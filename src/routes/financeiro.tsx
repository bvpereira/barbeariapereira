import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  eachMonthOfInterval, 
  isSameMonth, 
  parseISO, 
  startOfDay,
  endOfDay,
  subDays
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro" as any)({
  component: FinanceiroPage,
});

interface FinanceiroData {
  brutoDia: number;
  liquidoDia: number;
  brutoMes: number;
  liquidoMes: number;
  despesasMes: number;
  comissoesMes: number;
  previsaoBrutoMes: number;
  comissoesPorColaborador: { nome: string; valor: number }[];
  chartData: any[];
  historico: any[];
}

function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceiroData>({
    brutoDia: 0,
    liquidoDia: 0,
    brutoMes: 0,
    liquidoMes: 0,
    despesasMes: 0,
    comissoesMes: 0,
    previsaoBrutoMes: 0,
    comissoesPorColaborador: [],
    chartData: [],
    historico: []
  });

  useEffect(() => {
    fetchFinanceiro();
  }, []);

  const fetchFinanceiro = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startDay = startOfDay(today);
      const endDay = endOfDay(today);
      const startMonth = startOfMonth(today);
      const endMonth = endOfMonth(today);

      const { data: atendimentosHoje, error: errorHoje } = await supabase
        .from("atendimentos")
        .select(`
          valor, 
          status,
          atendimento_servicos (
            servico_id,
            colaborador_servicos:servico_id (
              colaborador_id,
              valor_comissao,
              tipo_comissao
            )
          ),
          colaborador_id
        `)
        .gte("data", startDay.toISOString())
        .lte("data", endDay.toISOString())
        .eq("status", "Finalizado");

      if (errorHoje) throw errorHoje;

      let brutoDia = 0;
      let comissoesDia = 0;

      const { data: rules, error: errorRules } = await supabase
        .from("colaborador_servicos")
        .select("colaborador_id, servico_id, valor_comissao, tipo_comissao");
      
      if (errorRules) throw errorRules;

      atendimentosHoje?.forEach(atend => {
        brutoDia += Number(atend.valor || 0);
        atend.atendimento_servicos?.forEach((as: any) => {
          const rule = rules?.find(r => r.servico_id === as.servico_id && r.colaborador_id === atend.colaborador_id);
          if (rule) {
            if (rule.tipo_comissao === "fixo") {
              comissoesDia += Number(rule.valor_comissao);
            } else {
              // Note: as.valor_servico is not in the select of errorHoje, adding it below
              comissoesDia += (Number(as.valor_servico || 0) * Number(rule.valor_comissao)) / 100;
            }
          }
        });
      });

      const { data: atendimentosMes, error: errorMes } = await supabase
        .from("atendimentos")
        .select(`
          id,
          valor, 
          status,
          data,
          colaborador_id,
          atendimento_servicos (
            servico_id,
            valor_servico
          )
        `)
        .gte("data", startMonth.toISOString())
        .lte("data", endMonth.toISOString());

      if (errorMes) throw errorMes;

      const { data: rules, error: errorRules } = await supabase
        .from("colaborador_servicos")
        .select("colaborador_id, servico_id, valor_comissao, tipo_comissao");
      
      if (errorRules) throw errorRules;
      
      const { data: colaboradores, error: errorColab } = await supabase
        .from("colaboradores")
        .select("id, nome, salario_fixo");
      
      if (errorColab) throw errorColab;

      const { data: gastosMes, error: errorGastos } = await supabase
        .from("gastos")
        .select("valor")
        .gte("data", startMonth.toISOString())
        .lte("data", endMonth.toISOString());
      
      if (errorGastos) throw errorGastos;

      const despesasMes = gastosMes?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

      let brutoMes = 0;
      let previsaoBrutoMes = 0;
      let comissoesMes = 0;
      const comissoesColabMap = new Map<string, number>();
      
      colaboradores?.forEach(c => comissoesColabMap.set(c.id, 0));

      atendimentosMes?.forEach(atend => {
        const val = Number(atend.valor || 0);
        if (atend.status === "Finalizado") {
          brutoMes += val;
          
          atend.atendimento_servicos?.forEach((as: any) => {
            const rule = rules?.find(r => r.servico_id === as.servico_id && r.colaborador_id === atend.colaborador_id);
            if (rule) {
              let valorComissao = 0;
              if (rule.tipo_comissao === "fixo") {
                valorComissao = Number(rule.valor_comissao);
              } else {
                valorComissao = (Number(as.valor_servico) * Number(rule.valor_comissao)) / 100;
              }
              comissoesMes += valorComissao;
              const current = comissoesColabMap.get(atend.colaborador_id) || 0;
              comissoesColabMap.set(atend.colaborador_id, current + valorComissao);
            }
          });
        } else if (atend.status === "Agendado") {
          previsaoBrutoMes += val;
        }
      });

      const totalSalarios = colaboradores?.reduce((acc, curr) => acc + Number(curr.salario_fixo || 0), 0) || 0;
      const liquidoMes = brutoMes - comissoesMes - despesasMes - totalSalarios;
      const liquidoDia = brutoDia - comissoesDia;

      const start12 = startOfMonth(subMonths(today, 11));
      
      const { data: allAtendimentos12, error: error12A } = await supabase
        .from("atendimentos")
        .select("valor, status, data, colaborador_id, atendimento_servicos(servico_id, valor_servico)")
        .gte("data", start12.toISOString())
        .lte("data", endMonth.toISOString())
        .eq("status", "Finalizado");

      const { data: allGastos12, error: error12G } = await supabase
        .from("gastos")
        .select("valor, data")
        .gte("data", start12.toISOString())
        .lte("data", endMonth.toISOString());

      const months = eachMonthOfInterval({ start: start12, end: today });
      
      const historico = months.map(month => {
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        
        const monthAtendimentos = allAtendimentos12?.filter(a => {
          const d = parseISO(a.data);
          return d >= start && d <= end;
        }) || [];
        
        const monthGastos = allGastos12?.filter(g => {
          const d = parseISO(g.data);
          return d >= start && d <= end;
        }) || [];
        
        const bruto = monthAtendimentos.reduce((acc, curr) => acc + Number(curr.valor), 0);
        const gastos = monthGastos.reduce((acc, curr) => acc + Number(curr.valor), 0);
        
        let comissoes = 0;
        monthAtendimentos.forEach(atend => {
          atend.atendimento_servicos?.forEach((as: any) => {
            const rule = rules?.find(r => r.servico_id === as.servico_id && r.colaborador_id === atend.colaborador_id);
            if (rule) {
              if (rule.tipo_comissao === "fixo") comissoes += Number(rule.valor_comissao);
              else comissoes += (Number(as.valor_servico) * Number(rule.valor_comissao)) / 100;
            }
          });
        });

        const liquido = bruto - comissoes - gastos - totalSalarios;

        return {
          month: format(month, "MMM/yy", { locale: ptBR }),
          fullDate: month,
          bruto,
          liquido,
          comissoes,
          gastos,
          salarios: totalSalarios
        };
      }).reverse();

      setData({
        brutoDia,
        liquidoDia,
        brutoMes,
        liquidoMes,
        despesasMes,
        comissoesMes,
        previsaoBrutoMes,
        comissoesPorColaborador: colaboradores?.map(c => ({
          nome: c.nome,
          valor: comissoesColabMap.get(c.id) || 0
        })) || [],
        chartData: [...historico].reverse().map(h => ({
          name: h.month,
          liquido: h.liquido
        })),
        historico
      });

    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão Financeira</h1>
          <p className="text-muted-foreground">Visão geral do desempenho da sua barbearia.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Bruto (Hoje)</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(data.brutoDia)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Atendimentos finalizados hoje
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Faturamento Líquido (Hoje)</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(data.liquidoDia)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Bruto menos comissões
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bruto do Mês</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.brutoMes)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total finalizado este mês</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Líquido do Mês</CardTitle>
              <div className={data.liquidoMes >= 0 ? "text-green-500" : "text-destructive"}>
                {data.liquidoMes >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", data.liquidoMes >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                {formatCurrency(data.liquidoMes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Bruto - comissões - gastos - salários</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(data.despesasMes)}</div>
              <p className="text-xs text-muted-foreground mt-1">Apenas tabela de gastos</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Faturamento Líquido (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData}>
                    <defs>
                      <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Líquido']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="liquido" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorLiquido)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Previsão de Faturamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Agendados para o mês</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(data.previsaoBrutoMes)}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-primary/40" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comissões do Mês</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold border-b pb-2">{formatCurrency(data.comissoesMes)} <span className="text-xs font-normal text-muted-foreground block mt-1">Total a pagar em comissões</span></div>
                <div className="space-y-3">
                  {data.comissoesPorColaborador.map((colab, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{colab.nome}</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(colab.valor)}</span>
                    </div>
                  ))}
                  {data.comissoesPorColaborador.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-2">Nenhuma comissão este mês.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico Financeiro Detalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Faturamento Bruto</TableHead>
                    <TableHead className="text-right">Comissões</TableHead>
                    <TableHead className="text-right">Gastos</TableHead>
                    <TableHead className="text-right">Salários</TableHead>
                    <TableHead className="text-right">Faturamento Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.historico.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium capitalize">{h.month}</TableCell>
                      <TableCell className="text-right">{formatCurrency(h.bruto)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(h.comissoes)}</TableCell>
                      <TableCell className="text-right text-destructive/80">{formatCurrency(h.gastos)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(h.salarios)}</TableCell>
                      <TableCell className={cn("text-right font-bold", h.liquido >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                        {formatCurrency(h.liquido)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
