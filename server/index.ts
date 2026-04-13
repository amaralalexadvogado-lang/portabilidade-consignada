import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL    = "https://api.wts.chat";
const TOKEN       = process.env.VENDITORE_TOKEN || "pn_fVCtCCZUE4t8cmATvqG9eUql6oOsm7MMeTmF5ItOg4";
const INSTANCE_ID = process.env.VENDITORE_INSTANCE_ID || "2e7e4573-106b-4556-914e-c384c29ce1e4";
const TEST_PHONE  = process.env.TEST_PHONE || "5511952756127";

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

async function attempt(phone: string, message: string): Promise<any> {
  const formatted = formatPhone(phone);
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TOKEN}`,
  };

  // Tenta diferentes formatos de payload aceitos pela Venditore
  const payloads = [
    { instanceId: INSTANCE_ID, to: formatted, content: message },
    { instanceId: INSTANCE_ID, phone: formatted, message },
    { instanceId: INSTANCE_ID, phone: formatted, text: message },
  ];

  const endpoints = [
    "/v1/message/text",
    "/v1/message/send-text",
    "/message/send-text",
  ];

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json() as any;
        console.log(`[Venditore] ✅ Enviado → ${formatted} (${endpoint})`);
        return { success: true, messageId: data?.id || data?.messageId || "ok" };
      }
      const status = res.status;
      if (status === 404) continue; // tenta próximo endpoint
      if (status === 400) continue; // tenta próximo payload
      const err = await res.text();
      throw new Error(`${status}: ${err}`);
    }
  }
  throw new Error("Nenhum endpoint/payload funcionou na Venditore");
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
  const result = await sendWhatsAppMessage(
    TEST_PHONE,
    "✅ *Conexão Venditore OK!*\nSistema Crédito Já funcionando. 🙏"
  );
  return {
    success: result.success,
    message: result.success
      ? `Enviado! ID: ${result.messageId}`
      : `Falha: ${result.error}`,
  };
}
