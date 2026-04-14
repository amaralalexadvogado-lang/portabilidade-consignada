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
  "cleide","cleuza","iracema","iraci","lourdes","conceicao","benedita","izabel","dulce","dirce",
  "marileni","maristela","natalina","cecilia","gilvania","simoni","judite","arlete","lucinda",
  "therezinha","elesandra","gildete","valquiria","soraia","celia","valdete","elisangela","elizete",
]);

export type Period =
  | "morning"
  | "afternoon"
  | "retorno_1h"
  | "formalizacao_1h"
  | "desbloqueio_1h";

export interface ClientData {
  name: string;
  gender?: "M" | "F" | null;
  proposta?: string | null;
  banco?: string | null;
  formalizacaoLink?: string | null;
  vendedor?: string | null;
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

function saudacao(client: ClientData, cumprimento: string): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  const vend = client.vendedor ? ` com *${client.vendedor}*` : "";
  return `${cumprimento} ${titulo}, que Deus abençoe seu dia e de sua família. 🙏\n\nSou da equipe da *Crédito Já*, referente à portabilidade realizada${vend}.`;
}

export function buildMessage(period: Period, client: ClientData, days: number): string {
  const prop  = client.proposta ? `*${client.proposta}*` : "*sua proposta*";
  const banco = client.banco    ? `*${client.banco}*`    : "*o banco*";

  if (period === "formalizacao_1h") {
    const link = client.formalizacaoLink ? `\nAcesse o link abaixo para assinar agora:\n${client.formalizacaoLink}\n` : "";
    return [saudacao(client, "Olá"),"",`*Você ainda não formalizou a sua portabilidade Crédito Já.* Faça o quanto antes para não perder o valor liberado.`,"",`📋 Proposta: ${prop} | Banco: ${banco}`,link,`⚠️ *Não deixe para depois* — o prazo é limitado e o valor pode ser cancelado.`,"",`Estamos aqui para te ajudar. Fique com Deus. 🙏`].join("\n");
  }

  if (period === "desbloqueio_1h") {
    const link = client.formalizacaoLink ? `\nApós desbloquear, acesse o link para assinar: ${client.formalizacaoLink}\n` : "";
    return [saudacao(client, "Olá"),"",`Estamos acompanhando a proposta ${prop} no banco ${banco}.`,"",`*Você já conseguiu desbloquear o seu benefício?*`,"",`Se ainda não desbloqueou, precisamos que faça isso o quanto antes. Podemos te ajudar passo a passo — é só nos chamar.`,link,`⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar a operação.`,"",`Qualquer dúvida, estamos aqui. Fique com Deus. 🙏`].join("\n");
  }

  if (period === "retorno_1h") {
    return [saudacao(client, "Olá"),"",`*Hoje é o dia do retorno do seu saldo!* 🎉`,"",`Proposta ${prop} no banco ${banco} — estamos acompanhando tudo em tempo real.`,"",`Precisamos saber: *você já desbloqueou o seu benefício?*`,"",`• ✅ Se já desbloqueou — nos avise agora para seguirmos com a formalização!`,`• ❓ Se ainda não sabe como fazer — *nosso time pode te ajudar agora mesmo.* É só pedir!`,"",`⚠️ *NÃO atenda ligações desconhecidas* e *NÃO aceite nada do banco atual.* Eles tentarão te convencer a ficar — não caia nessa.`,"",`*Você tem apenas 2 horas após o retorno para assinar.* Estamos aqui com você! Fique com Deus. 🙏`].join("\n");
  }

  if (days === 1) {
    return [saudacao(client, "Bom dia"),"",`*Atenção: amanhã é o dia do retorno do seu saldo!* 🎉`,"",`Proposta ${prop} no banco ${banco} — estamos acompanhando tudo de perto.`,"",`Precisamos confirmar: *você já desbloqueou o seu benefício?* Se ainda não desbloqueou, faça hoje mesmo para não perder o prazo.`,"",`Se precisar de ajuda com o desbloqueio, nos chame agora. Se possível, tenha um familiar por perto amanhã para te ajudar.`,"",`⚠️ *Não tente fazer portabilidade em outro lugar.*`,"",`*NÃO atenda ligações desconhecidas* e não aceite nada do banco.`,"",`Estamos com você. Fique com Deus! 🙏`].join("\n");
  }

  if (days <= 7) {
    if (period === "morning") {
      return [saudacao(client, "Bom dia"),"",`Estamos chegando muito perto da data de retorno do seu saldo — *faltam ${days} dia(s)* para a proposta ${prop} no banco ${banco}.`,"",`Precisamos confirmar algo importante: *você sabe como desbloquear o seu benefício?*`,"",`Se tiver alguma dificuldade, nos avise agora para que possamos te ajudar passo a passo.`,"",`⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.`,"",`Fique com Deus, estamos aqui com você. 🙏`].join("\n");
    }
    return [saudacao(client, "Olá"),"",`Atualizando sobre a proposta ${prop} no banco ${banco} — *faltam ${days} dia(s)* para o retorno do seu saldo.`,"",`Precisamos confirmar: *você já desbloqueou o seu benefício?*`,"",`• Se não, você sabe como fazer? Nos fale agora para que possamos te auxiliar.`,`• Se sim, nos envie o extrato para confirmarmos.`,"",`⚠️ *No dia do retorno, você terá apenas 2 horas para assinar.*`,"",`Fique com Deus e conte conosco. 🙏`].join("\n");
  }

  if (period === "morning") {
    return [saudacao(client, "Bom dia"),"",`Estamos acompanhando de perto a sua portabilidade, proposta ${prop} no banco ${banco}.`,"",`Ainda não recebemos retorno do banco, mas o processo está em andamento normalmente.`,"",`⚠️ *Atenção importante:* Não tente fazer portabilidade em outro lugar. O seu processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.`,"",`*NÃO atenda ligações de números desconhecidos.* Quando precisarmos ligar para você, avisaremos com antecedência.`,"",`Fique com Deus e tenha um dia abençoado. 🙏`].join("\n");
  }

  return [saudacao(client, "Boa tarde"),"",`Atualizando você sobre a portabilidade, proposta ${prop} no banco ${banco} — ainda aguardamos retorno do banco hoje.`,"",`Amanhã entraremos em contato novamente com mais informações.`,"",`⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício*.`,"",`*NÃO atenda ligações desconhecidas* e não aceite nada do banco.`,"",`Tenha uma tarde abençoada. Fique com Deus. 🙏`].join("\n");
}

export function msgTransferirSetor(client: ClientData): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  return `Olá ${titulo}, entendemos que você está com dificuldade. 🙏\n\nVamos transferir você para o setor de formalização que irá te auxiliar no desbloqueio/formalização em breve.\n\nFique com Deus. 🙏`;
}

export function msgMensagemAutomatica(): string {
  return `Olá! Esta mensagem é automática. Em breve o vendedor entrará em contato para te atender. 🙏\n\nFique com Deus.`;
}

export function msgNumeroErrado(client: ClientData): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  return `Olá ${titulo}, pedimos desculpas pelo contato indevido. 🙏\n\nNão entraremos mais em contato com este número.\n\nFique com Deus.`;
}

export function msgDesbloqueioConfirmado(client: ClientData): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  const link = client.formalizacaoLink;
  return `Ótimo ${titulo}! 🎉 Desbloqueio confirmado.\n\n` +
    (link ? `Agora acesse o link para assinar:\n${link}\n\nFique com Deus. 🙏` : `Em breve o vendedor entrará em contato. Fique com Deus. 🙏`);
}

export function msgFormalizacaoConfirmada(client: ClientData): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  return `Perfeito ${titulo}! ✅ Formalização confirmada.\n\nEm breve nossa equipe entrará em contato para os próximos passos.\n\nFique com Deus. 🙏`;
}

export function msgPersuasao(client: ClientData): string {
  const g = client.gender || detectGender(client.name);
  const firstName = client.name.trim().split(/\s+/)[0];
  const titulo = g === "F" ? `Sra. ${firstName}` : `Sr. ${firstName}`;
  const prop  = client.proposta ? `*${client.proposta}*` : "*sua proposta*";
  const banco = client.banco    ? `*${client.banco}*`    : "*o banco*";
  return [
    `Olá ${titulo}, entendemos sua posição. 🙏`,
    ``,
    `Mas precisamos que saiba: *esta portabilidade já está aprovada e o valor está reservado para você.* Se desistir agora, perderá tudo que foi conquistado até aqui.`,
    ``,
    `📋 Proposta ${prop} no banco ${banco}:`,
    `• ✅ Redução das suas parcelas mensais`,
    `• ✅ Mais dinheiro no seu bolso todo mês`,
    `• ✅ Processo 100% seguro e sem custo para você`,
    ``,
    `*Não deixe o banco atual te convencer a ficar.* Eles ligam porque sabem que você vai economizar — e isso prejudica os lucros deles, não os seus.`,
    ``,
    `Nossa equipe está aqui para te ajudar em cada passo. Podemos fazer uma *videochamada agora* para tirar todas as suas dúvidas. É só pedir! 🙏`,
    ``,
    `Fique com Deus. Estamos com você.`,
  ].join("\n");
}
