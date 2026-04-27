// server/webhook.ts
// Endpoint HTTP que recebe os webhooks da Z-API quando um cliente responde.
// Detecta intenção, atualiza o cliente e PARA os disparos automáticos.

import type { Request, Response, Express } from "express";
import { eq, or } from "drizzle-orm";
import { db } from "./db";
import { clients, messageLogs } from "../drizzle/schema";
import { detectAllIntents } from "./intent-detector";

// Payload típico do Z-API "ao receber mensagem"
interface ZapiIncomingPayload {
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  type?: string;
  messageId?: string;
  momment?: number;
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

      // 1) Filtros: ignora mensagens enviadas por nós, grupos e callbacks de outro tipo
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

      if (!client) {
        console.log(`[webhook/zapi] cliente não encontrado para o telefone ${phone} — texto: "${text}"`);
        return res.status(200).json({ ok: true, ignored: "client_not_found" });
      }

      // 3) Loga a mensagem recebida
      const dispatchKey = payload.messageId
        ? `inbound_${payload.messageId}`
        : `inbound_${client.id}_${Date.now()}`;

      await db.insert(messageLogs).values({
        clientId: client.id,
        phone: normalizePhone(phone),
        message: text,
        messageType: "inbound_received",
        direction: "inbound",
        dispatchKey,
        zapiMessageId: payload.messageId ?? null,
        status: "received",
        attempts: 0,
        sentAt: new Date(payload.momment ?? Date.now()),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // 4) Detecta intenção
      const intents = detectAllIntents(text);
      console.log(
        `[webhook/zapi] cliente ${client.id} (${client.name}) — intents:`,
        intents,
        `— texto: "${text}"`
      );

      // 5) Monta as atualizações usando os campos REAIS do schema
      const updates: Record<string, any> = {
        hasReplied: true,
        lastResponseAt: new Date(),
        lastResponseText: text.slice(0, 500),
        updatedAt: new Date(),
      };

      if (intents.signed) {
        // Mesmo efeito do botão manual "Assinou o Link"
        updates.formalizacaoConcluida = true;
        if (client.status === "pendente_formalizacao") {
          updates.status = "aguarda_desbloqueio";
        }
      }

      if (intents.unlocked) {
        // Mesmo efeito do botão manual "Desbloqueou"
        updates.desbloqueoConcluido = true;
        if (client.status === "aguarda_desbloqueio") {
          updates.status = "aprovado";
        }
      }

      if (intents.approved) {
        updates.status = "aprovado";
        updates.formalizacaoConcluida = true;
        updates.desbloqueoConcluido = true;
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
      // Sempre responde 200 pra Z-API não ficar reenviando
      return res.status(200).json({ ok: false, error: "internal" });
    }
  });
}
