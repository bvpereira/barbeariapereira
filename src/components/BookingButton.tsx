import { useState, useRef, useEffect, useCallback } from "react";
import { triggerWebhook } from "@/lib/webhook";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  User, 
  Scissors, 
  CheckCircle2,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, isAfter, addMinutes, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { applyCoupon, previewCoupon, removeCoupon } from "@/lib/coupons.functions";
import { applyClubeToAppointment, getClienteClubeStatus } from "@/lib/clube.functions";

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

interface BookingButtonProps {
  fixedClientId?: string;
  fixedColaboradorId?: string;
  initialData?: any;
  onSuccess?: () => void;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  className?: string;
  label?: string;
  icon?: React.ReactNode;
}

export function BookingButton({ 
  fixedClientId, 
  fixedColaboradorId, 
  initialData,
  onSuccess,
  variant = "outline",
  className,
  label = "Agendar Atendimento",
  icon
}: BookingButtonProps) {
  const { tenant, loading: tenantLoading } = useTenant();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const userData = localStorage.getItem("user");
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    }
  }, [isOpen]);
  
  // Data states
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [allServicos, setAllServicos] = useState<Servico[]>([]);
  const [colabServicosIds, setColabServicosIds] = useState<string[]>([]);
  const [colabActiveDates, setColabActiveDates] = useState<string[]>([]);
  
  // Form states
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState(fixedColaboradorId || "");
  const [selectedDatePart, setSelectedDatePart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTimePart, setSelectedTimePart] = useState("");
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [valorFinal, setValorFinal] = useState("0");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [maxDate, setMaxDate] = useState<string>("");
  const [tempoMarcar, setTempoMarcar] = useState<number>(60);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempoExcluir, setTempoExcluir] = useState<number>(60);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<any>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const applyCouponFn = useServerFn(applyCoupon);
  const previewCouponFn = useServerFn(previewCoupon);
  const removeCouponFn = useServerFn(removeCoupon);
  const applyClubeFn = useServerFn(applyClubeToAppointment);
  const getClubeStatusFn = useServerFn(getClienteClubeStatus);
  const [clubePreview, setClubePreview] = useState<{ desconto: number; valor_final: number; valor_original: number; itens: Array<{ nome: string; desconto: number }> } | null>(null);

  // Cashback
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackSaldo, setCashbackSaldo] = useState(0);
  const [cashbackServicos, setCashbackServicos] = useState<Record<string, number>>({}); // servico_id -> percentual
  const [cashbackClubeCobertos, setCashbackClubeCobertos] = useState<Set<string>>(new Set());
  const [usarCashback, setUsarCashback] = useState(false);
  const [cashbackUsoStr, setCashbackUsoStr] = useState("0");

  const fetchFormData = async () => {
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome, ativo, foto_url').eq('barbearia_id', tenant!.id).order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration, image_url, cashback_ativo, cashback_percentual').eq('barbearia_id', tenant!.id).order('name');
    const { data: rels } = await supabase.from('colaborador_servicos').select('colaborador_id, servico_id').eq('barbearia_id', tenant!.id);
    
    const formattedColabs = colabs?.map(c => ({
      ...c,
      servicos: rels?.filter(r => r.colaborador_id === c.id).map(r => {
        const s = servs?.find(srv => srv.id === r.servico_id);
        return s?.name || "";
      }).filter(Boolean)
    })) || [];

    setColaboradores(formattedColabs as Colaborador[]);
    setAllServicos((servs || []) as any);
    const cbMap: Record<string, number> = {};
    (servs || []).forEach((s: any) => {
      if (s.cashback_ativo && s.cashback_percentual != null) cbMap[s.id] = Number(s.cashback_percentual);
    });
    setCashbackServicos(cbMap);
  };

  const fetchBookingSettings = async () => {
    const { data: agendaData } = await supabase.from('dias_agenda').select('data').eq('barbearia_id', tenant!.id).eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (agendaData && agendaData.length > 0) setMaxDate(agendaData[0].data);

    const { data: infoData } = await supabase.from('informacoes').select('tempo_marcar, tempo_excluir, cashback').eq('barbearia_id', tenant!.id).maybeSingle();
    if (infoData) {
      setTempoMarcar(infoData.tempo_marcar ?? 60);
      setTempoExcluir(infoData.tempo_excluir ?? 60);
      setCashbackEnabled(!!(infoData as any).cashback);
    }
  };

  const fetchFixedClient = async (id: string) => {
    if (!tenant?.id) return;
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, login, barbearia_id')
      .eq('id', id)
      .eq('barbearia_id', tenant.id)
      .single();
    if (data) {
      setSelectedCliente(data);
      setSearchCliente(data.nome);
    }
  };

  useEffect(() => {
    if (isOpen && tenant) {
      fetchFormData();
      fetchBookingSettings();
      // Sempre pergunta novamente sobre o cashback ao abrir (inclusive em reagendamentos)
      setUsarCashback(false);
      setCashbackUsoStr("0");
      
      
      if (initialData) {
        setSelectedCliente({ id: initialData.cliente_id, nome: initialData.cliente_nome, login: "" });
        // Fetch full client data to get the login
        fetchFixedClient(initialData.cliente_id);
        setSearchCliente(initialData.cliente_nome || "");
        setSelectedColaborador(initialData.colaborador_id);
        setSelectedDatePart(format(parseISO(initialData.data), "yyyy-MM-dd"));
        setSelectedTimePart(format(parseISO(initialData.data), "HH:mm"));
        setSelectedServicos(initialData.servicos_ids || []);
        setValorFinal(initialData.valor?.toString() || "0");
        setCouponCode(initialData.cupom_codigo || "");
        fetchColabServicos(initialData.colaborador_id);
      } else {
        if (fixedClientId) {
          fetchFixedClient(fixedClientId);
        }
        if (fixedColaboradorId) {
          setSelectedColaborador(fixedColaboradorId);
          fetchColabServicos(fixedColaboradorId);
        }
      }
    }
  }, [isOpen, fixedClientId, fixedColaboradorId, initialData]);

  const searchClientes = async (term: string) => {
    // Se o cliente já está fixo ou é uma edição, não permite busca/alteração
    if (fixedClientId || initialData?.cliente_id) return;
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
      
    // Filtro adicional no front-end para garantir que apenas clientes desta barbearia apareçam
    const filteredData = (data || []).filter(c => c.barbearia_id === tenant.id);
    setClientes(filteredData);
  };

  const handleSelectServico = (servicoId: string) => {
    setSelectedServicos(prev => {
      const isRemoving = prev.includes(servicoId);
      const newSelection = isRemoving ? prev.filter(id => id !== servicoId) : [...prev, servicoId];
      const newTotal = newSelection.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.price || 0), 0);
      setValorFinal(newTotal.toString());
      setCouponResult(null);
      return newSelection;
    });
  };

  const fetchColabServicos = async (colabId: string) => {
    const { data } = await supabase.from('colaborador_servicos').select('servico_id').eq('colaborador_id', colabId);
    const ids = data?.map(d => d.servico_id).filter((id): id is string => !!id) || [];
    setColabServicosIds(ids);
    
    const { data: activeDates } = await supabase.from('horarios_colaboradores').select('data').eq('colaborador_id', colabId).eq('ativo', true);
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
      const minAllowed = addMinutes(now, tempoMarcar);

      const checkOverlap = (start: Date, duration: number) => {
        const end = addMinutes(start, duration);
        return appts?.some(app => {
          const appStart = parseISO(app.data);
          const appDur = (app.atendimento_servicos as any[]).reduce((sum: number, item: any) => sum + (item.servicos.duration || 0), 0);
          const appEnd = addMinutes(appStart, appDur);
          return (start < appEnd && end > appStart);
        });
      };

      const generateSlots = (s: string, e: string) => {
        if (!s || !e) return;
        let curr = parseISO(`${date}T${s}`);
        const end = parseISO(`${date}T${e}`);
        while (addMinutes(curr, requestedDuration) <= end) {
          if (curr.getTime() >= minAllowed.getTime() && !checkOverlap(curr, requestedDuration)) {
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
    if (isOpen) {
      fetchAvailableTimes(selectedDatePart, selectedColaborador, selectedServicos);
    }
  }, [selectedDatePart, selectedColaborador, selectedServicos, isOpen, fetchAvailableTimes]);

  // Preview do desconto do clube de assinatura
  useEffect(() => {
    if (!isOpen || !tenant || !selectedCliente || selectedServicos.length === 0 || !selectedDatePart) {
      setClubePreview(null);
      setCashbackClubeCobertos(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const status: any = await getClubeStatusFn({ data: { barbearia_id: tenant.id, cliente_id: selectedCliente.id } });
        if (cancelled) return;
        if (!status?.ativo || !Array.isArray(status.servicos)) { setClubePreview(null); setCashbackClubeCobertos(new Set()); return; }
        const dow = parseISO(selectedDatePart).getDay();
        const remaining: Record<string, number> = {};
        status.servicos.forEach((s: any) => { remaining[s.servico_id] = Number(s.restantes) || 0; });
        let desconto = 0;
        const itens: Array<{ nome: string; desconto: number }> = [];
        const cobertos = new Set<string>();
        for (const sId of selectedServicos) {
          const rule = status.servicos.find((x: any) => x.servico_id === sId);
          if (!rule) continue;
          if (!Array.isArray(rule.dias_semana) || !rule.dias_semana.includes(dow)) continue;
          if ((remaining[sId] ?? 0) <= 0) continue;
          const serv = allServicos.find(a => a.id === sId);
          if (!serv) continue;
          cobertos.add(sId);
          const d = rule.tipo_desconto === "percentual"
            ? (Number(serv.price) * Number(rule.valor_desconto)) / 100
            : Math.min(Number(rule.valor_desconto), Number(serv.price));
          if (d <= 0) continue;
          desconto += d;
          itens.push({ nome: serv.name, desconto: d });
          remaining[sId] -= 1;
        }
        setCashbackClubeCobertos(cobertos);
        if (desconto <= 0) { setClubePreview(null); return; }
        const baseTotal = selectedServicos.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.price || 0), 0);
        setClubePreview({ desconto, valor_final: Math.max(0, baseTotal - desconto), valor_original: baseTotal, itens });
      } catch { if (!cancelled) { setClubePreview(null); setCashbackClubeCobertos(new Set()); } }
    })();
    return () => { cancelled = true; };
  }, [isOpen, tenant, selectedCliente, selectedServicos, selectedDatePart, allServicos, getClubeStatusFn]);

  // Carregar saldo de cashback do cliente
  useEffect(() => {
    if (!isOpen || !cashbackEnabled || !tenant || !selectedCliente) { setCashbackSaldo(0); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("fn_cashback_saldo", {
        p_barbearia_id: tenant.id, p_cliente_id: selectedCliente.id,
      });
      if (cancelled) return;
      // Ao reagendar, desconsidera o cashback já debitado neste atendimento
      const jaUsado = Number(initialData?.cashback_usado || 0);
      setCashbackSaldo(Number((data as any)?.disponivel || 0) + jaUsado);
    })();
    return () => { cancelled = true; };
  }, [isOpen, cashbackEnabled, tenant, selectedCliente, initialData?.cashback_usado]);


  // Atualiza o valor final exibido com o desconto do clube quando não há cupom aplicado
  useEffect(() => {
    if (clubePreview && !couponResult) {
      setValorFinal(String(clubePreview.valor_final.toFixed(2)));
    }
  }, [clubePreview, couponResult]);

  const handleSave = async (force: boolean = false) => {
    if (!tenant) return;
    if (!selectedCliente || !selectedColaborador || selectedServicos.length === 0 || !selectedTimePart) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (couponCode.trim() && !couponResult) {
      toast.error("Clique em Aplicar para validar o cupom antes de confirmar.");
      return;
    }

    const userData = localStorage.getItem("user");
    const user = userData ? JSON.parse(userData) : null;

    if (!force) {
      const colab = colaboradores.find(c => c.id === selectedColaborador);
      const servs = selectedServicos.map(id => allServicos.find(s => s.id === id)?.name).filter(Boolean);
      
      const newDate = parseISO(`${selectedDatePart}T${selectedTimePart}`);
      
      // Calcular valor com cashback/cupom/clube
      const baseTotal = selectedServicos.reduce((acc, sId) => acc + (allServicos.find(s => s.id === sId)?.price || 0), 0);
      const cupomDesc = couponResult ? Number((couponResult as any).valor_desconto || 0) : 0;
      const clubeDesc = clubePreview ? clubePreview.desconto : 0;
      const cashbackUso = (cashbackEnabled && usarCashback) ? Math.max(0, parseFloat(cashbackUsoStr || "0")) : 0;
      const valorAPagar = Math.max(0, baseTotal - cupomDesc - clubeDesc - cashbackUso);
      
      const data: any = {
        isUpdate: !!initialData?.id,
        cliente: selectedCliente.nome,
        colaborador: colab?.nome || "",
        data: format(newDate, "dd/MM/yyyy"),
        horario: selectedTimePart,
        servicos: servs.join(", "),
        valorOriginal: baseTotal,
        valorAPagar,
        cupomDesc,
        clubeDesc,
        cashbackUso,
      };

      if (initialData?.id) {
        const oldDate = parseISO(initialData.data);
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
      // Calculate commission
      const { data: rules } = await supabase
        .from("colaborador_servicos")
        .select("servico_id, valor_comissao, tipo_comissao")
        .eq("colaborador_id", selectedColaborador);
      
      let totalComissao = 0;
      selectedServicos.forEach(sId => {
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

      const selectedServiceRows = selectedServicos.map((serviceId) => {
        const service = allServicos.find((item) => item.id === serviceId);
        const price = Number(service?.price) || 0;
        return {
          barbearia_id: tenant!.id,
          servico_id: serviceId,
          valor_servico: price,
          valor_original: price,
          valor_desconto: 0,
          name_servico: service?.name ?? null,
        };
      });
      const originalTotal = selectedServiceRows.reduce((sum, service) => sum + service.valor_original, 0);
      const payload = {
        barbearia_id: tenant!.id,
        cliente_id: selectedCliente.id,
        colaborador_id: selectedColaborador,
        data: `${selectedDatePart}T${selectedTimePart}:00`,
        valor: originalTotal,
        valor_original: originalTotal,
        valor_desconto: 0,
        clube_desconto_aplicado: 0,
        clube_id: null,
        comissao: totalComissao,
        status: 'Agendado'
      };
      
      let atendimentoId: string;
      if (initialData?.id) {
        const { error } = await supabase.from('atendimentos').update(payload).eq('id', initialData.id);
        if (error) throw error;
        atendimentoId = initialData.id;
        
        // Delete old services
        const { error: deleteServicesError } = await supabase.from('atendimento_servicos').delete().eq('atendimento_id', atendimentoId);
        if (deleteServicesError) throw new Error("Serviços anteriores: " + deleteServicesError.message);
      } else {
        const { data, error } = await supabase.from('atendimentos').insert([payload]).select().single();
        if (error) throw error;
        atendimentoId = data.id;
      }

      const { error: insertServicesError } = await supabase.from('atendimento_servicos').insert(
        selectedServiceRows.map((service) => ({ ...service, atendimento_id: atendimentoId }))
      );
      if (insertServicesError) throw new Error("Serviços: " + insertServicesError.message);

      if (couponCode.trim()) {
        if (!user?.id || !user?.senha) throw new Error("Faça login novamente para aplicar o cupom.");
        const discount = await applyCouponFn({ data: {
          atendimento_id: atendimentoId, barbearia_id: tenant.id, cliente_id: selectedCliente.id,
          actor_id: user.id, password: user.senha, codigo: couponCode,
        } });
        setCouponResult(discount);
        setValorFinal(String((discount as any).valor_final));
      } else if (initialData?.cupom_codigo) {
        if (!user?.id || !user?.senha) throw new Error("Faça login novamente para remover o cupom.");
        await removeCouponFn({ data: { atendimento_id: atendimentoId, barbearia_id: tenant.id,
          cliente_id: selectedCliente.id, actor_id: user.id, password: user.senha } });
      }

      // Aplicar desconto do clube de assinatura (se o cliente tiver clube ativo)
      try {
        const clubeResult = await applyClubeFn({ data: {
          atendimento_id: atendimentoId, barbearia_id: tenant.id, cliente_id: selectedCliente.id,
        } });
        if (clubeResult?.aplicado && clubeResult.valor_final != null) {
          setValorFinal(String(clubeResult.valor_final));
          toast.success(`Clube de assinatura aplicado: -R$ ${Number(clubeResult.desconto ?? 0).toFixed(2)}`);
        }
      } catch (err) { console.warn("Clube nao aplicado:", err); }

      // Aplicar uso de cashback (debita saldo e diminui valor do atendimento)
      if (cashbackEnabled) {
        const usoNum = usarCashback ? Math.max(0, parseFloat(cashbackUsoStr || "0")) : 0;
        const { data: atRow } = await supabase.from('atendimentos')
          .select('valor, cashback_usado').eq('id', atendimentoId).maybeSingle();
        const currentValor = Number((atRow as any)?.valor || 0);
        const oldUso = Number((atRow as any)?.cashback_usado || 0);
        const usoFinal = usoNum > 0 ? Math.min(usoNum, currentValor + oldUso, cashbackSaldo) : 0;
        if (usoFinal !== oldUso) {
          // Restaurar o valor original antes de debitar de novo
          const valorBase = currentValor + oldUso;
          const { error: cbErr } = await supabase.from('atendimentos').update({
            cashback_usado: usoFinal,
            valor: Math.max(0, valorBase - usoFinal),
          } as any).eq('id', atendimentoId);
          if (cbErr) throw new Error("Cashback: " + cbErr.message);
          setValorFinal(String(Math.max(0, valorBase - usoFinal)));
        }
      }



      // Trigger Webhook
      const colab = colaboradores.find(c => c.id === selectedColaborador);
      const { data: colabData } = await supabase.from('colaboradores').select('login').eq('id', selectedColaborador).maybeSingle();
      const formattedTel = colabData?.login ? colabData.login.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : (colabData?.login || "");
      
      const newData = parseISO(`${selectedDatePart}T${selectedTimePart}:00-03:00`);

      if (initialData?.id) {
        const oldData = parseISO(initialData.data);
        const isRemarcacao = oldData.getTime() !== newData.getTime();
        
        triggerWebhook(isRemarcacao ? "Remarcacao" : "Agendamento", {
          tipo: isRemarcacao ? "Remarcacao" : "Agendamento",
          barbearia_id: tenant!.id,
          cliente: selectedCliente.nome,
          login_cliente: selectedCliente.login,
          colaborador: colab?.nome || "",
          tel_colaborador: formattedTel,
          data: format(newData, "dd/MM/yyyy"),
          horario: selectedTimePart,
          servicos: selectedServicos.map(sId => allServicos.find(s => s.id === sId)?.name || ""),
          ...(isRemarcacao && {
            data_antiga: format(oldData, "dd/MM/yyyy"),
            horario_antigo: format(oldData, "HH:mm")
          })
        });
      } else {
        triggerWebhook("Agendamento", {
          tipo: "Agendamento",
          barbearia_id: tenant!.id,
          cliente: selectedCliente.nome,
          login_cliente: selectedCliente.login,
          colaborador: colab?.nome || "",
          tel_colaborador: formattedTel,
          data: format(parseISO(selectedDatePart), "dd/MM/yyyy"),
          horario: selectedTimePart,
          servicos: selectedServicos.map(sId => allServicos.find(s => s.id === sId)?.name || "")
        });
      }

      toast.success(initialData?.id ? "Agendamento atualizado" : "Agendamento realizado com sucesso");
      setIsOpen(false);
      setShowConfirmation(false);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (e: any) { 
      toast.error(e.message); 
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    if (!fixedClientId) {
      setSelectedCliente(null);
      setSearchCliente("");
    }
    if (!fixedColaboradorId) {
      setSelectedColaborador("");
    }
    setSelectedDatePart(format(new Date(), "yyyy-MM-dd"));
    setSelectedTimePart("");
    setSelectedServicos([]);
    setValorFinal("0");
    setCouponCode("");
    setCouponResult(null);
    setClubePreview(null);
    setColabServicosIds([]);
    setUsarCashback(false);
    setCashbackUsoStr("0");
    setCashbackClubeCobertos(new Set());
  };

  return (
    <>
      <Button 
        onClick={() => {
          if (initialData?.data) {
            const userData = localStorage.getItem("user");
            const user = userData ? JSON.parse(userData) : null;
            const isLevel3 = user?.nivel === 3;

            if (isLevel3) {
              const now = new Date();
              const appDate = parseISO(initialData.data);
              const minAllowedToChange = addMinutes(now, tempoExcluir);
              
              if (appDate < minAllowedToChange) {
                toast.error(`Não é possível reagendar atendimentos com menos de ${tempoExcluir} minutos de antecedência.`);
                return;
              }
            }
          }
          setIsOpen(true);
        }} 
        variant={variant} 
        className={cn("gap-2", className)}
      >
        {icon ? icon : <CalendarIcon className="w-4 h-4" />}
        {label}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Agendar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
            {(!fixedClientId && !initialData?.cliente_id) && (
              <div className="space-y-2">
                <Label>1. Selecione o Cliente</Label>
                <Input 
                  placeholder="Buscar cliente..." 
                  value={searchCliente} 
                  onChange={(e) => searchClientes(e.target.value)} 
                />
                <div className="space-y-1">
                  {clientes.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => { setSelectedCliente(c); setSearchCliente(c.nome); setClientes([]); }} 
                      className="p-2 border rounded hover:bg-accent cursor-pointer flex justify-between"
                    >
                      <span>{c.nome}</span>
                      <span className="text-xs opacity-50">{c.login}</span>
                    </div>
                  ))}
                </div>
                {selectedCliente && <p className="text-xs text-green-600 font-medium">✓ {selectedCliente.nome}</p>}
              </div>
            )}

            {(fixedClientId || initialData?.cliente_id) && (
              <div className="space-y-2">
                <Label>Cliente Selecionado</Label>
                <div className="p-2 border rounded bg-muted/50 flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {selectedCliente?.nome || "Carregando..."}
                  </span>
                </div>
              </div>
            )}

            {!fixedColaboradorId ? (
              <div className="space-y-2">
                <Label>{(fixedClientId || initialData?.cliente_id) ? "1" : "2"}. Selecione o Colaborador</Label>
                <div className="rounded-md border p-2 bg-muted/5">
                  <div className="space-y-2">
                    {colaboradores.filter(c => c.ativo).map(c => (
                      <div 
                        key={c.id}
                        onClick={() => { setSelectedColaborador(c.id); setSelectedServicos([]); setSelectedDatePart(""); setSelectedTimePart(""); fetchColabServicos(c.id); }}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedColaborador === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                        )}
                      >
                        <Avatar className="h-12 w-12 border">
                          <AvatarImage src={c.foto_url || ""} />
                          <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-none mb-1">{c.nome}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {c.servicos?.join(", ") || "Sem serviços vinculados"}
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
            ) : (
              <div className="space-y-2">
                <Label>{(fixedClientId || initialData?.cliente_id) ? "" : "2. "}Colaborador Selecionado</Label>
                <div className="p-3 border rounded-lg bg-muted/30 flex items-center gap-3">
                  {(() => {
                    const c = colaboradores.find(col => col.id === (fixedColaboradorId || selectedColaborador));
                    return (
                      <>
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={c?.foto_url || ""} />
                          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-none">{c?.nome || "Carregando..."}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {c?.servicos?.join(", ")}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {selectedColaborador && (
              <>
                <div className="space-y-2">
                  <Label>{(fixedClientId || initialData?.cliente_id) && fixedColaboradorId ? "1" : (!fixedClientId && !initialData?.cliente_id && !fixedColaboradorId) ? "3" : "2"}. Selecione os Serviços</Label>
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
                          <Checkbox 
                            id={`sch-${s.id}`} 
                            checked={selectedServicos.includes(s.id)} 
                            onCheckedChange={() => handleSelectServico(s.id)} 
                            onClick={(e) => e.stopPropagation()}
                          />
                          {s.image_url ? (
                            <img src={s.image_url} alt={s.name} className="w-10 h-10 rounded object-cover border" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border">
                              <Scissors className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-none">{s.name}</p>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-muted-foreground">{s.duration}min</span>
                              <span className="text-xs font-semibold">R${s.price}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedServicos.length > 0 && (
                  <div className="space-y-2">
                    <Label>{(fixedClientId || initialData?.cliente_id) && fixedColaboradorId ? "2" : (!fixedClientId && !initialData?.cliente_id && !fixedColaboradorId) ? "4" : "3"}. Selecione a Data</Label>
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
                              onClick={() => { setSelectedDatePart(dateStr); setCouponResult(null); }}
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
                    <Label>{(fixedClientId || initialData?.cliente_id) && fixedColaboradorId ? "3" : (!fixedClientId && !initialData?.cliente_id && !fixedColaboradorId) ? "5" : "4"}. Horários Disponíveis</Label>
                    {loadingTimes ? <p className="text-sm animate-pulse">Consultando agenda...</p> : (
                      <div className="grid grid-cols-4 gap-2">
                        {availableTimes.length > 0 ? availableTimes.map(t => (
                          <Button 
                            key={t} 
                            variant={selectedTimePart === t ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setSelectedTimePart(t)}
                          >
                            {t}
                          </Button>
                        )) : <p className="text-sm text-destructive col-span-full">Sem horários disponíveis para este dia.</p>}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="valor-agendar">Valor Total (R$)</Label>
              <Input 
                id="valor-agendar"
                type="number"
                step="0.01"
                value={valorFinal}
                onChange={(e) => setValorFinal(e.target.value)}
                disabled={currentUser?.nivel === 3 || currentUser?.nivel === "3"}
              />
            </div>
            {cashbackEnabled && selectedServicos.length > 0 && (() => {
              // Cashback que o cliente vai receber neste agendamento
              const couponMap: Record<string, { orig: number; final: number }> = {};
              if (couponResult && Array.isArray((couponResult as any).servicos)) {
                (couponResult as any).servicos.forEach((s: any) => {
                  couponMap[s.servico_id] = { orig: Number(s.valor_original), final: Number(s.valor_final) };
                });
              }
              let cashbackAReceber = 0;
              selectedServicos.forEach((sId) => {
                const perc = cashbackServicos[sId];
                if (!perc) return;
                if (cashbackClubeCobertos.has(sId)) return;
                const serv = allServicos.find((a) => a.id === sId);
                if (!serv) return;
                const orig = Number(serv.price);
                const finalAfterCoupon = couponMap[sId]?.final ?? orig;
                const fator = orig > 0 ? Math.max(0, finalAfterCoupon) / orig : 0;
                cashbackAReceber += (orig * perc / 100) * fator;
              });
              const maxUso = Math.min(cashbackSaldo, parseFloat(valorFinal || "0"));
              return (
                <div className="space-y-2 rounded-lg border p-3 bg-primary/5">
                  {cashbackAReceber > 0 && (
                    <p className="text-sm font-medium text-primary">
                      Você vai receber R$ {cashbackAReceber.toFixed(2).replace(".", ",")} de cashback
                    </p>
                  )}
                  {cashbackSaldo > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <Checkbox id="cb-usar" checked={usarCashback}
                          onCheckedChange={(c) => {
                            const v = !!c; setUsarCashback(v);
                            if (v) setCashbackUsoStr(String(maxUso.toFixed(2)));
                            else setCashbackUsoStr("0");
                          }} />
                        <Label htmlFor="cb-usar" className="text-sm">
                          Usar saldo de cashback (R$ {cashbackSaldo.toFixed(2).replace(".", ",")} disponível)
                        </Label>
                      </div>
                      {usarCashback && (
                        <p className="text-xs text-muted-foreground">
                          Será utilizado R$ {maxUso.toFixed(2).replace(".", ",")} do seu saldo (uso total obrigatório, limitado ao valor do atendimento).
                        </p>
                      )}

                    </>
                  )}
                </div>
              );
            })()}
            {selectedDatePart && selectedServicos.length > 0 && (
              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="coupon-code">Cupom de desconto</Label>
                <div className="flex gap-2">
                  <Input id="coupon-code" minLength={4} maxLength={10} placeholder="Digite o código"
                    value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }} />
                  {couponCode && <Button type="button" variant="outline" disabled={applyingCoupon} onClick={async () => {
                    if (!currentUser?.id || !currentUser?.senha || !selectedCliente) return toast.error("Faça login novamente para aplicar o cupom.");
                    setApplyingCoupon(true);
                    try {
                      const result = await previewCouponFn({ data: { barbearia_id: tenant!.id, cliente_id: selectedCliente.id,
                        actor_id: currentUser.id, password: currentUser.senha, codigo: couponCode,
                        data: selectedDatePart, servicos_ids: selectedServicos } });
                      setCouponResult(result); setValorFinal(String((result as any).valor_final)); toast.success("Cupom válido!");
                    } catch (error) { setCouponResult(null); toast.error(error instanceof Error ? error.message : "Cupom inválido."); }
                    finally { setApplyingCoupon(false); }
                  }}>{applyingCoupon ? "Validando..." : "Aplicar"}</Button>}
                </div>
                {couponResult && <div className="rounded-md bg-primary/10 p-3 text-sm">
                  <p className="font-semibold text-primary">Cupom {(couponResult as any).codigo} aplicado</p>
                  <p>De R$ {Number((couponResult as any).valor_original).toFixed(2)} por R$ {Number((couponResult as any).valor_final).toFixed(2)}</p>
                  <p className="text-muted-foreground">Economia de R$ {Number((couponResult as any).valor_desconto).toFixed(2)}</p>
                  <div className="mt-2 space-y-1">{((couponResult as any).servicos ?? []).map((service: any) => <p key={service.servico_id} className="text-xs">{service.nome}: <span className="line-through">R$ {Number(service.valor_original).toFixed(2)}</span> → R$ {Number(service.valor_final).toFixed(2)}</p>)}</div>
                </div>}
              </div>
            )}
            {clubePreview && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
                <p className="font-semibold text-primary">Clube de assinatura aplicado</p>
                <p>De R$ {clubePreview.valor_original.toFixed(2)} por <span className="font-semibold">R$ {clubePreview.valor_final.toFixed(2)}</span></p>
                <p className="text-muted-foreground">Desconto de R$ {clubePreview.desconto.toFixed(2)}</p>
                <div className="mt-1 space-y-0.5">
                  {clubePreview.itens.map((it, i) => (
                    <p key={i} className="text-xs">{it.nome}: -R$ {it.desconto.toFixed(2)}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleSave()} disabled={isSubmitting || !selectedTimePart}>
              {isSubmitting ? "Agendando..." : "Agendar"}
            </Button>
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

            {confirmationData && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Resumo do Valor:</p>
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-md text-sm space-y-1">
                  <p className="flex justify-between"><span>Valor original:</span><span>R$ {Number(confirmationData.valorOriginal || 0).toFixed(2).replace(".", ",")}</span></p>
                  {confirmationData.clubeDesc > 0 && (
                    <p className="flex justify-between text-muted-foreground"><span>Clube de assinatura:</span><span>- R$ {Number(confirmationData.clubeDesc).toFixed(2).replace(".", ",")}</span></p>
                  )}
                  {confirmationData.cupomDesc > 0 && (
                    <p className="flex justify-between text-muted-foreground"><span>Cupom de desconto:</span><span>- R$ {Number(confirmationData.cupomDesc).toFixed(2).replace(".", ",")}</span></p>
                  )}
                  {confirmationData.cashbackUso > 0 && (
                    <p className="flex justify-between text-muted-foreground"><span>Cashback utilizado:</span><span>- R$ {Number(confirmationData.cashbackUso).toFixed(2).replace(".", ",")}</span></p>
                  )}
                  <p className="flex justify-between font-bold text-primary pt-1 border-t border-primary/20"><span>Você vai pagar:</span><span>R$ {Number(confirmationData.valorAPagar || 0).toFixed(2).replace(".", ",")}</span></p>
                </div>
              </div>
            )}

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
            <Button onClick={() => handleSave(true)} disabled={isSubmitting}>
              {isSubmitting ? "Confirmando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
