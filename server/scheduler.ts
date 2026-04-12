import cron from "node-cron";
import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { clients, messageLogs } from "../drizzle/schema.js";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { buildMessage, getDaysUntilReturn } from "./messages.js";
import { syncFromGoogleSheets } from "./sheets-sync.js";

function isWeekday(): boolean {
  const d = new Date().getDay();
  return d >= 1 && d <= 5;
}

async function alreadySent(key: string): Promise<boolean> {
  const rows = await db
    .select({ id: messageLogs.id })
    .from(messageLogs)
    .where(eq(messageLogs.dispatchKey, key))
    .limit(1);
  return rows.length > 0;
}

async function saveLog(data: {
  clientId: number;
  phone: string;
  message: string;
  messageType: string;
  dispatchKey: string;
  success: boolean;
  error?: string;
  days: number;
}) {
  await db.insert(messageLogs).values({
    clientId: data.clientId,
    phone: data.phone,
    message: data.message,
    messageType: data.messageType,
    dispatchKey: data.dispatchKey,
    status: data.success ? "sent" : "failed",
    errorMessage: data.error || null,
    sentAt: new Date(),
    daysUntilReturn: data.days,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ── Disparos normais: 9h e 15h (apenas clientes com retorno > 0 dias) ────────
export async function dispatchPeriod(
  period: "morning" | "afternoon"
) {
  if (!isWeekday()) return;
  const today = new Date().toISOString().split("T")[0];
  console.log(`[Scheduler] Disparando: ${period} — ${today}`);

  const activeClients = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.active, true), eq(clients.status, "aguarda_retorno_saldo"))
    );

  for (const c of activeClients) {
    const days = getDaysUntilReturn(c.expectedReturnDate ?? null);

    // No dia do retorno (days <= 0): NÃO dispara aqui — será tratado pelo retorno_1h
    if (days <= 0) continue;

    const key = `${today}_${period}_c${c.id}`;
    if (await alreadySent(key)) continue;

    const msg = buildMessage(period, c, days);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({
      clientId: c.id,
      phone: c.phone || "",
      message: msg,
      messageType: period,
      dispatchKey: key,
      success: result.success,
      error: result.error,
      days,
    });
  }
  console.log(`[Scheduler] Concluído: ${period}`);
}

// ── Disparo do dia do retorno: a cada 1h das 9h às 17h ───────────────────────
// Substitui os disparos normais quando days === 0
// Para automaticamente quando o cliente marcar que desbloqueou (hasReplied = true)
export async function dispatchRetornoDia() {
  if (!isWeekday()) return;
  const now = new Date();
  const h = now.getHours();
  if (h < 9 || h >= 17) return;

  const today = now.toISOString().split("T")[0];
  const hStr = String(h).padStart(2, "0");

  console.log(`[Scheduler] Disparando: retorno_1h — ${today} ${hStr}h`);

  const activeClients = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.active, true), eq(clients.status, "aguarda_retorno_saldo"))
    );

  for (const c of activeClients) {
    const days = getDaysUntilReturn(c.expectedReturnDate ?? null);

    // Só dispara no dia do retorno (days === 0)
    if (days !== 0) continue;

    // Para automaticamente se cliente já confirmou desbloqueio
    if (c.hasReplied) continue;

    const key = `${today}_retorno_1h_${hStr}_c${c.id}`;
    if (await alreadySent(key)) continue;

    const msg = buildMessage("retorno_1h", c, 0);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({
      clientId: c.id,
      phone: c.phone || "",
      message: msg,
      messageType: "retorno_1h",
      dispatchKey: key,
      success: result.success,
      error: result.error,
      days: 0,
    });
  }
  console.log(`[Scheduler] Concluído: retorno_1h`);
}

// ── Formalização a cada 1h (8h–18h) ─────────────────────────────────────────
export async function dispatchFormalizacao() {
  if (!isWeekday()) return;
  const now = new Date();
  const h = now.getHours();
  if (h < 8 || h >= 18) return;

  const today = now.toISOString().split("T")[0];
  const hStr = String(h).padStart(2, "0");

  const pendentes = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.active, true),
        eq(clients.status, "pendente_formalizacao"),
        eq(clients.formalizacaoConcluida, false)
      )
    );

  for (const c of pendentes) {
    const key = `${today}_formalizacao_${hStr}_c${c.id}`;
    if (await alreadySent(key)) continue;
    const msg = buildMessage("formalizacao_1h", c, 0);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({ clientId: c.id, phone: c.phone || "", message: msg, messageType: "formalizacao_1h", dispatchKey: key, success: result.success, error: result.error, days: 0 });
  }
}

// ── Desbloqueio a cada 1h (8h–18h) ──────────────────────────────────────────
export async function dispatchDesbloqueio() {
  if (!isWeekday()) return;
  const now = new Date();
  const h = now.getHours();
  if (h < 8 || h >= 18) return;

  const today = now.toISOString().split("T")[0];
  const hStr = String(h).padStart(2, "0");

  const bloqueados = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.active, true),
        eq(clients.status, "aguarda_desbloqueio"),
        eq(clients.desbloqueoConcluido, false)
      )
    );

  for (const c of bloqueados) {
    const key = `${today}_desbloqueio_${hStr}_c${c.id}`;
    if (await alreadySent(key)) continue;
    const msg = buildMessage("desbloqueio_1h", c, 0);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({ clientId: c.id, phone: c.phone || "", message: msg, messageType: "desbloqueio_1h", dispatchKey: key, success: result.success, error: result.error, days: 0 });
  }
}

// ── Relatório diário (20h) ───────────────────────────────────────────────────
async function sendDailyReport() {
  if (!isWeekday()) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const all = await db.select().from(clients).where(eq(clients.active, true));
  const retornoHoje = all.filter((c) => getDaysUntilReturn(c.expectedReturnDate ?? null) === 0);

  const logs = await db.select().from(messageLogs);
  const enviados = logs.filter((l) => new Date(l.sentAt || 0) >= today && l.status === "sent").length;
  const falhas = logs.filter((l) => new Date(l.sentAt || 0) >= today && l.status === "failed").length;

  const phone = process.env.REPORT_PHONE || "5511952756127";
  const msg = [
    `📊 *RELATÓRIO DIÁRIO — CRÉDITO JÁ*`,
    ``,
    `• Retornos de saldo hoje: ${retornoHoje.length}`,
    ...retornoHoje.map((c) => `  - ${c.name}`),
    ``,
    `✅ Enviados hoje: ${enviados}`,
    `❌ Falhas hoje: ${falhas}`,
    ``,
    `Fique com Deus. Operação rodando com sucesso. 🙏`,
  ].join("\n");

  await sendWhatsAppMessage(phone, msg);
}

// ── Iniciar todos os cron jobs ───────────────────────────────────────────────
export function startScheduler() {
  console.log("[Scheduler] 🚀 Iniciando cron jobs (America/Sao_Paulo)...");

  // Disparos normais: 9h e 15h (apenas clientes com retorno > 0 dias)
  cron.schedule("0 9 * * 1-5", () => dispatchPeriod("morning"), { timezone: "America/Sao_Paulo" });
  cron.schedule("0 15 * * 1-5", () => dispatchPeriod("afternoon"), { timezone: "America/Sao_Paulo" });

  // Dia do retorno: a cada 1h das 9h às 17h
  cron.schedule("0 9-17 * * 1-5", () => dispatchRetornoDia(), { timezone: "America/Sao_Paulo" });

  // Formalização e desbloqueio: a cada 1h das 8h às 18h
  cron.schedule("0 8-18 * * 1-5", () => { dispatchFormalizacao(); dispatchDesbloqueio(); }, { timezone: "America/Sao_Paulo" });

  // Relatório diário: 20h
  cron.schedule("0 20 * * 1-5", () => sendDailyReport(), { timezone: "America/Sao_Paulo" });

  // Sync Google Sheets a cada 30min
  cron.schedule("*/30 * * * *", () => syncFromGoogleSheets(), { timezone: "America/Sao_Paulo" });

  // Sync imediato ao iniciar
  setTimeout(() => syncFromGoogleSheets(), 5000);

  console.log("[Scheduler] ✅ Todos os cron jobs registrados.");
  console.log("[Scheduler] 📋 Rotina do dia do retorno: a cada 1h das 9h às 17h.");
}
