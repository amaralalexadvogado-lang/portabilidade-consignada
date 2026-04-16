import * as dotenv from "dotenv";
dotenv.config();

const INSTANCE_ID  = process.env.ZAPI_INSTANCE_ID  || "3F1BF1D45A3040748A36667E5D6D48C0";
const TOKEN        = process.env.ZAPI_TOKEN         || "D69E92226EAEA0D710827FA4";
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN  || "Fd30ad825715b44d8a25f5d591ea5de16S";
const BASE_URL     = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`;
const TEST_PHONE   = process.env.TEST_PHONE         || "5511952756127";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : "55" + digits;
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formatted = formatPhone(phone);
  try {
    const res = await fetch(`${BASE_URL}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": CLIENT_TOKEN,
      },
      body: JSON.stringify({ phone: formatted, message }),
    });
    const data = (await res.json()) as any;
    if (res.ok && data.zaapId) {
      console.log(`[Z-API] ✅ Enviado → ${formatted} | ID: ${data.zaapId}`);
      return { success: true, messageId: data.zaapId };
    }
    console.error(`[Z-API] ❌ Erro → ${formatted}:`, data);
    return { success: false, error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    console.error(`[Z-API] ❌ Rede:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const result = await sendWhatsAppMessage(
    TEST_PHONE,
    "✅ *Conexão OK!*\nSistema Crédito Já funcionando. 🙏"
  );
  return {
    success: result.success,
    message: result.success
      ? `Enviado! ID: ${result.messageId}`
      : `Falha: ${result.error}`,
  };
}
