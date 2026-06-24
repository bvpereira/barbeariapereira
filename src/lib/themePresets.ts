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

const OCEAN_LIGHT: ThemeTokens = {
  background: "#f0f9ff", foreground: "#082f49",
  card: "#ffffff", card_foreground: "#082f49",
  popover: "#ffffff", popover_foreground: "#082f49",
  primary: "#0284c7", primary_foreground: "#f0f9ff",
  secondary: "#e0f2fe", secondary_foreground: "#082f49",
  muted: "#e0f2fe", muted_foreground: "#0c4a6e",
  accent: "#bae6fd", accent_foreground: "#082f49",
  destructive: "#dc2626", destructive_foreground: "#ffffff",
  border: "#bae6fd", input: "#bae6fd", ring: "#0284c7",
  titulo: "#082f49", subtitulo: "#0c4a6e",
  sidebar: "#082f49", sidebar_foreground: "#e0f2fe",
  sidebar_primary: "#38bdf8", sidebar_primary_foreground: "#082f49",
  sidebar_accent: "#0c4a6e", sidebar_accent_foreground: "#e0f2fe",
  sidebar_border: "#0c4a6e", sidebar_ring: "#38bdf8",
};

const OCEAN_DARK: ThemeTokens = {
  background: "#031827", foreground: "#e0f2fe",
  card: "#082f49", card_foreground: "#e0f2fe",
  popover: "#082f49", popover_foreground: "#e0f2fe",
  primary: "#38bdf8", primary_foreground: "#031827",
  secondary: "#0c4a6e", secondary_foreground: "#e0f2fe",
  muted: "#0c4a6e", muted_foreground: "#7dd3fc",
  accent: "#075985", accent_foreground: "#e0f2fe",
  destructive: "#ef4444", destructive_foreground: "#ffffff",
  border: "#0c4a6e", input: "#0c4a6e", ring: "#38bdf8",
  titulo: "#e0f2fe", subtitulo: "#bae6fd",
  sidebar: "#020c18", sidebar_foreground: "#e0f2fe",
  sidebar_primary: "#38bdf8", sidebar_primary_foreground: "#031827",
  sidebar_accent: "#082f49", sidebar_accent_foreground: "#e0f2fe",
  sidebar_border: "#082f49", sidebar_ring: "#38bdf8",
};

const SUNSET_LIGHT: ThemeTokens = {
  background: "#fff7ed", foreground: "#431407",
  card: "#ffffff", card_foreground: "#431407",
  popover: "#ffffff", popover_foreground: "#431407",
  primary: "#ea580c", primary_foreground: "#fff7ed",
  secondary: "#ffedd5", secondary_foreground: "#431407",
  muted: "#ffedd5", muted_foreground: "#9a3412",
  accent: "#fed7aa", accent_foreground: "#431407",
  destructive: "#b91c1c", destructive_foreground: "#ffffff",
  border: "#fed7aa", input: "#fed7aa", ring: "#ea580c",
  titulo: "#431407", subtitulo: "#9a3412",
  sidebar: "#431407", sidebar_foreground: "#ffedd5",
  sidebar_primary: "#fb923c", sidebar_primary_foreground: "#431407",
  sidebar_accent: "#7c2d12", sidebar_accent_foreground: "#ffedd5",
  sidebar_border: "#7c2d12", sidebar_ring: "#fb923c",
};

const SUNSET_DARK: ThemeTokens = {
  background: "#1c0a03", foreground: "#ffedd5",
  card: "#431407", card_foreground: "#ffedd5",
  popover: "#431407", popover_foreground: "#ffedd5",
  primary: "#fb923c", primary_foreground: "#1c0a03",
  secondary: "#7c2d12", secondary_foreground: "#ffedd5",
  muted: "#7c2d12", muted_foreground: "#fdba74",
  accent: "#9a3412", accent_foreground: "#ffedd5",
  destructive: "#ef4444", destructive_foreground: "#ffffff",
  border: "#7c2d12", input: "#7c2d12", ring: "#fb923c",
  titulo: "#ffedd5", subtitulo: "#fed7aa",
  sidebar: "#0f0502", sidebar_foreground: "#ffedd5",
  sidebar_primary: "#fb923c", sidebar_primary_foreground: "#1c0a03",
  sidebar_accent: "#431407", sidebar_accent_foreground: "#ffedd5",
  sidebar_border: "#431407", sidebar_ring: "#fb923c",
};

const ROYAL_LIGHT: ThemeTokens = {
  background: "#faf5ff", foreground: "#2e1065",
  card: "#ffffff", card_foreground: "#2e1065",
  popover: "#ffffff", popover_foreground: "#2e1065",
  primary: "#7c3aed", primary_foreground: "#faf5ff",
  secondary: "#ede9fe", secondary_foreground: "#2e1065",
  muted: "#ede9fe", muted_foreground: "#5b21b6",
  accent: "#ddd6fe", accent_foreground: "#2e1065",
  destructive: "#dc2626", destructive_foreground: "#ffffff",
  border: "#ddd6fe", input: "#ddd6fe", ring: "#7c3aed",
  titulo: "#2e1065", subtitulo: "#5b21b6",
  sidebar: "#2e1065", sidebar_foreground: "#ede9fe",
  sidebar_primary: "#a78bfa", sidebar_primary_foreground: "#2e1065",
  sidebar_accent: "#4c1d95", sidebar_accent_foreground: "#ede9fe",
  sidebar_border: "#4c1d95", sidebar_ring: "#a78bfa",
};

const ROYAL_DARK: ThemeTokens = {
  background: "#130726", foreground: "#ede9fe",
  card: "#2e1065", card_foreground: "#ede9fe",
  popover: "#2e1065", popover_foreground: "#ede9fe",
  primary: "#a78bfa", primary_foreground: "#130726",
  secondary: "#4c1d95", secondary_foreground: "#ede9fe",
  muted: "#4c1d95", muted_foreground: "#c4b5fd",
  accent: "#5b21b6", accent_foreground: "#ede9fe",
  destructive: "#ef4444", destructive_foreground: "#ffffff",
  border: "#4c1d95", input: "#4c1d95", ring: "#a78bfa",
  titulo: "#ede9fe", subtitulo: "#ddd6fe",
  sidebar: "#0a0314", sidebar_foreground: "#ede9fe",
  sidebar_primary: "#a78bfa", sidebar_primary_foreground: "#130726",
  sidebar_accent: "#2e1065", sidebar_accent_foreground: "#ede9fe",
  sidebar_border: "#2e1065", sidebar_ring: "#a78bfa",
};

const MONO_LIGHT: ThemeTokens = {
  background: "#ffffff", foreground: "#000000",
  card: "#ffffff", card_foreground: "#000000",
  popover: "#ffffff", popover_foreground: "#000000",
  primary: "#000000", primary_foreground: "#ffffff",
  secondary: "#f5f5f5", secondary_foreground: "#000000",
  muted: "#f5f5f5", muted_foreground: "#525252",
  accent: "#e5e5e5", accent_foreground: "#000000",
  destructive: "#000000", destructive_foreground: "#ffffff",
  border: "#e5e5e5", input: "#e5e5e5", ring: "#000000",
  titulo: "#000000", subtitulo: "#525252",
  sidebar: "#ffffff", sidebar_foreground: "#000000",
  sidebar_primary: "#000000", sidebar_primary_foreground: "#ffffff",
  sidebar_accent: "#f5f5f5", sidebar_accent_foreground: "#000000",
  sidebar_border: "#e5e5e5", sidebar_ring: "#000000",
};

const MONO_DARK: ThemeTokens = {
  background: "#000000", foreground: "#ffffff",
  card: "#0a0a0a", card_foreground: "#ffffff",
  popover: "#0a0a0a", popover_foreground: "#ffffff",
  primary: "#ffffff", primary_foreground: "#000000",
  secondary: "#171717", secondary_foreground: "#ffffff",
  muted: "#171717", muted_foreground: "#a3a3a3",
  accent: "#262626", accent_foreground: "#ffffff",
  destructive: "#ffffff", destructive_foreground: "#000000",
  border: "#262626", input: "#262626", ring: "#ffffff",
  titulo: "#ffffff", subtitulo: "#a3a3a3",
  sidebar: "#000000", sidebar_foreground: "#ffffff",
  sidebar_primary: "#ffffff", sidebar_primary_foreground: "#000000",
  sidebar_accent: "#171717", sidebar_accent_foreground: "#ffffff",
  sidebar_border: "#262626", sidebar_ring: "#ffffff",
};

export const PRESETS: Record<string, { label: string; light: ThemeTokens; dark: ThemeTokens }> = {
  claro: { label: "Claro", light: CLARO_LIGHT, dark: CLARO_LIGHT },
  escuro: { label: "Escuro", light: ESCURO_DARK, dark: ESCURO_DARK },
  classico: { label: "Barbearia Clássica", light: CLASSICO_LIGHT, dark: CLASSICO_DARK },
  moderno: { label: "Moderno Minimal", light: MODERNO_LIGHT, dark: MODERNO_DARK },
  mono: { label: "Minimalista P&B", light: MONO_LIGHT, dark: MONO_DARK },
  ocean: { label: "Ocean Breeze", light: OCEAN_LIGHT, dark: OCEAN_DARK },
  sunset: { label: "Sunset Glow", light: SUNSET_LIGHT, dark: SUNSET_DARK },
  royal: { label: "Royal Purple", light: ROYAL_LIGHT, dark: ROYAL_DARK },
};

export const DEFAULT_PRESET = "classico";
