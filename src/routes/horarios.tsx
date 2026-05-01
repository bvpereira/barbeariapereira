import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Save, ChevronDown, ChevronUp, Copy, Check, Users, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/horarios" as any)({
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
}

function HorariosPage() {
  const [dias, setDias] = useState<DiaAgenda[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [horariosColaboradores, setHorariosColaboradores] = useState<HorarioColaborador[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Global config states (per day, but transient)
  const [globalConfig, setGlobalConfig] = useState<{
    [date: string]: {
      manha_inicio: string;
      manha_fim: string;
      tarde_inicio: string;
      tarde_fim: string;
    };
  }>({});

  // Selection for batch application
  const [selectedCollaborators, setSelectedCollaborators] = useState<{ [date: string]: string[] }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: diasData, error: diasError } = await supabase
        .from("dias_agenda")
        .select("*")
        .order("data", { ascending: true });

      if (diasError) throw diasError;
      setDias(diasData || []);

      const { data: colabsData, error: colabsError } = await supabase
        .from("colaboradores")
        .select("id, nome")
        .order("nome");

      if (colabsError) throw colabsError;
      setCollaborators(colabsData || []);

      const { data: horariosData, error: horariosError } = await supabase
        .from("horarios_colaboradores")
        .select("*");

      if (horariosError) throw horariosError;
      setHorariosColaboradores(horariosData || []);

      // Initialize global config defaults
      const initialGlobal: any = {};
      diasData?.forEach(dia => {
        initialGlobal[dia.data] = {
          manha_inicio: "08:00",
          manha_fim: "12:00",
          tarde_inicio: "13:00",
          tarde_fim: "18:00"
        };
      });
      setGlobalConfig(initialGlobal);

    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addDay = async () => {
    let nextDate = new Date();
    if (dias.length > 0) {
      const lastDay = parseISO(dias[dias.length - 1].data);
      nextDate = addDays(lastDay, 1);
    }

    const dateStr = format(nextDate, "yyyy-MM-dd");

    try {
      const { data, error } = await supabase
        .from("dias_agenda")
        .insert([{ data: dateStr, ativo: true }])
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
    const confirm = window.confirm(`Tem certeza que deseja excluir o dia ${format(parseISO(lastDay.data), "dd/MM/yyyy")}?`);
    
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("dias_agenda")
        .delete()
        .eq("id", lastDay.id);

      if (error) throw error;

      setDias(dias.slice(0, -1));
      
      // Also remove from global config and selected collaborators
      const newGlobalConfig = { ...globalConfig };
      delete newGlobalConfig[lastDay.data];
      setGlobalConfig(newGlobalConfig);
      
      const newSelected = { ...selectedCollaborators };
      delete newSelected[lastDay.data];
      setSelectedCollaborators(newSelected);

      toast.success("Último dia excluído com sucesso.");
    } catch (error: any) {
      toast.error("Erro ao excluir dia: " + error.message);
    }
  };

  const updateGlobalField = (date: string, field: string, value: string) => {
    setGlobalConfig({
      ...globalConfig,
      [date]: {
        ...globalConfig[date],
        [field]: value
      }
    });
  };

  const toggleCollaboratorSelection = (date: string, colabId: string) => {
    const current = selectedCollaborators[date] || [];
    if (current.includes(colabId)) {
      setSelectedCollaborators({
        ...selectedCollaborators,
        [date]: current.filter(id => id !== colabId)
      });
    } else {
      setSelectedCollaborators({
        ...selectedCollaborators,
        [date]: [...current, colabId]
      });
    }
  };

  const applyGlobalConfig = async (date: string) => {
    const selected = selectedCollaborators[date] || [];
    if (selected.length === 0) {
      toast.warning("Selecione ao menos um colaborador.");
      return;
    }

    const config = globalConfig[date];
    const newHorarios = [...horariosColaboradores];
    
    const updates = selected.map(colabId => {
      const existingIdx = newHorarios.findIndex(h => h.colaborador_id === colabId && h.data === date);
      const data = {
        colaborador_id: colabId,
        data: date,
        manha_inicio: config.manha_inicio,
        manha_fim: config.manha_fim,
        tarde_inicio: config.tarde_inicio,
        tarde_fim: config.tarde_fim
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
    const existing = horariosColaboradores.find(h => h.colaborador_id === colabId && h.data === date);
    const updatedData = {
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
          <div className="flex gap-2 flex-wrap">
            {dias.length > 0 && (
              <Button onClick={deleteLastDay} variant="outline" className="gap-2 text-destructive border-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
                Excluir último dia
              </Button>
            )}
            <Button onClick={addDay} className="gap-2">
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
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div 
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => setExpandedDay(expandedDay === dia.id ? null : dia.id)}
                >
                  <div className="flex flex-col min-w-[100px]">
                    <span className="font-bold text-lg">
                      {format(parseISO(dia.data), "dd/MM/yyyy")}
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {format(parseISO(dia.data), "EEEE", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 flex-1">
                    {collaborators
                      .filter(c => {
                        const isSelected = selectedCollaborators[dia.data]?.includes(c.id);
                        const hasHorario = horariosColaboradores.some(h => h.colaborador_id === c.id && h.data === dia.data);
                        return isSelected && hasHorario;
                      })
                      .map(c => {
                        const h = horariosColaboradores.find(hc => hc.colaborador_id === c.id && hc.data === dia.data);
                        return (
                          <div key={c.id} className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded border border-secondary flex items-center gap-1">
                            <span className="font-bold whitespace-nowrap">{c.nome}:</span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {h?.manha_inicio && h?.manha_fim ? `${h.manha_inicio.substring(0, 5)}-${h.manha_fim.substring(0, 5)}` : ""}
                              {(h?.manha_inicio && h.tarde_inicio) ? " | " : ""}
                              {h?.tarde_inicio && h?.tarde_fim ? `${h.tarde_inicio.substring(0, 5)}-${h.tarde_fim.substring(0, 5)}` : ""}
                            </span>
                          </div>
                        );
                      })
                    }
                  </div>

                  {expandedDay === dia.id ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </div>
                <div className="flex items-center gap-2">
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
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Horários dos Colaboradores
                      </h3>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => applyGlobalConfig(dia.data)}
                      >
                        <Copy className="w-4 h-4" />
                        Aplicar horário global
                      </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left w-10">
                              <Checkbox 
                                checked={selectedCollaborators[dia.data]?.length === collaborators.length && collaborators.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCollaborators({
                                      ...selectedCollaborators,
                                      [dia.data]: collaborators.map(c => c.id)
                                    });
                                  } else {
                                    setSelectedCollaborators({
                                      ...selectedCollaborators,
                                      [dia.data]: []
                                    });
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
                            const isSelected = selectedCollaborators[dia.data]?.includes(colab.id);
                            
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
