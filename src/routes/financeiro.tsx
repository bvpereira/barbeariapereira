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
  previsaoTotalMes: number;
  previsaoAgendadosMes: number;
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
    previsaoTotalMes: 0,
    previsaoAgendadosMes: 0,
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

      const { data: rules, error: errorRules } = await supabase
        .from("colaborador_servicos")
        .select("colaborador_id, servico_id, valor_comissao, tipo_comissao");
      
      if (errorRules) throw errorRules;

      const { data: atendimentosHoje, error: errorHoje } = await supabase
        .from("atendimentos")
        .select(`
          valor, 
          comissao,
          status,
          atendimento_servicos (
            servico_id,
            valor_servico
          ),
          colaborador_id
        `)
        .gte("data", startDay.toISOString())
        .lte("data", endDay.toISOString())
        .eq("status", "Finalizado");

      if (errorHoje) throw errorHoje;

      let brutoDia = 0;
      let comissoesDia = 0;

      atendimentosHoje?.forEach(atend => {
        brutoDia += Number(atend.valor || 0);
        comissoesDia += Number(atend.comissao || 0);
      });

      const { data: atendimentosMes, error: errorMes } = await supabase
        .from("atendimentos")
        .select(`
          id,
          valor, 
          comissao,
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
      
      const { data: colaboradores, error: errorColab } = await supabase
        .from("colaboradores")
        .select("id, nome");
      
      if (errorColab) throw errorColab;

      const { data: gastosMes, error: errorGastos } = await supabase
        .from("gastos")
        .select("valor")
        .gte("data", startMonth.toISOString())
        .lte("data", endMonth.toISOString());
      
      if (errorGastos) throw errorGastos;

      const despesasMes = gastosMes?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

      let brutoMes = 0;
      let previsaoAgendadosMes = 0;
      let comissoesMes = 0;
      const comissoesColabMap = new Map<string, number>();
      
      colaboradores?.forEach(c => comissoesColabMap.set(c.id, 0));

      atendimentosMes?.forEach(atend => {
        const val = Number(atend.valor || 0);
        if (atend.status === "Finalizado") {
          brutoMes += val;
          const comissaoVal = Number(atend.comissao || 0);
          comissoesMes += comissaoVal;
          const current = comissoesColabMap.get(atend.colaborador_id) || 0;
          comissoesColabMap.set(atend.colaborador_id, current + comissaoVal);
        } else if (atend.status === "Agendado") {
          previsaoAgendadosMes += val;
        }
      });

      const liquidoMes = brutoMes - comissoesMes - despesasMes;
      const liquidoDia = brutoDia - comissoesDia;
      const previsaoTotalMes = brutoMes + previsaoAgendadosMes;

      const start12 = startOfMonth(subMonths(today, 11));
      
      const { data: allAtendimentos12, error: error12A } = await supabase
        .from("atendimentos")
        .select("valor, comissao, status, data, colaborador_id, atendimento_servicos(servico_id, valor_servico)")
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
          comissoes += Number(atend.comissao || 0);
        });

        const liquido = bruto - comissoes - gastos;

        return {
          month: format(month, "MMM/yy", { locale: ptBR }),
          fullDate: month,
          bruto,
          liquido,
          comissoes,
          gastos,
          salarios: 0 // Salários agora estão inclusos nos gastos
        };
      }).reverse();

      setData({
        brutoDia,
        liquidoDia,
        brutoMes,
        liquidoMes,
        despesasMes,
        comissoesMes,
        previsaoTotalMes,
        previsaoAgendadosMes,
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

        <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Bruto (Hoje)</CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
              <div className="text-lg md:text-2xl font-bold text-primary">{formatCurrency(data.brutoDia)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                Finalizados hoje
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
              <CardTitle className="text-[10px] md:text-sm font-medium text-green-600 dark:text-green-400">Líquido (Hoje)</CardTitle>
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
              <div className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(data.liquidoDia)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                Bruto - comissões
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Bruto Mês</CardTitle>
              <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
              <div className="text-lg md:text-2xl font-bold">{formatCurrency(data.brutoMes)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-1">Total finalizado</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Líquido Mês</CardTitle>
              <div className={data.liquidoMes >= 0 ? "text-green-500" : "text-destructive"}>
                {data.liquidoMes >= 0 ? <TrendingUp className="h-3 w-3 md:h-4 md:w-4" /> : <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />}
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
              <div className={cn("text-lg md:text-2xl font-bold", data.liquidoMes >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                {formatCurrency(data.liquidoMes)}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-1">Lucro real</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Despesas Mês</CardTitle>
              <ArrowDownRight className="h-3 w-3 md:h-4 md:w-4 text-destructive" />
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
              <div className="text-lg md:text-2xl font-bold text-destructive">{formatCurrency(data.despesasMes)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-1">Apenas gastos</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-xl">Líquido (12 meses)</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 overflow-x-auto">
              <div className="h-[200px] md:h-[300px] min-w-[500px] md:min-w-0 w-full">
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

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Previsão de Faturamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Previsto (Finalizado + Agendado)</span>
                  <div className="text-3xl font-black text-primary tracking-tight">
                    {formatCurrency(data.previsaoTotalMes)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Já Finalizado</p>
                    <p className="text-lg font-semibold">{formatCurrency(data.brutoMes)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Agendado</p>
                    <p className="text-lg font-semibold text-primary/80">{formatCurrency(data.previsaoAgendadosMes)}</p>
                  </div>
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
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-xl">Histórico Detalhado</CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6">
            <div className="overflow-x-auto">
              <div className="min-w-[600px] md:min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Faturamento Bruto</TableHead>
                      <TableHead className="text-right">Comissões</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right hidden">Salários</TableHead>
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
                        <TableCell className="text-right text-muted-foreground hidden">{formatCurrency(h.salarios)}</TableCell>
                        <TableCell className={cn("text-right font-bold", h.liquido >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                          {formatCurrency(h.liquido)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
