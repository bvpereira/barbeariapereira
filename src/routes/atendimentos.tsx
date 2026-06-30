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
import { applyClubeToAppointment } from "@/lib/clube.functions";
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
import { useServerFn } from "@tanstack/react-start";
import { invalidateAppointmentCoupon } from "@/lib/coupons.functions";

export const Route = createFileRoute("/atendimentos")({
  component: AtendimentosPage,
});

interface Atendimento {
  id: string;
  data: string;
  valor: number;
  valor_original?: number | null;
  valor_desconto?: number | null;
  cashback_usado?: number | null;
  clube_desconto_aplicado?: number | null;
  clube_id?: string | null;
  comissao: number;
  status: 'Agendado' | 'Finalizado' | 'Não compareceu';
  manual?: boolean;
  cliente: { id: string; nome: string; login: string };
  colaborador: { id: string; nome: string };
  servicos: { id: string; name: string; price: number; duration: number }[];
  servicos_atendimento?: string | null;
  cupom_codigo?: string | null;
  cupom_nome?: string | null;
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
  cashback_ativo?: boolean | null;
  cashback_percentual?: number | null;
}

function AtendimentosPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [agendados, setAgendados] = useState<Atendimento[]>([]);
  const [atencao, setAtencao] = useState<Atendimento[]>([]);
  const [concluidos, setConcluidos] = useState<Atendimento[]>([]);
  const [loadingAgendados, setLoadingAgendados] = useState(true);
  const [loadingConcluidos, setLoadingConcluidos] = useState(true);
  const PAGE_SIZE = 30;
  const [pageAgendados, setPageAgendados] = useState(0);
  const [pageConcluidos, setPageConcluidos] = useState(0);
  const [totalAgendados, setTotalAgendados] = useState(0);
  const [totalConcluidos, setTotalConcluidos] = useState(0);
  const [pedidosExclusao, setPedidosExclusao] = useState<Atendimento[]>([]);
  const [loadingExclusao, setLoadingExclusao] = useState(false);
  const [filtroConcluidos, setFiltroConcluidos] = useState<'Todos' | 'Finalizado' | 'Não compareceu'>('Todos');
  const invalidateCouponFn = useServerFn(invalidateAppointmentCoupon);
  const applyClubeFn = useServerFn(applyClubeToAppointment);

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
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  // Override por serviço selecionado: { servicoId: { ativo, percentual } }
  const [cashbackOverrides, setCashbackOverrides] = useState<Record<string, { ativo: boolean; percentual: number }>>({});
  // Produtos de revenda
  const [produtosRevendaCatalog, setProdutosRevendaCatalog] = useState<{ id: string; nome: string; preco_revenda: number; quantidade_atual: number; unidade_medida: string }[]>([]);
  const [produtosVenda, setProdutosVenda] = useState<{ id?: string; estoque_id: string; nome_produto: string; quantidade: number; valor_unitario: number }[]>([]);
  const [userNivel, setUserNivel] = useState<number | null>(null);

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
      .eq('barbearia_id', tenant.id)
      .eq('status', 'Agendado')
      .order('data', { ascending: true })
      .range(pageAgendados * PAGE_SIZE, pageAgendados * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) { toast.error("Erro ao carregar agendados"); return; }

    const formatted = (data as any[]).map(item => ({
      ...item,
      servicos: (item.atendimento_servicos || []).map((as: any) => as.servicos).filter(Boolean)
    }));

    const now = new Date();
    setAtencao(formatted.filter(item => new Date(item.data) < now));
    setAgendados(formatted.filter(item => new Date(item.data) >= now));
    setTotalAgendados(count || 0);
    setLoadingAgendados(false);
  }, [pageAgendados, tenant]);

  const fetchConcluidos = useCallback(async () => {
    if (!tenant?.id) return;
    setLoadingConcluidos(true);
    let query = supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(id, nome, login),
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servico_id, servicos(id, name, price, duration))
      `, { count: 'exact' })
      .eq('barbearia_id', tenant.id)
      .in('status', ['Finalizado', 'Não compareceu']);

    if (filtroConcluidos !== 'Todos') query = query.eq('status', filtroConcluidos);

    const { data, error, count } = await query
      .order('data', { ascending: false })
      .range(pageConcluidos * PAGE_SIZE, pageConcluidos * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) { toast.error("Erro ao carregar concluídos"); return; }

    setConcluidos((data as any[]).map(item => ({ ...item, servicos: (item.atendimento_servicos || []).map((as: any) => as.servicos).filter(Boolean) })));
    setTotalConcluidos(count || 0);
    setLoadingConcluidos(false);
  }, [pageConcluidos, filtroConcluidos, tenant]);

  const fetchPedidosExclusao = useCallback(async () => {
    if (!tenant?.id) return;
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

    setPedidosExclusao((data as any[]).map(item => ({ ...item, servicos: (item.atendimento_servicos || []).map((as: any) => as.servicos).filter(Boolean) })));
    setLoadingExclusao(false);
  }, [tenant]);

  const fetchFormData = useCallback(async () => {
    if (!tenant?.id) return;
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome, ativo, foto_url').eq('barbearia_id', tenant.id).order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration, image_url, cashback_ativo, cashback_percentual').eq('barbearia_id', tenant.id).order('name');
    const { data: rels } = await supabase.from('colaborador_servicos').select('colaborador_id, servico_id').eq('barbearia_id', tenant.id);
    
    const formattedColabs = colabs?.map(c => ({
      ...c,
      servicos: rels?.filter(r => r.colaborador_id === c.id).map(r => {
        const s = servs?.find(srv => srv.id === r.servico_id);
        return s?.name || "";
      }).filter(Boolean)
    })) || [];

    setColaboradores(formattedColabs as Colaborador[]);
    setAllServicos(servs || []);

    const { data: prods } = await supabase.from('estoque' as any)
      .select('id, nome, preco_revenda, quantidade_atual, unidade_medida')
      .eq('barbearia_id', tenant.id).eq('tipo', 'revenda').is('deleted_at', null).order('nome');
    setProdutosRevendaCatalog((prods as any) || []);
  }, [tenant]);

  const fetchBookingSettings = useCallback(async () => {
    if (!tenant?.id) return;
    const { data: agendaData } = await supabase.from('dias_agenda').select('data').eq('barbearia_id', tenant.id).eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (agendaData && agendaData.length > 0) setMaxDate(agendaData[0].data);

    const { data: infoData } = await supabase.from('informacoes').select('tempo_marcar, cashback').eq('barbearia_id', tenant.id).maybeSingle();
    if (infoData) {
      setTempoMarcar(infoData.tempo_marcar ?? 60);
      setCashbackEnabled(!!(infoData as any).cashback);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenantLoading) return;
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUserNivel(Number(parsedUser.nivel));
      if (tenant?.id && parsedUser.barbearia_id !== tenant.id) {
        toast.error("Acesso negado.");
        window.location.href = "/";
        return;
      }
    }
    fetchAgendados();
  }, [fetchAgendados, tenant]);

  useEffect(() => {
    if (!tenantLoading && tenant) {
      fetchConcluidos();
    }
  }, [fetchConcluidos, tenant, tenantLoading]);

  useEffect(() => {
    if (!tenantLoading && tenant) {
      fetchFormData();
      fetchBookingSettings();
      fetchPedidosExclusao();
    }
  }, [tenant, tenantLoading, fetchFormData, fetchBookingSettings, fetchPedidosExclusao]);

  const searchClientes = async (term: string) => {
    if (!tenant?.id) return;
    setSearchCliente(term);
    if (term.length < 2) { setClientes([]); return; }
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, login, barbearia_id')
      .eq('barbearia_id', tenant.id)
      .eq('nivel', 3)
      .or(`nome.ilike.%${term}%,login.ilike.%${term}%`)
      .limit(10);
    
    // Filtro adicional no front-end para garantir segurança absoluta
    const filteredData = (data || []).filter(c => c.barbearia_id === tenant.id);
    setClientes(filteredData);
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

      // Inicializar override de cashback ao selecionar
      setCashbackOverrides(prevOv => {
        const next = { ...prevOv };
        if (isRemoving) {
          delete next[servicoId];
        } else {
          const s = allServicos.find(sv => sv.id === servicoId);
          if (s) next[servicoId] = { ativo: !!s.cashback_ativo, percentual: Number(s.cashback_percentual) || 0 };
        }
        return next;
      });
      
      return newSelection;
    });
  };

  const calculateComissao = async (servicosIds: string[], colabId: string) => {
    if (!tenant?.id) return;
    const { data: rules } = await supabase
      .from("colaborador_servicos")
      .select("servico_id, valor_comissao, tipo_comissao")
      .eq("barbearia_id", tenant.id)
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
    if (!tenant?.id) return [];
    const { data } = await supabase.from('colaborador_servicos').select('servico_id').eq('barbearia_id', tenant.id).eq('colaborador_id', colabId);
    const ids = data?.map(d => d.servico_id).filter((id): id is string => !!id) || [];
    setColabServicosIds(ids);
    
    // Fetch active dates
    const { data: activeDates } = await supabase.from('horarios_colaboradores').select('data').eq('barbearia_id', tenant.id).eq('colaborador_id', colabId).eq('ativo', true);
    const dates = activeDates?.map(d => d.data) || [];
    setColabActiveDates(dates);
    
    if (selectedDatePart && !dates.includes(selectedDatePart)) {
      setSelectedDatePart("");
    }

    return ids;
  };

  const fetchAvailableTimes = useCallback(async (date: string, colabId: string, servs: string[], manualMode: boolean = false) => {
    if (!tenant?.id || !date || !colabId || servs.length === 0) {
      setAvailableTimes([]);
      return;
    }
    setLoadingTimes(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const isPastOrToday = date <= today;
      // In manual mode (creating finalized atendimento) for past/today, use global defaults if there's no entry
      const { data: workingHours } = await supabase.from('horarios_colaboradores').select('*').eq('barbearia_id', tenant.id).eq('colaborador_id', colabId).eq('data', date).eq('ativo', true).maybeSingle();

      let hours = workingHours as any;
      if (!hours && manualMode && isPastOrToday) {
        hours = { manha_inicio: "08:00", manha_fim: "12:00", tarde_inicio: "13:00", tarde_fim: "18:00" };
      }
      if (!hours) {
        setAvailableTimes([]);
        setLoadingTimes(false);
        return;
      }

      const skipChecks = manualMode && isPastOrToday;
      const appts = skipChecks ? [] : (await supabase.from('atendimentos').select('data, status, atendimento_servicos(servicos(duration))').eq('barbearia_id', tenant.id).eq('colaborador_id', colabId).eq('status', 'Agendado').gte('data', `${date}T00:00:00`).lte('data', `${date}T23:59:59`)).data;

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
          let include: boolean;
          if (skipChecks) {
            // For past dates: include all. For today: only times already passed.
            include = date < today ? true : curr <= now;
          } else {
            include = curr.getTime() >= minAllowed.getTime() && !checkOverlap(curr, requestedDuration);
          }
          if (include) possibleTimes.push(format(curr, "HH:mm"));
          curr = addMinutes(curr, 30);
        }
      };

      if (hours.manha_inicio && hours.manha_fim) generateSlots(hours.manha_inicio, hours.manha_fim);
      if (hours.tarde_inicio && hours.tarde_fim) generateSlots(hours.tarde_inicio, hours.tarde_fim);
      setAvailableTimes(possibleTimes);
    } catch (e) { console.error(e); }
    setLoadingTimes(false);
  }, [allServicos, tempoMarcar, tenant]);

  useEffect(() => {
    fetchAvailableTimes(selectedDatePart, selectedColaborador, selectedServicos, !editingAtendimento);
  }, [selectedDatePart, selectedColaborador, selectedServicos, fetchAvailableTimes, editingAtendimento]);

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
    setProdutosVenda([]);
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

    if (!force) {
      const colab = colaboradores.find(c => c.id === selectedColaborador);
      const servs = selectedServicos.map(id => allServicos.find(s => s.id === id)?.name).filter(Boolean);
      
      const newDate = parseISO(`${selectedDatePart}T${selectedTimePart}`);
      const baseTotal = selectedServicos.reduce((acc, sId) => acc + (allServicos.find(s => s.id === sId)?.price || 0), 0);
      
      const data: any = {
        isUpdate: !!editingAtendimento,
        cliente: selectedCliente.nome,
        colaborador: colab?.nome || "",
        data: format(newDate, "dd/MM/yyyy"),
        horario: selectedTimePart,
        servicos: servs.join(", "),
        valorOriginal: baseTotal,
        valorAPagar: baseTotal,
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
      const isManualNew = !editingAtendimento;
      const selectedServiceRows = selectedServicos.map((serviceId) => {
        const service = allServicos.find((item) => item.id === serviceId);
        const price = Number(service?.price) || 0;
        const ov = cashbackOverrides[serviceId];
        return {
          barbearia_id: tenant.id,
          servico_id: serviceId,
          valor_servico: price,
          valor_original: price,
          valor_desconto: 0,
          name_servico: service?.name ?? null,
          cashback_ativo_override: cashbackEnabled && ov ? ov.ativo : null,
          cashback_percentual_override: cashbackEnabled && ov && ov.ativo ? ov.percentual : null,
        };
      });
      const originalTotal = selectedServiceRows.reduce((sum, service) => sum + service.valor_original, 0);
      const payload: any = {
        barbearia_id: tenant.id,
        cliente_id: selectedCliente.id,
        colaborador_id: selectedColaborador,
        data: `${selectedDatePart}T${selectedTimePart || format(new Date(), "HH:mm")}:00`,
        valor: originalTotal,
        valor_original: originalTotal,
        valor_desconto: 0,
        clube_desconto_aplicado: 0,
        clube_id: null,
        comissao: parseFloat(comissaoFinal),
        status: isManualNew ? 'Finalizado' : (isScheduling ? 'Agendado' : status),
        ...(isManualNew ? { manual: true } : {})
      };
      
      let atendimentoId: string;
      if (editingAtendimento) {
        const { error: updateError } = await supabase.from('atendimentos').update(payload).eq('id', editingAtendimento.id);
        if (updateError) throw updateError;
        const { error: deleteServicesError } = await supabase.from('atendimento_servicos').delete().eq('atendimento_id', editingAtendimento.id);
        if (deleteServicesError) throw new Error("Serviços anteriores: " + deleteServicesError.message);
        atendimentoId = editingAtendimento.id;
      } else {
        const { data, error } = await supabase.from('atendimentos').insert([payload]).select().single();
        if (error) throw error;
        atendimentoId = data.id;
      }

      const { error: servErr } = await supabase.from('atendimento_servicos').insert(
        selectedServiceRows.map((service) => ({ ...service, atendimento_id: atendimentoId }))
      );
      if (servErr) throw new Error("Serviços: " + servErr.message);

      // Persistir produtos vendidos (apenas em edição)
      if (editingAtendimento) {
        await supabase.from('atendimento_produtos' as any).delete().eq('atendimento_id', atendimentoId);
        const linhasProd = produtosVenda.filter(p => p.estoque_id && p.quantidade > 0).map(p => ({
          atendimento_id: atendimentoId, barbearia_id: tenant.id,
          estoque_id: p.estoque_id, nome_produto: p.nome_produto,
          quantidade: p.quantidade, valor_unitario: p.valor_unitario,
        }));
        if (linhasProd.length > 0) {
          const { error: prodErr } = await supabase.from('atendimento_produtos' as any).insert(linhasProd);
          if (prodErr) throw new Error("Produtos: " + prodErr.message);
        }
        // Recalcular valor total = serviços + produtos
        const totalProdutos = linhasProd.reduce((s, p) => s + (p.quantidade * p.valor_unitario), 0);
        const novoTotal = originalTotal + totalProdutos;
        await supabase.from('atendimentos').update({ valor: novoTotal, valor_original: novoTotal }).eq('id', atendimentoId);
      }



      // Aplicar desconto do clube de assinatura (se o cliente tiver clube ativo)
      try {
        await applyClubeFn({ data: {
          atendimento_id: atendimentoId,
          barbearia_id: tenant.id,
          cliente_id: selectedCliente.id,
        } });
      } catch (err) { console.warn("Clube nao aplicado:", err); }

      // Trigger Webhook
      const { data: colabData } = await supabase.from('colaboradores').select('login').eq('barbearia_id', tenant.id).eq('id', selectedColaborador).maybeSingle();
      const formattedTel = colabData?.login ? colabData.login.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : (colabData?.login || "");

      if (editingAtendimento) {
        const oldData = parseISO(editingAtendimento.data);
        const newData = parseISO(`${selectedDatePart}T${selectedTimePart || format(new Date(), "HH:mm")}:00-03:00`);
        const isRemarcacao = oldData.getTime() !== newData.getTime();
        
        triggerWebhook(isRemarcacao ? "Remarcacao" : "Agendamento", {
          tipo: isRemarcacao ? "Remarcacao" : "Agendamento",
          barbearia_id: tenant.id,
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
        // Only trigger webhook for new manual atendimentos when the date is today
        if (isToday(parseISO(selectedDatePart))) {
          triggerWebhook("Agendamento", {
            tipo: "Agendamento",
            barbearia_id: tenant.id,
            cliente: selectedCliente.nome,
            login_cliente: selectedCliente.login,
            colaborador: colaboradores.find(c => c.id === selectedColaborador)?.nome || "",
            tel_colaborador: formattedTel,
            data: format(parseISO(selectedDatePart), "dd/MM/yyyy"),
            horario: selectedTimePart || format(new Date(), "HH:mm"),
            servicos: selectedServicos.map(sId => allServicos.find(s => s.id === sId)?.name || "")
          });
        }
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
    if (!tenant?.id) return;
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
            .eq("barbearia_id", tenant.id)
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
      
      const { error } = await supabase.from('atendimentos').update(payload).eq('barbearia_id', tenant.id).eq('id', id);
      if (error) throw error;

      if (newStatus === 'Não compareceu') {
        const stored = JSON.parse(localStorage.getItem("user") || "null");
        if (stored?.id && stored?.senha) {
          await invalidateCouponFn({ data: { atendimento_id: id, barbearia_id: tenant.id,
            admin_id: stored.id, admin_password: stored.senha, reason: "Atendimento marcado como não compareceu." } });
        }
      }

      // Trigger Finalização/Não compareceu Webhook
      if (newStatus === 'Finalizado' || newStatus === 'Não compareceu') {
        try {
          const { data: integracao } = await supabase
            .from("integracoes")
            .select("webhook_url")
            .eq("tipo", "finalizacao")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (integracao?.webhook_url) {
            const item = concluidos.find(a => a.id === id) || agendados.find(a => a.id === id) || atencao.find(a => a.id === id);
            if (item) {
              const webhookPayload = {
                tipo: newStatus,
                cliente: item.cliente.nome,
                login_cliente: item.cliente.login,
                colaborador: item.colaborador.nome,
                data: format(parseISO(item.data), "dd/MM/yyyy"),
                horario: format(parseISO(item.data), "HH:mm"),
                valor: item.valor,
                comissao: payload.comissao || item.comissao,
                barbearia_id: tenant.id,
                id_barbearia: tenant.id,
                ID_BARBEARIA: tenant.id,
                servicos: item.servicos.map(s => s.name),
              };

              await supabase.functions.invoke('proxy-webhook', {
                body: {
                  url: integracao.webhook_url,
                  method: "POST",
                  body: webhookPayload
                }
              });
            }
          }
        } catch (webhookErr) {
          console.error("Erro ao disparar webhook de finalização:", webhookErr);
        }
      }

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
    if (!deleteId || !tenant?.id) return;
    setIsDeleting(true);
    try {
      const { data: item } = await supabase
        .from('atendimentos')
        .select('*, cliente:usuarios!cliente_id(nome, login), colaborador:colaboradores(nome), atendimento_servicos(servicos(name))')
        .eq('barbearia_id', tenant.id)
        .eq('id', deleteId)
        .single();

      // Delete from atendimento_servicos first (due to foreign key constraints)
      const { error: servError } = await supabase
        .from('atendimento_servicos')
        .delete()
        .eq('barbearia_id', tenant.id)
        .eq('atendimento_id', deleteId);

      if (servError) throw servError;

      const { error } = await supabase.from('atendimentos').delete().eq('barbearia_id', tenant.id).eq('id', deleteId);
      if (error) throw error;

      if (item) {
        triggerWebhook("Exclusao", {
          tipo: "Exclusao",
          barbearia_id: tenant.id,
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
        const serviceIds = item.servicos.length > 0
          ? item.servicos.map(s => s.id)
          : allServicos.filter(service => (item.servicos_atendimento || "").split(",").map(name => name.trim()).includes(service.name)).map(service => service.id);
        setEditingAtendimento(item);
        setSelectedCliente(item.cliente);
        setSearchCliente(item.cliente.nome);
        setSelectedColaborador(item.colaborador.id);
        setSelectedDatePart(format(parseISO(item.data), "yyyy-MM-dd"));
        setSelectedTimePart(format(parseISO(item.data), "HH:mm"));
        setSelectedServicos(serviceIds);
        setValorFinal(item.valor.toString());
        setComissaoFinal(item.comissao?.toString() || "0");
        setStatus(item.status);
        fetchColabServicos(item.colaborador.id);
        // Carregar produtos vendidos do atendimento
        supabase.from('atendimento_produtos' as any)
          .select('id, estoque_id, nome_produto, quantidade, valor_unitario')
          .eq('atendimento_id', item.id)
          .then(({ data }) => setProdutosVenda(((data as any) || []).map((p: any) => ({
            id: p.id, estoque_id: p.estoque_id || "", nome_produto: p.nome_produto,
            quantidade: Number(p.quantidade), valor_unitario: Number(p.valor_unitario),
          }))));
        setIsDialogOpen(true);
      }}>

      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="font-bold">{item.cliente.nome}</span></div>
          <div className="flex items-center gap-2">
            {item.manual && <Badge variant="outline" className="border-blue-500 text-blue-600">Manual</Badge>}
            {getStatusBadge(item.status)}
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarIcon className="w-3 h-3" /><span>{format(parseISO(item.data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span></div>
          <div className="flex items-center gap-2"><User className="w-3 h-3" /><span>Colaborador: {item.colaborador.nome}</span></div>
          <div className="flex items-center gap-2"><Scissors className="w-3 h-3" /><span>{item.servicos.length > 0 ? item.servicos.map(s => s.name).join(", ") : (item.servicos_atendimento || "Serviços não informados")}</span></div>
        </div>
        <div className="mt-3 pt-3 border-t flex justify-between items-start gap-2">
          {(() => {
            const valorFinal = Number(item.valor) || 0;
            const cashback = Number(item.cashback_usado) || 0;
            const clube = Number(item.clube_desconto_aplicado) || 0;
            const descontoTotal = Number(item.valor_desconto) || 0;
            const cupom = Math.max(0, descontoTotal - cashback - clube);
            const somaServicos = (item.servicos || []).reduce((s, sv) => s + (Number(sv?.price) || 0), 0);
            const valorOriginalDb = Number(item.valor_original) || 0;
            // Real original: prefer DB value, fall back to sum of services' prices, then to valor + descontos
            const original = valorOriginalDb > 0
              ? valorOriginalDb
              : (somaServicos > 0 ? somaServicos : valorFinal + descontoTotal);
            const temDesconto = original > valorFinal + 0.001 || descontoTotal > 0;
            return (
              <div className="flex flex-col">
                {temDesconto && (
                  <span className="text-xs text-muted-foreground line-through">
                    R$ {original.toFixed(2).replace(".", ",")}
                  </span>
                )}
                <span className="font-bold text-primary">
                  R$ {valorFinal.toFixed(2).replace(".", ",")}
                </span>
                {temDesconto && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5 mt-1">
                    {cashback > 0 && <div>Cashback: -R$ {cashback.toFixed(2).replace(".", ",")}</div>}
                    {clube > 0 && <div>Plano assinatura: -R$ {clube.toFixed(2).replace(".", ",")}</div>}
                    {cupom > 0 && (
                      <div>
                        Cupom{item.cupom_nome ? ` (${item.cupom_nome})` : item.cupom_codigo ? ` (${item.cupom_codigo})` : ""}: -R$ {cupom.toFixed(2).replace(".", ",")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
                 cupom_codigo: item.cupom_codigo,
                 cashback_usado: item.cashback_usado,
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

                  {cashbackEnabled && selectedServicos.some(id => allServicos.find(s => s.id === id)?.cashback_ativo) && (
                    <div className="space-y-2 rounded-lg border p-3 bg-primary/5">
                      <Label className="text-sm font-medium">Cashback por serviço</Label>
                      <div className="space-y-2">
                        {selectedServicos.map(sId => {
                          const serv = allServicos.find(s => s.id === sId);
                          if (!serv || !serv.cashback_ativo) return null;
                          const ov = cashbackOverrides[sId] ?? { ativo: !!serv.cashback_ativo, percentual: Number(serv.cashback_percentual) || 0 };
                          return (
                            <div key={sId} className="flex items-center gap-2 flex-wrap">
                              <Checkbox
                                id={`cb-${sId}`}
                                checked={ov.ativo}
                                onCheckedChange={(c) => setCashbackOverrides(p => ({ ...p, [sId]: { ...(p[sId] ?? ov), ativo: !!c } }))}
                              />
                              <Label htmlFor={`cb-${sId}`} className="text-sm flex-1 min-w-0 truncate">{serv.name}</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="w-24 h-8"
                                disabled={!ov.ativo}
                                value={ov.percentual}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.min(100, parseFloat(e.target.value || "0")));
                                  setCashbackOverrides(p => ({ ...p, [sId]: { ...(p[sId] ?? ov), percentual: v } }));
                                }}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}


                  {selectedServicos.length > 0 && (
                    <div className="space-y-2">
                      <Label>Data do Atendimento</Label>
                      {!editingAtendimento ? (
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDatePart && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDatePart ? format(parseISO(selectedDatePart), "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDatePart ? parseISO(selectedDatePart) : undefined}
                              onSelect={(d) => {
                                if (d) {
                                  setSelectedDatePart(format(d, "yyyy-MM-dd"));
                                  setSelectedTimePart("");
                                  setIsCalendarOpen(false);
                                }
                              }}
                              disabled={(d) => d > new Date()}
                              initialFocus
                              locale={ptBR}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
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
                                  <span className={cn("text-[10px] uppercase font-bold tracking-wider", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/60")}>
                                    {format(date, "EEE", { locale: ptBR })}
                                  </span>
                                  <span className="text-xl font-black mt-1">{format(date, "dd")}</span>
                                  <span className={cn("text-[10px] font-medium capitalize", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/60")}>
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
                      )}
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

              {editingAtendimento && (userNivel === 1 || userNivel === 2) && (
                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Produtos vendidos (revenda)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setProdutosVenda(p => [...p, { estoque_id: "", nome_produto: "", quantidade: 1, valor_unitario: 0 }])}>
                      + Adicionar
                    </Button>
                  </div>
                  {produtosVenda.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum produto adicionado.</p>
                  ) : (
                    <div className="space-y-2">
                      {produtosVenda.map((pv, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-end">
                          <div className="col-span-5">
                            <Select value={pv.estoque_id} onValueChange={(v) => {
                              const prod = produtosRevendaCatalog.find(x => x.id === v);
                              setProdutosVenda(arr => arr.map((p, i) => i === idx ? {
                                ...p, estoque_id: v,
                                nome_produto: prod?.nome || p.nome_produto,
                                valor_unitario: prod?.preco_revenda ?? p.valor_unitario,
                              } : p));
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                              <SelectContent>
                                {produtosRevendaCatalog.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome} ({Number(p.quantidade_atual)} {p.unidade_medida})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Input type="number" step="0.001" className="h-8 text-xs" value={pv.quantidade}
                              onChange={(e) => setProdutosVenda(arr => arr.map((p, i) => i === idx ? { ...p, quantidade: parseFloat(e.target.value) || 0 } : p))} />
                          </div>
                          <div className="col-span-4">
                            <Input type="number" step="0.01" className="h-8 text-xs" value={pv.valor_unitario}
                              onChange={(e) => setProdutosVenda(arr => arr.map((p, i) => i === idx ? { ...p, valor_unitario: parseFloat(e.target.value) || 0 } : p))} />
                          </div>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 col-span-1"
                            onClick={() => setProdutosVenda(arr => arr.filter((_, i) => i !== idx))}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground text-right">
                        Total produtos: R$ {produtosVenda.reduce((s, p) => s + (p.quantidade * p.valor_unitario), 0).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
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
                  {confirmationData?.valorOriginal !== undefined && (
                    <p><strong>Valor total:</strong> R$ {Number(confirmationData.valorOriginal).toFixed(2).replace(".", ",")}</p>
                  )}
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
