import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, MessageCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listClubesPublicos, getClienteClubeStatus } from "@/lib/clube.functions";

interface Props {
  barbeariaId: string;
  clienteId: string;
}

export function ClienteClubeView({ barbeariaId, clienteId }: Props) {
  const listFn = useServerFn(listClubesPublicos);
  const statusFn = useServerFn(getClienteClubeStatus);
  const [clubes, setClubes] = useState<Awaited<ReturnType<typeof listClubesPublicos>>>([]);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getClienteClubeStatus>> | null>(null);
  const [telefone, setTelefone] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, st, info] = await Promise.all([
          listFn({ data: { barbearia_id: barbeariaId } }),
          statusFn({ data: { barbearia_id: barbeariaId, cliente_id: clienteId } }),
          supabase.from("informacoes").select("tel_contato").eq("barbearia_id", barbeariaId).maybeSingle(),
        ]);
        setClubes(list);
        setStatus(st);
        setTelefone((info.data as any)?.tel_contato ?? "");
      } catch (e) { console.error(e); }
    })();
  }, [barbeariaId, clienteId]);

  const whatsappUrl = telefone
    ? `https://wa.me/55${telefone.replace(/\D/g, "")}?text=${encodeURIComponent("Quero saber mais sobre o Clube de Assinatura")}`
    : "";

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
              <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> Ativo</Badge>
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
            {clubes.map((c) => (
              <Card key={c.id} className="border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{c.nome}</CardTitle>
                    <p className="text-primary font-bold">R$ {Number(c.valor_mensal).toFixed(2)}/mês</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{c.descricao || "Sem descrição."}</p>
                </CardContent>
              </Card>
            ))}
            <div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-center space-y-3">
              <p className="text-sm">Se você se interessou, é só entrar em contato:</p>
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
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
