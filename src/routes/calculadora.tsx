import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/calculadora")({
  component: CalculadoraPage,
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) && v > 0 ? v : 0,
  );

function CalculadoraPage() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<"unitario" | "quantidade">("unitario");
  const [qtd, setQtd] = useState<string>("12");
  const [precoCompra, setPrecoCompra] = useState<string>("");
  const [margem, setMargem] = useState<string>("");

  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (!u) {
        navigate({ to: "/login" });
        return;
      }
      const nivel = JSON.parse(u).nivel;
      if (nivel > 1) navigate({ to: "/admin" });
    } catch {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const { custoUnit, precoVendaUnit, lucroUnit, unidades, precoVendaTotal } = useMemo(() => {
    const unidades = tipo === "quantidade" ? Math.max(1, Number(qtd) || 0) : 1;
    const compra = Number(precoCompra) || 0;
    const m = Number(margem) || 0;
    const custoUnit = unidades > 0 ? compra / unidades : 0;
    const precoVendaUnit = custoUnit * (1 + m / 100);
    const lucroUnit = precoVendaUnit - custoUnit;
    return {
      unidades,
      custoUnit,
      precoVendaUnit,
      lucroUnit,
      precoVendaTotal: precoVendaUnit * unidades,
    };
  }, [tipo, qtd, precoCompra, margem]);

  return (
    <AdminLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Calculadora de Preço de Venda</h1>
          <p className="text-muted-foreground">
            Calcule quanto cobrar por unidade com base no custo e na margem desejada.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados da compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Tipo de compra</Label>
              <RadioGroup
                value={tipo}
                onValueChange={(v) => setTipo(v as "unitario" | "quantidade")}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="unitario" id="tipo-unit" />
                  <Label htmlFor="tipo-unit" className="font-normal cursor-pointer">
                    Unitário
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="quantidade" id="tipo-qtd" />
                  <Label htmlFor="tipo-qtd" className="font-normal cursor-pointer">
                    Quantidade (pacote)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {tipo === "quantidade" && (
              <div className="space-y-2">
                <Label htmlFor="qtd">Quantidade de unidades</Label>
                <Input
                  id="qtd"
                  type="number"
                  min={1}
                  step={1}
                  value={qtd}
                  onChange={(e) => setQtd(e.target.value)}
                  placeholder="Ex.: 12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="preco">Preço de compra (R$)</Label>
              <Input
                id="preco"
                type="number"
                min={0}
                step="0.01"
                value={precoCompra}
                onChange={(e) => setPrecoCompra(e.target.value)}
                placeholder={tipo === "quantidade" ? "Valor total pago no pacote" : "Valor pago na unidade"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="margem">Margem de lucro (%)</Label>
              <Input
                id="margem"
                type="number"
                min={0}
                step="0.1"
                value={margem}
                onChange={(e) => setMargem(e.target.value)}
                placeholder="Ex.: 50"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Unidades</span>
              <span className="font-medium">{unidades}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custo por unidade</span>
              <span className="font-medium">{brl(custoUnit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lucro por unidade</span>
              <span className="font-medium">{brl(lucroUnit)}</span>
            </div>
            <div className="border-t border-border pt-4 mt-2">
              <div className="text-sm text-muted-foreground mb-1">Preço de venda por unidade</div>
              <div className="text-4xl font-bold text-primary">{brl(precoVendaUnit)}</div>
            </div>
            {tipo === "quantidade" && (
              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">Total vendendo todas as unidades</span>
                <span className="font-medium">{brl(precoVendaTotal)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
