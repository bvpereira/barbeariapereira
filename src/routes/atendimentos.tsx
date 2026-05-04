import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Calendar as CalendarIcon, 
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
import { triggerWebhook } from "@/lib/webhook";
import { Card, CardContent } from "@/components/ui/card";
import { BookingButton } from "@/components/BookingButton";
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
import { format, parseISO, isAfter, addMinutes, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atendimentos" as any)({
  component: AtendimentosPage,
});

interface Atendimento {
  id: string;
  data: string;
  valor: number;
  comissao: number;
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
  ativo: boolean;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAtendimento, setEditingAtendimento] = useState<Atendimento | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [allServicos, setAllServicos] = useState<Servico[]>([]);
  const [colabServicosIds, setColabServicosIds] = useState<string[]>([]);
  const [colabActiveDates, setColabActiveDates] = useState<string[]>([]);
  
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [selectedDatePart, setSelectedDatePart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTimePart, setSelectedTimePart] = useState("");
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [valorFinal, setValorFinal] = useState("0");
  const [comissaoFinal, setComissaoFinal] = useState("0");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [maxDate, setMaxDate] = useState<string>("");
  const [status, setStatus] = useState<Atendimento['status']>('Finalizado');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const fetchAgendados = useCallback(async () => {
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
  }, [limitAgendados]);

  const fetchConcluidos = useCallback(async () => {
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
  }, [limitConcluidos, filtroConcluidos]);

  const fetchFormData = async () => {
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome, ativo').order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration').order('name');
    setColaboradores(colabs || []);
    setAllServicos(servs || []);
  };

  const fetchMaxDate = async () => {
    const { data } = await supabase.from('dias_agenda').select('data').eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (data && data.length > 0) setMaxDate(data[0].data);
  };

  useEffect(() => {
    fetchAgendados();
  }, [fetchAgendados]);

  useEffect(() => {
    fetchConcluidos();
  }, [fetchConcluidos]);

  useEffect(() => {
    fetchFormData();
    fetchMaxDate();
  }, []);

  const searchClientes = async (term: string) => {
    setSearchCliente(term);
    if (term.length < 2) { setClientes([]); return; }
    const { data } = await supabase.from('usuarios').select('id, nome, login').eq('nivel', 3).or(`nome.ilike.%${term}%,login.ilike.%${term}%`).limit(5);
    setClientes(data || []);
  };

  const handleSelectServico = async (servicoId: string) => {
    setSelectedServicos(prev => {
      const isRemoving = prev.includes(servicoId);
      const newSelection = isRemoving ? prev.filter(id => id !== servicoId) : [...prev, servicoId];
      const newTotal = newSelection.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.price || 0), 0);
      setValorFinal(newTotal.toString());
      
      // Auto-calculate commission if we have a collaborator
      if (selectedColaborador) {
        calculateComissao(newSelection, selectedColaborador);
      }
      
      return newSelection;
    });
  };

  const calculateComissao = async (servicosIds: string[], colabId: string) => {
    const { data: rules } = await supabase
      .from("colaborador_servicos")
      .select("servico_id, valor_comissao, tipo_comissao")
      .eq("colaborador_id", colabId);
    
    let totalComissao = 0;
    servicosIds.forEach(sId => {
      const rule = rules?.find(r => r.servico_id === sId);
      const servico = allServicos.find(s => s.id === sId);
      if (rule && servico) {
        if (rule.tipo_comissao === "fixo") {
          totalComissao += Number(rule.valor_comissao);
        } else {
          totalComissao += (Number(servico.price) * Number(rule.valor_comissao)) / 100;
        }
      }
    });
    setComissaoFinal(totalComissao.toString());
  };

  const fetchColabServicos = async (colabId: string) => {
    const { data } = await supabase.from('colaborador_servicos').select('servico_id').eq('colaborador_id', colabId);
    setColabServicosIds(data?.map(d => d.servico_id).filter((id): id is string => !!id) || []);
    
    // Fetch active dates
    const { data: activeDates } = await supabase.from('horarios_colaboradores').select('data').eq('colaborador_id', colabId).eq('ativo', true);
    const dates = activeDates?.map(d => d.data) || [];
    setColabActiveDates(dates);
    
    if (selectedDatePart && !dates.includes(selectedDatePart)) {
      setSelectedDatePart("");
    }
  };

  const fetchAvailableTimes = useCallback(async (date: string, colabId: string, servs: string[]) => {
    if (!date || !colabId || servs.length === 0) {
      setAvailableTimes([]);
      return;
    }
    setLoadingTimes(true);
    try {
      const { data: workingHours } = await supabase.from('horarios_colaboradores').select('*').eq('colaborador_id', colabId).eq('data', date).eq('ativo', true).maybeSingle();
      if (!workingHours) { 
        setAvailableTimes([]); 
        setLoadingTimes(false);
        return; 
      }

      const { data: appts } = await supabase.from('atendimentos').select('data, status, atendimento_servicos(servicos(duration))').eq('colaborador_id', colabId).eq('status', 'Agendado').gte('data', `${date}T00:00:00`).lte('data', `${date}T23:59:59`);

      const requestedDuration = servs.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.duration || 0), 0);
      const possibleTimes: string[] = [];
      const now = new Date();
      const minAllowed = addMinutes(now, 60);

      const checkOverlap = (start: Date, duration: number) => {
        const end = addMinutes(start, duration);
        return appts?.some(app => {
          const appStart = parseISO(app.data);
          const appDur = (app.atendimento_servicos as any[]).reduce((sum, item) => sum + (item.servicos.duration || 0), 0);
          const appEnd = addMinutes(appStart, appDur);
          return (start < appEnd && end > appStart);
        });
      };

      const generateSlots = (s: string, e: string) => {
        if (!s || !e) return;
        let curr = parseISO(`${date}T${s}`);
        const end = parseISO(`${date}T${e}`);
        while (addMinutes(curr, requestedDuration) <= end) {
          if (isAfter(curr, minAllowed) && !checkOverlap(curr, requestedDuration)) {
            possibleTimes.push(format(curr, "HH:mm"));
          }
          curr = addMinutes(curr, 30);
        }
      };

      if (workingHours.manha_inicio && workingHours.manha_fim) generateSlots(workingHours.manha_inicio, workingHours.manha_fim);
      if (workingHours.tarde_inicio && workingHours.tarde_fim) generateSlots(workingHours.tarde_inicio, workingHours.tarde_fim);
      setAvailableTimes(possibleTimes);
    } catch (e) { console.error(e); }
    setLoadingTimes(false);
  }, [allServicos]);

  useEffect(() => {
    fetchAvailableTimes(selectedDatePart, selectedColaborador, selectedServicos);
  }, [selectedDatePart, selectedColaborador, selectedServicos, fetchAvailableTimes]);

  const resetForm = () => {
    setEditingAtendimento(null);
    setSelectedCliente(null);
    setSearchCliente("");
    setSelectedColaborador("");
    setSelectedDatePart(format(new Date(), "yyyy-MM-dd"));
    setSelectedTimePart("");
    setSelectedServicos([]);
    setValorFinal("0");
    setComissaoFinal("0");
    setStatus('Finalizado');
    setColabServicosIds([]);
  };

  const handleSave = async (isScheduling: boolean) => {
    if (!selectedCliente || !selectedColaborador || selectedServicos.length === 0 || (isScheduling && !selectedTimePart)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        cliente_id: selectedCliente.id,
        colaborador_id: selectedColaborador,
        data: `${selectedDatePart}T${selectedTimePart || format(new Date(), "HH:mm")}:00-03:00`,
        valor: parseFloat(valorFinal),
        comissao: parseFloat(comissaoFinal),
        status: isScheduling ? 'Agendado' : status
      };
      
      let atendimentoId: string;
      if (editingAtendimento) {
        await supabase.from('atendimentos').update(payload).eq('id', editingAtendimento.id);
        await supabase.from('atendimento_servicos').delete().eq('atendimento_id', editingAtendimento.id);
        atendimentoId = editingAtendimento.id;
      } else {
        const { data, error } = await supabase.from('atendimentos').insert([payload]).select().single();
        if (error) throw error;
        atendimentoId = data.id;
      }

      await supabase.from('atendimento_servicos').insert(selectedServicos.map(sId => ({
        atendimento_id: atendimentoId,
        servico_id: sId,
        valor_servico: allServicos.find(s => s.id === sId)?.price || 0
      })));

      toast.success("Salvo com sucesso");
      setIsDialogOpen(false);
      fetchAgendados();
      fetchConcluidos();
    } catch (e: any) { toast.error(e.message); }
    setIsSubmitting(false);
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'Agendado': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Agendado</Badge>;
      case 'Finalizado': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Finalizado</Badge>;
      case 'Não compareceu': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Não compareceu</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  const updateStatus = async (id: string, newStatus: Atendimento['status']) => {
    try {
      const payload: any = { status: newStatus };
      
      // If finalizing and comissao is 0, we might want to calculate it
      // However, the requirement says "locked once finalized", so if we update via menu
      // we should check if it already has a commission value.
      if (newStatus === 'Finalizado') {
        const item = concluidos.find(a => a.id === id) || agendados.find(a => a.id === id) || atencao.find(a => a.id === id);
        if (item && Number(item.comissao) === 0) {
          // Fetch rules to calculate
          const { data: rules } = await supabase
            .from("colaborador_servicos")
            .select("servico_id, valor_comissao, tipo_comissao")
            .eq("colaborador_id", item.colaborador.id);
          
          let totalComissao = 0;
          item.servicos.forEach(serv => {
            const rule = rules?.find(r => r.servico_id === serv.id);
            if (rule) {
              if (rule.tipo_comissao === "fixo") {
                totalComissao += Number(rule.valor_comissao);
              } else {
                totalComissao += (Number(serv.price) * Number(rule.valor_comissao)) / 100;
              }
            }
          });
          payload.comissao = totalComissao;
        }
      }

      const { error } = await supabase.from('atendimentos').update(payload).eq('id', id);
      if (error) throw error;
      toast.success("Status atualizado");
      fetchAgendados();
      fetchConcluidos();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este atendimento?")) return;
    try {
      const { error } = await supabase.from('atendimentos').delete().eq('id', id);
      if (error) throw error;
      toast.success("Atendimento excluído");
      fetchAgendados();
      fetchConcluidos();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const AtendimentoCard = ({ item }: { item: Atendimento }) => (
    <Card className="hover:bg-accent/5 transition-colors cursor-pointer" onClick={() => {
      setEditingAtendimento(item);
      setSelectedCliente(item.cliente);
      setSearchCliente(item.cliente.nome);
      setSelectedColaborador(item.colaborador.id);
      setSelectedDatePart(format(parseISO(item.data), "yyyy-MM-dd"));
      setSelectedTimePart(format(parseISO(item.data), "HH:mm"));
      setSelectedServicos(item.servicos.map(s => s.id));
      setValorFinal(item.valor.toString());
      setComissaoFinal(item.comissao?.toString() || "0");
      setStatus(item.status);
      setIsDialogOpen(true);
    }}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="font-bold">{item.cliente.nome}</span></div>
          {getStatusBadge(item.status)}
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarIcon className="w-3 h-3" /><span>{format(parseISO(item.data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span></div>
          <div className="flex items-center gap-2"><User className="w-3 h-3" /><span>Colaborador: {item.colaborador.nome}</span></div>
          <div className="flex items-center gap-2"><Scissors className="w-3 h-3" /><span>{item.servicos.map(s => s.name).join(", ")}</span></div>
        </div>
        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          <span className="font-bold text-primary">R$ {Number(item.valor).toFixed(2).replace(".", ",")}</span>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => updateStatus(item.id, 'Agendado')}>
                  <Clock className="w-4 h-4 mr-2" /> Agendado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(item.id, 'Finalizado')}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(item.id, 'Não compareceu')}>
                  <XCircle className="w-4 h-4 mr-2" /> Não compareceu
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Atendimentos</h1>
            <p className="text-muted-foreground">Controle os agendamentos e atendimentos realizados</p>
          </div>
          <div className="flex gap-2">
            <BookingButton onSuccess={fetchAgendados} />
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
            {atencao.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="w-5 h-5" /><h2 className="text-lg font-semibold">Requer Atenção</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {atencao.map(item => (
                    <div key={item.id} className="relative">
                      <div className="absolute -top-2 -right-2 z-10"><Badge variant="destructive" className="animate-pulse">Atrasado</Badge></div>
                      <AtendimentoCard item={item} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">Próximos Agendamentos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loadingAgendados ? <p>Carregando...</p> : agendados.map(item => <AtendimentoCard key={item.id} item={item} />)}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="concluidos" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingConcluidos ? <p>Carregando...</p> : concluidos.map(item => <AtendimentoCard key={item.id} item={item} />)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Novo/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>{editingAtendimento ? "Editar Atendimento" : "Novo Atendimento"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
               <div className="space-y-2">
                <Label>Cliente</Label>
                <Input placeholder="Buscar cliente..." value={searchCliente} onChange={(e) => searchClientes(e.target.value)} />
                {clientes.map(c => <div key={c.id} onClick={() => { setSelectedCliente(c); setSearchCliente(c.nome); setClientes([]); }} className="p-2 hover:bg-accent cursor-pointer border rounded-md mt-1">{c.nome}</div>)}
              </div>
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={selectedColaborador} onValueChange={(v) => { 
                  setSelectedColaborador(v);
                  if (selectedServicos.length > 0) calculateComissao(selectedServicos, v);
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {!c.ativo && "(Inativo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data do Atendimento</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDatePart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDatePart ? (
                        format(parseISO(selectedDatePart), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDatePart ? parseISO(selectedDatePart) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDatePart(format(date, "yyyy-MM-dd"));
                          setIsCalendarOpen(false);
                        }
                      }}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Serviços</Label>
                <div className="grid gap-2 border p-3 rounded-md max-h-[150px] overflow-auto">
                  {allServicos.map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedServicos.includes(s.id)} onCheckedChange={() => handleSelectServico(s.id)} />
                      <span>{s.name} - R${s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              {!editingAtendimento ? (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 text-sm flex items-center font-medium text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    Finalizado
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agendado">Agendado</SelectItem>
                      <SelectItem value="Finalizado">Finalizado</SelectItem>
                      <SelectItem value="Não compareceu">Não compareceu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor Total (R$)</Label>
                  <Input 
                    id="valor"
                    type="number"
                    step="0.01"
                    value={valorFinal}
                    onChange={(e) => setValorFinal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comissao">Comissão (R$)</Label>
                  <Input 
                    id="comissao"
                    type="number"
                    step="0.01"
                    value={comissaoFinal}
                    onChange={(e) => setComissaoFinal(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => handleSave(false)} disabled={isSubmitting}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}
