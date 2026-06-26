import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getFinanceiroResumo,
  getFinanceiroPorClube,
  getFinanceiroSerie,
  listFinanceiroTransacoes,
  getStripeFeeConfig,
  setStripeFeeConfig,
} from "@/lib/clube-financeiro.functions";

type Credentials = { barbearia_id: string; admin_id: string; admin_password: string };

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function presetRange(value: string): { inicio: string; fim: string } {
  const today = new Date();
  if (value === "atual") return { inicio: startOfMonth(today).toISOString(), fim: endOfMonth(today).toISOString() };
  if (value === "anterior") {
    const m = subMonths(today, 1);
    return { inicio: startOfMonth(m).toISOString(), fim: endOfMonth(m).toISOString() };
  }
  // últimos 30
  const d = new Date(today);
  d.setDate(d.getDate() - 30);
  return { inicio: d.toISOString(), fim: today.toISOString() };
}

export function ClubeFinanceiroTab({ credentials }: { credentials: Credentials }) {
  const [periodo, setPeriodo] = useState("atual");
  const range = useMemo(() => presetRange(periodo), [periodo]);

  const [resumo, setResumo] = useState<Awaited<ReturnType<typeof getFinanceiroResumo>> | null>(null);
  const [porClube, setPorClube] = useState<Awaited<ReturnType<typeof getFinanceiroPorClube>>>([]);
  const [serie, setSerie] = useState<Awaited<ReturnType<typeof getFinanceiroSerie>>>([]);
  const [txs, setTxs] = useState<Awaited<ReturnType<typeof listFinanceiroTransacoes>>>([]);
  const [fee, setFee] = useState<{ percent: number; fixed: number }>({ percent: 0.0399, fixed: 0.39 });
  const [savingFee, setSavingFee] = useState(false);
  const [loading, setLoading] = useState(true);

  const resumoFn = useServerFn(getFinanceiroResumo);
  const porClubeFn = useServerFn(getFinanceiroPorClube);
  const serieFn = useServerFn(getFinanceiroSerie);
  const txsFn = useServerFn(listFinanceiroTransacoes);
  const getFeeFn = useServerFn(getStripeFeeConfig);
  const setFeeFn = useServerFn(setStripeFeeConfig);

  const load = async () => {
    setLoading(true);
    try {
      const payload = { ...credentials, ...range };
      const [r, c, s, t, f] = await Promise.all([
        resumoFn({ data: payload }),
        porClubeFn({ data: payload }),
        serieFn({ data: payload }),
        txsFn({ data: { ...payload, limit: 50 } }),
        getFeeFn({ data: credentials }),
      ]);
      setResumo(r); setPorClube(c); setSerie(s); setTxs(t); setFee(f);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar financeiro.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [periodo]);

  const handleSaveFee = async () => {
    setSavingFee(true);
    try {
      await setFeeFn({ data: { ...credentials, percent: fee.percent, fixed: fee.fixed } });
      toast.success("Taxa atualizada.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar taxa.");
    } finally { setSavingFee(false); }
  };

  const maxBar = Math.max(1, ...serie.map((s) => Math.max(s.bruto, s.liquido)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="atual">Mês atual</SelectItem>
              <SelectItem value="anterior">Mês anterior</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="p-3 flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Taxa Stripe (%)</Label>
            <Input className="w-24" type="number" step="0.01" min={0}
              value={(fee.percent * 100).toFixed(2)}
              onChange={(e) => setFee({ ...fee, percent: (Number(e.target.value) || 0) / 100 })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Taxa fixa (R$)</Label>
            <Input className="w-24" type="number" step="0.01" min={0}
              value={fee.fixed}
              onChange={(e) => setFee({ ...fee, fixed: Number(e.target.value) || 0 })} />
          </div>
          <Button size="sm" disabled={savingFee} onClick={() => void handleSaveFee()}>
            {savingFee ? "Salvando..." : "Salvar taxa"}
          </Button>
        </Card>
      </div>

      {loading || !resumo ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-primary" /></div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <KPI label="Receita bruta" value={fmt(resumo.bruto)} />
            <KPI label="Taxas Stripe" value={fmt(resumo.taxas)} tone="muted" />
            <KPI label="Reembolsos" value={fmt(resumo.reembolsos)} tone="destructive" />
            <KPI label="Receita líquida" value={fmt(resumo.liquido)} tone="good" />
            <KPI label="MRR líquido (próximo ciclo)" value={fmt(resumo.mrr_previsao_proximo_ciclo)} tone="primary"
              subtitle={`${resumo.assinantes_ativos} assinante(s) ativo(s)`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Por clube no período</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clube</TableHead>
                    <TableHead className="text-right">Ativos</TableHead>
                    <TableHead className="text-right">Transações</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Reembolsos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">MRR líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porClube.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-right">{c.assinantes_ativos}</TableCell>
                      <TableCell className="text-right">{c.n_pagamentos}</TableCell>
                      <TableCell className="text-right">{fmt(c.bruto)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(c.taxas)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(c.reembolsos)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmt(c.liquido)}</TableCell>
                      <TableCell className="text-right">{fmt(c.mrr_liquido)}</TableCell>
                    </TableRow>
                  ))}
                  {porClube.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem clubes.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
            <CardContent>
              {serie.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados no período.</p>
              ) : (
                <div className="space-y-2">
                  {serie.map((s) => (
                    <div key={s.mes} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{s.mes}</span>
                      <div className="flex flex-col gap-1">
                        <div className="h-2 rounded bg-primary/20 overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${(s.bruto / maxBar) * 100}%` }} />
                        </div>
                        <div className="h-2 rounded bg-emerald-500/20 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${(Math.max(0, s.liquido) / maxBar) * 100}%` }} />
                        </div>
                      </div>
                      <span className="font-medium">{fmt(s.liquido)}</span>
                    </div>
                  ))}
                  <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary rounded" /> Bruto</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 rounded" /> Líquido</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas transações</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{format(parseISO(t.pago_em as unknown as string), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "paid" ? "default" : t.status === "refunded" ? "destructive" : "secondary"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right ${Number(t.valor_bruto) < 0 ? "text-destructive" : ""}`}>{fmt(Number(t.valor_bruto))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(Number(t.taxa_stripe))}</TableCell>
                      <TableCell className={`text-right font-medium ${Number(t.valor_liquido) < 0 ? "text-destructive" : "text-primary"}`}>{fmt(Number(t.valor_liquido))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.stripe_invoice_id ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {txs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma transação no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, subtitle, tone }: { label: string; value: string; subtitle?: string; tone?: "muted" | "destructive" | "good" | "primary" }) {
  const cls = tone === "destructive" ? "text-destructive"
    : tone === "good" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "primary" ? "text-primary"
    : tone === "muted" ? "text-muted-foreground"
    : "";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-1 ${cls}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
