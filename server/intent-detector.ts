// server/intent-detector.ts
// Detecta a intenção do cliente a partir do texto recebido no WhatsApp.
// Retorna quais ações foram detectadas (assinou, desbloqueou, aprovado, pediu ajuda).

export type DetectedIntent =
  | "signed"          // cliente assinou o link de formalização
  | "unlocked"        // cliente desbloqueou o benefício
  | "approved"        // cliente diz que foi aprovado / saiu / caiu
  | "asking_help"     // pediu ajuda — não para envio, só sinaliza
  | null;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")    // remove pontuação
    .replace(/\s+/g, " ")
    .trim();
}

// Padrões: regex pra capturar variações comuns do português falado/whatsapp.
const SIGNED_PATTERNS: RegExp[] = [
  /\b(ja|jah|ah|acabei de|acabo de|terminei de|recem)\s+(assin\w+)/,
  /\b(assinei|assinado|assinada|assinou|assinatura\s+feita|assinatura\s+ok)\b/,
  /\bassin\w+\s+(ja|agora|hoje|tudo|certo|ok|sim)\b/,
  /\b(link\s+assinado|link\s+ja\s+assinado)\b/,
];

const UNLOCKED_PATTERNS: RegExp[] = [
  /\b(ja|jah|ah|acabei de|acabo de|consegui)\s+(desbloqu\w+)/,
  /\b(desbloqueei|desbloqueado|desbloqueada|desbloqueou)\b/,
  /\b(beneficio\s+desbloqueado|inss\s+desbloqueado|liberou\s+o\s+beneficio)\b/,
  /\bdesbloqu\w+\s+(ja|agora|hoje|ok|sim)\b/,
];

const APPROVED_PATTERNS: RegExp[] = [
  /\b(foi\s+aprovado|ja\s+foi\s+aprovado|aprovada|aprovado)\b/,
  /\b(caiu\s+(o\s+)?(dinheiro|valor|deposito))\b/,
  /\b(deu\s+certo|ja\s+saiu|ja\s+recebi)\b/,
  /\b(deposito\s+caiu|valor\s+caiu)\b/,
];

const HELP_PATTERNS: RegExp[] = [
  /\b(nao\s+sei|como\s+faco|me\s+ajuda|ajuda\s*\?|preciso\s+de\s+ajuda)\b/,
  /\b(nao\s+consegui|nao\s+consigo|nao\s+ta\s+indo|nao\s+abre|deu\s+erro)\b/,
];

export function detectIntent(rawText: string): DetectedIntent {
  if (!rawText || typeof rawText !== "string") return null;
  const text = normalize(rawText);
  if (text.length === 0) return null;

  if (SIGNED_PATTERNS.some((re) => re.test(text))) return "signed";
  if (UNLOCKED_PATTERNS.some((re) => re.test(text))) return "unlocked";
  if (APPROVED_PATTERNS.some((re) => re.test(text))) return "approved";
  if (HELP_PATTERNS.some((re) => re.test(text))) return "asking_help";

  return null;
}

// Versão que retorna TODAS as intenções (útil quando o cliente diz
// "já assinei e desbloqueei" numa única mensagem).
export function detectAllIntents(rawText: string): {
  signed: boolean;
  unlocked: boolean;
  approved: boolean;
  askingHelp: boolean;
} {
  if (!rawText || typeof rawText !== "string") {
    return { signed: false, unlocked: false, approved: false, askingHelp: false };
  }
  const text = normalize(rawText);
  return {
    signed: SIGNED_PATTERNS.some((re) => re.test(text)),
    unlocked: UNLOCKED_PATTERNS.some((re) => re.test(text)),
    approved: APPROVED_PATTERNS.some((re) => re.test(text)),
    askingHelp: HELP_PATTERNS.some((re) => re.test(text)),
  };
}
