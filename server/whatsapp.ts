import * as dotenv from "dotenv";
dotenv.config();

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F0F77FB7F735150F1D5BA665B49BD70";
const TOKEN = process.env.ZAPI_TOKEN || "D2DE9E7E30489E0552A2B8B6";
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F11cb8ecb6d934af1a2d2f801b86b00fdS";

const BASE_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`;

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const digits = phone.replace(/\D/g, "");
  const formatted = digits.startsWith("55") ? digits : "55" + digits;
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
  const phone = process.env.TEST_PHONE || "5511952756127";
  const result = await sendWhatsAppMessage(phone, "✅ *Conexão Z-API OK!*\nSistema Crédito Já funcionando. 🙏");
  return {
    success: result.success,
    message: result.success ? `Enviado! ID: ${result.messageId}` : `Falha: ${result.error}`,
  };
}
