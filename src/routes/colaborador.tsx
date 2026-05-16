import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookingButton } from "@/components/BookingButton";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Scissors, User, LogOut, CheckCircle2, AlertTriangle, Search, History, ChevronDown } from "lucide-react";
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
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 10;

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

  const fetchHistorico = useCallback(async (cId: string, pageNum: number, search: string, reset: boolean = false) => {
    setLoadingHistorico(true);
    
    let query = supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(nome),
        atendimento_servicos(servicos(name))
      `)
      .eq('colaborador_id', cId)
      .order('data', { ascending: false })
      .range(pageNum * itemsPerPage, (pageNum + 1) * itemsPerPage - 1);

    if (search) {
      // Filtrando pelo nome do cliente na tabela usuários através do relacionamento
      query = query.filter('cliente.nome', 'ilike', `%${search}%`);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Erro ao buscar histórico:", error);
    } else {
      if (reset) {
        setHistorico(data || []);
      } else {
        setHistorico(prev => [...prev, ...(data || [])]);
      }
      setHasMore((data || []).length === itemsPerPage);
    }
    setLoadingHistorico(false);
  }, []);

  useEffect(() => {
    if (colabId) {
      setPage(0);
      fetchHistorico(colabId, 0, searchTerm, true);
    }
  }, [searchTerm, colabId, fetchHistorico]);

  useEffect(() => {
    const getUserData = () => {
      const stored = localStorage.getItem("user");
      if (stored) return stored;

      const cookies = document.cookie.split(';');
      const userCookie = cookies.find(c => c.trim().startsWith('user='));
      if (userCookie) {
        const value = decodeURIComponent(userCookie.split('=')[1]);
        localStorage.setItem("user", value);
        return value;
      }
      return null;
    };

    const userData = getUserData();
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
    document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
            <div>
              <h1 className="text-3xl font-bold text-primary">Olá, {user.nome}!</h1>
              <p className="text-muted-foreground">Área do Profissional</p>
            </div>
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Meus Atendimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome do cliente..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                {historico.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="flex-shrink-0 w-16 text-center">
                      <span className="text-lg font-bold block">{format(parseISO(item.data), "HH:mm")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {format(parseISO(item.data), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{item.cliente?.nome}</span>
                        <Badge variant="outline" className="text-[10px] h-auto py-0 font-normal">
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.atendimento_servicos?.map((s: any) => s.servicos?.name).join(", ") || item.servicos_atendimento}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-bold text-sm block">R$ {Number(item.valor).toFixed(2).replace(".", ",")}</span>
                      <span className="text-[10px] text-green-600 font-medium">
                        Comissão: R$ {Number(item.comissao || 0).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                ))}

                {loadingHistorico && page === 0 && (
                  <p className="text-center py-4 text-muted-foreground">Carregando histórico...</p>
                ) }

                {!loadingHistorico && historico.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    Nenhum atendimento encontrado.
                  </p>
                )}
              </div>
            </CardContent>
            {hasMore && (
              <CardFooter className="pt-0">
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchHistorico(colabId!, nextPage, searchTerm);
                  }}
                  disabled={loadingHistorico}
                >
                  {loadingHistorico ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Mostrar mais 10
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
