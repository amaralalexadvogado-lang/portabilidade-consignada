import * as XLSX from "xlsx";
import { db } from "./db";
import { clients } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, "");
}

// Busca campo em um row pelo nome (case-insensitive, sem acentos)
function getField(row: Record<string, any>, ...keys: string[]): string {
  const normalized: Record<string, string> = {};
  for (const k of Object.keys(row)) normalized[norm(k)] = k;
  for (const k of keys) {
    const orig = normalized[norm(k)];
    if (orig && row[orig] !== undefined && String(row[orig]).trim()) {
      return String(row[orig]).trim();
    }
  }
  return "";
}

function cleanPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  const c = d.startsWith("55") ? d.slice(2) : d;
  if (c.length < 10 || c.length > 11) return "";
  return "55" + c;
}

// Mapeamento de status da planilha para status do sistema
function mapStatus(raw: string): string {
  const s = raw.toUpperCase().trim();
  if (s.includes("AGUARDA RETORNO")) return "aguarda_retorno_saldo";
  if (s.includes("AGUARDA DESBLOQUEIO") || s.includes("DESBLOQUEIO")) return "aguarda_desbloqueio";
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
  if (!obs) return "";
  const m = obs.match(/https?:\/\/\S+/);
  return m ? m[0] : "";
}

// Prioridade de status para deduplicação por CPF (maior = mais importante)
const STATUS_PRIORITY: Record<string, number> = {
  aguarda_retorno_saldo: 10,
  aguarda_desbloqueio: 9,
  pendente_formalizacao: 8,
  aprovado: 3,
  cancelado: 0,
};

function getPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 0;
}

export async function processUpload(buffer: Buffer): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  let inserted = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  // Agrupa por CPF e pega a linha mais importante de cada cliente
  const byCpf = new Map<string, Record<string, any>>();

  for (const row of rows) {
    // ── Mapeamento de colunas da planilha ──────────────────────────────────
    // A planilha tem colunas fora de ordem — testamos múltiplos nomes possíveis

    // Nome do cliente: pode estar em "VALOR OPERAÇÃO" ou "nome"/"cliente"
    const name = getField(row,
      "VALOR OPERAÇÃO", "VALOR OPERACAO", "nome", "name", "cliente", "beneficiario", "beneficiário"
    );

    // CPF: pode estar em "PRODUTO" ou "cpf"/"documento"
    const cpfRaw = getField(row,
      "PRODUTO", "cpf", "documento", "CPF"
    );

    // Número da proposta: pode estar em "BANCO" ou "proposta"
    const proposta = getField(row,
      "BANCO", "proposta", "num proposta", "nº proposta", "numero proposta", "PROPOSTA_NUM"
    );

    // Banco: pode estar em "DATA ATUALIZAÇÃO" ou "banco"
    const banco = getField(row,
      "DATA ATUALIZAÇÃO", "DATA ATUALIZACAO", "banco", "bank", "instituição", "instituicao"
    );

    // Status do cliente: pode estar em "TELEFONES" ou "status"/"situação"
    const statusRaw = getField(row,
      "TELEFONES", "status", "situacao", "situação", "STATUS_CLIENTE"
    );

    // OBS com PREVISÃO e link: pode estar em "OBS.1" ou "obs"/"observação"
    const obs = getField(row,
      "OBS.1", "OBS1", "observacao 2", "obs", "observação", "observacoes", "notes", "OBS"
    );

    // Telefone: pode estar em "TELEFONES.1" ou "telefone"/"celular"
    const phoneRaw = getField(row,
      "TELEFONES.1", "TELEFONE1", "telefone 2", "telefone", "phone", "celular", "whatsapp", "fone"
    );

    // Nome do corretor/operador: coluna "PROPOSTA" (nome do corretor que fechou)
    const operatorName = getField(row,
      "PROPOSTA", "corretor", "operador", "agente", "vendedor"
    );

    // ── Validação ──────────────────────────────────────────────────────────
    if (!name || name.length < 2) { skipped++; continue; }

    const cpf = cpfRaw.replace(/\D/g, "");
    if (!cpf || cpf.length < 8) { skipped++; continue; }

    const status = mapStatus(statusRaw || "");
    const phone = phoneRaw ? cleanPhone(phoneRaw) : "";
    const returnDate = extractDate(obs);
    const formalizacaoLink = extractLink(obs);

    const rowData = {
      name,
      cpf,
      proposta,
      banco,
      status,
      phone: phone || null,
      returnDate,
      formalizacaoLink: formalizacaoLink || null,
      operatorName: operatorName || null,
      statusPriority: getPriority(status),
      hasPhone: !!phone,
      hasDate: !!returnDate,
    };

    // Deduplicação por CPF: mantém a linha mais importante
    const existing = byCpf.get(cpf);
    if (!existing) {
      byCpf.set(cpf, rowData);
    } else {
      // Troca se: maior prioridade, ou mesma prioridade mas tem telefone/data
      const existingPriority = existing.statusPriority;
      const newPriority = rowData.statusPriority;
      if (
        newPriority > existingPriority ||
        (newPriority === existingPriority && !existing.hasPhone && rowData.hasPhone) ||
        (newPriority === existingPriority && !existing.hasDate && rowData.hasDate)
      ) {
        byCpf.set(cpf, rowData);
      }
    }
  }

  // Upsert no banco
  for (const [cpf, data] of byCpf.entries()) {
    try {
      const existing = await db
        .select()
        .from(clients)
        .where(eq(clients.cpf, cpf))
        .limit(1);

      const values = {
        name: data.name,
        cpf,
        phone: data.phone,
        proposta: data.proposta || null,
        banco: data.banco || null,
        status: data.status as any,
        expectedReturnDate: data.returnDate,
        notes: null,
        formalizacaoLink: data.formalizacaoLink,
        operatorName: data.operatorName,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(clients).set(values).where(eq(clients.cpf, cpf));
        updated++;
      } else {
        await db.insert(clients).values({ ...values, createdAt: new Date() });
        inserted++;
      }
    } catch (e: any) {
      errors.push(`CPF ${cpf}: ${e.message}`);
    }
  }

  return { inserted, updated, skipped, errors };
}
