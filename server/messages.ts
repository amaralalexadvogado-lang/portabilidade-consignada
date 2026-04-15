import { db } from "./db";
import { clients, messageLogs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendWhatsAppMessage } from "./whatsapp";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Sao_Paulo";

// ─── DETECÇÃO DE GÊNERO ───────────────────────────────────────────────────────
const FEMALE_NAMES = new Set([
  "MARIA","ANA","FRANCISCA","ANTONIA","ADRIANA","JULIANA","MARCIA","FERNANDA",
  "PATRICIA","ALINE","SANDRA","CAMILA","AMANDA","BRUNA","JESSICA","LETICIA",
  "LUCIANA","DANIELA","FABIANA","CLAUDIA","CRISTINA","VANESSA","SIMONE","RENATA",
  "ANDREA","MONICA","CARLA","ROSANA","HELENA","VERA","LUCIA","ISABEL","RAQUEL",
  "NATALIA","TATIANA","ELIANE","SILVANA","ROSANGELA","MARGARETE","ELIZABETE",
  "SUELI","ROSELI","APARECIDA","CONCEICAO","TEREZA","JOSEFA","RAIMUNDA",
  "BENEDITA","ANGELICA","VIVIANE","PRISCILA","DEBORA","LILIAN","ELISANGELA",
  "MARILENE","FATIMA","SOLANGE","MARINEIDE","EDNEIA","CELIA","NEUZA","IRENE",
  "ROSEMEIRE","NILZA","NOEMIA","MARLENE","MARLI","MARISTELA","MARINETE",
  "ELZA","ELSA","DILVANA","DILVANE","SUZEL","SUZELAINE","IVONE","IVONETE",
  "IVANETE","IRACEMA","BERNADETE","BEATRIZ","BIANCA","BARBARA","ALICE",
  "ALESSANDRA","ALICIA","ALBA","FLAVIA","FLAVIANA","GLEICE","GLEICIANE",
  "GISLAINE","GISELE","GISELA","GISLENE","GRACIELA","GRACIETE","GRACIELE",
  "ROSILDA","ROSILEIDE","ROSILEIA","ROSILENE","ROSIMEIRE","SILVIA","SILVANA",
  "SIRLENE","SIRLEI","NELI","NELIA","NELY","NEIDE","NILCEIA","MARLY","MARLENE",
  "DAIANE","DAIANA","SUZAN","SUZANA","SUZANE","JAQUELINE","JACQUELINE",
  "VIVIANE","ROSEMEIRE","ROSEMARY","MAGDA","MAGDALENA","ODETE","VILMA",
  "CECILIA","TEREZINHA","TEREZA","ADELIA","ADELINA","GLEICIANE","MARILEI",
  "TATIANA","TANIA","TÂNIA","TAIANE","TAIANA","TAMIRIS","TAMIRES",
  "KEILA","KEILLA","KEILLE","KEILANE","KEILANI","KEILANNE",
  "ROSANIA","ROSANEA","ROSANE","ROSANI","ROSANY","ROSANIA",
  "VALÉRIA","VALERIA","VALESCA","VALESCA","VALESKA",
  "WANESSA","VANESSA","VANESA","VANESSE",
  "ZENAIDE","ZENAIDA","ZENILDA","ZENILDES",
]);

function getGender(name: string): "Sr." | "Sra." {
  const first = name
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (FEMALE_NAMES.has(first)) return "Sra.";
  // Nomes terminados em A geralmente são femininos (exceto exceções)
  const masculineEndingA = new Set(["LUA","JOSUA","NIKITA","LUCA","ELIA","EZRA"]);
  if (first.endsWith("A") && !masculineEndingA.has(first)) return "Sra.";
  return "Sr.";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

function daysUntil(returnDate: Date | string | null | undefined): number {
  if (!returnDate) return 999;
  try {
    const now = toZonedTime(new Date(), TZ);
    const ret = typeof returnDate === "string" ? parseISO(returnDate) : returnDate;
    return differenceInCalendarDays(ret, now);
  } catch {
    return 999;
  }
}

// ─── TEMPLATES DE MENSAGEM ────────────────────────────────────────────────────
function buildMessage(
  client: {
    name: string;
    proposta?: string | null;
    banco?: string | null;
    expectedReturnDate?: Date | string | null;
    operatorName?: string | null;
  },
  period: "morning" | "noon" | "afternoon",
  days: number
): string {
  const title = getGender(client.name);
  const first = firstName(client.name);
  const proposta = client.proposta || "—";
  const banco = client.banco || "—";
  const operador = client.operatorName
    ? `\n\nSua operação foi fechada pelo corretor *${client.operatorName}*.`
    : "";

  const greet =
    period === "morning" ? "Bom dia" : "Boa tarde";

  // Dia do retorno (hoje)
  if (days === 0) {
    return `${greet} ${title} ${first}, que Deus abençoe seu dia e de sua família. 🙏

Sou da equipe da *Crédito Já*, referente à portabilidade realizada.${operador}

🎉 *Hoje é o dia do retorno do seu saldo!* Proposta *${proposta}* no banco *${banco}*.

Assim que o saldo retornar, entraremos em contato imediatamente para finalizar sua portabilidade.

⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício*.

*NÃO atenda ligações desconhecidas* e não aceite nada do banco.

Fique com Deus. 🙏`;
  }

  // Amanhã é o retorno
  if (days === 1) {
    return `${greet} ${title} ${first}, que Deus abençoe seu dia e de sua família. 🙏

Sou da equipe da *Crédito Já*, referente à portabilidade realizada.${operador}

⏰ *Atenção: amanhã é o dia do retorno do seu saldo!* Proposta *${proposta}* no banco *${banco}*.

Fique atento — amanhã entraremos em contato assim que o saldo retornar.

⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício*.

*NÃO atenda ligações desconhecidas* e não aceite nada do banco.

Fique com Deus. 🙏`;
  }

  // 2 a 5 dias para o retorno
  if (days >= 2 && days <= 5) {
    return `${greet} ${title} ${first}, que Deus abençoe seu dia e de sua família. 🙏

Sou da equipe da *Crédito Já*, referente à portabilidade realizada.${operador}

Atualizando você sobre a portabilidade, proposta *${proposta}* no banco *${banco}* — faltam *${days} dia(s)* para o retorno do seu saldo.

Precisamos confirmar: *você já desbloqueou o seu benefício?*

• Se não, você sabe como fazer? Nos fale agora para que possamos te auxiliar.
• Se sim, nos envie o extrato para confirmarmos.

⚠️ *No dia do retorno, você terá apenas 2 horas para assinar.*

Fique com Deus e conte conosco. 🙏`;
  }

  // Mais de 5 dias
  return `${greet} ${title} ${first}, que Deus abençoe seu dia e de sua família. 🙏

Sou da equipe da *Crédito Já*, referente à portabilidade realizada.${operador}

Atualizando você sobre a portabilidade, proposta *${proposta}* no banco *${banco}* — ainda aguardamos retorno do banco, previsão em *${days} dia(s)*.

Amanhã entraremos em contato novamente com mais informações.

⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício*.

*NÃO atenda ligações desconhecidas* e não aceite nada do banco.

Tenha um dia abençoado. Fique com Deus. 🙏`;
}

// ─── ENVIO PRINCIPAL ──────────────────────────────────────────────────────────
export async function sendScheduledMessages(
  period: "morning" | "noon" | "afternoon"
): Promise<{ sent: number; skipped: number; failed: number }> {
  const now = toZonedTime(new Date(), TZ);
  const todayStr = format(now, "yyyy-MM-dd");

  const activeClients = await db
    .select()
    .from(clients)
    .where(eq(clients.status, "aguarda_retorno_saldo"));

  let sent = 0, skipped = 0, failed = 0;

  for (const client of activeClients) {
    // ✅ Pula se não tem telefone
    if (!client.phone || client.phone.trim() === "") {
      console.log(`[SKIP] ${client.name} — sem telefone`);
      skipped++;
      continue;
    }

    const days = daysUntil(client.expectedReturnDate);

    // Meio-dia: só envia se faltam mais de 7 dias
    if (period === "noon" && days <= 7) {
      skipped++;
      continue;
    }

    // Chave de deduplicação
    const key = `${todayStr}_${period}_c${client.id}`;

    // Verifica se já enviou hoje neste período
    const existing = await db
      .select()
      .from(messageLogs)
      .where(eq(messageLogs.dispatchKey, key))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const message = buildMessage(
      {
        name: client.name,
        proposta: client.proposta,
        banco: client.banco,
        expectedReturnDate: client.expectedReturnDate,
        operatorName: client.operatorName,
      },
      period,
      days
    );

    const result = await sendWhatsAppMessage(client.phone, client.name, message);

    await db.insert(messageLogs).values({
      clientId: client.id,
      phone: client.phone,
      message,
      messageType: period,
      dispatchKey: key,
      status: result.success ? "sent" : "failed",
      attempts: 1,
      errorMessage: result.success ? null : (result.error ?? null),
      daysUntilReturn: days,
      sentAt: result.success ? new Date() : null,
      scheduledFor: now,
    });

    if (result.success) {
      sent++;
      console.log(`[SENT] ${client.name} (${client.phone}) — ${days} dias`);
    } else {
      failed++;
      console.log(`[FAIL] ${client.name} — ${result.error}`);
    }
  }

  return { sent, skipped, failed };
}
