import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL   = process.env.VENDITORE_BASE_URL   || "https://api.wts.chat";
const TOKEN      = process.env.VENDITORE_TOKEN      || "";
const CHANNEL_ID = process.env.VENDITORE_CHANNEL_ID || "";
const TEST_PHONE = process.env.TEST_PHONE           || "5511952756127";

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

async function attempt(phone: string, message: string): Promise<any> {
  const formatted = formatPhone(phone);
  const payload = { channelId: CHANNEL_ID, phone: formatted, message, text: message };
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` };
  for (const endpoint of ["/v1/message/send-text", "/message/send-text"]) {
    const res = await fetch(`${BASE_URL}${endpoint}`, { method: "POST", headers, body: JSON.stringify(payload) });
    if (res.ok) {
      const data = await res.json() as any;
      console.log(`[Venditore] ✅ Enviado → ${formatted}`);
      return { success: true, messageId: data?.id || data?.messageId || "ok" };
    }
    if (res.status !== 404) {
      const err = await res.text();
      throw new Error(`${res.status}: ${err}`);
    }
  }
  throw new Error("Endpoint não encontrado na Venditore");
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!TOKEN)      return { success: false, error: "VENDITORE_TOKEN não configurado" };
  if (!CHANNEL_ID) return { success: false, error: "VENDITORE_CHANNEL_ID não configurado" };
  try {
    return await attempt(phone, message);
  } catch (err: any) {
    console.warn(`[Venditore] ⚠️ Falha, retentando em 3s → ${phone}: ${err.message}`);
    await new Promise(r => setTimeout(r, 3000));
    try {
      const result = await attempt(phone, message);
      console.log(`[Venditore] 🔁 Retry OK → ${phone}`);
      return result;
    } catch (err2: any) {
      console.error(`[Venditore] ❌ Falha final → ${phone}: ${err2.message}`);
      return { success: false, error: err2.message };
    }
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const result = await sendWhatsAppMessage(TEST_PHONE, "✅ *Conexão Venditore OK!*\nSistema Crédito Já funcionando. 🙏");
  return {
    success: result.success,
    message: result.success ? `Enviado para ${TEST_PHONE}! ID: ${result.messageId}` : `Falha: ${result.error}`,
  };
}
