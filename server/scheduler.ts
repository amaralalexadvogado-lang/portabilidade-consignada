import cron from "node-cron";
import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { clients, messageLogs } from "../drizzle/schema.js";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { buildMessage, getDaysUntilReturn, msgTransferirSetor, msgMensagemAutomatica, msgNumeroErrado, msgDesbloqueioConfirmado, msgFormalizacaoConfirmada } from "./messages.js";
import { syncFromGoogleSheets } from "./sheets-sync.js";

function isWeekday(): boolean {
  const d = new Date().getDay();
  return d >= 1 && d <= 5;
}

async function alreadySent(key: string): Promise<boolean> {
  const rows = await db.select({ id: messageLogs.id }).from(messageLogs).where(eq(messageLogs.dispatchKey, key)).limit(1);
  return rows.length > 0;
}

async function saveLog(data: { clientId: number; phone: string; message: string; messageType: string; dispatchKey: string; success: boolean; error?: string; days: number; }) {
  await db.insert(messageLogs).values({ clientId: data.clientId, phone: data.phone, message: data.message, messageType: data.messageType, dispatchKey: data.dispatchKey, status: data.success ? "sent" : "failed", errorMessage: data.error || null, sentAt: new Date(), daysUntilReturn: data.days, createdAt: new Date(), updatedAt: new Date() });
}

function norm(txt: string): string {
  return txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function has(txt: string, words: string[]): boolean {
  const n = norm(txt);
  return words.some(w => n.includes(w));
}

const KW_DESBLOQUEIO = ["ja desbloqueei","ja liberei","ja fiz la inss","ja fiz no aplicativo","desbloquiei","desbloqueei","ja fiz","esta feito","ja esta certo","ja liberou","fiz o desbloqueio","liberei","desbloqueado","fiz la","fiz no inss","fiz no app","liberado","fiz no meu inss","ja realizei","concluido","realizado","ja realizei o desbloqueio"];
const KW_FORMALIZACAO = ["ja formalizei","ja assinei","assinei","feito","concluido","ja assine","assinatura feita","ja finalizei","finalizei","ja fiz a assinatura","ja realizei a assinatura","assinatura concluida","contrato assinado","ja assinar","sim assinei","assino","assinar feito","ja fiz a formalizacao","formalizei","formalizado"];
const KW_AJUDA = ["nao consigo","nao estou conseguindo","preciso de ajuda","nao sei como","como faco","nao entendo","dificuldade","me ajuda","me ajude","como desbloquear","nao encontro","como faz","nao to conseguindo","nao sei","me explica","onde fica","como acesso","nao acho","nao funciona","erro","nao ta funcionando","ajuda","me orienta","pode ajudar","precisando de ajuda"];
const KW_NUMERO_ERRADO = ["nao sou eu","numero errado","engano","quem e voce","nao fiz nada","nao tenho","nao conheco","nao sei do que se trata","quem fala","nao e meu","esse numero nao e meu","voce errou","ligacao errada","mensagem errada","nao fiz portabilidade","nunca fiz isso","nao fiz nenhum emprestimo","quem e esse"];

export async function handleIncomingMessage(phone: string, text: string): Promise<void> {
  const cleaned = phone.replace(/\D/g, "");
  const rows = await db.select().from(clients).where(and(eq(clients.active, true), eq(clients.phone, cleaned.startsWith("55") ? cleaned : `55${cleaned}`))).limit(1);
  if (!rows.length) { console.log(`[Webhook] Número não cadastrado: ${cleaned}`); return; }
  const c = rows[0];
  console.log(`[Webhook] ${c.name} (${cleaned}): "${text.slice(0, 80)}"`);

  if (has(text, KW_NUMERO_ERRADO)) {
    await db.update(clients).set({ active: false, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgNumeroErrado(c));
    console.log(`[Webhook] ⛔ Número errado — ${c.name} inativado`);
    return;
  }
  if (has(text, KW_DESBLOQUEIO)) {
    await db.update(clients).set({ desbloqueoConcluido: true, hasReplied: true, status: c.formalizacaoLink && !c.formalizacaoConcluida ? "pendente_formalizacao" : c.status, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgDesbloqueioConfirmado(c));
    console.log(`[Webhook] ✅ Desbloqueio confirmado — ${c.name}`);
    return;
  }
  if (has(text, KW_FORMALIZACAO)) {
    await db.update(clients).set({ formalizacaoConcluida: true, hasReplied: true, status: "aprovado", updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgFormalizacaoConfirmada(c));
    console.log(`[Webhook] ✅ Formalização confirmada — ${c.name}`);
    return;
  }
  if (has(text, KW_AJUDA)) {
    await db.update(clients).set({ hasReplied: true, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgTransferirSetor(c));
    console.log(`[Webhook] 🆘 Ajuda solicitada — ${c.name}`);
    return;
  }
  await db.update(clients).set({ hasReplied: true, updatedAt: new Date() }).where(eq(clients.id, c.id));
  await sendWhatsAppMessage(c.phone!, msgMensagemAutomatica());
  console.log(`[Webhook] 💬 Resposta automática — ${c.name}`);
}

export async function dispatchPeriod(period: "morning" | "afternoon") {
  if (!isWeekday()) return;
  const today = new Date().toISOString().split("T")[0];
  console.log(`[Scheduler] Disparando: ${period} — ${today}`);
  const activeClients = await db.select().from(clients).where(and(eq(clients.active, true), eq(clients.status, "aguarda_retorno_saldo")));
  for (const c of activeClients) {
    const days = getDaysUntilReturn(c.expectedReturnDate ?? null);
    if (days <= 0) continue;
    const key = `${today}_${period}_c${c.id}`;
    if (await alreadySent(key)) continue;
    const msg = buildMessage(period, c, days);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({ clientId: c.id, phone: c.phone || "", message: msg, messageType: period, dispatchKey: key, success: result.success, error: result.error, days });
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`[Scheduler] Concluído: ${period}`);
}

export async function dispatchRetornoDia() {
  if (!isWeekday()) return;
  const now = new Date();
  const h = now.getHours();
  if (h < 9 || h >= 17) return;
  const today = now.toISOString().split("T")[0];
  const hStr = String(h).padStart(2, "0");
  const activeClients = await db.select().from(clients).where(and(eq(clients.active, true), eq(clients.status, "aguarda_retorno_saldo")));
  for (const c of activeClients) {
    const days = getDaysUntilReturn(c.expectedReturnDate ?? null);
    if (days !== 0) continue;
    if (c.hasReplied) continue;
    const key = `${today}_retorno_1h_${hStr}_c${c.id}`;
    if (await alreadySent(key)) continue;
    const msg = buildMessage("retorno_1h", c, 0);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({ clientId: c.id, phone: c.phone || "", message: msg, messageType: "retorno_1h", dispatchKey: key, success: result.success, error: result.error, days: 0 });
    await new Promise(r => setTimeout(r, 1500));
  }
}

export async function dispatchFormalizacao() {
  if (!isWeekday()) return;
  const now = new Date();
  const h = now.getHours();
  if (h < 8 || h >= 18) return;
  const today = now.toISOString().split("T")[0];
  const hStr = String(h).padStart(2, "0");
  const pendentes = await db.select().from(clients).where(and(eq(clients.active, true), eq(clients.status, "pendente_formalizacao"), eq(clients.formalizacaoConcluida, false)));
  for (const c of pendentes) {
    const key = `${today}_formalizacao_${hStr}_c${c.id}`;
    if (await alreadySent(key)) continue;
    const msg = buildMessage("formalizacao_1h", c, 0);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({ clientId: c.id, phone: c.phone || "", message: msg, messageType: "formalizacao_1h", dispatchKey: key, success: result.success, error: result.error, days: 0 });
    await new Promise(r => setTimeout(r, 1500));
  }
}

export async function dispatchDesbloqueio() {
  if (!isWeekday()) return;
  const now = new Date();
  const h = now.getHours();
  if (h < 8 || h >= 18) return;
  const today = now.toISOString().split("T")[0];
  const hStr = String(h).padStart(2, "0");
  const bloqueados = await db.select().from(clients).where(and(eq(clients.active, true), eq(clients.status, "aguarda_desbloqueio"), eq(clients.desbloqueoConcluido, false)));
  for (const c of bloqueados) {
    const key = `${today}_desbloqueio_${hStr}_c${c.id}`;
    if (await alreadySent(key)) continue;
    const msg = buildMessage("desbloqueio_1h", c, 0);
    const result = await sendWhatsAppMessage(c.phone || "", msg);
    await saveLog({ clientId: c.id, phone: c.phone || "", message: msg, messageType: "desbloqueio_1h", dispatchKey: key, success: result.success, error: result.error, days: 0 });
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function sendDailyReport() {
  if (!isWeekday()) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const all = await db.select().from(clients).where(eq(clients.active, true));
  const retornoHoje = all.filter(c => getDaysUntilReturn(c.expectedReturnDate ?? null) === 0);
  const logs = await db.select().from(messageLogs);
  const enviados = logs.filter(l => new Date(l.sentAt || 0) >= today && l.status === "sent").length;
  const falhas   = logs.filter(l => new Date(l.sentAt || 0) >= today && l.status === "failed").length;
  const phone = process.env.REPORT_PHONE || "5511952756127";
  const msg = [`📊 *RELATÓRIO DIÁRIO — CRÉDITO JÁ*`,``,`*Retornos de saldo hoje (${retornoHoje.length}):*`,...retornoHoje.map(c => `  • ${c.name} — ${c.proposta || "—"} (${(c as any).vendedor || "—"})`),``,`*Clientes que responderam:* ${all.filter(c => c.hasReplied).length}`,`*Clientes que desbloquearam:* ${all.filter(c => c.desbloqueoConcluido).length}`,`*Total ativos:* ${all.length}`,``,`✅ Enviados: ${enviados} | ❌ Falhas: ${falhas}`,``,`Fique com Deus. Operação rodando com sucesso. 🙏`].join("\n");
  await sendWhatsAppMessage(phone, msg);
}

export function startScheduler() {
  console.log("[Scheduler] 🚀 Iniciando cron jobs (America/Sao_Paulo)...");
  cron.schedule("0 9 * * 1-5",    () => dispatchPeriod("morning"),   { timezone: "America/Sao_Paulo" });
  cron.schedule("0 15 * * 1-5",   () => dispatchPeriod("afternoon"), { timezone: "America/Sao_Paulo" });
  cron.schedule("0 9-17 * * 1-5", () => dispatchRetornoDia(),        { timezone: "America/Sao_Paulo" });
  cron.schedule("0 8-18 * * 1-5", () => { dispatchFormalizacao(); dispatchDesbloqueio(); }, { timezone: "America/Sao_Paulo" });
  cron.schedule("0 20 * * 1-5",   () => sendDailyReport(),           { timezone: "America/Sao_Paulo" });
  cron.schedule("*/30 * * * *",   () => syncFromGoogleSheets(),      { timezone: "America/Sao_Paulo" });
  setTimeout(() => syncFromGoogleSheets(), 5000);
  console.log("[Scheduler] ✅ Todos os cron jobs registrados.");
}
