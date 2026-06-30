import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme, CoresRow } from "@/contexts/ThemeContext";
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
import { Pencil, Check, X, Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/cores")({
  component: CoresPage,
});

type Modo = "light" | "dark" | "auto";
type EditingMode = "light" | "dark";

function CoresPage() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { perfis, refresh } = useTheme();

  const [nivelOk, setNivelOk] = useState<boolean | null>(null);
  const [perfilSelId, setPerfilSelId] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>(DEFAULT_PRESET);
  const [light, setLight] = useState<ThemeTokens>(PRESETS[DEFAULT_PRESET].light);
  const [dark, setDark] = useState<ThemeTokens>(PRESETS[DEFAULT_PRESET].dark);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nomeEdit, setNomeEdit] = useState("");
  const [duplicarOpen, setDuplicarOpen] = useState(false);

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

  // seleciona perfil inicial (o ativo) quando perfis carregarem
  useEffect(() => {
    if (perfis.length === 0) return;
    if (perfilSelId && perfis.some((p) => p.id === perfilSelId)) return;
    const ativo = perfis.find((p) => p.ativo) || perfis[0];
    if (ativo?.id) setPerfilSelId(ativo.id);
  }, [perfis, perfilSelId]);

  const perfilSel = useMemo<CoresRow | null>(
    () => perfis.find((p) => p.id === perfilSelId) || null,
    [perfis, perfilSelId],
  );

  // hidrata estado a partir do perfil selecionado
  useEffect(() => {
    if (!perfilSel) return;
    setPreset(perfilSel.preset || "custom");
    
    setLight({ ...PRESETS[DEFAULT_PRESET].light, ...perfilSel.light });
    setDark({ ...PRESETS[DEFAULT_PRESET].dark, ...perfilSel.dark });
    setNomeEdit(perfilSel.nome_perfil || "");
    setRenaming(false);
  }, [perfilSel?.id]);

  // preview ao vivo (sempre claro)
  useEffect(() => {
    const root = document.documentElement;
    for (const t of COLOR_TOKENS) {
      root.style.setProperty(cssVarName(t), light[t]);
    }
    root.classList.remove("dark");
  }, [light]);

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

  const buildRow = () => {
    const row: any = { preset, modo: "light" };
    for (const t of COLOR_TOKENS) {
      row[t] = light[t];
      row["dark_" + t] = dark[t];
    }
    return row;
  };

  const handleSave = async () => {
    if (!perfilSel?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cores" as any)
        .update(buildRow())
        .eq("id", perfilSel.id);
      if (error) throw error;
      await refresh();
      toast.success("Perfil salvo!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurarPreset = () => {
    const key = preset && preset !== "custom" ? preset : DEFAULT_PRESET;
    applyPreset(key);
  };

  const handleAtivar = async () => {
    if (!perfilSel?.id || perfilSel.ativo) return;
    try {
      const { error } = await supabase.rpc("set_perfil_cores_ativo" as any, { _perfil_id: perfilSel.id });
      if (error) throw error;
      await refresh();
      toast.success(`Perfil "${perfilSel.nome_perfil}" agora está ativo`);
    } catch (e: any) {
      toast.error("Erro ao ativar: " + (e?.message || "desconhecido"));
    }
  };

  const handleRenomear = async () => {
    if (!perfilSel?.id) return;
    const nome = nomeEdit.trim();
    if (!nome) { toast.error("Nome não pode ficar vazio"); return; }
    if (nome.length > 30) { toast.error("Máx. 30 caracteres"); return; }
    try {
      const { error } = await supabase
        .from("cores" as any)
        .update({ nome_perfil: nome })
        .eq("id", perfilSel.id);
      if (error) {
        if ((error as any).code === "23505") toast.error("Já existe um perfil com esse nome");
        else throw error;
        return;
      }
      await refresh();
      setRenaming(false);
      toast.success("Perfil renomeado");
    } catch (e: any) {
      toast.error("Erro ao renomear: " + (e?.message || "desconhecido"));
    }
  };

  const destinoPerfil = useMemo(
    () => (perfilSel ? perfis.find((p) => p.id !== perfilSel.id) : undefined),
    [perfis, perfilSel],
  );

  const handleDuplicarConfirm = async () => {
    if (!perfilSel?.id || !destinoPerfil?.id) return;
    try {
      const { error } = await supabase
        .from("cores" as any)
        .update(buildRow())
        .eq("id", destinoPerfil.id);
      if (error) throw error;
      await refresh();
      toast.success(`Cores duplicadas para "${destinoPerfil.nome_perfil}"`);
    } catch (e: any) {
      toast.error("Erro ao duplicar: " + (e?.message || "desconhecido"));
    } finally {
      setDuplicarOpen(false);
    }
  };

  const currentTokens = light;
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

        {/* Perfis */}
        <Card>
          <CardHeader><CardTitle>Perfis de cores</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {perfis.map((p) => {
                const isSel = p.id === perfilSelId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPerfilSelId(p.id!)}
                    className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 transition ${
                      isSel ? "border-primary ring-2 ring-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span>{p.nome_perfil}</span>
                    {p.ativo && <Badge variant="secondary" className="text-[10px]">Ativo</Badge>}
                  </button>
                );
              })}
            </div>

            {perfilSel && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                {renaming ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nomeEdit}
                      onChange={(e) => setNomeEdit(e.target.value)}
                      maxLength={30}
                      className="h-8 w-48"
                      autoFocus
                    />
                    <Button size="sm" variant="outline" onClick={handleRenomear}><Check className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRenaming(false); setNomeEdit(perfilSel.nome_perfil || ""); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                    <Pencil className="w-4 h-4 mr-1" /> Renomear
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleAtivar} disabled={!!perfilSel.ativo}>
                  {perfilSel.ativo ? "Já está ativo" : "Tornar ativo"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDuplicarOpen(true)} disabled={perfis.length < 2 || !destinoPerfil}>
                  <Copy className="w-4 h-4 mr-1" /> Duplicar para o outro perfil
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
          <Button onClick={handleSave} disabled={saving || !perfilSel}>
            {saving ? "Salvando..." : `Salvar ${perfilSel?.nome_perfil || ""}`.trim()}
          </Button>
        </div>
      </div>

      <AlertDialog open={duplicarOpen} onOpenChange={setDuplicarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar cores para o outro perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai sobrescrever todas as cores de{" "}
              <strong>"{destinoPerfil?.nome_perfil}"</strong> com as cores atuais de{" "}
              <strong>"{perfilSel?.nome_perfil}"</strong>. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicarConfirm}>Duplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
