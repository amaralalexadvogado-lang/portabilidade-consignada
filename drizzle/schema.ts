import {
  boolean,
  datetime,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  cpf: varchar("cpf", { length: 14 }),
  proposta: varchar("proposta", { length: 100 }),
  banco: varchar("banco", { length: 100 }),
  status: mysqlEnum("status", [
    "aguarda_retorno_saldo",
    "aguarda_desbloqueio",
    "pendente_formalizacao",
    "aprovado",
    "cancelado",
  ]).default("aguarda_retorno_saldo"),
  gender: mysqlEnum("gender", ["M", "F"]).default("M"),
  expectedReturnDate: datetime("expectedReturnDate"),
  notes: text("notes"),
  formalizacaoLink: text("formalizacaoLink"),
  formalizacaoConcluida: boolean("formalizacaoConcluida").default(false),
  desbloqueoConcluido: boolean("desbloqueoConcluido").default(false),
  hasReplied: boolean("hasReplied").default(false),
  active: boolean("active").default(true),
  vendedor: varchar("vendedor", { length: 255 }),
  createdAt: datetime("createdAt"),
  updatedAt: datetime("updatedAt"),
});

export const messageLogs = mysqlTable("message_logs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  phone: varchar("phone", { length: 20 }),
  message: text("message"),
  messageType: varchar("messageType", { length: 50 }),
  dispatchKey: varchar("dispatchKey", { length: 200 }).unique(),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending"),
  attempts: int("attempts").default(1),
  errorMessage: text("errorMessage"),
  sentAt: datetime("sentAt"),
  daysUntilReturn: int("daysUntilReturn"),
  createdAt: datetime("createdAt"),
  updatedAt: datetime("updatedAt"),
});

export const systemConfig = mysqlTable("system_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  description: text("description"),
  updatedAt: datetime("updatedAt"),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type MessageLog = typeof messageLogs.$inferSelect;
export type SystemConfig = typeof systemConfig.$inferSelect;
