import cron from "node-cron";
import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { clients, messageLogs } from "../drizzle/schema.js";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { buildMessage, getDaysUntilReturn, msgTransferirSetor, msgMensagemAutomatica, msgNumeroErrado, msgDesbloqueioConfirmado, msgFormalizacaoConfirmada, msgPersuasao } from "./messages.js";
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

// ── Keywords expandidas ───────────────────────────────────────────────────────

// Confirmação genérica de conclusão: "sim", "ok", "deu certo", "feito", etc.
// ATENÇÃO: estas palavras sozinhas são ambíguas — usamos contexto do status do cliente
const KW_CONFIRMACAO_GENERICA = [
  "sim","ok","certo","feito","pronto","ja fiz","ja fiz hoje","fiz hoje","fiz hoje pela manha",
  "fiz hoje de manha","fiz esta manha","fiz agora","ja realizei","ja concluí","concluido",
  "deu certo","deu","ta feito","ta pronto","ja ta","ja esta","esta feito","esta pronto",
  "ja está","esta ok","to ok","tudo certo","tudo ok","pode ser","pode","claro","com certeza",
];

const KW_DESBLOQUEIO = [
  "ja desbloqueei","ja liberei","ja fiz la inss","ja fiz no aplicativo","desbloquiei",
  "desbloqueei","esta feito","ja esta certo","ja liberou","fiz o desbloqueio","liberei",
  "desbloqueado","fiz la","fiz no inss","fiz no app","liberado","fiz no meu inss",
  "ja realizei","realizado","ja realizei o desbloqueio","desbloqueio feito","desbloqueio ok",
  "beneficio liberado","beneficio desbloqueado","ja desbloqueou","ja esta liberado",
  "ja esta desbloqueado","pronto o desbloqueio","esta pronto o desbloqueio",
  "ja esta pronto","ja fiz o desbloqueio","fiz o desbloqueio hoje",
];

const KW_FORMALIZACAO = [
  "ja formalizei","ja assinei","assinei","ja assine","assinatura feita","ja finalizei",
  "finalizei","ja fiz a assinatura","ja realizei a assinatura","assinatura concluida",
  "contrato assinado","ja assinar","sim assinei","assino","assinar feito",
  "ja fiz a formalizacao","formalizei","formalizado","ja assinei o contrato",
  "assinei o link","cliquei no link","ja cliquei","ja acessei o link","assinei la",
  "ja fiz la","ja fiz tudo","tudo assinado","ja assinou","assinou",
];

const KW_RECUSA = [
  "nao quero","nao tenho interesse","desisto","cancela","cancelar","cancelado",
  "nao vou fazer","nao quero mais","desisti","mudei de ideia","nao quero continuar",
  "deixa pra la","esquece","nao preciso","nao vou","nao to interessado",
  "nao estou interessado","pode cancelar","quero cancelar","nao vou mais fazer",
];

const KW_AJUDA = [
  "nao consigo","nao estou conseguindo","preciso de ajuda","nao sei como","como faco",
  "nao entendo","dificuldade","me ajuda","me ajude","como desbloquear","nao encontro",
  "como faz","nao to conseguindo","nao sei","me explica","onde fica","como acesso",
  "nao acho","nao funciona","erro","nao ta funcionando","ajuda","me orienta",
  "pode ajudar","precisando de ajuda","nao aparece","nao abre","nao carrega",
];

const KW_NUMERO_ERRADO = [
  "nao sou eu","numero errado","engano","quem e voce","nao fiz nada","nao tenho",
  "nao conheco","nao sei do que se trata","quem fala","nao e meu","esse numero nao e meu",
  "voce errou","ligacao errada","mensagem errada","nao fiz portabilidade",
  "nunca fiz isso","nao fiz nenhum emprestimo","quem e esse",
];

// ── Handler de mensagens recebidas ────────────────────────────────────────────
export async function handleIncomingMessage(phone: string, text: string): Promise<void> {
  const cleaned = phone.replace(/\D/g, "");
  const formatted = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;

  const rows = await db.select().from(clients).where(and(eq(clients.active, true), eq(clients.phone, formatted))).limit(1);

  if (!rows.length) {
    console.log(`[Webhook] Número não cadastrado: ${formatted}`);
    return;
  }

  const c = rows[0];
  console.log(`[Webhook] ${c.name} (${formatted}) [${c.status}]: "${text.slice(0, 80)}"`);

  // 1. Número errado — prioridade máxima
  if (has(text, KW_NUMERO_ERRADO)) {
    await db.update(clients).set({ active: false, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgNumeroErrado(c));
    return;
  }

  // 2. Recusa → persuasão
  if (has(text, KW_RECUSA)) {
    await db.update(clients).set({ hasReplied: true, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgPersuasao(c));
    return;
  }

  // 3. Formalização confirmada
  if (has(text, KW_FORMALIZACAO)) {
    await db.update(clients).set({ formalizacaoConcluida: true, hasReplied: true, status: "aprovado", updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgFormalizacaoConfirmada(c));
    return;
  }

  // 4. Desbloqueio confirmado
  if (has(text, KW_DESBLOQUEIO)) {
    await db.update(clients).set({
      desbloqueoConcluido: true,
      hasReplied: true,
      status: c.formalizacaoLink && !c.formalizacaoConcluida ? "pendente_formalizacao" : c.status,
      updatedAt: new Date()
    }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgDesbloqueioConfirmado(c));
    return;
  }

  // 5. Confirmação genérica — interpreta pelo status atual do cliente
  if (has(text, KW_CONFIRMACAO_GENERICA)) {
    if (c.status === "pendente_formalizacao") {
      // Cliente no status de formalização confirmando → marca como assinado
      await db.update(clients).set({ formalizacaoConcluida: true, hasReplied: true, status: "aprovado", updatedAt: new Date() }).where(eq(clients.id, c.id));
      await sendWhatsAppMessage(c.phone!, msgFormalizacaoConfirmada(c));
      return;
    }
    if (c.status === "aguarda_desbloqueio" || c.status === "aguarda_retorno_saldo") {
      // Cliente confirmando desbloqueio
      await db.update(clients).set({
        desbloqueoConcluido: true,
        hasReplied: true,
        status: c.formalizacaoLink && !c.formalizacaoConcluida ? "pendente_formalizacao" : c.status,
        updatedAt: new Date()
      }).where(eq(clients.id, c.id));
      await sendWhatsAppMessage(c.phone!, msgDesbloqueioConfirmado(c));
      return;
    }
    // Para outros status: apenas marca hasReplied e para envios
    await db.update(clients).set({ hasReplied: true, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgFormalizacaoConfirmada(c));
    return;
  }

  // 6. Pedido de ajuda
  if (has(text, KW_AJUDA)) {
    await db.update(clients).set({ hasReplied: true, updatedAt: new Date() }).where(eq(clients.id, c.id));
    await sendWhatsAppMessage(c.phone!, msgTransferirSetor(c));
    return;
  }

  // 7. Qualquer outra mensagem — resposta automática + marca hasReplied
  await db.update(clients).set({ hasReplied: true, updatedAt: new Date() }).where(eq(clients.id, c.id));
  await sendWhatsAppMessage(c.phone!, msgMensagemAutomatica());
}

// ── Disparos ─────────────────────────────────────────────────────────────────

export async function dispatchPeriod(period: "morning" | "afternoon") {
  if (!isWeekday()) return;
  const today = new Date().toISOString().split("T")[0];
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
  const falhas = logs.filter(l => new Date(l.sentAt || 0) >= today && l.status === "failed").length;
  const phone = process.env.REPORT_PHONE || "5511952756127";
  const msg = [
    `📊 *RELATÓRIO DIÁRIO — CRÉDITO JÁ*`,``,
    `*Retornos de saldo hoje (${retornoHoje.length}):*`,
    ...retornoHoje.map(c => `  • ${c.name} — ${c.proposta || "—"} (${(c as any).vendedor || "—"})`),``,
    `*Clientes que responderam:* ${all.filter(c => c.hasReplied).length}`,
    `*Clientes que desbloquearam:* ${all.filter(c => c.desbloqueoConcluido).length}`,
    `*Total ativos:* ${all.length}`,``,
    `✅ Enviados: ${enviados} | ❌ Falhas: ${falhas}`,``,
    `Fique com Deus. Operação rodando com sucesso. 🙏`,
  ].join("\n");
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
