import { initTRPC } from "@trpc/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import superjson from "superjson";
import { z } from "zod";
import { clients, messageLogs, systemConfig } from "../drizzle/schema.js";
import { db } from "./db.js";
import { dispatchDesbloqueio, dispatchFormalizacao, dispatchPeriod } from "./scheduler.js";
import { testConnection } from "./whatsapp.js";
import { syncFromGoogleSheets, getLastSyncResult } from "./sheets-sync.js";

const t = initTRPC.create({ transformer: superjson });

export const appRouter = t.router({
  // Dashboard
  dashboard: t.procedure.query(async () => {
    const all = await db.select().from(clients).where(eq(clients.active, true));
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const logs = await db.select().from(messageLogs);
    const todayLogs = logs.filter((l) => new Date(l.sentAt || 0) >= today);

    return {
      total: all.length,
      aguardandoRetorno: all.filter((c) => c.status === "aguarda_retorno_saldo").length,
      retornoHoje: all.filter((c) => {
        if (!c.expectedReturnDate) return false;
        const d = new Date(c.expectedReturnDate); d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      }).length,
      aprovados: all.filter((c) => c.status === "aprovado").length,
      pendentesFormalizacao: all.filter((c) => c.status === "pendente_formalizacao").length,
      aguardandoDesbloqueio: all.filter((c) => c.status === "aguarda_desbloqueio").length,
      enviadosHoje: todayLogs.filter((l) => l.status === "sent").length,
      falhasHoje: todayLogs.filter((l) => l.status === "failed").length,
    };
  }),

  // Listar clientes
  listClients: t.procedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;
      const conds: any[] = [eq(clients.active, true)];

      if (input.status && input.status !== "all") {
        conds.push(eq(clients.status, input.status as any));
      }
      if (input.search) {
        conds.push(or(
          like(clients.name, `%${input.search}%`),
          like(clients.phone, `%${input.search}%`),
          like(clients.cpf, `%${input.search}%`)
        ));
      }

      const where = and(...conds);
      const rows = await db.select().from(clients).where(where)
        .orderBy(desc(clients.createdAt)).limit(input.limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(where);

      return { clients: rows, total: Number(count), page: input.page, limit: input.limit };
    }),

  // Buscar cliente por ID com logs
  getClient: t.procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [client] = await db.select().from(clients).where(eq(clients.id, input.id));
      const logs = await db.select().from(messageLogs)
        .where(eq(messageLogs.clientId, input.id))
        .orderBy(desc(messageLogs.createdAt));
      return { client, logs };
    }),

  // Atualizar cliente
  updateClient: t.procedure
    .input(z.object({
      id: z.number(),
      expectedReturnDate: z.string().optional().nullable(),
      status: z.string().optional(),
      formalizacaoConcluida: z.boolean().optional(),
      desbloqueoConcluido: z.boolean().optional(),
      hasReplied: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, expectedReturnDate, ...rest } = input;
      const upd: any = { ...rest, updatedAt: new Date() };
      if (expectedReturnDate !== undefined) {
        upd.expectedReturnDate = expectedReturnDate ? new Date(expectedReturnDate) : null;
      }
      await db.update(clients).set(upd).where(eq(clients.id, id));
      return { success: true };
    }),

  // Desativar cliente
  deleteClient: t.procedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.update(clients).set({ active: false, updatedAt: new Date() }).where(eq(clients.id, input.id));
      return { success: true };
    }),

  // Listar mensagens
  listMessages: t.procedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;
      const conds: any[] = [];
      if (input.status && input.status !== "all") {
        conds.push(eq(messageLogs.status, input.status as any));
      }
      const where = conds.length ? and(...conds) : undefined;
      const rows = await db.select().from(messageLogs).where(where)
        .orderBy(desc(messageLogs.createdAt)).limit(input.limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(messageLogs).where(where);
      return { messages: rows, total: Number(count) };
    }),

  // Disparos manuais
  triggerDispatch: t.procedure
    .input(z.object({ period: z.enum(["morning", "noon", "afternoon"]) }))
    .mutation(async ({ input }) => {
      await dispatchPeriod(input.period);
      return { success: true };
    }),

  triggerFormalizacao: t.procedure.mutation(async () => {
    await dispatchFormalizacao();
    return { success: true };
  }),

  triggerDesbloqueio: t.procedure.mutation(async () => {
    await dispatchDesbloqueio();
    return { success: true };
  }),

  // Configurações
  getConfig: t.procedure.query(async () => {
    const rows = await db.select().from(systemConfig);
    return Object.fromEntries(rows.map((r) => [r.key, r.value || ""]));
  }),

  setConfig: t.procedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      await db.insert(systemConfig)
        .values({ key: input.key, value: input.value, updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { value: input.value, updatedAt: new Date() } });
      return { success: true };
    }),

  // Testar Z-API
  testZAPI: t.procedure.mutation(async () => {
    return await testConnection();
  }),

  // Sincronizar Google Sheets agora
  syncSheets: t.procedure.mutation(async () => {
    return await syncFromGoogleSheets();
  }),

  // Status da última sincronização
  lastSync: t.procedure.query(async () => {
    return getLastSyncResult();
  }),
});

export type AppRouter = typeof appRouter;
