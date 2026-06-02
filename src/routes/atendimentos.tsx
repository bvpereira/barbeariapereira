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
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { triggerWebhook } from "@/lib/webhook";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { format, parseISO, isAfter, addMinutes, startOfToday, isToday } from "date-fns";
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

export const Route = createFileRoute("/atendimentos")({
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
  foto_url?: string | null;
  servicos?: string[];
}

interface Servico {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url?: string | null;
}

function AtendimentosPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [agendados, setAgendados] = useState<Atendimento[]>([]);
  const [atencao, setAtencao] = useState<Atendimento[]>([]);
  const [concluidos, setConcluidos] = useState<Atendimento[]>([]);
  const [loadingAgendados, setLoadingAgendados] = useState(true);
  const [loadingConcluidos, setLoadingConcluidos] = useState(true);
  const [limitAgendados, setLimitAgendados] = useState(10);
  const [limitConcluidos, setLimitConcluidos] = useState(10);
  const [pedidosExclusao, setPedidosExclusao] = useState<Atendimento[]>([]);
  const [loadingExclusao, setLoadingExclusao] = useState(false);
  const [hasMoreAgendados, setHasMoreAgendados] = useState(false);
  const [hasMoreConcluidos, setHasMoreConcluidos] = useState(false);
  const [filtroConcluidos, setFiltroConcluidos] = useState<'Todos' | 'Finalizado' | 'Não compareceu'>('Todos');

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAtendimento, setEditingAtendimento] = useState<Atendimento | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);

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
  const [tempoMarcar, setTempoMarcar] = useState<number>(60);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const fetchAgendados = useCallback(async () => {
    if (!tenant?.id) return;
    setLoadingAgendados(true);
    const { data, error, count } = await supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(id, nome, login),
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servico_id, servicos(id, name, price, duration))
      `, { count: 'exact' })
      .eq('barbearia_id', tenant?.id)
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
      .eq('barbearia_id', tenant?.id)
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

  const fetchPedidosExclusao = useCallback(async () => {
    setLoadingExclusao(true);
    const { data, error } = await supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(id, nome, login),
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servico_id, servicos(id, name, price, duration))
      `)
      .eq('barbearia_id', tenant?.id)
      .eq('pedido_exclusao', true)
      .order('data', { ascending: false });

    if (error) { toast.error("Erro ao carregar pedidos de exclusão"); return; }

    setPedidosExclusao((data as any[]).map(item => ({ ...item, servicos: item.atendimento_servicos.map((as: any) => as.servicos) })));
    setLoadingExclusao(false);
  }, []);

  const fetchFormData = async () => {
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome, ativo, foto_url').eq('barbearia_id', tenant?.id).order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration, image_url').eq('barbearia_id', tenant?.id).order('name');
    const { data: rels } = await supabase.from('colaborador_servicos').select('colaborador_id, servico_id').eq('barbearia_id', tenant?.id);
    
    const formattedColabs = colabs?.map(c => ({
      ...c,
      servicos: rels?.filter(r => r.colaborador_id === c.id).map(r => {
        const s = servs?.find(srv => srv.id === r.servico_id);
        return s?.name || "";
      }).filter(Boolean)
    })) || [];

    setColaboradores(formattedColabs as Colaborador[]);
    setAllServicos(servs || []);
  };

  const fetchBookingSettings = async () => {
    const { data: agendaData } = await supabase.from('dias_agenda').select('data').eq('barbearia_id', tenant?.id).eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (agendaData && agendaData.length > 0) setMaxDate(agendaData[0].data);

    const { data: infoData } = await supabase.from('informacoes').select('tempo_marcar').eq('barbearia_id', tenant?.id).maybeSingle();
    if (infoData) setTempoMarcar(infoData.tempo_marcar ?? 60);
  };

  useEffect(() => {
    if (tenantLoading) return;
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (tenant?.id && parsedUser.barbearia_id !== tenant.id) {
        toast.error("Acesso negado.");
        window.location.href = "/";
        return;
      }
    }
    fetchAgendados();
  }, [fetchAgendados, tenant]);

  useEffect(() => {
    fetchConcluidos();
  }, [fetchConcluidos]);

  useEffect(() => {
    fetchFormData();
    fetchBookingSettings();
    fetchPedidosExclusao();
  }, [fetchPedidosExclusao]);

  const searchClientes = async (term: string) => {
    setSearchCliente(term);
    if (term.length < 2) { setClientes([]); return; }
    const { data } = await supabase.from('usuarios').select('id, nome, login').eq('barbearia_id', tenant?.id).eq('nivel', 3).or(`nome.ilike.%${term}%,login.ilike.%${term}%`).limit(5);
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
      .eq("barbearia_id", tenant?.id)
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
    const { data } = await supabase.from('colaborador_servicos').select('servico_id').eq('barbearia_id', tenant?.id).eq('colaborador_id', colabId);
    const ids = data?.map(d => d.servico_id).filter((id): id is string => !!id) || [];
    setColabServicosIds(ids);
    
    // Fetch active dates
    const { data: activeDates } = await supabase.from('horarios_colaboradores').select('data').eq('barbearia_id', tenant?.id).eq('colaborador_id', colabId).eq('ativo', true);
    const dates = activeDates?.map(d => d.data) || [];
    setColabActiveDates(dates);
    
    if (selectedDatePart && !dates.includes(selectedDatePart)) {
      setSelectedDatePart("");
    }

    return ids;
  };

  const fetchAvailableTimes = useCallback(async (date: string, colabId: string, servs: string[]) => {
    if (!date || !colabId || servs.length === 0) {
      setAvailableTimes([]);
      return;
    }
    setLoadingTimes(true);
    try {
      const { data: workingHours } = await supabase.from('horarios_colaboradores').select('*').eq('barbearia_id', tenant?.id).eq('colaborador_id', colabId).eq('data', date).eq('ativo', true).maybeSingle();
      if (!workingHours) { 
        setAvailableTimes([]); 
        setLoadingTimes(false);
        return; 
      }

      const { data: appts } = await supabase.from('atendimentos').select('data, status, atendimento_servicos(servicos(duration))').eq('barbearia_id', tenant?.id).eq('colaborador_id', colabId).eq('status', 'Agendado').gte('data', `${date}T00:00:00`).lte('data', `${date}T23:59:59`);

      const requestedDuration = servs.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.duration || 0), 0);
      const possibleTimes: string[] = [];
      const now = new Date();
      const minAllowed = addMinutes(now, tempoMarcar);

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
  }, [allServicos, tempoMarcar]);

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

  const handleSave = async (isScheduling: boolean, force: boolean = false) => {
    if (!tenant?.id) return;
    if (!selectedCliente || !selectedColaborador || selectedServicos.length === 0 || (isScheduling && !selectedTimePart)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const userData = localStorage.getItem("user");
    const user = userData ? JSON.parse(userData) : null;
    const isClient = user?.nivel === 3 || user?.nivel === "3";

    if (!isClient && !force) {
      const colab = colaboradores.find(c => c.id === selectedColaborador);
      const servs = selectedServicos.map(id => allServicos.find(s => s.id === id)?.name).filter(Boolean);
      
      const newDate = parseISO(`${selectedDatePart}T${selectedTimePart}`);
      
      const data: any = {
        isUpdate: !!editingAtendimento,
        cliente: selectedCliente.nome,
        colaborador: colab?.nome || "",
        data: format(newDate, "dd/MM/yyyy"),
        horario: selectedTimePart,
        servicos: servs.join(", "),
      };

      if (editingAtendimento) {
        const oldDate = parseISO(editingAtendimento.data);
        data.oldData = format(oldDate, "dd/MM/yyyy");
        data.oldHorario = format(oldDate, "HH:mm");
        data.isReschedule = oldDate.getTime() !== newDate.getTime();
      }

      setConfirmationData(data);
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        barbearia_id: tenant.id,
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
        barbearia_id: tenant.id,
        atendimento_id: atendimentoId,
        servico_id: sId,
        valor_servico: allServicos.find(s => s.id === sId)?.price || 0
      })));

      // Trigger Webhook
      const { data: colabData } = await supabase.from('colaboradores').select('login').eq('barbearia_id', tenant.id).eq('id', selectedColaborador).maybeSingle();
      const formattedTel = colabData?.login ? colabData.login.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : (colabData?.login || "");

      if (editingAtendimento) {
        const oldData = parseISO(editingAtendimento.data);
        const newData = parseISO(`${selectedDatePart}T${selectedTimePart || format(new Date(), "HH:mm")}:00-03:00`);
        const isRemarcacao = oldData.getTime() !== newData.getTime();
        
        triggerWebhook(isRemarcacao ? "Remarcacao" : "Agendamento", {
          tipo: isRemarcacao ? "Remarcacao" : "Agendamento",
          cliente: selectedCliente.nome,
          login_cliente: selectedCliente.login,
          colaborador: colaboradores.find(c => c.id === selectedColaborador)?.nome || "",
          tel_colaborador: formattedTel,
          data: format(newData, "dd/MM/yyyy"),
          horario: format(newData, "HH:mm"),
          servicos: selectedServicos.map(sId => allServicos.find(s => s.id === sId)?.name || ""),
          ...(isRemarcacao && {
            data_antiga: format(oldData, "dd/MM/yyyy"),
            horario_antigo: format(oldData, "HH:mm")
          })
        });
      } else {
        triggerWebhook("Agendamento", {
          tipo: "Agendamento",
          cliente: selectedCliente.nome,
          login_cliente: selectedCliente.login,
          colaborador: colaboradores.find(c => c.id === selectedColaborador)?.nome || "",
          tel_colaborador: formattedTel,
          data: format(parseISO(selectedDatePart), "dd/MM/yyyy"),
          horario: selectedTimePart || format(new Date(), "HH:mm"),
          servicos: selectedServicos.map(sId => allServicos.find(s => s.id === sId)?.name || "")
        });
      }

      toast.success("Salvo com sucesso");
      setIsDialogOpen(false);
      setShowConfirmation(false);
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

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const { data: item } = await supabase
        .from('atendimentos')
        .select('*, cliente:usuarios!cliente_id(nome, login), colaborador:colaboradores(nome), atendimento_servicos(servicos(name))')
        .eq('id', deleteId)
        .single();

      // Delete from atendimento_servicos first (due to foreign key constraints)
      const { error: servError } = await supabase
        .from('atendimento_servicos')
        .delete()
        .eq('atendimento_id', deleteId);

      if (servError) throw servError;

      const { error } = await supabase.from('atendimentos').delete().eq('id', deleteId);
      if (error) throw error;

      if (item) {
        triggerWebhook("Exclusao", {
          tipo: "Exclusao",
          cliente: (item.cliente as any)?.nome || "Cliente",
          login_cliente: (item.cliente as any)?.login || "",
          colaborador: (item.colaborador as any)?.nome || "Colaborador",
          data: format(parseISO(item.data), "dd/MM/yyyy"),
          horario: format(parseISO(item.data), "HH:mm"),
          servicos: (item.atendimento_servicos as any[]).map(s => s.servicos?.name)
        });
      }

      toast.success("Atendimento excluído com sucesso");
      setDeleteId(null);
      fetchAgendados();
      fetchConcluidos();
      fetchPedidosExclusao();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const groupAppointmentsByDate = (items: Atendimento[]) => {
    const groups: { [key: string]: Atendimento[] } = {};
    items.forEach(item => {
      const dateKey = format(parseISO(item.data), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  };

  const AtendimentoCard = ({ item }: { item: Atendimento }) => (
    <div className="relative group">
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
        fetchColabServicos(item.colaborador.id);
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
             <BookingButton 
              onSuccess={fetchAgendados} 
              variant="ghost" 
              className="h-8 w-8 p-0"
              label=""
              icon={<Clock className="h-4 w-4" />}
              initialData={{
                id: item.id,
                cliente_id: item.cliente.id,
                cliente_nome: item.cliente.nome,
                colaborador_id: item.colaborador.id,
                data: item.data,
                valor: item.valor,
                servicos_ids: item.servicos.map(s => s.id)
              }}
            />
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
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Atendimentos</h1>
            <p className="text-muted-foreground">Controle os agendamentos e atendimentos realizados</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <BookingButton onSuccess={fetchAgendados} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90" variant="default" />
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Novo atendimento
            </Button>
          </div>
        </div>

        <Tabs defaultValue="agendados" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
            <TabsTrigger value="agendados">Agendados</TabsTrigger>
            <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
            <TabsTrigger value="exclusao">Pedidos exclusão</TabsTrigger>
          </TabsList>
          
          <TabsContent value="agendados" className="space-y-6 mt-6">
            {loadingAgendados ? (
              <p>Carregando...</p>
            ) : (
              <>
                {/* Atrasados (Anteriores a Hoje) */}
                {atencao.filter(item => !isToday(parseISO(item.data))).length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-500">
                      <AlertTriangle className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Atrasados (Dias Anteriores)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {atencao
                        .filter(item => !isToday(parseISO(item.data)))
                        .map(item => (
                          <div key={item.id} className="relative">
                            <div className="absolute -top-2 -right-2 z-10">
                              <Badge variant="destructive" className="animate-pulse">Atrasado</Badge>
                            </div>
                            <AtendimentoCard item={item} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Hoje */}
                {([...atencao, ...agendados].filter(item => isToday(parseISO(item.data))).length > 0) && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold text-primary">Hoje</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[...atencao, ...agendados]
                        .filter(item => isToday(parseISO(item.data)))
                        .sort((a, b) => a.data.localeCompare(b.data))
                        .map(item => (
                          <div key={item.id} className="relative">
                            {new Date(item.data) < new Date() && (
                              <div className="absolute -top-2 -right-2 z-10">
                                <Badge variant="destructive" className="animate-pulse">Atrasado</Badge>
                              </div>
                            )}
                            <AtendimentoCard item={item} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Futuros Agrupados por Data */}
                {(() => {
                  const futuros = agendados.filter(item => !isToday(parseISO(item.data)));
                  const grouped = groupAppointmentsByDate(futuros);
                  const sortedDates = Object.keys(grouped).sort();
                  
                  return sortedDates.map(dateKey => (
                    <div key={dateKey} className="space-y-4">
                      <h2 className="text-lg font-semibold text-muted-foreground capitalize">
                        {format(parseISO(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {grouped[dateKey].map(item => (
                          <AtendimentoCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  ));
                })()}

                {atencao.length === 0 && agendados.length === 0 && (
                  <p className="text-muted-foreground text-center py-10">Nenhum agendamento encontrado.</p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="concluidos" className="space-y-8 mt-6">
            {loadingConcluidos ? (
              <p>Carregando...</p>
            ) : (
              <>
                {(() => {
                  const grouped = groupAppointmentsByDate(concluidos);
                  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
                  
                  return sortedDates.map(dateKey => (
                    <div key={dateKey} className="space-y-4">
                      <h2 className="text-lg font-semibold text-muted-foreground capitalize border-b pb-2">
                        {isToday(parseISO(dateKey)) ? "Hoje" : format(parseISO(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {grouped[dateKey].map(item => (
                          <AtendimentoCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  ));
                })()}
                
                {concluidos.length === 0 && (
                  <p className="text-muted-foreground text-center py-10">Nenhum atendimento concluído encontrado.</p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="exclusao" className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 p-4 rounded-lg border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p>Estes atendimentos foram marcados por colaboradores para exclusão. Apenas administradores podem confirmar a remoção definitiva.</p>
            </div>

            {loadingExclusao ? (
              <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : pedidosExclusao.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">Nenhum pedido de exclusão pendente.</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {pedidosExclusao.map((item) => (
                  <Card key={item.id} className="overflow-hidden border-destructive/20 bg-destructive/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-12 text-center">
                            <span className="text-sm font-bold block">{format(parseISO(item.data), "dd/MM")}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{format(parseISO(item.data), "HH:mm")}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{item.cliente?.nome}</p>
                            <p className="text-xs text-muted-foreground">Colaborador: {item.colaborador?.nome}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.servicos.map(s => s.name).join(", ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs gap-1"
                            onClick={async () => {
                              if (!confirm("Deseja negar o pedido de exclusão e manter este atendimento?")) return;
                              const { error } = await supabase.from('atendimentos').update({ pedido_exclusao: false }).eq('id', item.id);
                              if (error) toast.error("Erro ao negar pedido");
                              else { toast.success("Pedido de exclusão negado"); fetchPedidosExclusao(); }
                            }}
                          >
                            <XCircle className="w-3 h-3" />
                            Negar
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-8 text-xs gap-1"
                            onClick={() => {
                              if (confirm("Deseja aprovar a exclusão? O atendimento será removido permanentemente.")) {
                                setDeleteId(item.id);
                                handleDelete();
                              }
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Aprovar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog Novo/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>{editingAtendimento ? "Editar Atendimento" : "Novo Atendimento"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
               <div className="space-y-2">
                <Label>Cliente</Label>
                <Input placeholder="Buscar cliente..." value={searchCliente} onChange={(e) => searchClientes(e.target.value)} />
                {clientes.map(c => <div key={c.id} onClick={() => { setSelectedCliente(c); setSearchCliente(c.nome); setClientes([]); }} className="p-2 hover:bg-accent cursor-pointer border rounded-md mt-1">{c.nome}</div>)}
              </div>
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <div className="rounded-md border p-2 bg-muted/5">
                  <div className="space-y-2">
                    {colaboradores.map(c => (
                      <div 
                        key={c.id}
                        onClick={() => { 
                          setSelectedColaborador(c.id);
                          setSelectedServicos([]);
                          setSelectedDatePart("");
                          setSelectedTimePart("");
                          fetchColabServicos(c.id);
                          if (selectedServicos.length > 0) calculateComissao([], c.id);
                        }}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedColaborador === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                          !c.ativo && "opacity-50"
                        )}
                      >
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={c.foto_url || ""} />
                          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-none mb-1">
                            {c.nome} {!c.ativo && "(Inativo)"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {c.servicos?.join(", ") || "Sem serviços"}
                          </p>
                        </div>
                        {selectedColaborador === c.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

               {selectedColaborador && (
                 <>
                  <div className="space-y-2">
                    <Label>Serviços</Label>
                    <div className="rounded-md border p-2 bg-muted/5">
                      <div className="space-y-2">
                        {allServicos.filter(s => colabServicosIds.includes(s.id)).map(s => (
                          <div 
                            key={s.id} 
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors",
                              selectedServicos.includes(s.id) ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-accent"
                            )}
                            onClick={() => handleSelectServico(s.id)}
                          >
                            <Checkbox checked={selectedServicos.includes(s.id)} onCheckedChange={() => handleSelectServico(s.id)} onClick={(e) => e.stopPropagation()} />
                            {s.image_url ? (
                              <img src={s.image_url} alt={s.name} className="w-8 h-8 rounded object-cover border" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border">
                                <Scissors className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-none">{s.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">R${s.price}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedServicos.length > 0 && (
                    <div className="space-y-2">
                      <Label>Data do Atendimento</Label>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        {colabActiveDates
                          .filter(dateStr => {
                            const date = parseISO(dateStr);
                            const today = startOfToday();
                            return date >= today && (!maxDate || dateStr <= maxDate);
                          })
                          .sort()
                          .map((dateStr) => {
                            const date = parseISO(dateStr);
                            const isSelected = selectedDatePart === dateStr;
                            return (
                              <button
                                key={dateStr}
                                type="button"
                                onClick={() => setSelectedDatePart(dateStr)}
                                className={cn(
                                  "flex flex-col items-center justify-center min-w-[65px] h-[85px] rounded-xl border-2 transition-all",
                                  isSelected 
                                    ? "border-primary bg-primary text-primary-foreground shadow-lg scale-105" 
                                    : "border-muted bg-card hover:border-primary/50 text-muted-foreground"
                                )}
                              >
                                <span className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider",
                                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground/60"
                                )}>
                                  {format(date, "EEE", { locale: ptBR })}
                                </span>
                                <span className="text-xl font-black mt-1">
                                  {format(date, "dd")}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-medium capitalize",
                                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground/60"
                                )}>
                                  {format(date, "MMM", { locale: ptBR })}
                                </span>
                              </button>
                            );
                          })}
                        {colabActiveDates.length === 0 && (
                          <p className="text-xs text-muted-foreground italic p-2">
                            Nenhuma data disponível para este colaborador.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedDatePart && selectedServicos.length > 0 && (
                    <div className="space-y-2">
                      <Label>Horário do Atendimento</Label>
                      {loadingTimes ? <p className="text-sm animate-pulse">Consultando horários...</p> : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-auto border p-2 rounded-md">
                          {availableTimes.length > 0 ? availableTimes.map(t => (
                            <Button 
                              key={t} 
                              variant={selectedTimePart === t ? "default" : "outline"} 
                              size="sm" 
                              className="h-8 text-[10px] sm:text-xs px-1"
                              onClick={() => setSelectedTimePart(t)}
                            >
                              {t}
                            </Button>
                          )) : <p className="text-xs text-destructive col-span-full">Sem horários disponíveis.</p>}
                        </div>
                      )}
                    </div>
                  )}
                 </>
               )}
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
            <DialogFooter className="p-6 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => handleSave(true)} disabled={isSubmitting}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Confirmar Agendamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Dados do Agendamento:</p>
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  <p><strong>Colaborador:</strong> {confirmationData?.colaborador}</p>
                  <p><strong>Serviços:</strong> {confirmationData?.servicos}</p>
                  <p><strong>Data:</strong> {confirmationData?.data}</p>
                  <p><strong>Horário:</strong> {confirmationData?.horario}</p>
                </div>
              </div>

              {confirmationData?.isReschedule && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-600">Dados do Agendamento Anterior:</p>
                  <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                    <p><strong>Data Anterior:</strong> {confirmationData?.oldData}</p>
                    <p><strong>Horário Anterior:</strong> {confirmationData?.oldHorario}</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700 border border-blue-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Ao clicar em confirmar, você receberá uma mensagem no WhatsApp com a confirmação do agendamento.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmation(false)}>Voltar</Button>
              <Button onClick={() => handleSave(true, true)} disabled={isSubmitting}>
                {isSubmitting ? "Confirmando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmar Exclusão
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este atendimento? Esta ação não pode ser desfeita.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}
