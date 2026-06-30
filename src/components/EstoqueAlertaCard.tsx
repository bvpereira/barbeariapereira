import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Boxes } from "lucide-react";

interface ProdutoAlerta {
  id: string;
  nome: string;
  tipo: string;
  quantidade_atual: number;
  alerta_estoque: number;
  unidade_medida: string | null;
}

export function EstoqueAlertaCard() {
  const { tenant } = useTenant();
  const [produtos, setProdutos] = useState<ProdutoAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    const load = async () => {
      const { data } = await supabase.from("estoque" as any)
        .select("id, nome, tipo, quantidade_atual, alerta_estoque, unidade_medida")
        .eq("barbearia_id", tenant.id).is("deleted_at", null);
      const alertas = ((data as any) || []).filter((p: any) =>
        Number(p.quantidade_atual) <= Number(p.alerta_estoque)
      ).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      setProdutos(alertas);
      setLoading(false);
    };
    load();
  }, [tenant]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Produtos em alerta de estoque
        </CardTitle>
        <Link to={"/estoque" as any}>
          <Button variant="ghost" size="sm" className="gap-1">Ver estoque <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : produtos.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Boxes className="w-4 h-4" />Nenhum produto em alerta.</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {produtos.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.nome}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">{p.tipo === "consumivel" ? "Consumível" : "Revenda"}</Badge>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-destructive">{Number(p.quantidade_atual)} {p.unidade_medida || "un"}</p>
                  <p className="text-[10px] text-muted-foreground">alerta ≤ {Number(p.alerta_estoque)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
