import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  barbeariaId: string;
  clienteId: string;
}

export function CashbackCard({ barbeariaId, clienteId }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [economizado, setEconomizado] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: info } = await supabase
          .from("informacoes")
          .select("cashback")
          .eq("barbearia_id", barbeariaId)
          .maybeSingle();
        if (cancelled) return;
        const on = !!(info as any)?.cashback;
        setEnabled(on);
        if (!on) return;
        const { data } = await supabase.rpc("fn_cashback_saldo", {
          p_barbearia_id: barbeariaId,
          p_cliente_id: clienteId,
        });
        if (cancelled) return;
        const d: any = data || {};
        setSaldo(Number(d.disponivel || 0));
        setAReceber(Number(d.a_receber || 0));
        setEconomizado(Number(d.total_economizado || 0));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [barbeariaId, clienteId]);

  if (!enabled || loading) return null;

  return (
    <Card className="md:col-span-2 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Meu cashback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          <span className="text-3xl font-bold text-primary">
            R$ {saldo.toFixed(2).replace(".", ",")}
          </span>
          <span className="text-xs text-muted-foreground">
            A receber: R$ {aReceber.toFixed(2).replace(".", ",")} (em atendimentos agendados)
          </span>
          {economizado > 0 && (
            <span className="text-xs text-muted-foreground">
              Você já economizou R$ {economizado.toFixed(2).replace(".", ",")} usando cashback
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
