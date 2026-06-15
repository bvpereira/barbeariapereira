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

  const fetchFormData = async () => {
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome, ativo, foto_url').eq('barbearia_id', tenant!.id).order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration, image_url').eq('barbearia_id', tenant!.id).order('name');
    const { data: rels } = await supabase.from('colaborador_servicos').select('colaborador_id, servico_id').eq('barbearia_id', tenant!.id);
    
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
    const { data: agendaData } = await supabase.from('dias_agenda').select('data').eq('barbearia_id', tenant!.id).eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (agendaData && agendaData.length > 0) setMaxDate(agendaData[0].data);

    const { data: infoData } = await supabase.from('informacoes').select('tempo_marcar, tempo_excluir').eq('barbearia_id', tenant!.id).maybeSingle();
    if (infoData) {
      setTempoMarcar(infoData.tempo_marcar ?? 60);
      setTempoExcluir(infoData.tempo_excluir ?? 60);
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
    if (isOpen) {
      fetchAvailableTimes(selectedDatePart, selectedColaborador, selectedServicos);
    }
  }, [selectedDatePart, selectedColaborador, selectedServicos, isOpen, fetchAvailableTimes]);

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
    const isClient = user?.nivel === 3 || user?.nivel === "3";

    if (!isClient && !force) {
      const colab = colaboradores.find(c => c.id === selectedColaborador);
      const servs = selectedServicos.map(id => allServicos.find(s => s.id === id)?.name).filter(Boolean);
      
      const newDate = parseISO(`${selectedDatePart}T${selectedTimePart}`);
      
      const data: any = {
        isUpdate: !!initialData?.id,
        cliente: selectedCliente.nome,
        colaborador: colab?.nome || "",
        data: format(newDate, "dd/MM/yyyy"),
        horario: selectedTimePart,
        servicos: servs.join(", "),
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

      const originalTotal = selectedServicos.reduce((sum, id) => sum + (allServicos.find((service) => service.id === id)?.price || 0), 0);
      const payload = {
        barbearia_id: tenant!.id,
        cliente_id: selectedCliente.id,
        colaborador_id: selectedColaborador,
        data: `${selectedDatePart}T${selectedTimePart}:00-03:00`,
        valor: originalTotal,
        valor_original: originalTotal,
        comissao: totalComissao,
        status: 'Agendado'
      };
      
      let atendimentoId: string;
      if (initialData?.id) {
        const { error } = await supabase.from('atendimentos').update(payload).eq('id', initialData.id);
        if (error) throw error;
        atendimentoId = initialData.id;
        
        // Delete old services
        await supabase.from('atendimento_servicos').delete().eq('atendimento_id', atendimentoId);
      } else {
        const { data, error } = await supabase.from('atendimentos').insert([payload]).select().single();
        if (error) throw error;
        atendimentoId = data.id;
      }

      await supabase.from('atendimento_servicos').insert(selectedServicos.map(sId => ({
        barbearia_id: tenant!.id,
        atendimento_id: atendimentoId,
        servico_id: sId,
        valor_servico: allServicos.find(s => s.id === sId)?.price || 0,
        valor_original: allServicos.find(s => s.id === sId)?.price || 0
      })));

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
    setColabServicosIds([]);
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
