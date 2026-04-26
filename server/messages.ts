const FEMALE_NAMES = new Set([
  "ana","maria","julia","juliana","fernanda","patricia","camila","aline","amanda","bruna",
  "carolina","claudia","cristina","daniela","debora","elaine","elisa","flavia","gabriela",
  "giovanna","isabela","jessica","joana","karen","larissa","laura","leticia","lucia","luciana",
  "luiza","marcela","marcia","mariana","marina","michelle","monica","natalia","paula","priscila",
  "raquel","renata","roberta","sandra","simone","silvia","tatiana","thais","valeria","vanessa",
  "veronica","viviane","yasmin","alice","beatriz","bianca","cintia","denise","edilaine","edna",
  "eliane","elisangela","fabiana","fatima","francisca","geovana","helena","ines","irene","janaina",
  "josefa","katia","luana","lurdes","magda","marta","nadia","nair","nathalia","neuza","noemia",
  "odete","olivia","regiane","rosa","rosana","rosangela","roseli","rosilene","rosimeire","ruth",
  "sabrina","selma","sheila","solange","soraia","sueli","suely","suzana","telma","tereza","valdirene",
  "vera","vitoria","wania","walkiria","zelia","zenaide","sonia","aparecida","elza","tatiane",
  "andreia","andrea","jaqueline","silvana","marlene","marli","neusa","neli","leni",
  "cleide","cleuza","iracema","iraci","lourdes","conceicao","benedita","izabel","dulce","dirce"
]);

export type Period =
  | "morning"
  | "afternoon"
  | "retorno_1h"
  | "formalizacao_apresentacao"
  | "formalizacao_cobranca"
  | "desbloqueio_apresentacao"
  | "desbloqueio_cobranca";

export interface ClientData {
  name: string;
  gender?: "M" | "F" | null;
  proposta?: string | null;
  banco?: string | null;
  formalizacaoLink?: string | null;
  vendedor?: string | null;
  expectedReturnDate?: Date | string | null;
}

export function detectGender(name: string): "M" | "F" {
  const first = name.trim().split(/\s+/)[0].toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "");
  return FEMALE_NAMES.has(first) ? "F" : "M";
}

export function getDaysUntilReturn(date: Date | null | undefined): number {
  if (!date) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ret = new Date(date);
  ret.setHours(0, 0, 0, 0);
  return Math.ceil((ret.getTime() - today.getTime()) / 86400000);
}

// ─── Helpers de formatação ──────────────────────────────────────────────────
function getTitulo(client: ClientData): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  return g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
}

function getVendedor(client: ClientData): string {
  return client.vendedor && client.vendedor.trim()
    ? client.vendedor.trim()
    : "nosso consultor";
}

function formatReturnDate(d: Date | string | null | undefined): string {
  if (!d) return "em breve";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "em breve";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Saudação completa: usada na 1ª mensagem do dia (apresentação)
function saudacaoCompleta(client: ClientData, cumprimento: string): string {
  const titulo = getTitulo(client);
  const vendedor = getVendedor(client);
  return `${cumprimento} ${titulo}, que Deus abençoe você e sua família. 🙏\n\nSomos do *Time de Acompanhamento de Portabilidade da Crédito Já*. Sua portabilidade foi formalizada com *${vendedor}*.`;
}

// ─── Mensagens principais ──────────────────────────────────────────────────
export function buildMessage(period: Period, client: ClientData, days: number): string {
  const prop  = client.proposta ? `*${client.proposta}*` : "*sua proposta*";
  const banco = client.banco    ? `*${client.banco}*`    : "*o banco*";
  const vendedor = getVendedor(client);
  const titulo = getTitulo(client);

  // ════════════════════════════════════════════════════════════════════
  // FORMALIZAÇÃO — APRESENTAÇÃO (1ª do dia)
  // ════════════════════════════════════════════════════════════════════
  if (period === "formalizacao_apresentacao") {
    const link = client.formalizacaoLink
      ? `\nAcesse o link abaixo para assinar agora:\n${client.formalizacaoLink}\n`
      : "";
    return [
      saudacaoCompleta(client, "Olá"),
      "",
      `*Você ainda não finalizou a sua portabilidade.* Faça o quanto antes para não perder o valor liberado.`,
      "",
      `📋 Proposta: ${prop} | Banco: ${banco}`,
      link,
      `⚠️ *Não deixe para depois* — o prazo é limitado e o valor pode ser cancelado.`,
      "",
      `⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício*.`,
      "",
      `Estamos aqui para te ajudar. Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ════════════════════════════════════════════════════════════════════
  // FORMALIZAÇÃO — COBRANÇA (demais do dia)
  // ════════════════════════════════════════════════════════════════════
  if (period === "formalizacao_cobranca") {
    const linkLine = client.formalizacaoLink ? `\n${client.formalizacaoLink}\n` : "";
    return [
      `Olá ${titulo}, estamos entrando em contato pois consultamos no sistema do banco ${banco} e ainda *não consta a assinatura do link*:`,
      linkLine,
      `Caso já tenha feito, é só responder *"assinei"*.`,
      "",
      `Caso esteja com dúvida ou dificuldade para realizar o processo de assinatura, basta responder *"não estou conseguindo"* que o *${vendedor}* vai entrar em contato para lhe auxiliar.`,
      "",
      `Estamos aguardando seu retorno, pois sem isso não conseguimos avançar. *Não ignore a mensagem!* 🙏`,
    ].join("\n");
  }

  // ════════════════════════════════════════════════════════════════════
  // DESBLOQUEIO — APRESENTAÇÃO (1ª do dia)
  // ════════════════════════════════════════════════════════════════════
  if (period === "desbloqueio_apresentacao") {
    const link = client.formalizacaoLink
      ? `\nApós desbloquear, acesse o link para assinar:\n${client.formalizacaoLink}\n`
      : "";
    return [
      saudacaoCompleta(client, "Olá"),
      "",
      `Nosso contato é referente à proposta ${prop} no banco ${banco}.`,
      "",
      `*Você já conseguiu desbloquear o seu benefício?*`,
      "",
      `Se ainda não desbloqueou, precisamos que faça isso o quanto antes para não perder o valor liberado. Podemos te ajudar passo a passo — é só nos chamar.`,
      link,
      `⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar a operação.`,
      "",
      `Qualquer dúvida, estamos aqui. Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ════════════════════════════════════════════════════════════════════
  // DESBLOQUEIO — COBRANÇA (demais do dia)
  // ════════════════════════════════════════════════════════════════════
  if (period === "desbloqueio_cobranca") {
    return [
      `Olá ${titulo}, estamos entrando em contato pois consultamos no sistema do *INSS* e ainda *não consta o desbloqueio*.`,
      "",
      `Caso já tenha feito, consegue nos encaminhar seu *extrato de empréstimo*?`,
      "",
      `Caso esteja com dúvida ou dificuldade para realizar o desbloqueio, basta responder *"não estou conseguindo"* que o *${vendedor}* vai entrar em contato para lhe auxiliar.`,
      "",
      `Estamos aguardando seu retorno, pois sem isso não conseguimos avançar. *Não ignore a mensagem!* 🙏`,
    ].join("\n");
  }

  // ════════════════════════════════════════════════════════════════════
  // DIA DO RETORNO (retorno_1h)
  // ════════════════════════════════════════════════════════════════════
  if (period === "retorno_1h") {
    return [
      saudacaoCompleta(client, "Olá"),
      "",
      `*Hoje é o dia do retorno do seu saldo!* 🎉`,
      "",
      `Proposta ${prop} no banco ${banco} — estamos acompanhando tudo em tempo real.`,
      "",
      `Precisamos saber: *você já desbloqueou o seu benefício?*`,
      "",
      `• ✅ Se já desbloqueou — nos avise agora para seguirmos com a formalização!`,
      `• ❓ Se ainda não sabe como fazer — *podemos te ajudar agora mesmo.* É só pedir!`,
      "",
      `⚠️ *NÃO atenda ligações desconhecidas* e *NÃO aceite nada do banco atual.* Eles tentarão te convencer a ficar — não caia nessa.`,
      "",
      `*Você tem apenas 2 horas após o retorno para assinar.* Estamos aqui com você! Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ════════════════════════════════════════════════════════════════════
  // RETORNO AMANHÃ (days === 1)
  // ════════════════════════════════════════════════════════════════════
  if (days === 1) {
    return [
      saudacaoCompleta(client, "Bom dia"),
      "",
      `*Atenção: amanhã é o dia do retorno do seu saldo!* 🎉`,
      "",
      `Proposta ${prop} no banco ${banco} — estamos acompanhando tudo de perto.`,
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

  // ════════════════════════════════════════════════════════════════════
  // FASE CRÍTICA (2 a 7 dias)
  // ════════════════════════════════════════════════════════════════════
  if (days <= 7) {
    if (period === "morning") {
      // ─── 9h: mensagem de acompanhamento ───
      return [
        saudacaoCompleta(client, "Bom dia"),
        "",
        `Estamos chegando muito perto da data de retorno do seu saldo — *faltam ${days} dia(s)* para a proposta ${prop} no banco ${banco}.`,
        "",
        `Precisamos confirmar algo importante: *você sabe como desbloquear o seu benefício?*`,
        "",
        `Se tiver alguma dificuldade, nos avise agora para que possamos te ajudar passo a passo e evitar deixar tudo para a última hora.`,
        "",
        `Se precisar, peça a um filho(a), amigo(a) ou familiar para estar com você no dia.`,
        "",
        `⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.`,
        "",
        `*NÃO atenda ligações desconhecidas* e não aceite nada do banco.`,
        "",
        `Fique com Deus, estamos aqui com você. 🙏`,
      ].join("\n");
    }
    // ─── 15h: mensagem NOVA, curta — "sem novidade hoje" ───
    const dataPrev = formatReturnDate(client.expectedReturnDate);
    return [
      `Olá ${titulo}, somos do *Time de Acompanhamento da Crédito Já*. 🙏`,
      "",
      `Acompanhamos o seu procedimento hoje durante o dia, mas seguimos *sem novidade do retorno*. Contudo, ainda está dentro do prazo — está previsto para retornar em *${dataPrev}*.`,
      "",
      `Qualquer dúvida, chame *${vendedor}*.`,
      "",
      `A *Equipe Crédito Já* agradece e deseja um bom final de dia. Fique com Deus. 🙏`,
    ].join("\n");
  }

  // ════════════════════════════════════════════════════════════════════
  // FASE INICIAL (>7 dias)
  // ════════════════════════════════════════════════════════════════════
  if (period === "morning") {
    return [
      saudacaoCompleta(client, "Bom dia"),
      "",
      `Estamos acompanhando de perto a sua portabilidade — proposta ${prop} no banco ${banco}.`,
      "",
      `Ainda não recebemos retorno do banco, mas o processo está em andamento normalmente.`,
      "",
      `⚠️ *Atenção importante:* Não tente fazer portabilidade em outro lugar. Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.`,
      "",
      `*NÃO atenda ligações de números desconhecidos.* Quando precisarmos ligar, avisaremos com antecedência.`,
      "",
      `Fique com Deus e tenha um dia abençoado. 🙏`,
    ].join("\n");
  }

  // FASE INICIAL — afternoon (15h)
  return [
    saudacaoCompleta(client, "Boa tarde"),
    "",
    `Atualizando você sobre a portabilidade — proposta ${prop} no banco ${banco}. Ainda aguardamos retorno do banco hoje.`,
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

// ─── Mensagens auxiliares (respostas automáticas do webhook) ────────────────
export function msgTransferirSetor(client: ClientData): string {
  const titulo = getTitulo(client);
  const vendedor = getVendedor(client);
  return [
    `Olá ${titulo}, entendemos sua dificuldade. 🙏`,
    "",
    `Estamos transferindo para *${vendedor}*, que vai entrar em contato para lhe auxiliar.`,
    "",
    `*Qual seria o melhor horário* para falar com você?`,
    "",
    `Fique com Deus. 🙏`,
  ].join("\n");
}

export function msgMensagemAutomatica(): string {
  return `Olá! Esta mensagem é automática. Em breve nosso *Time de Acompanhamento* irá te atender. 🙏\n\nFique com Deus.`;
}

export function msgNumeroErrado(client: ClientData): string {
  const titulo = getTitulo(client);
  return `Olá ${titulo}, pedimos desculpas pelo contato indevido. 🙏\n\nNão entraremos mais em contato com este número.\n\nFique com Deus.`;
}

export function msgDesbloqueioConfirmado(client: ClientData): string {
  const titulo = getTitulo(client);
  const vendedor = getVendedor(client);
  const link = client.formalizacaoLink;
  if (link) {
    return `Ótimo ${titulo}! 🎉 Desbloqueio confirmado.\n\nAgora acesse o link abaixo para assinar:\n${link}\n\nQualquer dúvida, *${vendedor}* está disponível. Fique com Deus. 🙏`;
  }
  return `Ótimo ${titulo}! 🎉 Desbloqueio confirmado.\n\nEm breve *${vendedor}* entrará em contato para os próximos passos. Fique com Deus. 🙏`;
}

export function msgFormalizacaoConfirmada(client: ClientData): string {
  const titulo = getTitulo(client);
  const vendedor = getVendedor(client);
  return `Perfeito ${titulo}! ✅ Formalização confirmada.\n\nEm breve *${vendedor}* entrará em contato para os próximos passos.\n\nFique com Deus. 🙏`;
}

export function msgPersuasao(client: ClientData): string {
  const titulo = getTitulo(client);
  const vendedor = getVendedor(client);
  return [
    `Olá ${titulo}, entendemos sua preocupação. 🙏`,
    "",
    `Somos do *Time de Acompanhamento da Crédito Já* e queremos garantir que você receba o melhor serviço possível. *${vendedor}* está totalmente comprometido com a sua portabilidade.`,
    "",
    `⚠️ *Importante:* Cancelar agora pode fazer você perder o valor já aprovado. Vamos juntos até o final!`,
    "",
    `Qualquer dúvida, estamos aqui. Fique com Deus. 🙏`,
  ].join("\n");
}
