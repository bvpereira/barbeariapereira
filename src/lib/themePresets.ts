// Tokens de tema (mesma chave para light e dark; o context aplica em --<chave>)
export const COLOR_TOKENS = [
  "background", "foreground",
  "card", "card_foreground",
  "popover", "popover_foreground",
  "primary", "primary_foreground",
  "secondary", "secondary_foreground",
  "muted", "muted_foreground",
  "accent", "accent_foreground",
  "destructive", "destructive_foreground",
  "border", "input", "ring",
  "titulo", "subtitulo",
  "sidebar", "sidebar_foreground",
  "sidebar_primary", "sidebar_primary_foreground",
  "sidebar_accent", "sidebar_accent_foreground",
  "sidebar_border", "sidebar_ring",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ThemeTokens = Record<ColorToken, string>;

// Mapeia chave do banco/token -> nome real da CSS var
export function cssVarName(token: ColorToken): string {
  return "--" + token.replace(/_/g, "-");
}

export const TOKEN_GROUPS: { title: string; tokens: ColorToken[] }[] = [
  { title: "Geral", tokens: ["background", "foreground", "border", "input", "ring"] },
  { title: "Tipografia", tokens: ["titulo", "subtitulo", "muted_foreground"] },
  { title: "Botões", tokens: ["primary", "primary_foreground", "secondary", "secondary_foreground", "destructive", "destructive_foreground", "accent", "accent_foreground"] },
  { title: "Cards e superfícies", tokens: ["card", "card_foreground", "popover", "popover_foreground", "muted"] },
  { title: "Sidebar", tokens: ["sidebar", "sidebar_foreground", "sidebar_primary", "sidebar_primary_foreground", "sidebar_accent", "sidebar_accent_foreground", "sidebar_border", "sidebar_ring"] },
];

export const TOKEN_LABEL: Record<ColorToken, string> = {
  background: "Fundo geral",
  foreground: "Texto base",
  card: "Fundo de card",
  card_foreground: "Texto em card",
  popover: "Fundo de popover",
  popover_foreground: "Texto em popover",
  primary: "Botão primário",
  primary_foreground: "Texto botão primário",
  secondary: "Botão secundário",
  secondary_foreground: "Texto botão secundário",
  muted: "Fundo apagado",
  muted_foreground: "Texto apagado",
  accent: "Destaque (hover)",
  accent_foreground: "Texto em destaque",
  destructive: "Excluir / erro",
  destructive_foreground: "Texto excluir",
  border: "Borda",
  input: "Borda de input",
  ring: "Anel de foco",
  titulo: "Título",
  subtitulo: "Subtítulo",
  sidebar: "Sidebar (fundo)",
  sidebar_foreground: "Sidebar (texto)",
  sidebar_primary: "Sidebar item ativo",
  sidebar_primary_foreground: "Sidebar item ativo (texto)",
  sidebar_accent: "Sidebar hover",
  sidebar_accent_foreground: "Sidebar hover (texto)",
  sidebar_border: "Sidebar borda",
  sidebar_ring: "Sidebar foco",
};

// Presets — sempre em hex para casar com input type="color"
const CLARO_LIGHT: ThemeTokens = {
  background: "#ffffff", foreground: "#0b1220",
  card: "#ffffff", card_foreground: "#0b1220",
  popover: "#ffffff", popover_foreground: "#0b1220",
  primary: "#2563eb", primary_foreground: "#ffffff",
  secondary: "#f1f5f9", secondary_foreground: "#0b1220",
  muted: "#f1f5f9", muted_foreground: "#64748b",
  accent: "#e0e7ff", accent_foreground: "#1e1b4b",
  destructive: "#dc2626", destructive_foreground: "#ffffff",
  border: "#e2e8f0", input: "#e2e8f0", ring: "#2563eb",
  titulo: "#0b1220", subtitulo: "#475569",
  sidebar: "#f8fafc", sidebar_foreground: "#0b1220",
  sidebar_primary: "#2563eb", sidebar_primary_foreground: "#ffffff",
  sidebar_accent: "#e0e7ff", sidebar_accent_foreground: "#1e1b4b",
  sidebar_border: "#e2e8f0", sidebar_ring: "#2563eb",
};

const ESCURO_DARK: ThemeTokens = {
  background: "#0b1220", foreground: "#f8fafc",
  card: "#111827", card_foreground: "#f8fafc",
  popover: "#111827", popover_foreground: "#f8fafc",
  primary: "#60a5fa", primary_foreground: "#0b1220",
  secondary: "#1f2937", secondary_foreground: "#f8fafc",
  muted: "#1f2937", muted_foreground: "#94a3b8",
  accent: "#1e3a8a", accent_foreground: "#dbeafe",
  destructive: "#ef4444", destructive_foreground: "#ffffff",
  border: "#1f2937", input: "#1f2937", ring: "#60a5fa",
  titulo: "#f8fafc", subtitulo: "#cbd5e1",
  sidebar: "#0f172a", sidebar_foreground: "#f8fafc",
  sidebar_primary: "#60a5fa", sidebar_primary_foreground: "#0b1220",
  sidebar_accent: "#1e3a8a", sidebar_accent_foreground: "#dbeafe",
  sidebar_border: "#1f2937", sidebar_ring: "#60a5fa",
};

const CLASSICO_LIGHT: ThemeTokens = {
  background: "#fdf8ef", foreground: "#1c1917",
  card: "#fffaf0", card_foreground: "#1c1917",
  popover: "#fffaf0", popover_foreground: "#1c1917",
  primary: "#b45309", primary_foreground: "#fffbeb",
  secondary: "#fde68a", secondary_foreground: "#1c1917",
  muted: "#f5efe0", muted_foreground: "#78716c",
  accent: "#fcd34d", accent_foreground: "#1c1917",
  destructive: "#b91c1c", destructive_foreground: "#fffbeb",
  border: "#e7d9b8", input: "#e7d9b8", ring: "#b45309",
  titulo: "#1c1917", subtitulo: "#57534e",
  sidebar: "#1c1917", sidebar_foreground: "#fde68a",
  sidebar_primary: "#fbbf24", sidebar_primary_foreground: "#1c1917",
  sidebar_accent: "#292524", sidebar_accent_foreground: "#fde68a",
  sidebar_border: "#292524", sidebar_ring: "#fbbf24",
};

const CLASSICO_DARK: ThemeTokens = {
  background: "#1c1917", foreground: "#fde68a",
  card: "#292524", card_foreground: "#fde68a",
  popover: "#292524", popover_foreground: "#fde68a",
  primary: "#fbbf24", primary_foreground: "#1c1917",
  secondary: "#3f3f46", secondary_foreground: "#fde68a",
  muted: "#292524", muted_foreground: "#a8a29e",
  accent: "#78350f", accent_foreground: "#fde68a",
  destructive: "#ef4444", destructive_foreground: "#fffbeb",
  border: "#3f3f46", input: "#3f3f46", ring: "#fbbf24",
  titulo: "#fde68a", subtitulo: "#d6d3d1",
  sidebar: "#0c0a09", sidebar_foreground: "#fde68a",
  sidebar_primary: "#fbbf24", sidebar_primary_foreground: "#1c1917",
  sidebar_accent: "#292524", sidebar_accent_foreground: "#fde68a",
  sidebar_border: "#292524", sidebar_ring: "#fbbf24",
};

const MODERNO_LIGHT: ThemeTokens = {
  background: "#fafafa", foreground: "#0a0a0a",
  card: "#ffffff", card_foreground: "#0a0a0a",
  popover: "#ffffff", popover_foreground: "#0a0a0a",
  primary: "#10b981", primary_foreground: "#052e1f",
  secondary: "#f4f4f5", secondary_foreground: "#0a0a0a",
  muted: "#f4f4f5", muted_foreground: "#71717a",
  accent: "#d1fae5", accent_foreground: "#064e3b",
  destructive: "#ef4444", destructive_foreground: "#ffffff",
  border: "#e4e4e7", input: "#e4e4e7", ring: "#10b981",
  titulo: "#0a0a0a", subtitulo: "#52525b",
  sidebar: "#ffffff", sidebar_foreground: "#0a0a0a",
  sidebar_primary: "#10b981", sidebar_primary_foreground: "#052e1f",
  sidebar_accent: "#f4f4f5", sidebar_accent_foreground: "#0a0a0a",
  sidebar_border: "#e4e4e7", sidebar_ring: "#10b981",
};

const MODERNO_DARK: ThemeTokens = {
  background: "#09090b", foreground: "#fafafa",
  card: "#0a0a0a", card_foreground: "#fafafa",
  popover: "#0a0a0a", popover_foreground: "#fafafa",
  primary: "#34d399", primary_foreground: "#052e1f",
  secondary: "#18181b", secondary_foreground: "#fafafa",
  muted: "#18181b", muted_foreground: "#a1a1aa",
  accent: "#064e3b", accent_foreground: "#d1fae5",
  destructive: "#ef4444", destructive_foreground: "#ffffff",
  border: "#27272a", input: "#27272a", ring: "#34d399",
  titulo: "#fafafa", subtitulo: "#d4d4d8",
  sidebar: "#09090b", sidebar_foreground: "#fafafa",
  sidebar_primary: "#34d399", sidebar_primary_foreground: "#052e1f",
  sidebar_accent: "#18181b", sidebar_accent_foreground: "#fafafa",
  sidebar_border: "#27272a", sidebar_ring: "#34d399",
};

export const PRESETS: Record<string, { label: string; light: ThemeTokens; dark: ThemeTokens }> = {
  claro: { label: "Claro", light: CLARO_LIGHT, dark: ESCURO_DARK },
  escuro: { label: "Escuro", light: CLARO_LIGHT, dark: ESCURO_DARK },
  classico: { label: "Barbearia Clássica", light: CLASSICO_LIGHT, dark: CLASSICO_DARK },
  moderno: { label: "Moderno Minimal", light: MODERNO_LIGHT, dark: MODERNO_DARK },
};

export const DEFAULT_PRESET = "classico";
