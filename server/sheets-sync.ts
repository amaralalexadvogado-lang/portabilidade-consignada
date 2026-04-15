// server/sheets-sync.ts
import { db } from "./db";
import { clients, messageLogs, systemConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── ID DA PLANILHA ───────────────────────────────────────────────────────────
// Lê do banco (configurado na tela de Configurações) ou da variável de ambiente
async function getSheetId(): Promise<string> {
  try {
    const row = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "google_sheets_id"))
      .limit(1);
    if (row[0]?.value && row[0].value.length > 10) return row[0].value;
  } catch {}
  return process.env.GOOGLE_SHEET_ID || "1gMk_2DcWchCh8Q9mVtxjdYjzsT-ZzsbSgj1XP0HB578";
}

function getSheetCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[\s_\-\.]+/g, "");
}

function getCol(row: Record<string, string>, ...keys: string[]): string {
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[norm(k)] = k;
  for (const k of keys) {
    const orig = map[norm(k)];
    if (orig !== undefined && row[orig]?.trim()) return row[orig].trim();
  }
  return "";
}

function cleanPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length < 10 || local.length > 11) return "";
  return "55" + local;
}

function cleanCpf(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Mapeamento de status da planilha → status do sistema
function mapStatus(raw: string): string {
  const s = raw.toUpperCase().trim();
  if (s.includes("AGUARDA RETORNO")) return "aguarda_retorno_saldo";
  if (s.includes("DESBLOQUEIO") || s.includes("DESBLOQUEI")) return "aguarda_desbloqueio";
  if (s.includes("FORMALIZA")) return "pendente_formalizacao";
  if (s.includes("PAGO") || s.includes("APROVAD")) return "aprovado";
  return "cancelado";
}

// Extrai data de retorno do campo OBS (formato "PREVISÃO - DD/MM/YYYY")
function extractDate(obs: string): Date | null {
  if (!obs) return null;
  const m = obs.match(/PREVIS[AÃ]O\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!m) return null;
  try {
    return new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
  } catch {
    return null;
  }
}

// Extrai link de formalização do campo OBS
function extractLink(obs: string): string {
  const m = obs?.match(/https?:\/\/\S+/);
  return m ? m[0] : "";
}

// Prioridade de status (maior = mais importante)
const STATUS_PRIORITY: Record<string, number> = {
  aguarda_retorno_saldo: 10,
  aguarda_desbloqueio: 9,
  pendente_formalizacao: 8,
  aprovado: 3,
  cancelado: 0,
};

// ─── PARSER CSV ───────────────────────────────────────────────────────────────
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

// ─── RESULTADO DA SYNC ────────────────────────────────────────────────────────
export interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  lastSync: Date;
}

export async function getLastSyncResult(): Promise<SyncResult | null> {
  try {
    const row = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "last_sync_result"))
      .limit(1);
    if (row[0]?.value) return JSON.parse(row[0].value);
  } catch {}
  return null;
}

// ─── SINCRONIZAÇÃO PRINCIPAL ─────────────────────────────────────────────────
export async function syncFromGoogleSheets(): Promise<SyncResult> {
  const result: SyncResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    lastSync: new Date(),
  };

  console.log("[Sheets Sync] 🔄 Iniciando sincronização...");

  let sheetId: string;
  try {
    sheetId = await getSheetId();
  } catch (e: any) {
    result.errors.push("Erro ao buscar ID da planilha: " + e.message);
    return result;
  }

  // Baixa o CSV da planilha
  let csvText: string;
  try {
    const url = getSheetCsvUrl(sheetId);
    const resp = await fetch(url);
    if (!resp.ok) {
      result.errors.push(`Erro HTTP ${resp.status} ao acessar planilha.`);
      await saveSyncResult(result);
      return result;
    }
    csvText = await resp.text();
  } catch (e: any) {
    result.errors.push("Erro de rede: " + e.message);
    await saveSyncResult(result);
    return result;
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    result.errors.push("Planilha vazia ou sem dados.");
    await saveSyncResult(result);
    return result;
  }

  console.log(`[Sheets Sync] 📋 ${rows.length} linhas encontradas`);

  // ── Agrupa por CPF — pega a linha mais importante de cada cliente ──────────
  const byCpf = new Map<string, Record<string, string>>();

  for (const row of rows) {
    // Mapeamento de colunas da planilha da corretora:
    // "VALOR OPERAÇÃO" = nome do cliente
    // "PRODUTO" = CPF
    // "BANCO" = número da proposta
    // "DATA ATUALIZAÇÃO" = banco
    // "TELEFONES" = status do cliente
    // "OBS.1" = observação com PREVISÃO - DD/MM/YYYY
    // "TELEFONES.1" = telefone do cliente
    // "PROPOSTA" = nome do corretor/operador

    const name = getCol(row,
      "VALOR OPERAÇÃO", "VALOR OPERACAO", "nome", "name", "cliente", "beneficiario", "beneficiário"
    );
    const cpfRaw = getCol(row,
      "PRODUTO", "cpf", "documento", "CPF"
    );
    const cpf = cleanCpf(cpfRaw);

    if (!name || name.length < 2 || !cpf || cpf.length < 8) {
      result.skipped++;
      continue;
    }

    const proposta = getCol(row,
      "BANCO", "proposta", "num proposta", "nº proposta", "numero proposta"
    );
    const banco = getCol(row,
      "DATA ATUALIZAÇÃO", "DATA ATUALIZACAO", "banco", "bank", "instituição", "instituicao"
    );
    const statusRaw = getCol(row,
      "TELEFONES", "status", "situacao", "situação"
    );
    const obs = getCol(row,
      "OBS.1", "OBS1", "obs", "observação", "observacoes", "notes"
    );
    const phoneRaw = getCol(row,
      "TELEFONES.1", "TELEFONE1", "telefone", "phone", "celular", "whatsapp", "fone"
    );
    const vendedor = getCol(row,
      "PROPOSTA", "corretor", "operador", "agente", "vendedor"
    );

    const status = mapStatus(statusRaw);
    const phone = phoneRaw ? cleanPhone(phoneRaw) : "";
    const returnDate = extractDate(obs);
    const formalizacaoLink = extractLink(obs);
    const priority = STATUS_PRIORITY[status] ?? 0;

    const rowData = {
      _name: name,
      _cpf: cpf,
      _proposta: proposta,
      _banco: banco,
      _status: status,
      _phone: phone,
      _returnDate: returnDate ? returnDate.toISOString() : "",
      _formalizacaoLink: formalizacaoLink,
      _vendedor: vendedor,
      _priority: String(priority),
      _hasPhone: phone ? "1" : "0",
      _hasDate: returnDate ? "1" : "0",
    };

    const existing = byCpf.get(cpf);
    if (!existing) {
      byCpf.set(cpf, rowData);
    } else {
      const ep = Number(existing._priority);
      const np = Number(rowData._priority);
      if (
        np > ep ||
        (np === ep && existing._hasPhone === "0" && rowData._hasPhone === "1") ||
        (np === ep && existing._hasDate === "0" && rowData._hasDate === "1")
      ) {
        byCpf.set(cpf, rowData);
      }
    }
  }

  console.log(`[Sheets Sync] 👥 ${byCpf.size} clientes únicos após deduplicação`);

  // ── Upsert no banco ────────────────────────────────────────────────────────
  for (const [cpf, data] of byCpf.entries()) {
    try {
      const existing = await db
        .select()
        .from(clients)
        .where(eq(clients.cpf, cpf))
        .limit(1);

      const values = {
        name: data._name,
        cpf,
        phone: data._phone || null,
        proposta: data._proposta || null,
        banco: data._banco || null,
        status: data._status as any,
        expectedReturnDate: data._returnDate ? new Date(data._returnDate) : null,
        formalizacaoLink: data._formalizacaoLink || null,
        vendedor: data._vendedor || null,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        // Atualiza apenas se o novo dado for mais relevante
        const currentStatus = existing[0].status;
        const currentPriority = STATUS_PRIORITY[currentStatus ?? "cancelado"] ?? 0;
        const newPriority = STATUS_PRIORITY[data._status] ?? 0;

        // Sempre atualiza telefone e data se não tinha antes
        const shouldUpdate =
          newPriority >= currentPriority ||
          (!existing[0].phone && data._phone) ||
          (!existing[0].expectedReturnDate && data._returnDate);

        if (shouldUpdate) {
          await db.update(clients).set(values).where(eq(clients.cpf, cpf));
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await db.insert(clients).values({ ...values, createdAt: new Date() });
        result.inserted++;
      }
    } catch (e: any) {
      result.errors.push(`CPF ${cpf}: ${e.message}`);
    }
  }

  await saveSyncResult(result);

  console.log(
    `[Sheets Sync] ✅ Concluído — inseridos: ${result.inserted}, atualizados: ${result.updated}, pulados: ${result.skipped}, erros: ${result.errors.length}`
  );

  return result;
}

async function saveSyncResult(result: SyncResult): Promise<void> {
  try {
    await db
      .insert(systemConfig)
      .values({
        key: "last_sync_result",
        value: JSON.stringify(result),
        updatedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: { value: JSON.stringify(result), updatedAt: new Date() },
      });
  } catch {}
}
