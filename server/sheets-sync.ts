// server/sheets-sync.ts
import { db } from "./db.js";
import { clients } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { detectGender } from "./messages.js";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1QZNIROr-CG3d61sZQnGefDZ9D4yLVfMiuOsHi_jk_58";

function getSheetCsvUrl(sheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
}

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
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (local.length < 10 || local.length > 11) return "";
  return "55" + local;
}

function cleanCpf(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

function mapStatus(raw: string): string | null {
  const v = norm(raw);

  // Aguarda retorno de saldo e variações
  if (v.includes("aguardaretorno") || v.includes("aguardapagamento") || v.includes("aguardaaverbacao") || v.includes("aguardaaverbaçao")) return "aguarda_retorno_saldo";

  // Aguarda desbloqueio — inclui "AGUARDA DESBLOQUEIO DE BEN"
  if (v.includes("aguardadesbloqueio") || v.includes("desbloqueio")) return "aguarda_desbloqueio";

  // Pendente de formalização
  if (v.includes("pendentedeformalizacao") || v.includes("pendenteformalizacao") || v.includes("pendentedeformaliz") || v.includes("pendentedocumento") || v.includes("pendentedeemail") || v.includes("pendentedoc") || v.includes("pendenteemail")) return "pendente_formalizacao";

  // Aprovado / pago
  if (v === "pago" || v.includes("aprovad")) return "aprovado";

  // Ignorados
  if (v.includes("reprovad") || v.includes("cancelad") || v.includes("naoencont") || v.includes("proposta") || v === "-" || v === "") return null;

  return null;
}

function extractDate(obs: string): Date | null {
  const m = obs.match(/PREVIS[AÃ]O\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!m) return null;
  const [d, mo, y] = m[1].split("/");
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(date.getTime())) return null;
  return date;
}

function extractLink(obs: string): string | null {
  const m = obs.match(/https?:\/\/[^\s,]+/);
  return m ? m[0] : null;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.every((v) => !v.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || "").trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ && line[i + 1] === '"' ? (cur += '"', i++) : (inQ = !inQ); }
    else if (c === "," && !inQ) { result.push(cur); cur = ""; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  lastSync: Date;
}

let lastSyncResult: SyncResult | null = null;
export function getLastSyncResult() { return lastSyncResult; }

export async function syncFromGoogleSheets(): Promise<SyncResult> {
  console.log("[Sheets Sync] 🔄 Iniciando sincronização...");

  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, errors: [], lastSync: new Date() };

  try {
    const res = await fetch(getSheetCsvUrl(SHEET_ID), {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      if (res.status === 403) {
        result.errors.push("Planilha não está pública. Acesse Compartilhar → Qualquer pessoa com o link → Leitor.");
      } else {
        result.errors.push(`Erro HTTP ${res.status} ao acessar planilha.`);
      }
      lastSyncResult = result;
      return result;
    }

    const csv = await res.text();
    const rows = parseCsv(csv);
    console.log(`[Sheets Sync] 📊 ${rows.length} linhas na planilha`);

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        const name      = getCol(row, "NOME", "nome");
        const cpfRaw    = getCol(row, "CPF", "cpf");
        const phoneRaw  = getCol(row, "TELEFONE", "telefone", "fone", "celular");
        const proposta  = getCol(row, "PROPOSTA", "proposta");
        const banco     = getCol(row, "BANCO", "banco");
        const statusRaw = getCol(row, "STATUS", "status", "situacao", "SITUAÇÃO");
        const obs       = getCol(row, "OBS", "obs", "observacao", "OBSERVAÇÕES");
        const vendedor  = getCol(row, "VENDEDOR", "vendedor", "consultor", "atendente");

        if (!name || name.length < 2) { result.skipped++; continue; }

        const status = mapStatus(statusRaw);
        if (!status) { result.skipped++; continue; }

        const phone      = cleanPhone(phoneRaw);
        const cpf        = cleanCpf(cpfRaw);
        const gender     = detectGender(name);
        const returnDate = obs ? extractDate(obs) : null;
        const formLink   = obs ? extractLink(obs) : null;

        if (!phone) { result.skipped++; continue; }

        const data: any = {
          name,
          phone,
          cpf: cpf || null,
          proposta: proposta || null,
          banco: banco || null,
          status,
          gender,
          expectedReturnDate: returnDate || null,
          notes: obs || null,
          formalizacaoLink: formLink || null,
          vendedor: vendedor || null,
          updatedAt: new Date(),
        };

        let existingId: number | null = null;

        if (cpf && cpf.length === 11) {
          const found = await db.select({ id: clients.id }).from(clients).where(eq(clients.cpf, cpf)).limit(1);
          if (found.length > 0) existingId = found[0].id;
        }

        if (!existingId && phone) {
          const found = await db.select({ id: clients.id }).from(clients).where(eq(clients.phone, phone)).limit(1);
          if (found.length > 0) existingId = found[0].id;
        }

        if (existingId) {
          const [cur] = await db.select().from(clients).where(eq(clients.id, existingId)).limit(1);
          const upd: any = { ...data };
          if (cur?.formalizacaoConcluida) delete upd.formalizacaoConcluida;
          if (cur?.desbloqueoConcluido)   delete upd.desbloqueoConcluido;
          if (cur?.hasReplied)            delete upd.hasReplied;
          await db.update(clients).set(upd).where(eq(clients.id, existingId));
          result.updated++;
        } else {
          await db.insert(clients).values({
            ...data,
            active: true,
            formalizacaoConcluida: false,
            desbloqueoConcluido: false,
            hasReplied: false,
            createdAt: new Date(),
          });
          result.inserted++;
        }
      } catch (err: any) {
        result.errors.push(`Linha ${i + 2}: ${err.message}`);
      }
    }

    console.log(`[Sheets Sync] ✅ Novo: ${result.inserted} | Atualizado: ${result.updated} | Ignorado: ${result.skipped} | Erro: ${result.errors.length}`);
  } catch (err: any) {
    result.errors.push(`Erro geral: ${err.message}`);
    console.error("[Sheets Sync] ❌", err.message);
  }

  lastSyncResult = result;
  return result;
}
