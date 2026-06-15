import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, AtSign, ExternalLink, MessageCircle, Save, Scissors, Users } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { softDeleteBarbeariaFn, restoreBarbeariaFn } from "@/lib/barbearias-admin.functions";

export const Route = createFileRoute("/barbearias")({
  component: BarbeariasPage,
});

type EditableValues = {
  instanciaEvo: string;
  instanciaApi: string;
  limiteImagens: string;
};

type BarbeariaData = {
  id: string;
  slug: string;
  createdAt: string;
  nome: string;
  telefone: string;
  email: string;
  googleAvaliacao: string;
  instagram: string;
  responsavel: string;
  informacoesId: string | null;
  agenteId: string | null;
  instanciaEvo: string;
  instanciaApi: string;
  limiteImagens: number | null;
  clientes: number;
  colaboradoresUltimos30Dias: number;
  colaboradoresAtivos: number;
  colaboradoresInativos: number;
  servicos: number;
  deletedAt: string | null;
};

const SITE_ORIGIN = "https://barbeariapereira.lovable.app";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function whatsappUrl(value: string) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function instagramUrl(value: string) {
  const handle = value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/$/, "");
  return handle ? `https://instagram.com/${handle}` : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function ReadOnlyField({ label, value, href, icon }: { label: string; value: string; href?: string; icon?: "link" | "whatsapp" | "instagram" }) {
  const Icon = icon === "whatsapp" ? MessageCircle : icon === "instagram" ? AtSign : ExternalLink;
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="flex min-h-10 items-center gap-3 rounded-md border border-primary/15 bg-background/40 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 break-words text-foreground">{value || "Não informado"}</span>
        {href ? (
          <Button asChild variant="ghost" size="icon" className="shrink-0 text-primary" title={`Abrir ${label}`}>
            <a href={href} target="_blank" rel="noreferrer" aria-label={`Abrir ${label}`}>
              <Icon className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

async function fetchBarbearias(): Promise<BarbeariaData[]> {
  const { data: barbearias, error } = await supabase
    .from("barbearias")
    .select("id, slug, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return Promise.all(
    (barbearias ?? []).map(async (barbearia) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [infoResult, agenteResult, responsavelResult, clientesResult, colaboradoresResult, recentesResult, servicosResult] = await Promise.all([
        supabase.from("informacoes").select("id, nome_barbearia, tel_contato, email, google_avaliacao, instagram, instancia_evo, instancia_api").eq("barbearia_id", barbearia.id).maybeSingle(),
        supabase.from("agentes_ia").select("id, num_limite_imagens").eq("barbearia_id", barbearia.id).maybeSingle(),
        supabase.from("usuarios").select("nome").eq("barbearia_id", barbearia.id).eq("nivel", 1).maybeSingle(),
        supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("barbearia_id", barbearia.id).eq("nivel", 3),
        supabase.from("colaboradores").select("ativo").eq("barbearia_id", barbearia.id),
        supabase.from("colaboradores").select("id", { count: "exact", head: true }).eq("barbearia_id", barbearia.id).gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("servicos").select("id", { count: "exact", head: true }).eq("barbearia_id", barbearia.id),
      ]);

      const queryError = [infoResult.error, agenteResult.error, responsavelResult.error, clientesResult.error, colaboradoresResult.error, recentesResult.error, servicosResult.error].find(Boolean);
      if (queryError) throw queryError;

      const colaboradores = colaboradoresResult.data ?? [];
      return {
        id: barbearia.id,
        slug: barbearia.slug,
        createdAt: barbearia.created_at,
        nome: infoResult.data?.nome_barbearia || "Barbearia sem nome",
        telefone: infoResult.data?.tel_contato || "",
        email: infoResult.data?.email || "",
        googleAvaliacao: infoResult.data?.google_avaliacao || "",
        instagram: infoResult.data?.instagram || "",
        responsavel: responsavelResult.data?.nome || "",
        informacoesId: infoResult.data?.id ?? null,
        agenteId: agenteResult.data?.id ?? null,
        instanciaEvo: infoResult.data?.instancia_evo || "",
        instanciaApi: infoResult.data?.instancia_api || "",
        limiteImagens: agenteResult.data?.num_limite_imagens ?? null,
        clientes: clientesResult.count ?? 0,
        colaboradoresUltimos30Dias: recentesResult.count ?? 0,
        colaboradoresAtivos: colaboradores.filter((item) => item.ativo).length,
        colaboradoresInativos: colaboradores.filter((item) => !item.ativo).length,
        servicos: servicosResult.count ?? 0,
      };
    }),
  );
}

function BarbeariaCard({ barbearia }: { barbearia: BarbeariaData }) {
  const queryClient = useQueryClient();
  const initialValues = useMemo<EditableValues>(() => ({
    instanciaEvo: barbearia.instanciaEvo,
    instanciaApi: barbearia.instanciaApi,
    limiteImagens: barbearia.limiteImagens?.toString() ?? "",
  }), [barbearia]);
  const [values, setValues] = useState(initialValues);
  const siteUrl = `${SITE_ORIGIN}/${barbearia.slug}`;

  useEffect(() => setValues(initialValues), [initialValues]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const limite = Number(values.limiteImagens);
      if (!barbearia.informacoesId || !barbearia.agenteId) throw new Error("Cadastro de configurações incompleto para esta barbearia.");
      if (!Number.isInteger(limite) || limite < 0) throw new Error("Informe um limite mensal válido.");

      const [infoResult, agenteResult] = await Promise.all([
        supabase.from("informacoes").update({ instancia_evo: values.instanciaEvo.trim(), instancia_api: values.instanciaApi.trim() }).eq("id", barbearia.informacoesId).eq("barbearia_id", barbearia.id),
        supabase.from("agentes_ia").update({ num_limite_imagens: limite }).eq("id", barbearia.agenteId).eq("barbearia_id", barbearia.id),
      ]);
      if (infoResult.error) throw infoResult.error;
      if (agenteResult.error) throw agenteResult.error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["superadmin-barbearias"] });
      toast.success(`Dados de ${barbearia.nome} salvos com sucesso.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const metrics = [
    ["Criada em", formatDate(barbearia.createdAt)],
    ["Clientes cadastrados", barbearia.clientes],
    ["Colaboradores nos últimos 30 dias", barbearia.colaboradoresUltimos30Dias],
    ["Colaboradores ativos", barbearia.colaboradoresAtivos],
    ["Colaboradores inativos", barbearia.colaboradoresInativos],
    ["Serviços cadastrados", barbearia.servicos],
  ];

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/80">
      <CardHeader className="border-b border-primary/10 bg-primary/5">
        <CardTitle className="flex items-center gap-3 font-josefin text-2xl uppercase tracking-wide text-primary">
          <Scissors className="h-6 w-6" />
          {barbearia.nome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        <section className="grid gap-5 md:grid-cols-2">
          <ReadOnlyField label="Site" value={siteUrl} href={siteUrl} icon="link" />
          <ReadOnlyField label="Nome do Responsável" value={barbearia.responsavel} />
          <ReadOnlyField label="Telefone de contato" value={barbearia.telefone} href={whatsappUrl(barbearia.telefone)} icon="whatsapp" />
          <ReadOnlyField label="E-mail" value={barbearia.email} />
          <ReadOnlyField label="Site de avaliação do Google" value={barbearia.googleAvaliacao} href={normalizeUrl(barbearia.googleAvaliacao)} icon="link" />
          <ReadOnlyField label="Instagram" value={barbearia.instagram} href={instagramUrl(barbearia.instagram)} icon="instagram" />
        </section>

        <section className="space-y-4 border-y border-primary/10 py-6">
          <div>
            <h3 className="font-josefin text-lg font-bold uppercase tracking-wide text-foreground">Configurações editáveis</h3>
            <p className="text-sm text-muted-foreground">Altere os dados abaixo e salve para substituir os valores atuais.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`evo-${barbearia.id}`}>Instância conectada Evolution API</Label>
              <Input id={`evo-${barbearia.id}`} value={values.instanciaEvo} onChange={(event) => setValues((current) => ({ ...current, instanciaEvo: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`api-${barbearia.id}`}>API key da instância</Label>
              <Input id={`api-${barbearia.id}`} value={values.instanciaApi} onChange={(event) => setValues((current) => ({ ...current, instanciaApi: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`limite-${barbearia.id}`}>Limite mensal de criação/edição de imagens</Label>
              <Input id={`limite-${barbearia.id}`} type="number" min="0" step="1" value={values.limiteImagens} onChange={(event) => setValues((current) => ({ ...current, limiteImagens: event.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </section>

        <section>
          <h3 className="mb-4 flex items-center gap-2 font-josefin text-lg font-bold uppercase tracking-wide text-foreground">
            <Users className="h-5 w-5 text-primary" /> Informações da barbearia
          </h3>
          <div className="grid gap-px overflow-hidden rounded-lg border border-primary/10 bg-primary/10 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(([label, value]) => (
              <div key={label} className="bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function BarbeariasPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const rawSession = localStorage.getItem("superadmin_session");
        const session = rawSession ? JSON.parse(rawSession) : null;
        if (!session?.id || !session?.login || !session?.senha || Number(session.nivel) !== 0) {
          throw new Error("Acesso não autorizado");
        }
        const { data, error } = await supabase
          .from("usuarios")
          .select("id")
          .eq("id", session.id)
          .eq("login", session.login)
          .eq("senha", session.senha)
          .eq("nivel", 0)
          .maybeSingle();
        if (error || !data) throw new Error("Acesso não autorizado");
        setAuthorized(true);
      } catch {
        localStorage.removeItem("superadmin_session");
        navigate({ to: "/superlogin", replace: true });
      }
    };
    void validateAccess();
  }, [navigate]);

  const { data: barbearias, isLoading, error } = useQuery({
    queryKey: ["superadmin-barbearias"],
    queryFn: fetchBarbearias,
    enabled: authorized,
  });

  if (!authorized) return null;

  return (
    <SuperAdminLayout>
      <div className="w-full max-w-7xl space-y-8">
        <header>
          <h1 className="font-josefin text-3xl font-bold uppercase tracking-widest text-primary md:text-5xl">Barbearias</h1>
          <p className="mt-2 text-muted-foreground">Visualize dados, indicadores e configurações de todas as unidades.</p>
        </header>

        {isLoading ? <p className="animate-pulse text-primary">Carregando barbearias...</p> : null}
        {error ? <p className="text-destructive">Não foi possível carregar as barbearias.</p> : null}
        {!isLoading && !error && !barbearias?.length ? <p className="text-muted-foreground">Nenhuma barbearia cadastrada.</p> : null}

        <div className="space-y-8">
          {barbearias?.map((barbearia) => <BarbeariaCard key={barbearia.id} barbearia={barbearia} />)}
        </div>
      </div>
    </SuperAdminLayout>
  );
}