// server/webhook.ts
// Endpoint HTTP que recebe os webhooks da Z-API quando um cliente responde.
// Detecta intenção, atualiza o cliente e PARA os disparos automáticos.

import type { Request, Response, Express } from "express";
import { eq, or } from "drizzle-orm";
import { db } from "./db";                       // ajuste se seu db estiver em outro caminho
import { clients, messageLogs } from "./schema"; // ajuste se seu schema estiver em outro caminho
import { detectAllIntents } from "./intent-detector";

// Payload típico do Z-API "ao receber mensagem"
interface ZapiIncomingPayload {
  phone?: string;             // telefone com DDI, ex: 5511999999999
  fromMe?: boolean;           // true = mensagem ENVIADA por nós (ignorar)
  isGroup?: boolean;          // true = grupo (ignorar)
  type?: string;              // ex: "ReceivedCallback"
  messageId?: string;
  momment?: number;           // timestamp em ms (Z-API escreve assim mesmo)
  text?: { message?: string };
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function phoneVariants(phone: string): string[] {
  const digits = normalizePhone(phone);
  const without55 = digits.startsWith("55") ? digits.slice(2) : digits;
  const with55 = digits.startsWith("55") ? digits : `55${digits}`;
  return Array.from(new Set([digits, without55, with55]));
}

export function registerWebhookRoutes(app: Express) {
  app.post("/api/webhook/zapi", async (req: Request, res: Response) => {
    try {
      const payload = req.body as ZapiIncomingPayload;

      // 1) Filtros básicos
      if (!payload || payload.fromMe === true || payload.isGroup === true) {
        return res.status(200).json({ ok: true, ignored: "fromMe_or_group" });
      }
      if (payload.type && payload.type !== "ReceivedCallback") {
        return res.status(200).json({ ok: true, ignored: `type_${payload.type}` });
      }

      const phone = payload.phone;
      const text = payload.text?.message ?? "";
      if (!phone) {
        return res.status(200).json({ ok: true, ignored: "no_phone" });
      }

      // 2) Localiza o cliente pelo telefone (tenta variantes com/sem 55)
      const variants = phoneVariants(phone);
      const found = await db
        .select()
        .from(clients)
        .where(or(...variants.map((v) => eq(clients.phone, v))))
        .limit(1);

      const client = found[0];

      // 3) Loga a mensagem recebida (mesmo se cliente não foi achado)
      await db.insert(messageLogs).values({
        clientId: client?.id ?? null,
        phone: normalizePhone(phone),
        direction: "inbound",
        status: "received",
        content: text,
        zapiMessageId: payload.messageId ?? null,
        sentAt: new Date(payload.momment ?? Date.now()),
      } as any);

      if (!client) {
        console.log(`[webhook/zapi] cliente não encontrado para o telefone ${phone}`);
        return res.status(200).json({ ok: true, ignored: "client_not_found" });
      }

      // 4) Detecta intenção
      const intents = detectAllIntents(text);
      console.log(`[webhook/zapi] cliente ${client.id} (${client.name}) — intents:`, intents, "— texto:", text);

      // 5) Monta as atualizações
      const updates: Record<string, any> = {
        lastResponseAt: new Date(),
        lastResponseText: text.slice(0, 500),
      };

      if (intents.signed) {
        updates.signedLinkAt = new Date();
        if (client.status === "pendente_formalizacao") {
          updates.status = "aguarda_desbloqueio";
        }
      }

      if (intents.unlocked) {
        updates.unlockedAt = new Date();
        if (client.status === "aguarda_desbloqueio") {
          updates.status = "aprovado";
        }
      }

      if (intents.approved) {
        updates.status = "aprovado";
        updates.approvedAt = new Date();
      }

      await db.update(clients).set(updates).where(eq(clients.id, client.id));

      return res.status(200).json({
        ok: true,
        clientId: client.id,
        intents,
        statusAfter: updates.status ?? client.status,
      });
    } catch (err) {
      console.error("[webhook/zapi] erro:", err);
      // Sempre responde 200 pra Z-API não ficar reenviando.
      return res.status(200).json({ ok: false, error: "internal" });
    }
  });
}
