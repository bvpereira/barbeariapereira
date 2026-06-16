import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  UserCircle, 
  Phone, 
  Lock, 
  StickyNote,
  ChevronDown,
  Eye,
  EyeOff,
  History,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Scissors
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addMinutes, isAfter, startOfToday } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreVertical, MessageCircle, Crown } from "lucide-react";
import { ClienteClubeSection } from "@/components/ClienteClubeSection";
import { listClubesPublicos, listClientesClubeAtivo } from "@/lib/clube.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
});

interface Cliente {
  id: string;
  nome: string;
  login: string;
  senha?: string;
  observacao: string | null;
  registro?: string;
  hasAtendimentos?: boolean;
  clube_id?: string | null;
  clube_data_fim?: string | null;
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

interface AtendimentoHistorico {
  id: string;
  data: string;
  valor: number;
  status: 'Agendado' | 'Finalizado' | 'Não compareceu';
  colaborador: { id: string, nome: string };
  servicos: { id: string, name: string, price: number, duration: number }[];
}

function ClientesPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const isMobile = useIsMobile();
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalAssinantes, setTotalAssinantes] = useState(0);
  const [clubesMap, setClubesMap] = useState<Record<string, string>>({});
  const listClubesPublicosFn = useServerFn(listClubesPublicos);
  const listClientesClubeAtivoFn = useServerFn(listClientesClubeAtivo);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  // Historico states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [atendimentosCliente, setAtendimentosCliente] = useState<AtendimentoHistorico[]>([]);

  // Edit Atendimento states
  const [isEditAtendimentoOpen, setIsEditAtendimentoOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAtendimento, setEditingAtendimento] = useState<AtendimentoHistorico | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [allServicos, setAllServicos] = useState<Servico[]>([]);
  const [colabServicosIds, setColabServicosIds] = useState<string[]>([]);
  const [colabActiveDates, setColabActiveDates] = useState<string[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [selectedDatePart, setSelectedDatePart] = useState("");
  const [selectedTimePart, setSelectedTimePart] = useState("");
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [valorFinal, setValorFinal] = useState("0");
  const [statusAtendimento, setStatusAtendimento] = useState<AtendimentoHistorico['status']>('Finalizado');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [maxDate, setMaxDate] = useState("");
  const [tempoMarcar, setTempoMarcar] = useState<number>(60);

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    login: "",
    senha: "",
    observacao: "",
    registro: "sim",
  });

  const formatPhone = (value: string) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  useEffect(() => {
    if (tenantLoading) return;
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (tenant?.id && parsedUser.barbearia_id !== tenant.id) {
        window.location.href = "/";
        return;
      }
    }
    if (tenant) {
      fetchTotal();
      fetchClientes();
      fetchFormData();
      fetchBookingSettings();
    }
  }, [search, limit, tenant, tenantLoading]);

  const fetchFormData = async () => {
    if (!tenant?.id) return;
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome').eq('barbearia_id', tenant.id).order('nome');
    const { data: servs } = await supabase.from('servicos').select('id, name, price, duration').eq('barbearia_id', tenant.id).order('name');
    setColaboradores(colabs || []);
    setAllServicos(servs || []);
  };

  const fetchBookingSettings = async () => {
    if (!tenant?.id) return;
    const { data: agendaData } = await supabase.from('dias_agenda').select('data').eq('barbearia_id', tenant.id).eq('ativo', true).order('data', { ascending: false }).limit(1);
    if (agendaData && agendaData.length > 0) setMaxDate(agendaData[0].data);

    const { data: infoData } = await supabase.from('informacoes').select('tempo_marcar').eq('barbearia_id', tenant.id).maybeSingle();
    if (infoData) setTempoMarcar(infoData.tempo_marcar ?? 60);
  };

  const fetchTotal = async () => {
    if (!tenant?.id) return;
    const { count, error } = await supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("barbearia_id", tenant.id)
      .eq("nivel", 3);
    
    if (error) {
      console.error("Erro ao buscar total:", error);
    } else {
      setTotalClientes(count || 0);
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const { data: assinantesRows } = await supabase
      .from("clube_usuarios")
      .select("usuario_id")
      .eq("barbearia_id", tenant.id)
      .gte("data_fim", today);
    const uniqueAssinantes = new Set((assinantesRows || []).map((r: any) => r.usuario_id));
    setTotalAssinantes(uniqueAssinantes.size);


    try {
      const list = await listClubesPublicosFn({ data: { barbearia_id: tenant.id } });
      const map: Record<string, string> = {};
      list.forEach((c) => { map[c.id] = c.nome; });
      setClubesMap(map);
    } catch (e) { console.error(e); }
  };

  const fetchClientes = async () => {
    setLoading(true);
    
    if (!tenant?.id) return;
    let finalQuery = supabase
      .from("usuarios")
      .select(`
        id, 
        nome, 
        login, 
        senha, 
        observacao,
        registro,
        atendimentos:atendimentos(id)
      `, { count: "exact" })
      .eq("barbearia_id", tenant.id)
      .eq("nivel", 3)
      .order("nome", { ascending: true });

    if (search) {
      finalQuery = finalQuery.or(`nome.ilike.%${search}%,login.ilike.%${search}%`);
    }

    const { data: finalData, error: finalError, count: filteredCount } = await finalQuery.range(0, limit - 1);

    if (finalError) {
      toast.error("Erro ao carregar clientes");
      console.error(finalError);
    } else {
      const ids = (finalData || []).map((c: any) => c.id);
      const today = format(new Date(), "yyyy-MM-dd");
      let subsMap: Record<string, { clube_id: string; data_fim: string }> = {};
      if (ids.length > 0) {
        const { data: subs } = await supabase
          .from("clube_usuarios")
          .select("usuario_id, clube_id, data_fim")
          .eq("barbearia_id", tenant.id)
          .in("usuario_id", ids)
          .gte("data_fim", today);
        (subs || []).forEach((s: any) => {
          const cur = subsMap[s.usuario_id];
          if (!cur || s.data_fim > cur.data_fim) {
            subsMap[s.usuario_id] = { clube_id: s.clube_id, data_fim: s.data_fim };
          }
        });
      }
      const clientesComFlag = (finalData || []).map((cliente: any) => ({
        ...cliente,
        hasAtendimentos: cliente.atendimentos && cliente.atendimentos.length > 0,
        clube_id: subsMap[cliente.id]?.clube_id ?? null,
        clube_data_fim: subsMap[cliente.id]?.data_fim ?? null,
      }));
      setClientes(clientesComFlag);
      setHasMore((filteredCount || 0) > limit);
    }
    setLoading(false);
  };


  const fetchHistorico = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    
    const { data, error } = await supabase
      .from("atendimentos")
      .select(`
        id,
        data,
        valor,
        status,
        colaborador:colaboradores(id, nome),
        servicos:atendimento_servicos(
          servico:servicos(id, name, price, duration)
        )
      `)
      .eq("cliente_id", cliente.id)
      .order("data", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar histórico");
      console.error(error);
    } else {
      const formattedData = (data || []).map((at: any) => ({
        ...at,
        servicos: at.servicos.map((s: any) => s.servico)
      }));
      setAtendimentosCliente(formattedData);
    }
    setHistoryLoading(false);
  };

  const fetchColabServicos = async (colabId: string) => {
    const { data } = await supabase.from('colaborador_servicos').select('servico_id').eq('colaborador_id', colabId);
    setColabServicosIds(data?.map(d => d.servico_id).filter((id): id is string => !!id) || []);
    
    const { data: activeDates } = await supabase.from('horarios_colaboradores').select('data').eq('colaborador_id', colabId).eq('ativo', true);
    setColabActiveDates(activeDates?.map(d => d.data) || []);
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

      const { data: appts } = await supabase.from('atendimentos').select('id, data, status, atendimento_servicos(servicos(duration))').eq('colaborador_id', colabId).eq('status', 'Agendado').gte('data', `${date}T00:00:00`).lte('data', `${date}T23:59:59`);

      const filteredAppts = editingAtendimento ? appts?.filter(a => a.id !== editingAtendimento.id) : appts;

      const requestedDuration = servs.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.duration || 0), 0);
      const possibleTimes: string[] = [];
      const now = new Date();
      const minAllowed = addMinutes(now, tempoMarcar);

      const checkOverlap = (start: Date, duration: number) => {
        const end = addMinutes(start, duration);
        return filteredAppts?.some(app => {
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
  }, [allServicos, editingAtendimento, tempoMarcar]);

  useEffect(() => {
    if (isScheduleDialogOpen) {
      fetchAvailableTimes(selectedDatePart, selectedColaborador, selectedServicos);
    }
  }, [selectedDatePart, selectedColaborador, selectedServicos, isScheduleDialogOpen, fetchAvailableTimes]);

  const handleSelectServicoAtendimento = (servicoId: string) => {
    setSelectedServicos(prev => {
      const newSelection = prev.includes(servicoId) ? prev.filter(id => id !== servicoId) : [...prev, servicoId];
      const newTotal = newSelection.reduce((acc, id) => acc + (allServicos.find(s => s.id === id)?.price || 0), 0);
      setValorFinal(newTotal.toString());
      return newSelection;
    });
  };

  const handleSaveAtendimento = async (isScheduling: boolean) => {
    if (!tenant) return;
    if (!selectedCliente || !selectedColaborador || selectedServicos.length === 0 || (isScheduling && !selectedTimePart)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        barbearia_id: tenant!.id,
        cliente_id: selectedCliente.id,
        colaborador_id: selectedColaborador,
        data: `${selectedDatePart}T${selectedTimePart || format(new Date(), "HH:mm")}:00-03:00`,
        valor: parseFloat(valorFinal),
        valor_original: parseFloat(valorFinal),
        status: isScheduling ? 'Agendado' : statusAtendimento
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
        barbearia_id: tenant!.id,
        atendimento_id: atendimentoId,
        servico_id: sId,
        valor_servico: allServicos.find(s => s.id === sId)?.price || 0,
        valor_original: allServicos.find(s => s.id === sId)?.price || 0
      })));

      toast.success("Salvo com sucesso");
      setIsEditAtendimentoOpen(false);
      setIsScheduleDialogOpen(false);
      fetchHistorico(selectedCliente);
    } catch (e: any) { toast.error(e.message); }
    setIsSubmitting(false);
  };

  const handleDeleteAtendimento = async (id: string) => {
    if (!confirm("Excluir este atendimento?")) return;
    try {
      const { error } = await supabase.from('atendimentos').delete().eq('id', id);
      if (error) throw error;
      toast.success("Atendimento excluído");
      if (selectedCliente) fetchHistorico(selectedCliente);
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const updateStatusAtendimento = async (id: string, newStatus: AtendimentoHistorico['status']) => {
    try {
      const { error } = await supabase.from('atendimentos').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success("Status atualizado");
      if (selectedCliente) fetchHistorico(selectedCliente);
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleSave = async () => {
    if (!tenant) return;
    if (!formData.nome) {
      toast.error("O nome do cliente é obrigatório");
      return;
    }

    const loginNumeros = formData.login.replace(/\D/g, "");
    if (loginNumeros.length === 0) {
      toast.error("O telefone é obrigatório");
      return;
    }

    if (loginNumeros.length < 11) {
      toast.error("O telefone está incompleto (deve ter 11 dígitos)");
      return;
    }

    if (!formData.senha) {
      toast.error("A senha é obrigatória");
      return;
    }

    if (formData.senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    const payload = {
      barbearia_id: tenant!.id,
      nome: formData.nome,
      login: loginNumeros,
      senha: formData.senha,
      observacao: formData.observacao,
      nivel: 3,
      registro: formData.registro,
    };

    if (isEditing && selectedCliente) {
      const { error } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("id", selectedCliente.id);

      if (error) {
        if (error.code === "23505") {
          toast.error("Este telefone já está cadastrado");
        } else {
          toast.error("Erro ao atualizar cliente");
        }
      } else {
        toast.success("Cliente atualizado com sucesso");
        setIsDialogOpen(false);
        fetchClientes();
      }
    } else {
      const { error } = await supabase
        .from("usuarios")
        .insert([{ ...payload, barbearia_id: tenant!.id }]);

      if (error) {
        if (error.code === "23505") {
          toast.error("Este telefone já está cadastrado");
        } else {
          toast.error("Erro ao cadastrar cliente");
        }
      } else {
        toast.success("Cliente cadastrado com sucesso");
        setIsDialogOpen(false);
        fetchClientes();
        fetchTotal();
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Primeiro, vamos deletar os atendimentos relacionados para evitar erro de chave estrangeira
      // se o banco não estiver com ON DELETE CASCADE configurado.
      // Primeiro deletamos da tabela atendimento_servicos
      const { data: userAtendimentos } = await supabase
        .from("atendimentos")
        .select("id")
        .eq("cliente_id", id);
      
      if (userAtendimentos && userAtendimentos.length > 0) {
        const atendimentoIds = userAtendimentos.map(a => a.id);
        await supabase
          .from("atendimento_servicos")
          .delete()
          .in("atendimento_id", atendimentoIds);

        await supabase
          .from("atendimentos")
          .delete()
          .in("id", atendimentoIds);
      }

      const { error } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", id);

      if (error) {
        toast.error("Erro ao excluir cliente");
        console.error(error);
      } else {
        toast.success("Cliente excluído com sucesso");
        fetchClientes();
        fetchTotal();
      }
    } catch (error) {
      console.error("Erro na exclusão:", error);
      toast.error("Ocorreu um erro ao tentar excluir o cliente");
    } finally {
      setIsDeleteDialogOpen(false);
      setClienteToDelete(null);
    }
  };

  const confirmDelete = (id: string) => {
    setClienteToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const openAddDialog = () => {
    setIsEditing(false);
    setSelectedCliente(null);
    setShowPassword(false);
    setFormData({ nome: "", login: "", senha: "", observacao: "", registro: "sim" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (cliente: Cliente) => {
    setIsEditing(true);
    setSelectedCliente(cliente);
    setShowPassword(false);
    setFormData({
      nome: cliente.nome,
      login: formatPhone(cliente.login),
      senha: cliente.senha || "",
      observacao: cliente.observacao || "",
      registro: cliente.registro || "sim",
    });
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Clientes</h1>
            <p className="text-muted-foreground">Gerencie a base de clientes da barbearia</p>
          </div>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar cliente
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <UserCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClientes}</div>
              <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clube de Assinatura</CardTitle>
              <Crown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssinantes}</div>
              <p className="text-xs text-muted-foreground">Clientes com plano ativo</p>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-4">
                {loading && clientes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando clientes...
                  </div>
                ) : clientes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </div>
                ) : (
                  clientes.map((cliente) => (
                    <Card 
                      key={cliente.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => fetchHistorico(cliente)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-lg truncate">{cliente.nome}</span>
                              {cliente.hasAtendimentos && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] py-0 px-1.5 border-blue-200">
                                  <History className="w-3 h-3 mr-1" />
                                  Histórico
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                              <Phone className="w-4 h-4" />
                              <span className="text-sm">{formatPhone(cliente.login)}</span>
                            </div>
                            {cliente.observacao ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 italic border-l-2 pl-2 py-1 bg-muted/30 rounded-r">
                                {cliente.observacao}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/30 italic">Sem observações</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => {
                                const phone = cliente.login.replace(/\D/g, "");
                                window.open(`https://wa.me/55${phone}`, "_blank");
                              }}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(cliente)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => confirmDelete(cliente.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && clientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          Carregando clientes...
                        </TableCell>
                      </TableRow>
                    ) : clientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientes.map((cliente) => (
                        <TableRow 
                          key={cliente.id} 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => fetchHistorico(cliente)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {cliente.nome}
                              {cliente.hasAtendimentos && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] py-0 px-1.5 border-blue-200">
                                  <History className="w-3 h-3 mr-1" />
                                  Histórico
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatPhone(cliente.login)}</TableCell>
                          <TableCell>
                            {cliente.clube_id && cliente.clube_data_fim && cliente.clube_data_fim >= format(new Date(), "yyyy-MM-dd") ? (
                              <Badge className="gap-1"><Crown className="w-3 h-3" />{clubesMap[cliente.clube_id] ?? "Plano ativo"}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {cliente.observacao ? (
                              <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]" title={cliente.observacao}>
                                {cliente.observacao}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/30 italic">Sem observações</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  const phone = cliente.login.replace(/\D/g, "");
                                  window.open(`https://wa.me/55${phone}`, "_blank");
                                }}
                                title="Enviar mensagem no WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(cliente)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => confirmDelete(cliente.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => setLimit(prev => prev + 10)}
                  disabled={loading}
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Carregar mais 10
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog Add/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome completo</Label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    className="pl-10"
                    placeholder="Ex: João Silva"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login"
                    className="pl-10"
                    placeholder="(00) 00000-0000"
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: formatPhone(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="registro">Ativar registro</Label>
                  <Checkbox
                    id="registro"
                    checked={formData.registro === "sim"}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, registro: checked ? "sim" : "nao" })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <div className="relative">
                  <StickyNote className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="observacao"
                    className="pl-10 min-h-[100px]"
                    placeholder="Anotações sobre o cliente..."
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  />
                </div>
              </div>
              {isEditing && selectedCliente && tenant?.id && (
                <ClienteClubeSection tenantId={tenant.id} clienteId={selectedCliente.id} />
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="w-full sm:w-auto">
                {isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Alert Dialog for Deletion Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente
                e todos os seus registros de atendimento associados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClienteToDelete(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clienteToDelete && handleDelete(clienteToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Cliente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Dialog Novo/Editar Atendimento (Histórico) */}
        <Dialog open={isEditAtendimentoOpen} onOpenChange={setIsEditAtendimentoOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Editar Atendimento</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={selectedColaborador} onValueChange={(v) => { setSelectedColaborador(v); fetchColabServicos(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serviços</Label>
                <div className="grid gap-2 border p-3 rounded-md max-h-[150px] overflow-auto">
                  {allServicos.map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedServicos.includes(s.id)} onCheckedChange={() => handleSelectServicoAtendimento(s.id)} />
                      <span>{s.name} - R${s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusAtendimento} onValueChange={(v: any) => setStatusAtendimento(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Finalizado">Finalizado</SelectItem>
                    <SelectItem value="Não compareceu">Não compareceu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor-edit">Valor Total (R$)</Label>
                <Input 
                  id="valor-edit"
                  type="number"
                  step="0.01"
                  value={valorFinal}
                  onChange={(e) => setValorFinal(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditAtendimentoOpen(false)}>Cancelar</Button>
              <Button onClick={() => handleSaveAtendimento(false)} disabled={isSubmitting}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Agendar Atendimento (Histórico) */}
        <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Agendamento</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={selectedColaborador} onValueChange={(v) => { setSelectedColaborador(v); setSelectedServicos([]); fetchColabServicos(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                  <SelectContent>{colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {selectedColaborador && (
                <div className="space-y-2">
                  <Label>Serviços</Label>
                  <div className="grid gap-2 border p-3 rounded-md max-h-[150px] overflow-auto bg-muted/20">
                    {allServicos.filter(s => colabServicosIds.includes(s.id)).map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox id={`sch-${s.id}`} checked={selectedServicos.includes(s.id)} onCheckedChange={() => handleSelectServicoAtendimento(s.id)} />
                        <label htmlFor={`sch-${s.id}`} className="text-sm flex-1 flex justify-between">
                          <span>{s.name}</span>
                          <span className="opacity-60">{s.duration}min - R${s.price}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedColaborador && selectedServicos.length > 0 && (
                <div className="space-y-2">
                  <Label>Data</Label>
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
                  <Label>Horários Disponíveis</Label>
                  {loadingTimes ? <p className="text-sm animate-pulse">Consultando agenda...</p> : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableTimes.length > 0 ? availableTimes.map(t => (
                        <Button key={t} variant={selectedTimePart === t ? "default" : "outline"} size="sm" className="px-2" onClick={() => setSelectedTimePart(t)}>{t}</Button>
                      )) : <p className="text-sm text-destructive col-span-full">Sem horários disponíveis para este dia.</p>}
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
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => handleSaveAtendimento(true)} disabled={isSubmitting || !selectedTimePart}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {isMobile ? (
          <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="text-left border-b pb-4">
                <DrawerTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Histórico: {selectedCliente?.nome}
                </DrawerTitle>
                <DrawerDescription>
                  Histórico completo de atendimentos do cliente.
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="overflow-y-auto px-4 py-2 flex-1">
                {renderHistoryContent()}
              </div>

              <DrawerFooter className="border-t pt-4">
                <DrawerClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Histórico: {selectedCliente?.nome}
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="flex-1 overflow-y-auto px-6 py-0">
                {renderHistoryContent()}
              </ScrollArea>
              
              <DialogFooter className="p-6 pt-2 border-t">
                <Button onClick={() => setIsHistoryOpen(false)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );

  function renderHistoryContent() {
    if (historyLoading) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          Carregando histórico...
        </div>
      );
    }

    if (atendimentosCliente.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum atendimento registrado para este cliente.
        </div>
      );
    }

    return (
      <div className="space-y-4 py-4">
        {atendimentosCliente.map((atendimento) => (
          <Card 
            key={atendimento.id} 
            className="overflow-hidden border-l-4 border-l-primary/40 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => {
              setEditingAtendimento(atendimento);
              setSelectedColaborador(atendimento.colaborador.id);
              setSelectedDatePart(format(parseISO(atendimento.data), "yyyy-MM-dd"));
              setSelectedTimePart(format(parseISO(atendimento.data), "HH:mm"));
              setSelectedServicos(atendimento.servicos.map(s => s.id));
              setValorFinal(atendimento.valor.toString());
              setStatusAtendimento(atendimento.status);
              fetchColabServicos(atendimento.colaborador.id);
              if (atendimento.status === 'Agendado') {
                setIsScheduleDialogOpen(true);
              } else {
                setIsEditAtendimentoOpen(true);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(parseISO(atendimento.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    Profissional: {atendimento.colaborador.nome}
                  </div>
                </div>
                <Badge 
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-2 py-0",
                    atendimento.status === 'Agendado' && "bg-blue-100 text-blue-700",
                    atendimento.status === 'Finalizado' && "bg-green-100 text-green-700",
                    atendimento.status === 'Não compareceu' && "bg-red-100 text-red-700"
                  )}
                >
                  {atendimento.status === 'Agendado' && <Clock className="w-3 h-3 mr-1" />}
                  {atendimento.status === 'Finalizado' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {atendimento.status === 'Não compareceu' && <XCircle className="w-3 h-3 mr-1" />}
                  {atendimento.status}
                </Badge>
              </div>
              
              <div className="bg-muted/30 rounded-md p-2.5 space-y-2">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Scissors className="w-3 h-3" />
                  Serviços
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {atendimento.servicos.map((s, idx) => (
                    <span key={idx} className="text-xs bg-background border rounded px-2 py-0.5">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex justify-between items-center gap-4">
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatusAtendimento(atendimento.id, 'Agendado')}>
                        <Clock className="w-4 h-4 mr-2" /> Agendado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatusAtendimento(atendimento.id, 'Finalizado')}>
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatusAtendimento(atendimento.id, 'Não compareceu')}>
                        <XCircle className="w-4 h-4 mr-2" /> Não compareceu
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteAtendimento(atendimento.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Clique para editar
                  </span>
                </div>
                <span className="text-sm font-bold text-primary whitespace-nowrap">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atendimento.valor)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
}
