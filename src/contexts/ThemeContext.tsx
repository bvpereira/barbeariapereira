import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { COLOR_TOKENS, ColorToken, ThemeTokens, cssVarName, PRESETS, DEFAULT_PRESET } from "@/lib/themePresets";

export interface CoresRow {
  id?: string;
  barbearia_id: string;
  preset: string;
  modo: "light" | "dark" | "auto";
  light: Partial<ThemeTokens>;
  dark: Partial<ThemeTokens>;
}

interface ThemeContextType {
  cores: CoresRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({ cores: null, loading: true, refresh: async () => {} });

const STYLE_TAG_ID = "tenant-dark-theme";

function rowToCores(row: any, barbeariaId: string): CoresRow {
  const light: Partial<ThemeTokens> = {};
  const dark: Partial<ThemeTokens> = {};
  for (const t of COLOR_TOKENS) {
    if (row[t]) light[t] = row[t];
    if (row["dark_" + t]) dark[t] = row["dark_" + t];
  }
  return {
    id: row.id,
    barbearia_id: barbeariaId,
    preset: row.preset || "custom",
    modo: (row.modo as any) || "light",
    light,
    dark,
  };
}

function applyLight(tokens: Partial<ThemeTokens>) {
  const root = document.documentElement;
  for (const t of COLOR_TOKENS) {
    const v = tokens[t];
    if (v) root.style.setProperty(cssVarName(t), v);
    else root.style.removeProperty(cssVarName(t));
  }
}

function applyDarkStyleTag(tokens: Partial<ThemeTokens>) {
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  const decls = COLOR_TOKENS
    .filter((t) => tokens[t])
    .map((t) => `${cssVarName(t)}: ${tokens[t]};`)
    .join("");
  const css = decls ? `.dark{${decls}}` : "";
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

function clearTheme() {
  const root = document.documentElement;
  for (const t of COLOR_TOKENS) root.style.removeProperty(cssVarName(t));
  const tag = document.getElementById(STYLE_TAG_ID);
  if (tag) tag.textContent = "";
  root.classList.remove("dark");
}

function applyMode(modo: "light" | "dark" | "auto", cleanupRef: { fn?: () => void }) {
  cleanupRef.fn?.();
  cleanupRef.fn = undefined;
  const root = document.documentElement;
  if (modo === "dark") {
    root.classList.add("dark");
  } else if (modo === "light") {
    root.classList.remove("dark");
  } else {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (mq.matches) root.classList.add("dark");
      else root.classList.remove("dark");
    };
    update();
    mq.addEventListener("change", update);
    cleanupRef.fn = () => mq.removeEventListener("change", update);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant } = useTenant();
  const [cores, setCores] = useState<CoresRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCores = useCallback(async () => {
    if (!tenant?.id) {
      setCores(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("cores" as any)
        .select("*")
        .eq("barbearia_id", tenant.id)
        .maybeSingle();
      if (data) {
        const row = rowToCores(data, tenant.id);
        setCores(row);
        try { localStorage.setItem(`theme:${tenant.slug}`, JSON.stringify(row)); } catch {}
      } else {
        setCores(null);
        try { localStorage.removeItem(`theme:${tenant.slug}`); } catch {}
      }
    } catch (e) {
      console.error("[ThemeProvider] erro carregando cores", e);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, tenant?.slug]);

  // Aplicação reativa
  useEffect(() => {
    const cleanupRef: { fn?: () => void } = {};
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    const isPublicLanding = !!tenant?.slug && pathname === `/${tenant.slug}`;

    if (!cores || isPublicLanding) {
      clearTheme();
      return () => cleanupRef.fn?.();
    }
    applyLight(cores.light);
    applyDarkStyleTag(cores.dark);
    applyMode(cores.modo, cleanupRef);
    return () => cleanupRef.fn?.();
  }, [cores, tenant?.slug]);

  // Cache otimista do localStorage antes do fetch (evita FOUC)
  useEffect(() => {
    if (!tenant?.slug) return;
    try {
      const raw = localStorage.getItem(`theme:${tenant.slug}`);
      if (raw) setCores(JSON.parse(raw));
    } catch {}
    fetchCores();
  }, [tenant?.slug, fetchCores]);

  return (
    <ThemeContext.Provider value={{ cores, loading, refresh: fetchCores }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export { PRESETS, DEFAULT_PRESET };
