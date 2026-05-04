import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookingButton } from "@/components/BookingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Scissors, User, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/colaborador" as any)({
  component: ColaboradorPage,
});

function ColaboradorPage() {
  const [user, setUser] = useState<any>(null);
  const [colabId, setColabId] = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchColaboradorId = async (login: string) => {
    const { data } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('login', login)
      .maybeSingle();
    
    if (data) {
      setColabId(data.id);
      return data.id;
    }
    return null;
  };

  const fetchAgendamentos = useCallback(async (cId: string) => {
    setLoading(true);
    const today = startOfDay(new Date());
    const tonight = endOfDay(new Date());

    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(nome),
        atendimento_servicos(servicos(name))
      `)
      .eq('colaborador_id', cId)
      .gte('data', today.toISOString())
      .lte('data', tonight.toISOString())
      .order('data', { ascending: true });
    
    setAgendamentos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchColaboradorId(parsedUser.login).then(id => {
        if (id) fetchAgendamentos(id);
      });
    }
  }, [fetchAgendamentos]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  if (!user) return null;

  if (!colabId && !loading) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
        <CardContent className="p-6 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-destructive">Perfil não encontrado</h2>
          <p className="text-muted-foreground text-sm">
            Seu usuário não está vinculado a um perfil de colaborador ativo. 
            Entre em contato com o administrador.
          </p>
          <Button variant="outline" onClick={handleLogout} className="w-full">Sair</Button>
        </CardContent>
      </Card>
    </div>
  );

  if (loading && !colabId) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary">Olá, {user.nome}!</h1>
            <p className="text-muted-foreground">Área do Profissional</p>
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
              <p className="mb-4 text-muted-foreground">Agende um novo serviço para um cliente.</p>
              <BookingButton 
                fixedColaboradorId={colabId!} 
                onSuccess={() => fetchAgendamentos(colabId!)}
                className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                variant="default"
              />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Agenda de Hoje
              </CardTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {agendamentos.length} atendimentos
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-4 text-muted-foreground">Carregando...</p>
              ) : agendamentos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  Nenhum atendimento agendado para hoje.
                </p>
              ) : (
                <div className="space-y-4">
                  {agendamentos.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                      <div className="flex-shrink-0 w-16 text-center">
                        <span className="text-lg font-bold block">{format(parseISO(item.data), "HH:mm")}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Hoje</span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold truncate">{item.cliente?.nome}</span>
                          {item.status === 'Finalizado' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          ) : item.status === 'Agendado' ? (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-destructive" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.atendimento_servicos.map((s: any) => s.servicos?.name).join(", ")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-bold text-sm block">R$ {Number(item.valor).toFixed(2).replace(".", ",")}</span>
                        <Badge variant="outline" className="text-[10px] h-auto font-normal">
                          {item.status}
                        </Badge>
                      </div>
                    </div>
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
