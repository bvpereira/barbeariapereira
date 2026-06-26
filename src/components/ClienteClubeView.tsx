import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, MessageCircle, CheckCircle2, CreditCard, AlertTriangle, Settings2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listClubesPublicos, getClienteClubeStatus } from "@/lib/clube.functions";
import { getStripeStatusPublic, createCheckoutSession, createBillingPortalSession, getClienteSubscriptionStatus } from "@/lib/stripe.functions";
import { toast } from "sonner";

interface Props {
  barbeariaId: string;
  clienteId: string;
}

export function ClienteClubeView({ barbeariaId, clienteId }: Props) {
  const listFn = useServerFn(listClubesPublicos);
  const statusFn = useServerFn(getClienteClubeStatus);
  const stripeStatusFn = useServerFn(getStripeStatusPublic);
  const checkoutFn = useServerFn(createCheckoutSession);
  const portalFn = useServerFn(createBillingPortalSession);
  const subStatusFn = useServerFn(getClienteSubscriptionStatus);

  const [clubes, setClubes] = useState<Awaited<ReturnType<typeof listClubesPublicos>>>([]);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getClienteClubeStatus>> | null>(null);
  const [stripeActive, setStripeActive] = useState(false);
  const [subStatus, setSubStatus] = useState<Awaited<ReturnType<typeof getClienteSubscriptionStatus>> | null>(null);
  const [telefone, setTelefone] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, st, info, sa, ss] = await Promise.all([
          listFn({ data: { barbearia_id: barbeariaId } }),
          statusFn({ data: { barbearia_id: barbeariaId, cliente_id: clienteId } }),
          supabase.from("informacoes").select("tel_contato").eq("barbearia_id", barbeariaId).maybeSingle(),
          stripeStatusFn({ data: { barbearia_id: barbeariaId } }).catch(() => ({ ativo: false })),
          subStatusFn({ data: { barbearia_id: barbeariaId, cliente_id: clienteId } }).catch(() => null),
        ]);
        setClubes(list);
        setStatus(st);
        setTelefone((info.data as any)?.tel_contato ?? "");
        setStripeActive(Boolean(sa?.ativo));
        setSubStatus(ss);
      } catch (e) { console.error(e); }
    })();
  }, [barbeariaId, clienteId]);

  const whatsappUrl = telefone
    ? `https://wa.me/55${telefone.replace(/\D/g, "")}?text=${encodeURIComponent("Quero saber mais sobre o Clube de Assinatura")}`
    : "";

  const handleAssinar = async (clubeId: string) => {
    setLoadingId(clubeId);
    try {
      const { url } = await checkoutFn({ data: {
        barbearia_id: barbeariaId, cliente_id: clienteId, clube_id: clubeId,
        base_url: window.location.origin,
      } });
      if (url) window.location.href = url;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao iniciar checkout."); }
    finally { setLoadingId(null); }
  };

  const handlePortal = async () => {
    setLoadingId("portal");
    try {
      const { url } = await portalFn({ data: {
        barbearia_id: barbeariaId, cliente_id: clienteId,
        base_url: window.location.origin,
      } });
      if (url) window.location.href = url;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao abrir portal."); }
    finally { setLoadingId(null); }
  };

  const pastDue = subStatus?.status_stripe === "past_due";
  const trialing = subStatus?.status_stripe === "trialing";

  return (
    <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" /> Clube de Assinatura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.ativo && status.clube_nome ? (
          <div className="space-y-3 rounded-lg border border-primary/40 bg-background/60 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-bold text-lg">{status.clube_nome}</p>
                <p className="text-sm text-muted-foreground">
                  Ativo até {status.data_fim && format(parseISO(status.data_fim), "dd/MM/yyyy")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> Ativo</Badge>
                {trialing && <Badge variant="secondary">Em teste grátis</Badge>}
                {pastDue && (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Pagamento pendente</Badge>
                )}
              </div>
            </div>
            {status.servicos && status.servicos.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Serviços disponíveis:</p>
                {status.servicos.map((s) => (
                  <div key={s.servico_id} className="flex justify-between text-sm border-l-2 border-primary/50 pl-2">
                    <span>{s.nome}</span>
                    <span className={s.restantes > 0 ? "text-primary font-medium" : "text-muted-foreground"}>
                      {s.restantes} de {s.quantidade} restante(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
            {stripeActive && subStatus?.has_customer && (
              <Button variant="outline" size="sm" disabled={loadingId === "portal"} onClick={() => void handlePortal()}>
                <Settings2 className="w-4 h-4" /> Gerenciar assinatura
              </Button>
            )}
          </div>
        ) : status?.expirado ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            Seu clube de assinatura expirou. Entre em contato para renovar.
          </div>
        ) : null}

        {clubes.length > 0 && (
          <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
            <Crown className="w-4 h-4" /> Ver clubes disponíveis
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Clubes de Assinatura</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {stripeActive && (
              <p className="text-sm text-muted-foreground bg-primary/5 border border-primary/20 rounded-md p-3">
                Você pode assinar automaticamente com cartão pelo Stripe ou entrar em contato via WhatsApp.
              </p>
            )}
            {clubes.map((c) => (
              <Card key={c.id} className="border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{c.nome}</CardTitle>
                    <p className="text-primary font-bold">R$ {Number(c.valor_mensal).toFixed(2)}/mês</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{c.descricao || "Sem descrição."}</p>
                  {stripeActive && (
                    <Button
                      className="w-full"
                      disabled={loadingId === c.id}
                      onClick={() => void handleAssinar(c.id)}
                    >
                      <CreditCard className="w-4 h-4" />
                      {loadingId === c.id ? "Abrindo checkout…" : "Assinar com cartão"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            <div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-center space-y-3">
              <p className="text-sm">Prefere falar com a gente?</p>
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white border-0">
                    <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
                  </Button>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Telefone de contato não configurado.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
