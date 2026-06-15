import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cloneBarbeariaFn } from "@/lib/barbearias-admin.functions";

const SITE_ORIGIN = "https://barbeariapereira.lovable.app";
const RESERVED = new Set([
  "admin", "login", "cadastro", "colaborador", "cliente", "atendimentos",
  "clientes", "colaboradores", "comunidade", "financeiro", "gastos", "horarios",
  "iacodconsumi", "iaimagem", "integracoes", "minhaconta", "promocao",
  "redefinir-senha", "registro", "servicos", "superadmin", "superlogin",
  "barbearias", "blog", "notificacoes", "clube",
]);
const SLUG_RE = /^[a-z0-9-]{3,30}$/;

export function CriarBarbeariaForm() {
  const qc = useQueryClient();
  const cloneFn = useServerFn(cloneBarbeariaFn);
  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [adminLogin, setAdminLogin] = useState("");
  const [adminSenha, setAdminSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [slugTaken, setSlugTaken] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const slugFormatOk = SLUG_RE.test(slug);
  const slugReserved = RESERVED.has(slug);
  const slugValid = slugFormatOk && !slugReserved;

  // Debounced uniqueness check
  useEffect(() => {
    setSlugTaken(null);
    if (!slugValid) return;
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("barbearias")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      setSlugTaken(!!data);
      setChecking(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [slug, slugValid]);

  const previewClass = useMemo(() => {
    if (!slug) return "text-muted-foreground";
    if (!slugFormatOk || slugReserved) return "text-destructive";
    if (slugTaken) return "text-destructive";
    if (slugTaken === false) return "text-emerald-500";
    return "text-muted-foreground";
  }, [slug, slugFormatOk, slugReserved, slugTaken]);

  const previewMsg = (() => {
    if (!slug) return "Digite um slug para visualizar a URL.";
    if (!slugFormatOk) return "Use 3-30 caracteres: letras minúsculas, números e hífen.";
    if (slugReserved) return "Esse slug é reservado pelo sistema.";
    if (checking) return "Verificando disponibilidade...";
    if (slugTaken) return "Esse slug já está em uso.";
    if (slugTaken === false) return "Slug disponível.";
    return "";
  })();

  const canSubmit =
    slugValid &&
    slugTaken === false &&
    nome.trim().length > 0 &&
    adminLogin.trim().length >= 3 &&
    adminSenha.length >= 6;

  const mutation = useMutation({
    mutationFn: async () => {
      const session = JSON.parse(localStorage.getItem("superadmin_session") || "{}");
      if (!session?.id || !session?.login || !session?.senha) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      return cloneFn({
        data: {
          adminId: session.id,
          adminLogin: session.login,
          adminSenha: session.senha,
          slug: slug.trim(),
          nome: nome.trim(),
          newAdminLogin: adminLogin.trim(),
          newAdminSenha: adminSenha,
        },
      });
    },
    onSuccess: async (result) => {
      toast.success(`Barbearia criada com sucesso!`, {
        action: {
          label: "Abrir",
          onClick: () => window.open(`${SITE_ORIGIN}/${result.slug}`, "_blank"),
        },
      });
      setSlug(""); setNome(""); setAdminLogin(""); setAdminSenha("");
      await qc.invalidateQueries({ queryKey: ["barbearias"] });
      await qc.invalidateQueries({ queryKey: ["superadmin-barbearias"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="w-full max-w-2xl border-primary/20 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-josefin uppercase tracking-wide text-primary">
          <Plus className="h-5 w-5" /> Criar nova barbearia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-slug">Slug</Label>
          <Input
            id="new-slug"
            placeholder="ex: barbeariatres"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            autoComplete="off"
          />
          <p className={`text-xs ${previewClass}`}>
            {SITE_ORIGIN}/<span className="font-mono">{slug || "seu-slug"}</span>
            {previewMsg ? ` — ${previewMsg}` : null}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-nome">Nome da barbearia</Label>
          <Input id="new-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-admin-login">Login do admin</Label>
            <Input
              id="new-admin-login"
              value={adminLogin}
              onChange={(e) => setAdminLogin(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-admin-senha">Senha do admin (mín. 6)</Label>
            <div className="relative">
              <Input
                id="new-admin-senha"
                type={showPwd ? "text" : "password"}
                value={adminSenha}
                onChange={(e) => setAdminSenha(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A nova barbearia será criada copiando todos os dados e imagens da unidade modelo (barb0).
          O processo pode demorar alguns minutos.
        </p>
        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Criar barbearia
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
