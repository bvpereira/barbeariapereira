import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Save, ChevronDown, ChevronUp, Copy, Check, Users, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/horarios")({
  component: HorariosPage,
});

interface DiaAgenda {
  id: string;
  data: string;
  ativo: boolean;
}

interface Collaborator {
  id: string;
  nome: string;
}

interface HorarioColaborador {
  id?: string;
  colaborador_id: string;
  data: string;
  manha_inicio: string | null;
  manha_fim: string | null;
  tarde_inicio: string | null;
  tarde_fim: string | null;
  ativo?: boolean | null;
}

function HorariosPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [dias, setDias] = useState<DiaAgenda[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [horariosColaboradores, setHorariosColaboradores] = useState<HorarioColaborador[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Global config (single, stored in informacoes table)
  const [globalConfig, setGlobalConfig] = useState<{
    manha_inicio: string;
    manha_fim: string;
    tarde_inicio: string;
    tarde_fim: string;
  }>({
    manha_inicio: "08:00",
    manha_fim: "12:00",
    tarde_inicio: "13:00",
    tarde_fim: "18:00",
  });
  const [savingGlobal, setSavingGlobal] = useState(false);

  

  useEffect(() => {
    if (tenantLoading || !tenant) return;
    
    const cleanupAndFetch = async () => {
      await cleanupOldDays();
      await fetchData();
    };
    cleanupAndFetch();
  }, [tenant, tenantLoading]);

  const cleanupOldDays = async () => {
    if (!tenant?.id) return;
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // We only delete from dias_agenda, which seems to be the controlling table for the UI
      // and won't affect the history of appointments (assuming they are in another table)
      const { error } = await supabase
        .from("dias_agenda")
        .delete()
        .eq("barbearia_id", tenant.id)
        .lt("data", today);

      if (error) console.error("Erro ao limpar dias antigos:", error);
    } catch (error) {
      console.error("Erro na limpeza de dias:", error);
    }
  };

  const fetchData = async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const { data: diasData, error: diasError } = await supabase
        .from("dias_agenda")
        .select("*")
        .eq("barbearia_id", tenant.id)
        .order("data", { ascending: true });

      if (diasError) throw diasError;
      setDias(diasData || []);

      const { data: colabsData, error: colabsError } = await supabase
        .from("colaboradores")
        .select("id, nome")
        .eq("barbearia_id", tenant.id)
        .order("nome");

      if (colabsError) throw colabsError;
      setCollaborators(colabsData || []);

      const { data: horariosData, error: horariosError } = await supabase
        .from("horarios_colaboradores")
        .select("*")
        .eq("barbearia_id", tenant.id);

      if (horariosError) throw horariosError;
      setHorariosColaboradores((horariosData as any) || []);

      // Load global config from informacoes
      const { data: infoData } = await supabase
        .from("informacoes")
        .select("manha_inicio, manha_fim, tarde_inicio, tarde_fim")
        .eq("barbearia_id", tenant.id)
        .maybeSingle();

      if (infoData) {
        setGlobalConfig({
          manha_inicio: (infoData as any).manha_inicio?.substring(0, 5) || "08:00",
          manha_fim: (infoData as any).manha_fim?.substring(0, 5) || "12:00",
          tarde_inicio: (infoData as any).tarde_inicio?.substring(0, 5) || "13:00",
          tarde_fim: (infoData as any).tarde_fim?.substring(0, 5) || "18:00",
        });
      }


    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addDay = async () => {
    if (!tenant) return;
    let nextDate = new Date();
    if (dias.length > 0) {
      const lastDay = parseISO(dias[dias.length - 1].data);
      nextDate = addDays(lastDay, 1);
    }

    const dateStr = format(nextDate, "yyyy-MM-dd");

    try {
      const { data, error } = await supabase
        .from("dias_agenda")
        .insert([{ barbearia_id: tenant.id, data: dateStr, ativo: true }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
           toast.error("Este dia já está cadastrado.");
           return;
        }
        throw error;
      }
      
      setDias([...dias, data]);
      setGlobalConfig({
        ...globalConfig,
        [dateStr]: {
          manha_inicio: "08:00",
          manha_fim: "12:00",
          tarde_inicio: "13:00",
          tarde_fim: "18:00"
        }
      });
      toast.success(`Dia ${format(nextDate, "dd/MM/yyyy")} adicionado.`);
    } catch (error: any) {
      toast.error("Erro ao adicionar dia: " + error.message);
    }
  };

  const toggleDayAtivo = async (id: string, currentAtivo: boolean) => {
    try {
      const { error } = await supabase
        .from("dias_agenda")
        .update({ ativo: !currentAtivo })
        .eq("id", id);

      if (error) throw error;
      setDias(dias.map(d => d.id === id ? { ...d, ativo: !currentAtivo } : d));
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const deleteLastDay = async () => {
    if (dias.length === 0) return;
    
    const lastDay = dias[dias.length - 1];

    try {
      const { error } = await supabase
        .from("dias_agenda")
        .delete()
        .eq("id", lastDay.id);

      if (error) throw error;

      setDias(dias.slice(0, -1));

      toast.success("Último dia excluído com sucesso.");
    } catch (error: any) {
      toast.error("Erro ao excluir dia: " + error.message);
    }
  };

  const updateGlobalField = (field: keyof typeof globalConfig, value: string) => {
    setGlobalConfig({ ...globalConfig, [field]: value });
  };

  const saveGlobalConfig = async () => {
    if (!tenant) return;
    setSavingGlobal(true);
    try {
      const { error } = await supabase
        .from("informacoes")
        .update({
          manha_inicio: globalConfig.manha_inicio,
          manha_fim: globalConfig.manha_fim,
          tarde_inicio: globalConfig.tarde_inicio,
          tarde_fim: globalConfig.tarde_fim,
        } as any)
        .eq("barbearia_id", tenant.id);
      if (error) throw error;
      toast.success("Configuração de horário global salva.");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSavingGlobal(false);
    }
  };

  const toggleCollaboratorSelection = async (date: string, colabId: string) => {
    if (!tenant) return;
    const existing = horariosColaboradores.find(h => h.colaborador_id === colabId && h.data === date);
    const newAtivo = existing ? !existing.ativo : true;
    
    const updatedData = {
      barbearia_id: tenant!.id,
      colaborador_id: colabId,
      data: date,
      ativo: newAtivo,
      ...(existing || {})
    };

    // Remove unneeded fields for upsert
    delete (updatedData as any).id;
    delete (updatedData as any).created_at;
    delete (updatedData as any).updated_at;
    
    // Ensure the new ativo state is set
    (updatedData as any).ativo = newAtivo;

    try {
      const { data, error } = await supabase
        .from("horarios_colaboradores")
        .upsert([updatedData], { onConflict: "colaborador_id, data" })
        .select()
        .single();

      if (error) throw error;

      if (existing) {
        setHorariosColaboradores(horariosColaboradores.map(h => 
          (h.colaborador_id === colabId && h.data === date) ? (data as any) : h
        ));
      } else {
        setHorariosColaboradores([...horariosColaboradores, data as any]);
      }
      
      toast.success(`${newAtivo ? "Colaborador ativado" : "Colaborador desativado"} para este dia.`);
    } catch (error: any) {
      toast.error("Erro ao atualizar status do colaborador: " + error.message);
    }
  };

  const applyGlobalConfig = async (date: string) => {
    if (!tenant) return;
    const selected = collaborators.filter(c => horariosColaboradores.find(h => h.colaborador_id === c.id && h.data === date)?.ativo).map(c => c.id);
    if (selected.length === 0) {
      toast.warning("Selecione ao menos um colaborador.");
      return;
    }

    const config = globalConfig;
    const newHorarios = [...horariosColaboradores];
    
    const updates = selected.map(colabId => {
      const existingIdx = newHorarios.findIndex(h => h.colaborador_id === colabId && h.data === date);
      const data = {
        barbearia_id: tenant!.id,
        colaborador_id: colabId,
        data: date,
        manha_inicio: config.manha_inicio,
        manha_fim: config.manha_fim,
        tarde_inicio: config.tarde_inicio,
        tarde_fim: config.tarde_fim,
        ativo: true
      };

      if (existingIdx >= 0) {
        newHorarios[existingIdx] = { ...newHorarios[existingIdx], ...data };
      } else {
        newHorarios.push(data);
      }
      return data;
    });

    try {
      const { error } = await supabase
        .from("horarios_colaboradores")
        .upsert(updates, { onConflict: "colaborador_id, data" });

      if (error) throw error;
      
      setHorariosColaboradores(newHorarios);
      toast.success("Horário global aplicado aos selecionados.");
    } catch (error: any) {
      toast.error("Erro ao aplicar horário: " + error.message);
    }
  };

  const updateIndividualHorario = async (colabId: string, date: string, field: string, value: string) => {
    if (!tenant) return;
    const existing = horariosColaboradores.find(h => h.colaborador_id === colabId && h.data === date);
    const updatedData = {
      barbearia_id: tenant!.id,
      colaborador_id: colabId,
      data: date,
      ...(existing || {}),
      [field]: value
    };

    try {
      const { data, error } = await supabase
        .from("horarios_colaboradores")
        .upsert([updatedData], { onConflict: "colaborador_id, data" })
        .select()
        .single();

      if (error) throw error;

      if (existing) {
        setHorariosColaboradores(horariosColaboradores.map(h => 
          (h.colaborador_id === colabId && h.data === date) ? data : h
        ));
      } else {
        setHorariosColaboradores([...horariosColaboradores, data]);
      }
    } catch (error: any) {
      toast.error("Erro ao atualizar horário: " + error.message);
    }
  };

  const lastDate = dias.length > 0 ? dias[dias.length - 1].data : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Horários</h1>
            <p className="text-muted-foreground">
              Configure a disponibilidade da barbearia e dos colaboradores.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {dias.length > 0 && (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-destructive border-destructive hover:bg-destructive/10 w-full sm:w-auto">
                    <Trash2 className="w-4 h-4" />
                    Excluir último dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o dia <strong>{format(parseISO(dias[dias.length - 1].data), "dd/MM/yyyy")}</strong>? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={deleteLastDay}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={addDay} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Adicionar dia
            </Button>
          </div>
        </div>

        {lastDate && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-medium">
              Agenda aberta até: {format(parseISO(lastDate), "dd/MM/yyyy")}
            </span>
          </div>
        )}

        <div className="grid gap-4">
          {dias.map((dia) => (
            <Card key={dia.id} className={!dia.ativo ? "opacity-60" : ""}>
              <CardHeader className="p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                <div 
                  className="flex items-center gap-3 md:gap-4 cursor-pointer w-full sm:flex-1"
                  onClick={() => setExpandedDay(expandedDay === dia.id ? null : dia.id)}
                >
                  <div className="flex flex-col min-w-[80px] md:min-w-[100px]">
                    <span className="font-bold text-base md:text-lg">
                      {format(parseISO(dia.data), "dd/MM/yyyy")}
                    </span>
                    <span className="text-xs md:text-sm text-muted-foreground capitalize">
                      {format(parseISO(dia.data), "EEEE", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                    {collaborators.some(c => horariosColaboradores.find(h => h.colaborador_id === c.id && h.data === dia.data)?.ativo) ? (
                      collaborators
                        .filter(c => {
                          const h = horariosColaboradores.find(hc => hc.colaborador_id === c.id && hc.data === dia.data);
                          return h && h.ativo;
                        })
                        .map(c => {
                          const h = horariosColaboradores.find(hc => hc.colaborador_id === c.id && hc.data === dia.data);
                          return (
                            <div key={c.id} className="text-[9px] md:text-[10px] bg-secondary/30 px-1.5 py-0.5 rounded border border-secondary/50 flex items-center gap-1">
                              <span className="font-bold whitespace-nowrap">{c.nome}:</span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {h?.manha_inicio && h?.manha_fim ? `${h.manha_inicio.substring(0, 5)}-${h.manha_fim.substring(0, 5)}` : ""}
                                {(h?.manha_inicio && h.tarde_inicio) ? " | " : ""}
                                {h?.tarde_inicio && h?.tarde_fim ? `${h.tarde_inicio.substring(0, 5)}-${h.tarde_fim.substring(0, 5)}` : ""}
                              </span>
                            </div>
                          );
                        })
                    ) : (
                      dia.ativo && (
                        <div className="text-[9px] md:text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded border border-destructive/20 font-bold whitespace-nowrap">
                          Nenhum colaborador ativo
                        </div>
                      )
                    )}
                  </div>

                  {expandedDay === dia.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center bg-muted/20 px-2 py-1 rounded-md">
                  <Label htmlFor={`ativo-${dia.id}`} className="text-sm">
                    {dia.ativo ? "Ativo" : "Inativo"}
                  </Label>
                  <Switch 
                    id={`ativo-${dia.id}`}
                    checked={dia.ativo}
                    onCheckedChange={() => toggleDayAtivo(dia.id, dia.ativo)}
                  />
                </div>
              </CardHeader>

              {expandedDay === dia.id && dia.ativo && (
                <CardContent className="p-4 pt-0 space-y-6 animate-in fade-in slide-in-from-top-2">
                  <Separator />
                  
                  {/* Global Config Section */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Configuração de Horário Global
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-xs uppercase text-muted-foreground">Turno da Manhã</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="time" 
                            value={globalConfig[dia.data]?.manha_inicio || ""} 
                            onChange={(e) => updateGlobalField(dia.data, "manha_inicio", e.target.value)}
                          />
                          <span>às</span>
                          <Input 
                            type="time" 
                            value={globalConfig[dia.data]?.manha_fim || ""} 
                            onChange={(e) => updateGlobalField(dia.data, "manha_fim", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs uppercase text-muted-foreground">Turno da Tarde</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="time" 
                            value={globalConfig[dia.data]?.tarde_inicio || ""} 
                            onChange={(e) => updateGlobalField(dia.data, "tarde_inicio", e.target.value)}
                          />
                          <span>às</span>
                          <Input 
                            type="time" 
                            value={globalConfig[dia.data]?.tarde_fim || ""} 
                            onChange={(e) => updateGlobalField(dia.data, "tarde_fim", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collaborators List */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Horários dos Colaboradores
                      </h3>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => applyGlobalConfig(dia.data)}
                      >
                        <Copy className="w-4 h-4" />
                        Aplicar horário global
                      </Button>
                    </div>

                    {/* Desktop View Table */}
                    <div className="hidden md:block border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left w-10">
                              <Checkbox 
                                checked={collaborators.every(c => horariosColaboradores.find(h => h.colaborador_id === c.id && h.data === dia.data)?.ativo) && collaborators.length > 0}
                                onCheckedChange={async (checked) => {
                                  const updates = collaborators.map(c => ({
                                    barbearia_id: tenant!.id,
                                    colaborador_id: c.id,
                                    data: dia.data,
                                    ativo: !!checked
                                  }));

                                  try {
                                    const { data, error } = await supabase
                                      .from("horarios_colaboradores")
                                      .upsert(updates, { onConflict: "colaborador_id, data" })
                                      .select();

                                    if (error) throw error;
                                    
                                    const newHorarios = [...horariosColaboradores];
                                    (data as any[]).forEach(updated => {
                                      const idx = newHorarios.findIndex(h => h.colaborador_id === updated.colaborador_id && h.data === updated.data);
                                      if (idx >= 0) {
                                        newHorarios[idx] = updated;
                                      } else {
                                        newHorarios.push(updated);
                                      }
                                    });
                                    setHorariosColaboradores(newHorarios);
                                    toast.success(checked ? "Todos ativados" : "Todos desativados");
                                  } catch (error: any) {
                                    toast.error("Erro ao atualizar colaboradores: " + error.message);
                                  }
                                }}
                              />
                            </th>
                            <th className="p-3 text-left">Colaborador</th>
                            <th className="p-3 text-left">Manhã</th>
                            <th className="p-3 text-left">Tarde</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {collaborators.map((colab) => {
                            const horario = horariosColaboradores.find(h => h.colaborador_id === colab.id && h.data === dia.data);
                            const isSelected = !!horario?.ativo;
                            
                            return (
                              <tr key={colab.id} className={isSelected ? "bg-primary/5" : ""}>
                                <td className="p-3">
                                  <Checkbox 
                                    checked={isSelected}
                                    onCheckedChange={() => toggleCollaboratorSelection(dia.data, colab.id)}
                                  />
                                </td>
                                <td className="p-3 font-medium">{colab.nome}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1">
                                    <Input 
                                      type="time" 
                                      className="h-8 w-24 text-xs"
                                      value={horario?.manha_inicio || ""}
                                      onChange={(e) => updateIndividualHorario(colab.id, dia.data, "manha_inicio", e.target.value)}
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input 
                                      type="time" 
                                      className="h-8 w-24 text-xs"
                                      value={horario?.manha_fim || ""}
                                      onChange={(e) => updateIndividualHorario(colab.id, dia.data, "manha_fim", e.target.value)}
                                    />
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1">
                                    <Input 
                                      type="time" 
                                      className="h-8 w-24 text-xs"
                                      value={horario?.tarde_inicio || ""}
                                      onChange={(e) => updateIndividualHorario(colab.id, dia.data, "tarde_inicio", e.target.value)}
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input 
                                      type="time" 
                                      className="h-8 w-24 text-xs"
                                      value={horario?.tarde_fim || ""}
                                      onChange={(e) => updateIndividualHorario(colab.id, dia.data, "tarde_fim", e.target.value)}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-center gap-2 px-1 pb-1 border-b">
                        <Checkbox 
                          id={`select-all-${dia.id}`}
                          checked={collaborators.every(c => horariosColaboradores.find(h => h.colaborador_id === c.id && h.data === dia.data)?.ativo) && collaborators.length > 0}
                          onCheckedChange={async (checked) => {
                            const updates = collaborators.map(c => ({
                              barbearia_id: tenant!.id,
                              colaborador_id: c.id,
                              data: dia.data,
                              ativo: !!checked
                            }));

                            try {
                              const { data, error } = await supabase
                                .from("horarios_colaboradores")
                                .upsert(updates, { onConflict: "colaborador_id, data" })
                                .select();

                              if (error) throw error;
                              
                              const newHorarios = [...horariosColaboradores];
                              (data as any[]).forEach(updated => {
                                const idx = newHorarios.findIndex(h => h.colaborador_id === updated.colaborador_id && h.data === updated.data);
                                if (idx >= 0) {
                                  newHorarios[idx] = updated;
                                } else {
                                  newHorarios.push(updated);
                                }
                              });
                              setHorariosColaboradores(newHorarios);
                              toast.success(checked ? "Todos ativados" : "Todos desativados");
                            } catch (error: any) {
                              toast.error("Erro ao atualizar colaboradores: " + error.message);
                            }
                          }}
                        />
                        <Label htmlFor={`select-all-${dia.id}`} className="text-xs font-bold uppercase">Selecionar Todos</Label>
                      </div>

                      {collaborators.map((colab) => {
                        const horario = horariosColaboradores.find(h => h.colaborador_id === colab.id && h.data === dia.data);
                        const isSelected = !!horario?.ativo;
                        
                        return (
                          <div key={colab.id} className={cn(
                            "p-3 border rounded-lg space-y-3 transition-colors",
                            isSelected ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  id={`colab-${colab.id}-${dia.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleCollaboratorSelection(dia.data, colab.id)}
                                />
                                <Label htmlFor={`colab-${colab.id}-${dia.id}`} className="font-bold">{colab.nome}</Label>
                              </div>
                              <Badge variant={isSelected ? "default" : "outline"} className="text-[10px] uppercase">
                                {isSelected ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-4">
                                <Label className="text-[10px] uppercase text-muted-foreground min-w-[40px]">Manhã</Label>
                                <div className="flex items-center gap-2 flex-1">
                                  <Input 
                                    type="time" 
                                    className="h-8 text-xs px-2 flex-1"
                                    value={horario?.manha_inicio || ""}
                                    onChange={(e) => updateIndividualHorario(colab.id, dia.data, "manha_inicio", e.target.value)}
                                  />
                                  <span className="text-muted-foreground text-xs">às</span>
                                  <Input 
                                    type="time" 
                                    className="h-8 text-xs px-2 flex-1"
                                    value={horario?.manha_fim || ""}
                                    onChange={(e) => updateIndividualHorario(colab.id, dia.data, "manha_fim", e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <Label className="text-[10px] uppercase text-muted-foreground min-w-[40px]">Tarde</Label>
                                <div className="flex items-center gap-2 flex-1">
                                  <Input 
                                    type="time" 
                                    className="h-8 text-xs px-2 flex-1"
                                    value={horario?.tarde_inicio || ""}
                                    onChange={(e) => updateIndividualHorario(colab.id, dia.data, "tarde_inicio", e.target.value)}
                                  />
                                  <span className="text-muted-foreground text-xs">às</span>
                                  <Input 
                                    type="time" 
                                    className="h-8 text-xs px-2 flex-1"
                                    value={horario?.tarde_fim || ""}
                                    onChange={(e) => updateIndividualHorario(colab.id, dia.data, "tarde_fim", e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {dias.length === 0 && !isLoading && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhum dia configurado</h3>
              <p className="text-muted-foreground mb-6">
                Comece adicionando o primeiro dia de atendimento.
              </p>
              <Button onClick={addDay} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar dia
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
