// ─── NOMES FEMININOS BRASILEIROS ─────────────────────────────────────────────
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
  "andreia","andrea","jaqueline","silvana","marlene","marli","neusa","neli","leni","sueli",
  "cleide","cleuza","iracema","iraci","lourdes","conceicao","benedita","izabel","dulce","dirce"
]);

function getGender(name) {
  const first = String(name).trim().split(" ")[0].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return FEMALE_NAMES.has(first) ? "F" : "M";
}

function getTreatment(client) {
  const gender = client.gender || getGender(client.name);
  const title = gender === "F" ? "Sra." : "Sr.";
  const firstName = client.name.trim().split(" ")[0];
  return { title, firstName };
}

function getDaysUntilReturn(expectedReturnDate) {
  if (!expectedReturnDate) return 999;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ret = new Date(expectedReturnDate); ret.setHours(0, 0, 0, 0);
  return Math.ceil((ret - today) / (1000 * 60 * 60 * 24));
}

// Saudação com vendedor — inserida no início de cada mensagem
function saudacaoVendedor(client, saudacao) {
  const { title, firstName } = getTreatment(client);
  const vendedor = client.vendedor ? ` com *${client.vendedor}*` : "";
  return `${saudacao} ${title} ${firstName}, que Deus abençoe seu dia e de sua família. 🙏\n\nSou da equipe da *Crédito Já*, referente à portabilidade realizada${vendedor}.`;
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

function msgFaseInicial9h(client) {
  return `${saudacaoVendedor(client, "Bom dia")}

Estamos acompanhando de perto a sua portabilidade, proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}*.

Ainda não recebemos retorno do banco, mas o processo está em andamento normalmente.

⚠️ *Atenção importante:* Não tente fazer portabilidade em outro lugar. O seu processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.

*NÃO atenda ligações de números desconhecidos.* Quando precisarmos ligar para você, avisaremos com antecedência.

Fique com Deus e tenha um dia abençoado. 🙏`;
}

function msgFaseInicial12h(client) {
  return `${saudacaoVendedor(client, "Olá")}

Estamos entrando em contato novamente sobre a proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}*.

Ainda não temos retorno do banco — isso é normal, o processo leva de 5 a 7 dias úteis.

⚠️ *Muito importante:* NÃO tente fazer portabilidade em outro lugar. O seu processo já está em andamento conosco e qualquer movimentação em outro banco pode *bloquear o seu benefício* e cancelar a sua operação.

Se o banco ligar oferecendo condições melhores, diga NÃO. Eles só querem manter você pagando juros mais altos.

Que Deus abençoe você e sua família. 🙏`;
}

function msgFaseInicial15h(client) {
  return `${saudacaoVendedor(client, "Boa tarde")}

Atualizando você sobre a proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}* — ainda aguardamos retorno do banco hoje.

Amanhã entraremos em contato novamente com mais informações.

⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício*.

*NÃO atenda ligações desconhecidas* e não aceite nada do banco.

Tenha uma tarde abençoada. Fique com Deus. 🙏`;
}

function msgFaseCritica9h(client, days) {
  return `${saudacaoVendedor(client, "Bom dia")}

Estamos chegando muito perto da data de retorno do seu saldo — *faltam ${days} dia(s)* para a proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}*.

Precisamos confirmar algo importante: *você sabe como desbloquear o seu benefício?*

Se tiver alguma dificuldade, nos avise agora para que possamos te ajudar passo a passo e evitar deixar tudo para a última hora.

Se precisar, peça a um filho(a), amigo(a) ou familiar para estar com você no dia — para não perder essa oportunidade.

⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.

*NÃO atenda ligações desconhecidas* e não aceite nada do banco.

Fique com Deus, estamos aqui com você. 🙏`;
}

function msgFaseCritica15h(client, days) {
  return `${saudacaoVendedor(client, "Olá")}

Atualizando sobre a proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}* — *faltam ${days} dia(s)* para o retorno do seu saldo.

Precisamos confirmar: *você já desbloqueou o seu benefício?*

• Se não, você sabe como fazer? Precisa de ajuda? Nos fale agora para que possamos te auxiliar.
• Se sim, nos envie o extrato para confirmarmos.

Esse passo é muito importante e não pode ser deixado para a última hora.

⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer movimentação em outro banco pode *bloquear o seu benefício* e cancelar a operação da Crédito Já.

*No dia do retorno, você terá apenas 2 horas para assinar.*

Fique com Deus e conte conosco. 🙏`;
}

function msgRetornoAmanha(client) {
  return `${saudacaoVendedor(client, "Bom dia")}

*Atenção: amanhã é o dia do retorno do seu saldo!* 🎉

Proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}* — estamos acompanhando tudo de perto.

Precisamos confirmar: *você já desbloqueou o seu benefício?* Se ainda não desbloqueou, faça hoje mesmo para não perder o prazo.

Se precisar de ajuda com o desbloqueio, nos chame agora. Se possível, tenha um familiar por perto amanhã para te ajudar caso precise.

⚠️ *Não tente fazer portabilidade em outro lugar.* O processo já está em andamento conosco e qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar tudo.

*NÃO atenda ligações desconhecidas* e não aceite nada do banco — eles vão tentar te convencer a ficar.

Estamos com você. Fique com Deus! 🙏`;
}

function msgDiaDoRetorno(client) {
  return `${saudacaoVendedor(client, "Bom dia")}

*Hoje é o dia do retorno do seu saldo!* 🎉

Proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}* — estamos acompanhando tudo em tempo real.

Por favor, fique disponível e em um local com sinal.

Você terá apenas *2 horas para assinar* após o retorno.

Se precisar, tenha um familiar por perto para te ajudar.

⚠️ *NÃO atenda ligações desconhecidas* e *NÃO aceite nada do banco*. Eles tentarão te convencer a ficar — não caia nessa.

Estamos com você. Fique com Deus! 🙏`;
}

function msgPendenteFormalização(client) {
  const { title, firstName } = getTreatment(client);
  const vendedor = client.vendedor ? ` com *${client.vendedor}*` : "";
  const link = client.formalizacaoLink
    ? `\nAcesse o link abaixo para assinar agora:\n${client.formalizacaoLink}\n`
    : "";
  return `Olá ${title} ${firstName}, que Deus abençoe você e sua família. 🙏

Sou da equipe da *Crédito Já*, referente à portabilidade realizada${vendedor}.

*Você ainda não formalizou a sua portabilidade.* Faça o quanto antes para não perder o valor liberado hoje.

📋 Proposta: *${client.proposta || "—"}* | Banco: *${client.banco || "—"}*
${link}
⚠️ *Não deixe para depois* — o prazo é limitado e o valor pode ser cancelado.

⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício*.

Estamos aqui para te ajudar. Fique com Deus. 🙏`;
}

function msgAguardaDesbloqueio(client) {
  const { title, firstName } = getTreatment(client);
  const vendedor = client.vendedor ? ` com *${client.vendedor}*` : "";
  const link = client.formalizacaoLink
    ? `\nApós desbloquear, acesse o link para assinar: ${client.formalizacaoLink}\n`
    : "";
  return `Olá ${title} ${firstName}, que Deus abençoe você e sua família. 🙏

Sou da equipe da *Crédito Já*, referente à portabilidade realizada${vendedor}.

Estamos acompanhando a proposta *${client.proposta || "—"}* no banco *${client.banco || "—"}*.

*Você já conseguiu desbloquear o seu benefício?*

Se ainda não desbloqueou, precisamos que faça isso o quanto antes para não perder o valor liberado. Podemos te ajudar passo a passo — é só nos chamar.
${link}
⚠️ *Não tente fazer portabilidade em outro lugar.* Qualquer tentativa em outro banco pode *bloquear o seu benefício* e cancelar a operação.

Qualquer dúvida, estamos aqui. Fique com Deus. 🙏`;
}

// ─── RESPOSTAS AUTOMÁTICAS DO WEBHOOK ────────────────────────────────────────

function msgTransferirSetor(client) {
  const { title, firstName } = getTreatment(client);
  return `Olá ${title} ${firstName}, entendemos que você está com dificuldade. 🙏\n\nVamos transferir você para o setor de formalização que irá te auxiliar no desbloqueio/formalização em breve.\n\nFique com Deus. 🙏`;
}

function msgMensagemAutomatica() {
  return `Olá! Esta mensagem é automática. Em breve o vendedor entrará em contato para te atender. 🙏\n\nFique com Deus.`;
}

function msgNumeroErrado(client) {
  const { title, firstName } = getTreatment(client);
  return `Olá ${title} ${firstName}, pedimos desculpas pelo contato indevido. 🙏\n\nNão entraremos mais em contato com este número.\n\nFique com Deus.`;
}

// ─── RELATÓRIO DIÁRIO ─────────────────────────────────────────────────────────

function buildRelatorio(stats, sent, failed) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const retornos = (stats.retornoClients || []).map(c =>
    `  • ${c.name} — ${c.proposta || "—"} (${c.vendedor || "—"})`
  ).join("\n") || "  • Nenhum";
  return `📊 *RELATÓRIO DIÁRIO — ACOMPANHAMENTO CRÉDITO JÁ*
📅 ${hoje}

*Retornos de saldo hoje (${stats.retornoHoje || 0}):*
${retornos}

*Clientes que responderam:* ${stats.replied || 0}
*Clientes que desbloquearam:* ${stats.desbloqueados || 0}
*Total de clientes ativos:* ${stats.total || 0}

✅ Enviados: ${sent} | ❌ Falhas: ${failed}

Fique com Deus. Operação rodando com sucesso. 🙏`;
}

module.exports = {
  getGender, getTreatment, getDaysUntilReturn,
  msgFaseInicial9h, msgFaseInicial12h, msgFaseInicial15h,
  msgFaseCritica9h, msgFaseCritica15h,
  msgRetornoAmanha, msgDiaDoRetorno,
  msgPendenteFormalização, msgAguardaDesbloqueio,
  msgTransferirSetor, msgMensagemAutomatica, msgNumeroErrado,
  buildRelatorio
};
