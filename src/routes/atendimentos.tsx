import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Calendar, 
  User, 
  Scissors, 
  Clock, 
  MoreVertical, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Search,
  Filter,
  ChevronDown,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/atendimentos" as any)({
  component: AtendimentosPage,
});

interface Atendimento {
  id: string;
  data: string;
  valor: number;
  status: 'Agendado' | 'Finalizado' | 'Não compareceu';
  cliente: { id: string; nome: string; login: string };
  colaborador: { id: string; nome: string };
  servicos: { id: string; name: string; price: number; duration: number }[];
}

interface Cliente {
  id: string;
  nome: string;
  login: string;
}

interface Colaborador {
  id: string;
  nome: string;
}

interface Servico {
  id: string;
  name: string;
  price: number;
  duration: number;
}

function AtendimentosPage() {
  const [agendados, setAgendados] = useState<Atendimento[]>([]);
  const [atencao, setAtencao] = useState<Atendimento[]>([]);
  const [concluidos, setConcluidos] = useState<Atendimento[]>([]);
  const [loadingAgendados, setLoadingAgendados] = useState(true);
  const [loadingConcluidos, setLoadingConcluidos] = useState(true);
  const [limitAgendados, setLimitAgendados] = useState(10);
  const [limitConcluidos, setLimitConcluidos] = useState(10);
  const [hasMoreAgendados, setHasMoreAgendados] = useState(false);
  const [hasMoreConcluidos, setHasMoreConcluidos] = useState(false);
  const [filtroConcluidos, setFiltroConcluidos] = useState<'Todos' | 'Finalizado' | 'Não compareceu'>('Todos');

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAtendimento, setEditingAtendimento] = useState<Atendimento | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [allServicos, setAllServicos] = useState<Servico[]>([]);
  
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [selectedDatePart, setSelectedDatePart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTimePart, setSelectedTimePart] = useState(format(new Date(), "HH:mm"));
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [valorFinal, setValorFinal] = useState("0");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [maxDate, setMaxDate] = useState<string>("");
  const [status, setStatus] = useState<Atendimento['status']>('Finalizado');

  useEffect(() => {
    fetchAgendados();
    fetchConcluidos();
    fetchFormData();
    fetchMaxDate();
  }, [limitAgendados, limitConcluidos, filtroConcluidos]);

  const fetchMaxDate = async () => {
    const { data } = await supabase.from('dias_agenda').select('data').eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (data && data.length > 0) setMaxDate(data[0].data);
  };

  const fetchAgendados = async () => {
    setLoadingAgendados(true);
    const { data, error, count } = await supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(id, nome, login),
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servico_id, servicos(id, name, price, duration))
      `, { count: 'exact' })
      .eq('status', 'Agendado')
      .order('data', { ascending: true })
      .range(0, limitAgendados - 1);

    if (error) { toast.error("Erro ao carregar agendados"); return; }

    const formatted = (data as any[]).map(item => ({
      ...item,
      servicos: item.atendimento_servicos.map((as: any) => as.servicos)
    }));

    const now = new Date();
    setAtencao(formatted.filter(item => new Date(item.data) < now));
    setAgendados(formatted.filter(item => new Date(item.data) >= now));
    setHasMoreAgendados((count || 0) > limitAgendados);
    setLoadingAgendados(false);
  };

  const fetchConcluidos = async () => {
    setLoadingConcluidos(true);
    let query = supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(id, nome, login),
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servico_id, servicos(id, name, price, duration))
      `, { count: 'exact' })
      .in('status', ['Finalizado', 'Não compareceu']);

    if (filtroConcluidos !== 'Todos') query = query.eq('status', filtroConcluidos);

    const { data, error, count } = await query
      .order('data', { ascending: false })
      .range(0, limitConcluidos - 1);

    if (error) { toast.error("Erro ao carregar concluídos"); return; }

    setConcluidos((data as any[]).map(item => ({ ...item, servicos: item.atendimento_servicos.map((as: any) => as.servicos) })));
    setHasMoreConcluidos((count || 0) > limitConcluidos);
    setLoadingConcluidos(false);
  };

  const fetchFormData = async () => {
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome').order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration').order('name');
    setColaboradores(colabs || []);
    setAllServicos(servs || []);
  };

  const searchClientes = async (term: string) => {
    setSearchCliente(term);
    if (term.length < 2) { setClientes([]); return; }
    const { data } = await supabase.from('usuarios').select('id, nome, login').eq('nivel', 3).or(`nome.ilike.%${term}%,login.ilike.%${term}%`).limit(5);
    setClientes(data || []);
  };

  const handleSelectServico = (servicoId: string) => {
    setSelectedServicos(prev => {
      const newSelection = prev.includes(servicoId) ? prev.filter(id => id !== servicoId) : [...prev, servicoId];
      const newTotal = newSelection.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.price || 0), 0);
      setValorFinal(newTotal.toString());
      return newSelection;
    });
  };

  const resetForm = () => {
    setEditingAtendimento(null);
    setSelectedCliente(null);
    setSearchCliente("");
    setSelectedColaborador("");
    setSelectedDatePart(format(new Date(), "yyyy-MM-dd"));
    setSelectedTimePart(format(new Date(), "HH:mm"));
    setSelectedServicos([]);
    setValorFinal("0");
    setStatus('Finalizado');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente || !selectedColaborador || selectedServicos.length === 0) { toast.error("Preencha todos os campos"); return; }
    setIsSubmitting(true);
    try {
      const payload = { cliente_id: selectedCliente.id, colaborador_id: selectedColaborador, data: `${selectedDatePart}T${selectedTimePart}`, valor: parseFloat(valorFinal), status: status };
      let atendimentoId = editingAtendimento?.id;

      if (editingAtendimento) {
        await supabase.from('atendimentos').update(payload).eq('id', editingAtendimento.id);
        await supabase.from('atendimento_servicos').delete().eq('atendimento_id', editingAtendimento.id);
      } else {
        const { data } = await supabase.from('atendimentos').insert([payload]).select().single();
        atendimentoId = data.id;
      }
      await supabase.from('atendimento_servicos').insert(selectedServicos.map(sId => ({ atendimento_id: atendimentoId, servico_id: sId, valor_servico: allServicos.find(s => s.id === sId)?.price || 0 })));
      toast.success(editingAtendimento ? "Atendimento atualizado" : "Atendimento criado");
      setIsDialogOpen(false);
      fetchAgendados();
      fetchConcluidos();
    } catch (error: any) { toast.error("Erro ao salvar: " + error.message); }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Agendado': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Agendado</Badge>;
      case 'Finalizado': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Finalizado</Badge>;
      case 'Não compareceu': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Não compareceu</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const AtendimentoCard = ({ item }: { item: Atendimento }) => (
    <Card className="hover:bg-accent/5 transition-colors cursor-pointer" onClick={() => openEditDialog(item)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="font-bold">{item.cliente.nome}</span></div>
          {getStatusBadge(item.status)}
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Calendar className="w-3 h-3" /><span>{format(new Date(item.data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span></div>
          <div className="flex items-center gap-2"><User className="w-3 h-3" /><span>Colaborador: {item.colaborador.nome}</span></div>
          <div className="flex items-center gap-2"><Scissors className="w-3 h-3" /><span>{item.servicos.map(s => s.name).join(", ")}</span></div>
        </div>
      </CardContent>
    </Card>
  );

  const openEditDialog = (item: Atendimento) => {
    setEditingAtendimento(item);
    setSelectedCliente(item.cliente);
    setSearchCliente(item.cliente.nome);
    setSelectedColaborador(item.colaborador.id);
    setSelectedDatePart(format(new Date(item.data), "yyyy-MM-dd"));
    setSelectedTimePart(format(new Date(item.data), "HH:mm"));
    setSelectedServicos(item.servicos.map(s => s.id));
    setValorFinal(item.valor.toString());
    setStatus(item.status);
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Atendimentos</h1>
            <p className="text-muted-foreground">Controle os agendamentos e atendimentos realizados</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsScheduleDialogOpen(true)} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
              <Calendar className="w-4 h-4" />
              Agendar Atendimento
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo atendimento
            </Button>
          </div>
        </div>

        <Tabs defaultValue="agendados" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="agendados">Agendados</TabsTrigger>
            <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
          </TabsList>
          <TabsContent value="agendados" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agendados.map(item => <AtendimentoCard key={item.id} item={item} />)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Add/Edit Existing */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>{editingAtendimento ? "Editar Atendimento" : "Novo Atendimento"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar cliente por nome ou telefone..." 
                    className="pl-10"
                    value={searchCliente}
                    onChange={(e) => searchClientes(e.target.value)}
                  />
                  {clientes.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg overflow-hidden">
                      {clientes.map(c => (
                        <div 
                          key={c.id} 
                          className="px-4 py-2 hover:bg-accent cursor-pointer flex justify-between items-center"
                          onClick={() => {
                            setSelectedCliente(c);
                            setSearchCliente(c.nome);
                            setClientes([]);
                          }}
                        >
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-xs text-muted-foreground">{c.login}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedCliente && (
                  <div className="text-xs text-green-500 font-medium">✓ Cliente selecionado: {selectedCliente.nome}</div>
                )}
                {searchCliente && !selectedCliente && clientes.length === 0 && searchCliente.length >= 2 && (
                   <div className="text-xs text-destructive">Cliente não cadastrado. Cadastre o cliente antes de criar o atendimento</div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map(colab => (
                      <SelectItem key={colab.id} value={colab.id}>{colab.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                    <Input 
                      type="date" 
                      className="pl-10"
                      value={selectedDatePart} 
                      onChange={(e) => setSelectedDatePart(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                    <Input 
                      type="time" 
                      className="pl-10"
                      value={selectedTimePart} 
                      onChange={(e) => setSelectedTimePart(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Serviços</Label>
                <div className="grid grid-cols-1 gap-2 border rounded-md p-3 max-h-[150px] overflow-y-auto bg-muted/20">
                  {allServicos.map(s => (
                    <div key={s.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`serv-${s.id}`} 
                        checked={selectedServicos.includes(s.id)} 
                        onCheckedChange={() => handleSelectServico(s.id)}
                      />
                      <label htmlFor={`serv-${s.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1 flex justify-between">
                        <span>{s.name}</span>
                        <span className="text-muted-foreground text-xs">R$ {Number(s.price).toFixed(2)}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Final (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={valorFinal} 
                    onChange={(e) => setValorFinal(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  
                  {!editingAtendimento ? (
                    <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 text-sm flex items-center font-medium text-green-600">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      Finalizado
                    </div>
                  ) : (
                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Agendado">Agendado</SelectItem>
                        <SelectItem value="Finalizado">Finalizado</SelectItem>
                        <SelectItem value="Não compareceu">Não compareceu</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <DialogFooter><Button onClick={() => setIsDialogOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* New Schedule Dialog */}
        <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Agendar Atendimento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Flow coming soon...</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
