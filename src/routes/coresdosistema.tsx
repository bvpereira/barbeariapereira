import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  COLOR_TOKENS,
  ColorToken,
  TOKEN_GROUPS,
  TOKEN_LABEL,
  ThemeTokens,
  cssVarName,
  PRESETS,
  DEFAULT_PRESET,
} from "@/lib/themePresets";
import { toast } from "sonner";

export const Route = createFileRoute("/coresdosistema")({
  component: CoresPage,
});

type Modo = "light" | "dark" | "auto";
type EditingMode = "light" | "dark";

function emptyTokens(): ThemeTokens {
  const t: any = {};
  for (const k of COLOR_TOKENS) t[k] = "#000000";
  return t as ThemeTokens;
}

function CoresPage() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { cores, refresh } = useTheme();

  const [nivelOk, setNivelOk] = useState<boolean | null>(null);
  const [preset, setPreset] = useState<string>(DEFAULT_PRESET);
  const [modo, setModo] = useState<Modo>("light");
  const [editing, setEditing] = useState<EditingMode>("light");
  const [light, setLight] = useState<ThemeTokens>(PRESETS[DEFAULT_PRESET].light);
  const [dark, setDark] = useState<ThemeTokens>(PRESETS[DEFAULT_PRESET].dark);
  const [saving, setSaving] = useState(false);

  // gate nível 1
  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (!u) { navigate({ to: "/login" }); return; }
      const parsed = JSON.parse(u);
      if (parsed.nivel !== 1) { navigate({ to: "/admin" }); return; }
      setNivelOk(true);
    } catch { navigate({ to: "/login" }); }
  }, [navigate]);

  // hidratação a partir do que está salvo
  useEffect(() => {
    if (!cores) return;
    setPreset(cores.preset || "custom");
    setModo((cores.modo as Modo) || "light");
    setLight((prev) => ({ ...prev, ...cores.light }));
    setDark((prev) => ({ ...prev, ...cores.dark }));
  }, [cores]);

  // preview ao vivo: aplica CSS vars enquanto edita
  useEffect(() => {
    const root = document.documentElement;
    const tokens = editing === "light" ? light : dark;
    for (const t of COLOR_TOKENS) {
      root.style.setProperty(cssVarName(t), tokens[t]);
    }
    if (editing === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [light, dark, editing]);

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setPreset(key);
    setLight(p.light);
    setDark(p.dark);
  };

  const setToken = (mode: EditingMode, token: ColorToken, value: string) => {
    setPreset("custom");
    if (mode === "light") setLight((prev) => ({ ...prev, [token]: value }));
    else setDark((prev) => ({ ...prev, [token]: value }));
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const row: any = { barbearia_id: tenant.id, preset, modo };
      for (const t of COLOR_TOKENS) {
        row[t] = light[t];
        row["dark_" + t] = dark[t];
      }
      const { error } = await supabase
        .from("cores" as any)
        .upsert(row, { onConflict: "barbearia_id" });
      if (error) throw error;
      await refresh();
      toast.success("Cores salvas!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurarPreset = () => {
    const key = preset && preset !== "custom" ? preset : DEFAULT_PRESET;
    applyPreset(key);
  };

  const currentTokens = editing === "light" ? light : dark;

  const presetKeys = useMemo(() => Object.keys(PRESETS), []);

  if (nivelOk !== true) return null;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ color: "var(--titulo)" }}>
            Cores do sistema
          </h1>
          <p className="text-muted-foreground" style={{ color: "var(--subtitulo)" }}>
            Personalize a aparência das páginas internas da sua barbearia.
            A página pública <code>/{tenant?.slug || "slug"}</code> não é afetada.
          </p>
        </div>

        {/* Presets */}
        <Card>
          <CardHeader><CardTitle>Preset</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {presetKeys.map((k) => {
              const p = PRESETS[k];
              const isActive = preset === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => applyPreset(k)}
                  className={`p-3 rounded-lg border text-left transition ${
                    isActive ? "ring-2 ring-primary border-primary" : "border-border hover:border-primary/50"
                  }`}
                  style={{ background: p.light.background, color: p.light.foreground }}
                >
                  <div className="text-sm font-semibold mb-2">{p.label}</div>
                  <div className="flex gap-1">
                    {(["primary", "secondary", "accent", "destructive"] as ColorToken[]).map((t) => (
                      <span key={t} className="w-5 h-5 rounded" style={{ background: p.light[t] }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Modo + toggle de edição */}
        <Card>
          <CardHeader><CardTitle>Modo de cores</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Modo aplicado ao site</Label>
              <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="flex gap-4">
                {(["light", "dark", "auto"] as Modo[]).map((m) => (
                  <div key={m} className="flex items-center gap-2">
                    <RadioGroupItem value={m} id={`modo-${m}`} />
                    <Label htmlFor={`modo-${m}`} className="capitalize">
                      {m === "light" ? "Claro" : m === "dark" ? "Escuro" : "Automático"}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="mb-2 block">Editando esquema</Label>
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                {(["light", "dark"] as EditingMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditing(m)}
                    className={`px-4 py-2 text-sm ${
                      editing === m ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
                    }`}
                  >
                    {m === "light" ? "Claro" : "Escuro"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form de tokens */}
        {TOKEN_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader><CardTitle>{group.title}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.tokens.map((t) => (
                <div key={t} className="space-y-1">
                  <Label htmlFor={`fld-${t}`} className="text-xs">{TOKEN_LABEL[t]}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTokens[t] || "#000000"}
                      onChange={(e) => setToken(editing, t, e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <Input
                      id={`fld-${t}`}
                      value={currentTokens[t] || ""}
                      onChange={(e) => setToken(editing, t, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Preview de componentes */}
        <Card>
          <CardHeader><CardTitle>Pré-visualização</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button>Botão primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="destructive">Excluir</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
              <h3 className="font-semibold" style={{ color: "var(--titulo)" }}>Título do card</h3>
              <p className="text-sm" style={{ color: "var(--subtitulo)" }}>
                Subtítulo do card usando os tokens definidos acima.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border border-border">
          <Button variant="outline" onClick={handleRestaurarPreset}>Restaurar preset</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar cores"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
