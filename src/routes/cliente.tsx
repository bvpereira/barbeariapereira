import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookingButton } from "@/components/BookingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Scissors, User, LogOut, Trash2, Edit2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { triggerWebhook } from "@/lib/webhook";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente" as any)({
  component: ClientePage,
});

function ClientePage() {
  const [user, setUser] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgendamentos = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servicos(id, name))
      `)
      .eq('cliente_id', userId)
      .eq('status', 'Agendado')
      .order('data', { ascending: true });
    
    setAgendamentos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchAgendamentos(parsedUser.id);
    }
  }, [fetchAgendamentos]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const handleDelete = async (item: any) => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    
    try {
      const { error } = await supabase
        .from('atendimentos')
        .delete()
        .eq('id', item.id);
      
      if (error) throw error;
      
      // Trigger Webhook
      triggerWebhook("Exclusao", {
        tipo: "Exclusao",
        cliente: user.nome,
        colaborador: item.colaborador?.nome || "",
        data: format(parseISO(item.data), "dd/MM/yyyy"),
        horario: format(parseISO(item.data), "HH:mm"),
        servicos: item.atendimento_servicos.map((s: any) => s.servicos?.name)
      });
      
      toast.success("Agendamento cancelado com sucesso");
      fetchAgendamentos(user.id);
    } catch (error: any) {
      toast.error("Erro ao cancelar: " + error.message);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary">Olá, {user.nome}!</h1>
            <p className="text-muted-foreground">Bem-vindo à sua área de cliente</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="md:col-span-2 bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Novo Agendamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Agende seu próximo horário com facilidade.</p>
              <BookingButton 
                fixedClientId={user.id} 
                onSuccess={() => fetchAgendamentos(user.id)}
                className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                variant="default"
              />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Meus Próximos Horários
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-4 text-muted-foreground">Carregando...</p>
              ) : agendamentos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  Você não tem agendamentos pendentes.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {agendamentos.map((item) => (
                    <Card key={item.id} className="bg-card hover:bg-accent/5 transition-colors border-border">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Agendado
                          </Badge>
                          <span className="font-bold text-primary">
                            R$ {Number(item.valor).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(parseISO(item.data), "dd 'de' MMMM", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(parseISO(item.data), "HH:mm")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>Profissional: {item.colaborador?.nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Scissors className="w-4 h-4 text-muted-foreground" />
                            <span className="line-clamp-1">
                              {item.atendimento_servicos.map((s: any) => s.servicos?.name).join(", ")}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <BookingButton 
                            label="Remarcar"
                            variant="outline"
                            className="flex-1 h-8 text-xs gap-1"
                            icon={<Edit2 className="w-3 h-3" />}
                            initialData={{
                              id: item.id,
                              data: item.data,
                              cliente_id: user.id,
                              cliente_nome: user.nome,
                              colaborador_id: item.colaborador_id,
                              valor: item.valor,
                              servicos_ids: item.atendimento_servicos.map((as: any) => as.servicos?.id).filter(Boolean)
                            }}
                            onSuccess={() => fetchAgendamentos(user.id)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 h-8 text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/20"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Cancelar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
