import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookingButton } from "@/components/BookingButton";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Scissors, User, LogOut, CheckCircle2, AlertTriangle, Search, History, ChevronDown, Trash2, MoreVertical } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const Route = createFileRoute("/colaborador" as any)({
  component: ColaboradorPage,
});

function ColaboradorPage() {
  const [user, setUser] = useState<any>(null);
  const [colabId, setColabId] = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [futuros, setFuturos] = useState<any[]>([]);
  const [pedidosExclusao, setPedidosExclusao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loadingFuturos, setLoadingFuturos] = useState(false);
  const [loadingExclusao, setLoadingExclusao] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [pageFuturos, setPageFuturos] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreFuturos, setHasMoreFuturos] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
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
        atendimento_servicos(servicos(id, name))
      `)
      .eq('colaborador_id', cId)
      .gte('data', today.toISOString())
      .lte('data', tonight.toISOString())
      .order('data', { ascending: true });
    
    setAgendamentos(data || []);
    setLoading(false);
  }, []);

  const fetchFuturos = useCallback(async (cId: string, pageNum: number, reset: boolean = false) => {
    setLoadingFuturos(true);
    const tomorrow = endOfDay(new Date());

    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(nome),
        atendimento_servicos(servicos(id, name))
      `)
      .eq('colaborador_id', cId)
      .eq('status', 'Agendado')
      .gt('data', tomorrow.toISOString())
      .order('data', { ascending: true })
      .range(pageNum * itemsPerPage, (pageNum + 1) * itemsPerPage - 1);
    
    if (reset) {
      setFuturos(data || []);
    } else {
      setFuturos(prev => [...prev, ...(data || [])]);
    }
    setHasMoreFuturos((data || []).length === itemsPerPage);
    setLoadingFuturos(false);
  }, []);

  const fetchHistorico = useCallback(async (cId: string, pageNum: number, search: string, reset: boolean = false) => {
    setLoadingHistorico(true);
    
    let query = supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(nome),
        atendimento_servicos(servicos(id, name))
      `)
      .eq('colaborador_id', cId)
      .neq('status', 'Agendado')
      .order('data', { ascending: false })
      .range(pageNum * itemsPerPage, (pageNum + 1) * itemsPerPage - 1);

    if (search) {
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

  const fetchPedidosExclusao = useCallback(async (cId: string) => {
    setLoadingExclusao(true);
    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        cliente:usuarios!cliente_id(nome),
        atendimento_servicos(servicos(id, name))
      `)
      .eq('colaborador_id', cId)
      .eq('pedido_exclusao', true)
      .order('data', { ascending: false });
    
    setPedidosExclusao(data || []);
    setLoadingExclusao(false);
  }, []);

  useEffect(() => {
    if (colabId) {
      setPage(0);
      fetchHistorico(colabId, 0, searchTerm, true);
    }
  }, [searchTerm, colabId, fetchHistorico]);

  useEffect(() => {
    if (colabId) {
      setPageFuturos(0);
      fetchFuturos(colabId, 0, true);
    }
  }, [colabId, fetchFuturos]);

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
        if (id) {
          fetchAgendamentos(id);
          fetchPedidosExclusao(id);
          
          // Subscription for real-time updates
          const channel = supabase
            .channel('atendimentos_colab')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'atendimentos',
                filter: `colaborador_id=eq.${id}`
              },
              () => {
                fetchAgendamentos(id);
                fetchFuturos(id, 0, true);
                fetchHistorico(id, 0, searchTerm, true);
                fetchPedidosExclusao(id);
              }
            )
            .subscribe();

          return () => {
            supabase.removeChannel(channel);
          };
        }
      });
    }
  }, [fetchAgendamentos, fetchFuturos, fetchHistorico, fetchPedidosExclusao, searchTerm]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('atendimentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`Status atualizado para ${newStatus}`);
      if (colabId) {
        fetchAgendamentos(colabId);
        fetchFuturos(colabId, 0, true);
        fetchHistorico(colabId, 0, searchTerm, true);
      }
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleRequestDeletion = async () => {
    if (!itemToDelete) return;
    try {
      const { error } = await supabase
        .from('atendimentos')
        .update({ pedido_exclusao: true })
        .eq('id', itemToDelete);

      if (error) throw error;
      
      toast.success("Pedido de exclusão enviado ao administrador");
      setItemToDelete(null);
      if (colabId) {
        fetchAgendamentos(colabId);
        fetchFuturos(colabId, 0, true);
        fetchHistorico(colabId, 0, searchTerm, true);
      }
    } catch (error: any) {
      toast.error("Erro ao solicitar exclusão: " + error.message);
    }
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
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="font-bold text-sm block">R$ {Number(item.valor).toFixed(2).replace(".", ",")}</span>
                        <div className="flex items-center gap-1">
                          {item.status === 'Agendado' && Number(user?.nivel) <= 2 && (
                            <BookingButton 
                              onSuccess={() => fetchAgendamentos(colabId!)} 
                              variant="ghost" 
                              className="h-7 px-2 text-[10px]"
                              label="Editar"
                              icon={<Clock className="h-3 w-3" />}
                              initialData={{
                                id: item.id,
                                cliente_id: item.cliente_id,
                                cliente_nome: item.cliente?.nome,
                                colaborador_id: item.colaborador_id,
                                data: item.data,
                                valor: item.valor,
                                servicos_ids: item.atendimento_servicos.map((s: any) => s.servicos?.id)
                              }}
                            />
                          )}
                          <Badge variant="outline" className="text-[10px] h-auto font-normal">
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Atendimentos Futuros
              </CardTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {futuros.length} agendados
              </Badge>
            </CardHeader>
            <CardContent>
              {loadingFuturos && pageFuturos === 0 ? (
                <p className="text-center py-4 text-muted-foreground">Carregando...</p>
              ) : futuros.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  Nenhum atendimento futuro agendado.
                </p>
              ) : (
                <div className="space-y-4">
                  {futuros.map((item) => (
                    <div key={item.id} className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors ${item.pedido_exclusao ? 'opacity-50 grayscale' : ''}`}>
                      <div className="flex-shrink-0 w-16 text-center">
                        <span className="text-lg font-bold block">
                          {format(parseISO(item.data), "HH:mm")}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {format(parseISO(item.data), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold truncate">{item.cliente?.nome}</span>
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.atendimento_servicos.map((s: any) => s.servicos?.name).join(", ")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="font-bold text-sm block">R$ {Number(item.valor).toFixed(2).replace(".", ",")}</span>
                        <div className="flex items-center gap-1">
                          {item.status === 'Agendado' && !item.pedido_exclusao && (
                            <BookingButton 
                              onSuccess={() => fetchFuturos(colabId!, 0, true)} 
                              variant="ghost" 
                              className="h-7 px-2 text-[10px]"
                              label="Editar"
                              icon={<Clock className="h-3 w-3" />}
                              initialData={{
                                id: item.id,
                                cliente_id: item.cliente_id,
                                cliente_nome: item.cliente?.nome,
                                colaborador_id: item.colaborador_id,
                                data: item.data,
                                valor: item.valor,
                                servicos_ids: item.atendimento_servicos.map((s: any) => s.servicos?.id)
                              }}
                            />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={item.pedido_exclusao}>
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <Badge variant="outline" className="text-[10px] h-auto font-normal cursor-pointer hover:bg-accent">
                                  {item.status}
                                </Badge>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Agendado')}>
                                Agendado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Finalizado')}>
                                Finalizado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Não compareceu')}>
                                Não compareceu
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => setItemToDelete(item.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Pedir Exclusão
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {item.pedido_exclusao && (
                          <span className="text-[9px] text-destructive font-bold uppercase">Exclusão Solicitada</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {hasMoreFuturos && (
              <CardFooter className="pt-0">
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  onClick={() => {
                    const nextPage = pageFuturos + 1;
                    setPageFuturos(nextPage);
                    fetchFuturos(colabId!, nextPage);
                  }}
                  disabled={loadingFuturos}
                >
                  {loadingFuturos ? (
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Histórico de Atendimentos
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
                      <span className="text-lg font-bold block">
                        {format(parseISO(item.data), "dd/MM", { locale: ptBR })}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {format(parseISO(item.data), "HH:mm")}
                      </span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{item.cliente?.nome}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] h-auto py-0 font-normal ${
                            item.status === 'Finalizado' 
                              ? 'bg-green-100 text-green-700 border-green-200' 
                              : item.status === 'Não compareceu' 
                                ? 'bg-red-100 text-red-700 border-red-200' 
                                : ''
                          }`}
                        >
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

          {pedidosExclusao.length > 0 && (
            <Card className="md:col-span-2 border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Pedidos para Exclusão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pedidosExclusao.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 border border-destructive/20 rounded-lg bg-background/50">
                      <div className="flex-shrink-0 w-16 text-center">
                        <span className="text-lg font-bold block">
                          {format(parseISO(item.data), "dd/MM")}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {format(parseISO(item.data), "HH:mm")}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold truncate">{item.cliente?.nome}</span>
                          <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                            Aguardando Admin
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.atendimento_servicos?.map((s: any) => s.servicos?.name).join(", ")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-bold text-sm block text-destructive">
                          Exclusão Solicitada
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
