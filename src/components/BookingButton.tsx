import { useState, useEffect, useCallback } from "react";
import { triggerWebhook } from "@/lib/webhook";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  User, 
  Scissors, 
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface BookingButtonProps {
  fixedClientId?: string;
  fixedColaboradorId?: string;
  onSuccess?: () => void;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  className?: string;
  label?: string;
}

export function BookingButton({ 
  fixedClientId, 
  fixedColaboradorId, 
  onSuccess,
  variant = "outline",
  className,
  label = "Agendar Atendimento"
}: BookingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

  const fetchFixedClient = async (id: string) => {
    const { data } = await supabase.from('usuarios').select('id, nome, login').eq('id', id).single();
    if (data) {
      setSelectedCliente(data);
      setSearchCliente(data.nome);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFormData();
      fetchMaxDate();
      if (fixedClientId) {
        fetchFixedClient(fixedClientId);
      }
      if (fixedColaboradorId) {
        setSelectedColaborador(fixedColaboradorId);
        fetchColabServicos(fixedColaboradorId);
      }
    }
  }, [isOpen, fixedClientId, fixedColaboradorId]);

  const searchClientes = async (term: string) => {
    setSearchCliente(term);
    if (term.length < 2) { setClientes([]); return; }
    const { data } = await supabase.from('usuarios').select('id, nome, login').eq('nivel', 3).or(`nome.ilike.%${term}%,login.ilike.%${term}%`).limit(5);
    setClientes(data || []);
  };

  const handleSelectServico = (servicoId: string) => {
    setSelectedServicos(prev => {
      const isRemoving = prev.includes(servicoId);
      const newSelection = isRemoving ? prev.filter(id => id !== servicoId) : [...prev, servicoId];
      const newTotal = newSelection.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.price || 0), 0);
      setValorFinal(newTotal.toString());
      return newSelection;
    });
  };

  const fetchColabServicos = async (colabId: string) => {
    const { data } = await supabase.from('colaborador_servicos').select('servico_id').eq('colaborador_id', colabId);
    setColabServicosIds(data?.map(d => d.servico_id).filter((id): id is string => !!id) || []);
    
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
  }, [allServicos]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableTimes(selectedDatePart, selectedColaborador, selectedServicos);
    }
  }, [selectedDatePart, selectedColaborador, selectedServicos, isOpen, fetchAvailableTimes]);

  const handleSave = async () => {
    if (!selectedCliente || !selectedColaborador || selectedServicos.length === 0 || !selectedTimePart) {
      toast.error("Preencha todos os campos obrigatórios");
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

      const payload = {
        cliente_id: selectedCliente.id,
        colaborador_id: selectedColaborador,
        data: `${selectedDatePart}T${selectedTimePart}:00-03:00`,
        valor: parseFloat(valorFinal),
        comissao: totalComissao,
        status: 'Agendado'
      };
      
      const { data, error } = await supabase.from('atendimentos').insert([payload]).select().single();
      if (error) throw error;
      const atendimentoId = data.id;

      await supabase.from('atendimento_servicos').insert(selectedServicos.map(sId => ({
        atendimento_id: atendimentoId,
        servico_id: sId,
        valor_servico: allServicos.find(s => s.id === sId)?.price || 0
      })));

      toast.success("Agendamento realizado com sucesso");
      setIsOpen(false);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (e: any) { toast.error(e.message); }
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
    setColabServicosIds([]);
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)} 
        variant={variant} 
        className={cn("gap-2", className)}
      >
        <CalendarIcon className="w-4 h-4" />
        {label}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!fixedClientId && (
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

            {!fixedColaboradorId ? (
              <div className="space-y-2">
                <Label>{fixedClientId ? "1" : "2"}. Selecione o Colaborador</Label>
                <Select 
                  value={selectedColaborador} 
                  onValueChange={(v) => { setSelectedColaborador(v); setSelectedServicos([]); fetchColabServicos(v); }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.filter(c => c.ativo).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{fixedClientId ? "" : "2. "}Colaborador Selecionado</Label>
                <div className="p-2 border rounded bg-muted/50 flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {colaboradores.find(c => c.id === fixedColaboradorId)?.nome || "Carregando..."}
                  </span>
                </div>
              </div>
            )}

            {selectedColaborador && (
              <div className="space-y-2">
                <Label>{(fixedClientId && fixedColaboradorId) ? "1" : (!fixedClientId && !fixedColaboradorId) ? "3" : "2"}. Selecione os Serviços</Label>
                <div className="grid gap-2 border p-3 rounded-md max-h-[150px] overflow-auto bg-muted/20">
                  {allServicos.filter(s => colabServicosIds.includes(s.id)).map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`sch-${s.id}`} 
                        checked={selectedServicos.includes(s.id)} 
                        onCheckedChange={() => handleSelectServico(s.id)} 
                      />
                      <label htmlFor={`sch-${s.id}`} className="text-sm flex-1 flex justify-between">
                        <span>{s.name}</span>
                        <span className="opacity-60">{s.duration}min - R${s.price}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedServicos.length > 0 && (
              <div className="space-y-2">
                <Label>{(fixedClientId && fixedColaboradorId) ? "2" : (!fixedClientId && !fixedColaboradorId) ? "4" : "3"}. Selecione a Data</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal pl-3",
                        !selectedDatePart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
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
                      disabled={(date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        const today = startOfToday();
                        return (
                          date < today || 
                          (maxDate && dateStr > maxDate) || 
                          !colabActiveDates.includes(dateStr)
                        );
                      }}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {selectedDatePart && selectedServicos.length > 0 && selectedColaborador && (
              <div className="space-y-2">
                <Label>{(fixedClientId && fixedColaboradorId) ? "3" : (!fixedClientId && !fixedColaboradorId) ? "5" : "4"}. Horários Disponíveis</Label>
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
            <div className="space-y-2">
              <Label htmlFor="valor-agendar">Valor Total (R$)</Label>
              <Input 
                id="valor-agendar"
                type="number"
                step="0.01"
                value={valorFinal}
                onChange={(e) => setValorFinal(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSubmitting || !selectedTimePart}>
              {isSubmitting ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
