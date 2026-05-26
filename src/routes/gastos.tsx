import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Trash2, Edit2, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
  endOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export const Route = createFileRoute("/gastos")({
  component: GastosPage,
});

interface Gasto {
  id: string;
  nome: string;
  valor: number;
  data: string;
}

function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSalarioDialogOpen, setIsSalarioDialogOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([]);
  
  // Form states
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [dataGasto, setDataGasto] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedColaboradorId, setSelectedColaboradorId] = useState("");

  const [totalMesAtual, setTotalMesAtual] = useState(0);
  const [totalUltimos12Meses, setTotalUltimos12Meses] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchGastos();
    fetchSummaryData();
    fetchColaboradores();
  }, [selectedMonth]);

  const fetchColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome");
      if (error) throw error;
      setColaboradores(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar colaboradores:", error);
    }
  };

  const fetchGastos = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      const { data, error } = await supabase
        .from("gastos")
        .select("*")
        .gte("data", start.toISOString())
        .lte("data", end.toISOString())
        .order("data", { ascending: false });

      if (error) throw error;
      setGastos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar gastos: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummaryData = async () => {
    try {
      // Total mes selecionado (já calculado via fetchGastos mas vamos fazer uma query pra resumo se quiser)
      const startCurrent = startOfMonth(selectedMonth);
      const endCurrent = endOfMonth(selectedMonth);
      
      const { data: currentData, error: currentError } = await supabase
        .from("gastos")
        .select("valor")
        .gte("data", startCurrent.toISOString())
        .lte("data", endCurrent.toISOString());
      
      if (currentError) throw currentError;
      const totalCurrent = currentData.reduce((acc, curr) => acc + Number(curr.valor), 0);
      setTotalMesAtual(totalCurrent);

      // Total ultimos 12 meses
      const start12 = startOfMonth(subMonths(new Date(), 11));
      const end12 = endOfMonth(new Date());

      const { data: data12, error: error12 } = await supabase
        .from("gastos")
        .select("valor, data")
        .gte("data", start12.toISOString())
        .lte("data", end12.toISOString());

      if (error12) throw error12;
      
      const total12 = data12.reduce((acc, curr) => acc + Number(curr.valor), 0);
      setTotalUltimos12Meses(total12);

      // Chart data
      const months = eachMonthOfInterval({
        start: start12,
        end: end12,
      });

      const formattedChartData = months.map(month => {
        const monthTotal = data12
          .filter(g => isSameMonth(parseISO(g.data), month))
          .reduce((acc, curr) => acc + Number(curr.valor), 0);
        
        return {
          name: format(month, "MMM/yy", { locale: ptBR }),
          total: monthTotal,
          fullDate: month
        };
      });

      setChartData(formattedChartData);

    } catch (error: any) {
      console.error("Erro no resumo:", error);
    }
  };

  const handleSaveGasto = async () => {
    if (!nome || !valor) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      const [year, month, day] = dataGasto.split("-").map(Number);
      const payload = {
        nome,
        valor: parseFloat(valor),
        data: new Date(year, month - 1, day, 12, 0, 0).toISOString(),
      };

      if (editingGasto) {
        const { error } = await supabase
          .from("gastos")
          .update(payload)
          .eq("id", editingGasto.id);
        if (error) throw error;
        toast.success("Gasto atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("gastos")
          .insert([payload]);
        if (error) throw error;
        toast.success("Gasto adicionado com sucesso");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchGastos();
      fetchSummaryData();
    } catch (error: any) {
      toast.error("Erro ao salvar gasto: " + error.message);
    }
  };

  const handleDeleteGasto = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este gasto?")) return;

    try {
      const { error } = await supabase
        .from("gastos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Gasto excluído");
      fetchGastos();
      fetchSummaryData();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const resetForm = () => {
    setNome("");
    setValor("");
    setDataGasto(format(new Date(), "yyyy-MM-dd"));
    setEditingGasto(null);
    setSelectedColaboradorId("");
  };

  const handleSaveSalario = async () => {
    const colaborador = colaboradores.find(c => c.id === selectedColaboradorId);
    if (!colaborador || !valor) {
      toast.error("Selecione o funcionário e o valor");
      return;
    }

    try {
      const payload = {
        nome: `Salário: ${colaborador.nome}`,
        valor: parseFloat(valor),
        data: startOfMonth(selectedMonth).toISOString(),
      };

      const { error } = await supabase
        .from("gastos")
        .insert([payload]);

      if (error) throw error;
      toast.success("Salário registrado como gasto");
      setIsSalarioDialogOpen(false);
      resetForm();
      fetchGastos();
      fetchSummaryData();
    } catch (error: any) {
      toast.error("Erro ao salvar salário: " + error.message);
    }
  };

  const openEditDialog = (gasto: Gasto) => {
    setEditingGasto(gasto);
    setNome(gasto.nome);
    setValor(gasto.valor.toString());
    setDataGasto(format(parseISO(gasto.data), "yyyy-MM-dd"));
    setIsDialogOpen(true);
  };

  const monthOptions = eachMonthOfInterval({
    start: subMonths(new Date(), 24),
    end: new Date(),
  }).reverse();

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={isSalarioDialogOpen} onOpenChange={(open) => {
              setIsSalarioDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="default" className="gap-2 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4" />
                  Adicionar Salário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Registrar Salário de Funcionário</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="colaborador">Funcionário</Label>
                    <Select value={selectedColaboradorId} onValueChange={setSelectedColaboradorId}>
                      <SelectTrigger id="colaborador">
                        <SelectValue placeholder="Selecione o funcionário" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradores.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="valor_salario">Valor do Salário (R$)</Label>
                    <Input 
                      id="valor_salario" 
                      type="number" 
                      step="0.01"
                      value={valor} 
                      onChange={(e) => setValor(e.target.value)} 
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O salário será registrado no primeiro dia do mês selecionado ({format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}).
                  </p>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setIsSalarioDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
                  <Button onClick={handleSaveSalario} className="w-full sm:w-auto">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                  Adicionar Gasto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingGasto ? "Editar Gasto" : "Novo Gasto"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome do gasto</Label>
                    <Input 
                      id="nome" 
                      value={nome} 
                      onChange={(e) => setNome(e.target.value)} 
                      placeholder="Ex: Aluguel, Luz, Produtos..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input 
                      id="valor" 
                      type="number" 
                      step="0.01"
                      value={valor} 
                      onChange={(e) => setValor(e.target.value)} 
                      placeholder="0,00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="data">Data</Label>
                    <Input 
                      id="data" 
                      type="date"
                      value={dataGasto} 
                      onChange={(e) => setDataGasto(e.target.value)} 
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
                  <Button onClick={handleSaveGasto} className="w-full sm:w-auto">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto do Mês</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMesAtual)}
              </div>
              <p className="text-xs text-muted-foreground">
                Referente a {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Últimos 12 Meses</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalUltimos12Meses)}
              </div>
              <p className="text-xs text-muted-foreground">
                Acumulado do último ano
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista e Filtro */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 space-y-0">
            <CardTitle>Gastos de {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="hidden sm:inline whitespace-nowrap">Filtrar por mês:</Label>
              <Select 
                value={format(selectedMonth, "yyyy-MM")} 
                onValueChange={(value) => {
                  const [year, month] = value.split("-").map(Number);
                  setSelectedMonth(new Date(year, month - 1, 1, 12, 0, 0));
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={format(month, "yyyy-MM")} value={format(month, "yyyy-MM")}>
                      {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            ) : gastos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum gasto registrado para este mês.</div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gastos.map((gasto) => (
                        <TableRow key={gasto.id}>
                          <TableCell className="font-medium">{gasto.nome}</TableCell>
                          <TableCell>{format(parseISO(gasto.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gasto.valor)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(gasto)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteGasto(gasto.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden divide-y">
                  {gastos.map((gasto) => (
                    <div key={gasto.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-foreground">{gasto.nome}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <CalendarIcon className="w-3 h-3" />
                            {format(parseISO(gasto.data), "dd/MM/yyyy")}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gasto.valor)}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 flex-1" onClick={() => openEditDialog(gasto)}>
                          <Edit2 className="h-3 w-3" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 flex-1 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteGasto(gasto.id)}>
                          <Trash2 className="h-3 w-3" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Gastos (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                    formatter={(value: number) => [
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                      'Gasto Total'
                    ]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="currentColor" 
                    radius={[4, 4, 0, 0]} 
                    className="fill-primary"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isSameMonth(entry.fullDate, selectedMonth) ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
