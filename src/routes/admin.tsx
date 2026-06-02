import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Calendar, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  UserPlus
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfDay, 
  endOfDay, 
  parseISO, 
  isAfter,
  addMinutes
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

interface DashboardData {
  clientesAgendadosHoje: number;
  novosAgendamentosHoje: number;
  faturamentoBrutoDia: number;
  faturamentoBrutoMes: number;
  faturamentoLiquidoMes: number;
  comissoesMes: number;
  despesasMes: number;
  previsaoBrutoMes: number;
  colaboradoresAtivos: string[];
  agendamentosProximos: any[];
  agendamentosEmAberto: any[];
  agendaAbertaAte: string | null;
}

function AdminPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [data, setData] = useState<DashboardData>({
    clientesAgendadosHoje: 0,
    novosAgendamentosHoje: 0,
    faturamentoBrutoDia: 0,
    faturamentoBrutoMes: 0,
    faturamentoLiquidoMes: 0,
    comissoesMes: 0,
    despesasMes: 0,
    previsaoBrutoMes: 0,
    colaboradoresAtivos: [],
    agendamentosProximos: [],
    agendamentosEmAberto: [],
    agendaAbertaAte: null
  });

  useEffect(() => {
    if (tenantLoading) return;

    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      
      // Bloqueio se o usuário não pertencer à barbearia atual da URL
      if (tenant?.id && parsedUser.barbearia_id !== tenant.id) {
        toast.error("Você não tem permissão para acessar os dados desta barbearia.");
        navigate({ to: "/" });
        return;
      }

      if (!tenant) {
        // Se não houver tenant e o usuário estiver logado, algo está errado
        // ou o tenant não pôde ser carregado.
        return;
      }

      setUserName(parsedUser.nome || "");
      fetchDashboardData();
    } else {
      navigate({ to: "/login" });
      return;
    }
  }, [tenant, tenantLoading, navigate]);

  const fetchDashboardData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const now = new Date();
      const sDay = startOfDay(now);
      const eDay = endOfDay(now);
      const sMonth = startOfMonth(now);
      const eMonth = endOfMonth(now);

      // 0. Agenda aberta até
      const { data: lastDayData } = await supabase
        .from("dias_agenda")
        .select("data")
        .eq("barbearia_id", tenant!.id)
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 0.1. Colaboradores ativos
      const { data: colaboradoresAtivosData } = await supabase
        .from("colaboradores")
        .select("nome")
        .eq("barbearia_id", tenant!.id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      // 1. Clientes agendados hoje
      const { count: agendadosHojeCount } = await supabase
        .from("atendimentos")
        .select("*", { count: "exact", head: true })
        .eq("barbearia_id", tenant.id)
        .gte("data", sDay.toISOString())
        .lte("data", eDay.toISOString())
        .eq("status", "Agendado");

      // 2. Novos agendamentos criados hoje
      const { count: criadosHojeCount } = await supabase
        .from("atendimentos")
        .select("*", { count: "exact", head: true })
        .eq("barbearia_id", tenant.id)
        .gte("created_at", sDay.toISOString())
        .lte("created_at", now.toISOString());

      // 3. Faturamento Bruto Dia (Finalizados)
      const { data: atendDia } = await supabase
        .from("atendimentos")
        .select("valor")
        .eq("barbearia_id", tenant.id)
        .gte("data", sDay.toISOString())
        .lte("data", eDay.toISOString())
        .eq("status", "Finalizado");
      
      const brutoDia = atendDia?.reduce((acc, curr) => acc + Number(curr.valor || 0), 0) || 0;

      // 4. Dados do Mês
      const { data: atendMes } = await supabase
        .from("atendimentos")
        .select(`
          id,
          valor, 
          comissao,
          status,
          data,
          atendimento_servicos(servicos(duration))
        `)
        .eq("barbearia_id", tenant.id)
        .gte("data", sMonth.toISOString())
        .lte("data", eMonth.toISOString());

      let brutoMes = 0;
      let comissoesMes = 0;
      let previsaoAgendados = 0;
      
      atendMes?.forEach(atend => {
        const val = Number(atend.valor || 0);
        if (atend.status === "Finalizado") {
          brutoMes += val;
          comissoesMes += Number(atend.comissao || 0);
        } else if (atend.status === "Agendado") {
          previsaoAgendados += val;
        }
      });

      // 5. Despesas do Mês
      const { data: gastosMes } = await supabase
        .from("gastos")
        .select("valor")
        .eq("barbearia_id", tenant.id)
        .gte("data", sMonth.toISOString())
        .lte("data", eMonth.toISOString());
      
      const despesasMes = gastosMes?.reduce((acc, curr) => acc + Number(curr.valor || 0), 0) || 0;
      const liquidoMes = brutoMes - comissoesMes - despesasMes;

      // 6. Listas de Atendimentos
      const { data: listAtend } = await supabase
        .from("atendimentos")
        .select(`
          id,
          data,
          status,
          valor,
          cliente:usuarios!cliente_id(nome),
          colaborador:colaboradores(nome),
          atendimento_servicos(servicos(duration, name))
        `)
        .eq("barbearia_id", tenant.id)
        .gte("data", sDay.toISOString())
        .lte("data", eDay.toISOString())
        .order("data", { ascending: true });

      const formattedList = (listAtend || []).map(item => {
        const dur = (item.atendimento_servicos as any[]).reduce((acc, s) => acc + (s.servicos?.duration || 0), 0);
        const startTime = parseISO(item.data);
        const endTime = addMinutes(startTime, dur);
        return {
          ...item,
          startTime,
          endTime,
          servicosNomes: (item.atendimento_servicos as any[]).map(s => s.servicos?.name).join(", ")
        };
      });

      const agendamentosProximos = formattedList.filter(a => 
        a.status === "Agendado" && isAfter(a.startTime, now)
      );

      const agendamentosEmAberto = formattedList.filter(a => 
        a.status === "Agendado" && !isAfter(a.endTime, now)
      );

      setData({
        clientesAgendadosHoje: agendadosHojeCount || 0,
        novosAgendamentosHoje: criadosHojeCount || 0,
        faturamentoBrutoDia: brutoDia,
        faturamentoBrutoMes: brutoMes,
        faturamentoLiquidoMes: liquidoMes,
        comissoesMes: comissoesMes,
        despesasMes: despesasMes,
        previsaoBrutoMes: brutoMes + previsaoAgendados,
        colaboradoresAtivos: (colaboradoresAtivosData || []).map(colaborador => colaborador.nome).filter(Boolean),
        agendamentosProximos,
        agendamentosEmAberto,
        agendaAbertaAte: lastDayData?.data || null
      });

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados do dashboard");
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
      <div className="space-y-8 pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              {userName ? `${userName}, bem-vindo` : "Bem-vindo"} à gestão da sua barbearia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate({ to: "/clientes" } as any)} size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Cliente
            </Button>
            <Button onClick={() => navigate({ to: "/atendimentos" } as any)} size="sm" className="gap-2">
              <Calendar className="h-4 w-4" />
              Atendimento
            </Button>
          </div>
        </div>

        {/* Cards de Resumo Hoje */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card className="p-0 border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium">Agenda Aberta Até</CardTitle>
              <Clock className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl md:text-2xl font-bold text-primary">
                {data.agendaAbertaAte ? format(parseISO(data.agendaAbertaAte), "dd/MM/yyyy") : "--/--/----"}
              </div>
              <p className="text-xs text-muted-foreground">Último dia disponível</p>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium">Agendados (Hoje)</CardTitle>
              <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl md:text-2xl font-bold">{data.clientesAgendadosHoje}</div>
              <p className="text-xs text-muted-foreground">Clientes marcados para hoje</p>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium">Novos Agendamentos</CardTitle>
              <PlusCircle className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl md:text-2xl font-bold">{data.novosAgendamentosHoje}</div>
              <p className="text-xs text-muted-foreground">Criados hoje (desde 00:00)</p>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium">Bruto (Hoje)</CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg md:text-2xl font-bold">{formatCurrency(data.faturamentoBrutoDia)}</div>
              <p className="text-xs text-muted-foreground">Finalizados hoje</p>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium">Previsão (Mês)</CardTitle>
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg md:text-2xl font-bold text-primary">{formatCurrency(data.previsaoBrutoMes)}</div>
              <p className="text-xs text-muted-foreground">Bruto + Agendados</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Colaboradores Ativos
            </CardTitle>
            <Badge variant="outline">{data.colaboradoresAtivos.length}</Badge>
          </CardHeader>
          <CardContent>
            {data.colaboradoresAtivos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum colaborador ativo cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.colaboradoresAtivos.map(nome => (
                  <Badge key={nome} variant="secondary" className="text-sm py-1 px-3">
                    {nome}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Listas de Atenção e Próximos */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Atenção: Agendamentos em Aberto */}
          <Card className="border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Atenção: Agendamentos em Aberto
              </CardTitle>
              <Badge variant="destructive">{data.agendamentosEmAberto.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.agendamentosEmAberto.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento atrasado.</p>
              ) : (
                data.agendamentosEmAberto.map(atend => (
                  <div key={atend.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{atend.cliente?.nome || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">{atend.servicosNomes}</p>
                      <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                        <Clock className="h-3 w-3" />
                        Terminou às {format(atend.endTime, "HH:mm")}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate({ to: "/atendimentos" } as any)}>
                      Resolver
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Próximos Atendimentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Próximos do Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.agendamentosProximos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem mais agendamentos hoje.</p>
              ) : (
                data.agendamentosProximos.map(atend => (
                  <div key={atend.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{format(atend.startTime, "HH:mm")}</span>
                        <p className="font-medium text-sm">{atend.cliente?.nome || "Cliente"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{atend.servicosNomes}</p>
                      <p className="text-[10px] text-muted-foreground italic">Com: {atend.colaborador?.nome}</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary">Agendado</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financeiro do Mês */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <Card className="p-0">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium text-muted-foreground">Bruto (Mês)</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg md:text-2xl font-bold">{formatCurrency(data.faturamentoBrutoMes)}</div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium text-muted-foreground">Líquido (Mês)</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className={cn("text-lg md:text-2xl font-bold", data.faturamentoLiquidoMes >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(data.faturamentoLiquidoMes)}
              </div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium text-muted-foreground">Comissões (Mês)</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg md:text-2xl font-bold text-blue-500">{formatCurrency(data.comissoesMes)}</div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[12px] md:text-sm font-medium text-muted-foreground">Despesas (Mês)</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg md:text-2xl font-bold text-destructive">{formatCurrency(data.despesasMes)}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
