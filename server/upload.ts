import * as XLSX from "xlsx";
import { db } from "./db.js";
import { clients } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { detectGender } from "./messages.js";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, "");
}

function getField(row: Record<string, any>, ...keys: string[]): string {
  const normalized: Record<string, string> = {};
  for (const k of Object.keys(row)) normalized[norm(k)] = k;
  for (const k of keys) {
    const orig = normalized[k];
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

function mapStatus(raw: string): string {
  const v = norm(raw);
  if (v.includes("retorno") || v.includes("saldo")) return "aguarda_retorno_saldo";
  if (v.includes("desbloqueio")) return "aguarda_desbloqueio";
  if (v.includes("formaliz")) return "pendente_formalizacao";
  if (v.includes("aprovad")) return "aprovado";
  if (v.includes("cancelad")) return "cancelado";
  return "aguarda_retorno_saldo";
}

function extractDate(obs: string): Date | null {
  const m = obs.match(/PREVIS[AÃ]O\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!m) return null;
  const [d, mo, y] = m[1].split("/");
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function extractLink(obs: string): string | null {
  const m = obs.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

export async function processUpload(
  buffer: Buffer
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];

  let inserted = 0, updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const name = getField(row, "nome", "name", "cliente", "beneficiario");
      if (!name) continue;

      const phone = cleanPhone(getField(row, "telefone", "phone", "celular", "whatsapp", "fone"));
      const cpf = getField(row, "cpf", "documento");
      const proposta = getField(row, "proposta", "numeroproposta", "numproposta");
      const banco = getField(row, "banco", "bank", "instituicao");
      const statusRaw = getField(row, "status", "situacao");
      const notes = getField(row, "obs", "observacao", "observacoes", "notes");

      const gender = detectGender(name);
      const returnDate = notes ? extractDate(notes) : null;
      const formLink = notes ? extractLink(notes) : null;
      const status = statusRaw ? mapStatus(statusRaw) : "aguarda_retorno_saldo";

      const data: any = {
        name,
        phone: phone || null,
        cpf: cpf || null,
        proposta: proposta || null,
        banco: banco || null,
        status,
        gender,
        expectedReturnDate: returnDate || null,
        notes: notes || null,
        formalizacaoLink: formLink || null,
        updatedAt: new Date(),
      };

      if (cpf) {
        const existing = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.cpf, cpf))
          .limit(1);
        if (existing.length > 0) {
          await db.update(clients).set(data).where(eq(clients.id, existing[0].id));
          updated++;
          continue;
        }
      }

      await db.insert(clients).values({ ...data, active: true, createdAt: new Date() });
      inserted++;
    } catch (err: any) {
      errors.push(`Linha ${i + 2}: ${err.message}`);
    }
  }

  return { inserted, updated, errors };
}
