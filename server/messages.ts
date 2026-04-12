const FEMININE_NAMES = new Set([
  "maria","ana","julia","juliana","patricia","fernanda","amanda","jessica",
  "aline","camila","bruna","leticia","gabriela","luciana","mariana","claudia",
  "sandra","adriana","daniela","renata","beatriz","vanessa","simone","cristina",
  "aparecida","rosana","rosangela","fatima","eliane","vera","rosa","lucia",
  "tereza","francisca","joana","raquel","natalia","tatiane","priscila","viviane",
  "larissa","roberta","marcela","debora","andrea","fabiana","elaine","regiane",
  "cintia","denise","monica","silvia","sonia","lilian","alice","carla","angela",
  "lidia","ruth","miriam","irene","sueli","katia","valeria","glaucia","edineia",
  "jane","nilza","iracema","edna","neusa","nair","ilza","terezinha","odete",
  "isabel","isabela","isabella","clara","laura","sofia","valentina","helena",
  "luana","tamara","flavia","gisele","michele","michelle","caroline","carolyne",
  "thais","thaisa","thaise","suzana","susana","solange","sheila","selma",
  "rejane","rebeca","raissa","rafaela","rafaella","paula","paola","paloma",
  "elisangela","elisabete","elizabete","elizete","marileni","maristela",
  "natalina","cecilia","gilvania","gilvania","vanessa","rosana","simoni",
  "judite","sonia","silvia","viviane","arlete","lucinda","therezinha",
  "elesandra","eliane","gildete","valquiria","soraia","celia","valdete",
]);

export function detectGender(name: string): "M" | "F" {
  const first = name
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return FEMININE_NAMES.has(first) ? "F" : "M";
}

export function getDaysUntilReturn(date: Date | null | undefined): number {
  if (!date) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ret = new Date(date);
  ret.setHours(0, 0, 0, 0);
  return Math.ceil((ret.getTime() - today.getTime()) / 86400000);
}

type Period =
  | "morning"
  | "afternoon"
  | "retorno_1h"       // NOVO: disparo a cada 1h no dia do retorno
  | "formalizacao_1h"
  | "desbloqueio_1h";

interface ClientData {
  name: string;
  gender?: "M" | "F" | null;
  proposta?: string | null;
  banco?: string | null;
  formalizacaoLink?: string | null;
}

export function buildMessage(
  period: Period,
  client: ClientData,
  days: number
): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  const prop = client.proposta ? `*${client.proposta}*` : "*sua proposta*";
  const banco = client.banco ? `*${client.banco}*` : "*o banco*";

  // ── Formalização 1h ──────────────────────────────────────
  if (period === "formalizacao_1h") {
    const link = client.formalizacaoLink || "(link indisponível)";
    return [
      `Olá ${titulo}, que Deus abençoe você e sua família. 🙏`,
      "",
      `*Você ainda não formalizou a sua portabilidade Crédito Já.* Faça o quanto antes para não perder o valor liberado.`,
      "",
      `📋 Proposta: ${prop} | Banco: ${banco}`,
      "",
      `Acesse o link abaixo para assinar agora:`,
      link,
      "",
      `⚠️ *Não deixe para depois* — o prazo é limitado e o valor pode ser cancelado.`,
      "",
      `Estamos aqui para te ajudar. Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ── Desbloqueio 1h ───────────────────────────────────────
  if (period === "desbloqueio_1h") {
    return [
      `Olá ${titulo}, que Deus abençoe você e sua família. 🙏`,
      "",
      `Estamos acompanhando a sua portabilidade *Crédito Já*, proposta ${prop} no banco ${banco}.`,
      "",
      `*Você já conseguiu desbloquear o seu benefício?*`,
      "",
      `Se ainda não desbloqueou, precisamos que faça isso o quanto antes para não perder o valor liberado. Podemos te ajudar passo a passo — é só nos chamar.`,
      "",
      `⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar a operação.`,
      "",
      `Qualquer dúvida, estamos aqui. Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ── Dia do retorno — disparo a cada 1h (9h–17h) ─────────
  if (period === "retorno_1h") {
    return [
      `Olá ${titulo}, que Deus abençoe você e sua família. 🙏`,
      "",
      `*Hoje é o dia do retorno do seu saldo!* 🎉`,
      "",
      `Proposta ${prop} no banco ${banco} — estamos acompanhando tudo em tempo real.`,
      "",
      `Precisamos saber: *você já desbloqueou o seu benefício?*`,
      "",
      `• ✅ Se já desbloqueou — nos avise agora para seguirmos com a formalização!`,
      `• ❓ Se ainda não sabe como fazer — *nosso time pode fazer uma videochamada com você agora* para te ajudar passo a passo. É só pedir!`,
      "",
      `⚠️ *NÃO atenda ligações desconhecidas* e *NÃO aceite nada do banco atual.* Eles tentarão te convencer a ficar — não caia nessa.`,
      "",
      `*Você tem apenas 2 horas após o retorno para assinar.* Estamos aqui com você! Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ── Retorno amanhã (1 dia) ───────────────────────────────
  if (days === 1) {
    return [
      `Bom dia ${titulo}, que Deus abençoe você e sua família. 🙏`,
      "",
      `*Atenção: amanhã é o dia do retorno do seu saldo!* 🎉`,
      "",
      `Proposta ${prop} no banco ${banco} — a Crédito Já está acompanhando tudo de perto.`,
      "",
      `Precisamos confirmar: *você já desbloqueou o seu benefício?* Se ainda não desbloqueou, faça hoje mesmo para não perder o prazo.`,
      "",
      `Se precisar de ajuda com o desbloqueio, nos chame agora. Se possível, tenha um familiar por perto amanhã para te ajudar.`,
      "",
      `⚠️ *Não tente fazer portabilidade em outro lugar.*`,
      "",
      `*NÃO atenda ligações desconhecidas* e não aceite nada do banco.`,
      "",
      `Estamos com você. Fique com Deus! 🙏`,
    ].join("\n");
  }

  // ── Fase Crítica (2–7 dias) ──────────────────────────────
  if (days <= 7) {
    if (period === "morning") {
      return [
        `Bom dia ${titulo}, que Deus e Jesus abençoem o seu dia e a sua família. 🙏`,
        "",
        `Estamos chegando muito perto da data de retorno do seu saldo — *faltam ${days} dia(s)* para a proposta ${prop} no banco ${banco}.`,
        "",
        `Precisamos confirmar algo importante: *você sabe como desbloquear o seu benefício?*`,
        "",
        `Se tiver alguma dificuldade, nos avise agora para que possamos te ajudar passo a passo e evitar deixar tudo para a última hora.`,
        "",
        `⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.`,
        "",
        `Fique com Deus, estamos aqui com você. 🙏`,
      ].join("\n");
    }
    // afternoon fase crítica
    return [
      `Olá ${titulo}, espero que esteja tendo um dia abençoado com Deus e sua família. 🙏`,
      "",
      `Atualizando sobre a proposta ${prop} no banco ${banco} — *faltam ${days} dia(s)* para o retorno do seu saldo.`,
      "",
      `Precisamos confirmar: *você já desbloqueou o seu benefício?*`,
      "",
      `• Se não, você sabe como fazer? Nos fale agora para que possamos te auxiliar.`,
      `• Se sim, nos envie o extrato para confirmarmos.`,
      "",
      `⚠️ *No dia do retorno, você terá apenas 2 horas para assinar.*`,
      "",
      `Fique com Deus e conte conosco. 🙏`,
    ].join("\n");
  }

  // ── Fase Inicial (> 7 dias) ──────────────────────────────
  if (period === "morning") {
    return [
      `Bom dia ${titulo}, que você tenha um dia abençoado. Que Deus e Jesus te protejam e à sua família. 🙏`,
      "",
      `Estamos acompanhando de perto a sua portabilidade realizada com a *Crédito Já*, proposta ${prop} no banco ${banco}.`,
      "",
      `Ainda não recebemos retorno do banco, mas o processo está em andamento normalmente.`,
      "",
      `⚠️ *Atenção importante:* Não tente fazer portabilidade em outro lugar. O seu processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.`,
      "",
      `*NÃO atenda ligações de números desconhecidos.* Quando precisarmos ligar para você, avisaremos com antecedência.`,
      "",
      `Fique com Deus e tenha um dia abençoado. 🙏`,
    ].join("\n");
  }

  // afternoon fase inicial
  return [
    `Boa tarde ${titulo}, espero que você e sua família estejam bem e protegidos por Deus. ☀️`,
    "",
    `Atualizando você sobre a portabilidade *Crédito Já*, proposta ${prop} no banco ${banco} — ainda aguardamos retorno do banco hoje.`,
    "",
    `Amanhã entraremos em contato novamente com mais informações.`,
    "",
    `⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício*.`,
    "",
    `*NÃO atenda ligações desconhecidas* e não aceite nada do banco.`,
    "",
    `Tenha uma tarde abençoada. Fique com Deus. 🙏`,
  ].join("\n");
}
