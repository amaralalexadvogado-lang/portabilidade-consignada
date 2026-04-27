// server/intent-detector.ts
// Detecta a intenção do cliente a partir do texto recebido no WhatsApp.

export type DetectedIntent =
  | "signed"
  | "unlocked"
  | "approved"
  | "asking_help"
  | null;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
