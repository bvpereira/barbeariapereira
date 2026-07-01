import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getClienteSubscriptionStatus, syncCheckoutSession } from "@/lib/stripe.functions";
import { BookingButton } from "@/components/BookingButton";
import { ClienteClubeView } from "@/components/ClienteClubeView";
import { CashbackCard } from "@/components/CashbackCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Calendar, Clock, Scissors, User, LogOut, Trash2, Edit2, Bell, Settings, Lock, Save, Image as ImageIcon, AlertTriangle, Package, Info, QrCode, Banknote, CreditCard } from "lucide-react";
import { AtendimentoDetailsDialog } from "@/components/AtendimentoDetailsDialog";
import { format, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { triggerWebhook } from "@/lib/webhook";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/cliente")({
  component: ClientePage,
});

function ClientePage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [detailsItem, setDetailsItem] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [loadingServicos, setLoadingServicos] = useState(true);
  const [loadingEquipe, setLoadingEquipe] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPromocaoEnabled, setIsPromocaoEnabled] = useState(true);
  const [isUpdatingPromocao, setIsUpdatingPromocao] = useState(false);
  const [newName, setNewName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [tempoExcluir, setTempoExcluir] = useState<number>(60);
  const [imagemBanner, setImagemBanner] = useState<string | null>(null);
  const [isBloqueado, setIsBloqueado] = useState(false);
  const [cashbackEconomizado, setCashbackEconomizado] = useState<number | null>(null);
  const [clubeSucessoOpen, setClubeSucessoOpen] = useState(false);
  const [clubeCanceladoOpen, setClubeCanceladoOpen] = useState(false);

  const fetchSubStatus = useServerFn(getClienteSubscriptionStatus);
  const syncSession = useServerFn(syncCheckoutSession);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const cleanParam = (...keys: string[]) => {
      keys.forEach((k) => params.delete(k));
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    };

    if (params.get("clube_sucesso") === "1") {
      const sessionId = params.get("session_id") || "default";
      const storageKey = `clube_sucesso_shown:${sessionId}`;
      if (!localStorage.getItem(storageKey) && tenant?.id && user?.id) {
        let cancelled = false;
        (async () => {
          // Webhook-independent: sync the Checkout Session directly from Stripe.
          if (sessionId && sessionId !== "default") {
            try {
              await syncSession({ data: { barbearia_id: tenant.id, cliente_id: user.id, session_id: sessionId } });
            } catch (e) {
              console.error("syncCheckoutSession failed", e);
            }
          }
          const activeStatuses = new Set(["active", "trialing"]);
          for (let i = 0; i < 6 && !cancelled; i++) {
            try {
              const res = await fetchSubStatus({
                data: { barbearia_id: tenant.id, cliente_id: user.id },
              });
              if (res?.status_stripe && activeStatuses.has(res.status_stripe)) {
                setClubeSucessoOpen(true);
                localStorage.setItem(storageKey, "1");
                cleanParam("clube_sucesso", "session_id");
                return;
              }
            } catch (e) {
              console.error("status check failed", e);
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
          if (!cancelled) {
            toast.info("Pagamento recebido. Estamos confirmando sua assinatura...");
            cleanParam("clube_sucesso", "session_id");
          }
        })();
        return () => {
          cancelled = true;
        };
      } else {
        cleanParam("clube_sucesso", "session_id");
      }
    } else if (params.get("clube_cancelado") === "1") {
      setClubeCanceladoOpen(true);
      cleanParam("clube_cancelado");
    }
  }, [tenant?.id, user?.id, fetchSubStatus, syncSession]);

  const conflitos = useMemo(() => {
    const items = agendamentos.map((a) => {
      const start = parseISO(a.data).getTime();
      const dur = (a.atendimento_servicos || []).reduce(
        (sum: number, s: any) => sum + (Number(s.servicos?.duration) || 0),
        0
      );
      return { id: a.id, colab: a.colaborador_id, start, end: start + dur * 60000 };
    });
    const conflicting = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.colab === b.colab) continue;
        if (a.start < b.end && b.start < a.end) {
          conflicting.add(a.id);
          conflicting.add(b.id);
        }
      }
    }
    return conflicting;
  }, [agendamentos]);




  useEffect(() => {
    if (!tenant?.id || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: info } = await supabase.from("informacoes")
        .select("cashback").eq("barbearia_id", tenant.id).maybeSingle();
      if (cancelled || !(info as any)?.cashback) return;
      const { data } = await supabase.rpc("fn_cashback_saldo", {
        p_barbearia_id: tenant.id, p_cliente_id: user.id,
      });
      if (cancelled) return;
      setCashbackEconomizado(Number((data as any)?.total_economizado || 0));
    })();
    return () => { cancelled = true; };
  }, [tenant?.id, user?.id]);


  const fetchAgendamentos = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servicos(id, name, duration))
      `)
      .eq('cliente_id', userId)
      .eq('status', 'Agendado')
      .order('data', { ascending: true });
    
    setAgendamentos(data || []);
    setLoading(false);
  }, []);

  const fetchHistorico = useCallback(async (userId: string) => {
    setLoadingHistorico(true);
    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servicos(id, name, price)),
        atendimento_produtos(id, nome_produto, quantidade, valor_unitario)
      `)
      .eq('cliente_id', userId)
      .in('status', ['Finalizado', 'Não compareceu'])
      .order('data', { ascending: false });

    const formatted = (data || []).map((item: any) => ({
      ...item,
      servicos: (item.atendimento_servicos || []).map((as: any) => as.servicos).filter(Boolean),
      produtos: item.atendimento_produtos || [],
    }));
    setHistorico(formatted);
    setLoadingHistorico(false);
  }, []);

  const fetchServicos = useCallback(async (tenantId: string) => {
    setLoadingServicos(true);
    const { data } = await supabase
      .from('servicos')
      .select('*')
      .eq('barbearia_id', tenantId)
      .order('name', { ascending: true });
    
    setServicos(data || []);
    setLoadingServicos(false);
  }, []);

  const fetchEquipe = useCallback(async (tenantId: string) => {
    setLoadingEquipe(true);
    const { data } = await supabase
      .from('colaboradores')
      .select(`
        *,
        colaborador_servicos(
          servicos(name)
        )
      `)
      .eq('barbearia_id', tenantId)
      .eq('ativo', true)
      .order('nome', { ascending: true });
    
    setEquipe(data || []);
    setLoadingEquipe(false);
  }, []);

  const fetchUserPromocao = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('promocao, bloqueado')
      .eq('id', userId)
      .maybeSingle();
    
    if (!error && data) {
      setIsPromocaoEnabled(data.promocao === 'sim');
      setIsBloqueado(!!data.bloqueado);
    }
  }, []);

  const fetchTempoExcluir = useCallback(async () => {
    const { data } = await supabase
      .from('informacoes')
      .select('tempo_excluir')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setTempoExcluir(data.tempo_excluir ?? 60);
    }
  }, []);

  const fetchBanner = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from('promocao')
      .select('imagem_banner')
      .eq('barbearia_id', tenantId)
      .eq('numero_promo', 0)
      .maybeSingle();
    
    if (data) {
      setImagemBanner(data.imagem_banner);
    }
  }, []);

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

      if (!tenantLoading && tenant?.id && parsedUser.barbearia_id !== tenant.id) {
        toast.error("Acesso negado.");
        navigate({ to: "/" });
        return;
      }

      setUser(parsedUser);
      setNewName(parsedUser.nome);
      setNewEmail(parsedUser.email_usuario || "");
      fetchAgendamentos(parsedUser.id);
      fetchHistorico(parsedUser.id);
      fetchUserPromocao(parsedUser.id);
      fetchTempoExcluir();
      if (tenant?.id) {
        fetchServicos(tenant.id);
        fetchEquipe(tenant.id);
        fetchBanner(tenant.id);
      }
    }
  }, [fetchAgendamentos, fetchHistorico, fetchUserPromocao, fetchTempoExcluir, fetchServicos, fetchEquipe, fetchBanner, tenant, tenantLoading, navigate]);

  const handlePromocaoToggle = async (checked: boolean) => {
    if (!user) return;
    
    setIsUpdatingPromocao(true);
    const newValue = checked ? 'sim' : 'não';
    
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ promocao: newValue })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setIsPromocaoEnabled(checked);
      
      // Atualiza o localStorage também para manter consistência
      const updatedUser = { ...user, promocao: newValue };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      toast.success(checked ? "Promoções ativadas" : "Promoções desativadas");
    } catch (error: any) {
      toast.error("Erro ao atualizar preferência: " + error.message);
    } finally {
      setIsUpdatingPromocao(false);
    }
  };

  const handleUpdateName = async () => {
    if (!user || !newName.trim()) return;
    
    setIsUpdatingName(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ nome: newName })
        .eq('id', user.id);
        
      if (error) throw error;
      
      const updatedUser = { ...user, nome: newName };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success("Nome atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao atualizar nome: " + error.message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user) return;
    const email = newEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    setIsUpdatingEmail(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update({ email_usuario: email || null })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      const updatedUser = { ...user, ...data, email_usuario: data?.email_usuario ?? (email || null) };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setNewEmail(updatedUser.email_usuario || "");
      toast.success("E-mail atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao atualizar e-mail: " + error.message);
    } finally {
      setIsUpdatingEmail(false);
    }
  };


  const handleChangePassword = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As novas senhas não coincidem");
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      // Primeiro verifica a senha atual
      const { data, error: checkError } = await supabase
        .from('usuarios')
        .select('senha')
        .eq('id', user.id)
        .maybeSingle();
        
      if (checkError) throw checkError;
      if (data?.senha !== currentPassword) {
        toast.error("Senha atual incorreta");
        setIsUpdatingPassword(false);
        return;
      }
      
      // Atualiza para a nova senha
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ senha: newPassword })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      toast.success("Senha alterada com sucesso");
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error("Erro ao alterar senha: " + error.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem("user");
    document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      const { error } = await supabase
        .from('atendimentos')
        .delete()
        .eq('id', itemToDelete.id);
      
      if (error) throw error;
      
      // Trigger Webhook
      const { data: colabData } = await supabase.from('colaboradores').select('login').eq('id', itemToDelete.colaborador_id).maybeSingle();
      const formattedTel = colabData?.login ? colabData.login.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : (colabData?.login || "");

      triggerWebhook("Exclusao", {
        tipo: "Exclusao",
        barbearia_id: user.barbearia_id,
        cliente: user.nome,
        login_cliente: user.login,
        colaborador: itemToDelete.colaborador?.nome || "",
        tel_colaborador: formattedTel,
        data: format(parseISO(itemToDelete.data), "dd/MM/yyyy"),
        horario: format(parseISO(itemToDelete.data), "HH:mm"),
        servicos: itemToDelete.atendimento_servicos.map((s: any) => s.servicos?.name)
      });
      
      toast.success("Agendamento cancelado com sucesso");
      fetchAgendamentos(user.id);
      fetchHistorico(user.id);
    } catch (error: any) {
      toast.error("Erro ao cancelar: " + error.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const confirmDelete = (item: any) => {
    const now = new Date();
    const appointmentDate = parseISO(item.data);
    const minAllowedToDelete = addMinutes(now, tempoExcluir);

    if (appointmentDate < minAllowedToDelete) {
      toast.error(`Não é possível cancelar agendamentos com menos de ${tempoExcluir} minutos de antecedência.`);
      return;
    }

    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
            <div>
              <h1 className="text-3xl font-bold text-primary">Olá, {user.nome}!</h1>
              <p className="text-muted-foreground">Bem-vindo à sua área de cliente</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Section 0: Banner Promocional */}
          {imagemBanner && (
            <div className="md:col-span-2 rounded-xl overflow-hidden shadow-sm border border-border/50">
              <img 
                src={imagemBanner} 
                alt="Banner Promocional" 
                className="w-full h-auto block"
              />
            </div>
          )}

          {/* Section 1: Novo Agendamento ou Aviso de Bloqueio */}
          {isBloqueado ? (
            <Card className="md:col-span-2 bg-destructive/5 border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Lock className="w-5 h-5" />
                  Sua conta está bloqueada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  Sua conta está bloqueada e, por isso, você não consegue realizar agendamentos através do site no momento.
                </p>
                <p className="text-sm text-muted-foreground">
                  Se quiser saber o motivo ou achar que o bloqueio foi um engano, entre em contato com os responsáveis da barbearia através dos canais de contato disponíveis na página inicial.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/$slug", params: { slug: tenant?.slug ?? "" } })}
                >
                  Ir para a página inicial da barbearia
                </Button>
              </CardContent>
            </Card>
          ) : (
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
                  onSuccess={() => {
                    fetchAgendamentos(user.id);
                    fetchHistorico(user.id);
                  }}
                  className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                  variant="default"
                />
              </CardContent>
            </Card>
          )}

          {tenant?.id && (
            <ClienteClubeView barbeariaId={tenant.id} clienteId={user.id} />
          )}

          {tenant?.id && (
            <CashbackCard barbeariaId={tenant.id} clienteId={user.id} />
          )}



          {/* Section 2: Meus Próximos Horários */}
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
                <>
                  {conflitos.size > 0 && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        Atenção: você tem agendamentos com profissionais diferentes em horários que se sobrepõem. Verifique os itens destacados abaixo.
                      </span>
                    </div>
                  )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {agendamentos.map((item) => (
                    <Card key={item.id} className={`bg-card hover:bg-accent/5 transition-colors ${conflitos.has(item.id) ? "border-yellow-500/60" : "border-border"}`}>
                      <CardContent className="p-4">
                        {conflitos.has(item.id) && (
                          <div className="mb-3 flex items-center gap-2 rounded-md bg-yellow-500/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400">
                            <AlertTriangle className="w-3 h-3" />
                            Conflito de horário com outro agendamento
                          </div>
                        )}

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
                          {!isBloqueado && (
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
                                cupom_codigo: item.cupom_codigo,
                                servicos_ids: item.atendimento_servicos.map((as: any) => as.servicos?.id).filter(Boolean)
                              }}
                              onSuccess={() => {
                                fetchAgendamentos(user.id);
                                fetchHistorico(user.id);
                              }}
                            />
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 h-8 text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/20"
                            onClick={() => confirmDelete(item)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Cancelar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Section: Nossos Serviços */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                Nossos Serviços
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingServicos ? (
                <p className="text-center py-4 text-muted-foreground">Carregando...</p>
              ) : servicos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  Nenhum serviço cadastrado.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {servicos.map((servico) => (
                    <Card key={servico.id} className="bg-card hover:bg-accent/5 transition-colors border-border overflow-hidden">
                      <div className="flex h-full">
                        <div className="w-32 h-auto flex-shrink-0 bg-muted relative">
                          {servico.image_url ? (
                            <img 
                              src={servico.image_url} 
                              alt={servico.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Scissors className="w-8 h-8 text-muted-foreground/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-bold text-lg leading-tight">{servico.name}</h3>
                              <span className="font-bold text-primary whitespace-nowrap ml-2">
                                R$ {Number(servico.price).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {servico.detalhes || "Sem descrição disponível."}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {servico.duration} min
                              </span>
                              {servico.cashback_ativo && Number(servico.cashback_percentual) > 0 && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                  {Number(servico.cashback_percentual)}% cashback
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {(servico.image_url_2 || servico.image_url_3 || servico.image_url_4 || servico.image_url_5) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="mt-2 w-fit h-7 text-xs gap-1 self-end text-primary hover:text-primary hover:bg-primary/10">
                                  <ImageIcon className="w-3 h-3" />
                                  Ver Fotos
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-black/95 border-none">
                                <DialogHeader className="p-4 bg-background/50 backdrop-blur-sm absolute top-0 w-full z-10">
                                  <DialogTitle className="text-white">Fotos: {servico.name}</DialogTitle>
                                </DialogHeader>
                                <div className="flex items-center justify-center min-h-[400px]">
                                  <Carousel className="w-full max-w-md mx-auto">
                                    <CarouselContent>
                                      {[servico.image_url, servico.image_url_2, servico.image_url_3, servico.image_url_4, servico.image_url_5]
                                        .filter(Boolean)
                                        .map((url, idx) => (
                                          <CarouselItem key={idx}>
                                            <div className="aspect-square relative overflow-hidden flex items-center justify-center">
                                              <img 
                                                src={url} 
                                                alt={`${servico.name} - foto ${idx + 1}`}
                                                className="max-w-full max-h-full object-contain"
                                              />
                                            </div>
                                          </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="left-4 bg-white/20 hover:bg-white/40 border-none text-white" />
                                    <CarouselNext className="right-4 bg-white/20 hover:bg-white/40 border-none text-white" />
                                  </Carousel>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Nossa Equipe */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Nossa Equipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEquipe ? (
                <p className="text-center py-4 text-muted-foreground">Carregando...</p>
              ) : equipe.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  Nenhum colaborador disponível no momento.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {equipe.map((colab) => (
                    <Card key={colab.id} className="bg-card hover:bg-accent/5 transition-colors border-border overflow-hidden">
                      <div className="flex h-full">
                        <div className="w-32 h-auto flex-shrink-0 bg-muted relative">
                          {colab.foto_url ? (
                            <img 
                              src={colab.foto_url} 
                              alt={colab.nome} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-8 h-8 text-muted-foreground/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-lg leading-tight mb-1">{colab.nome}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {colab.resumo || "Profissional dedicado ao melhor atendimento."}
                            </p>
                            {colab.colaborador_servicos?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {colab.colaborador_servicos.slice(0, 3).map((cs: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-[10px] h-4 py-0 px-1">
                                    {cs.servicos?.name}
                                  </Badge>
                                ))}
                                {colab.colaborador_servicos.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">+{colab.colaborador_servicos.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {(colab.foto_url_2 || colab.foto_url_3 || colab.foto_url_4 || colab.foto_url_5 || colab.foto_url_6 || colab.foto_url_7) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="mt-2 w-fit h-7 text-xs gap-1 self-end text-primary hover:text-primary hover:bg-primary/10">
                                  <ImageIcon className="w-3 h-3" />
                                  Portfólio
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-black/95 border-none">
                                <DialogHeader className="p-4 bg-background/50 backdrop-blur-sm absolute top-0 w-full z-10">
                                  <DialogTitle className="text-white">Portfólio: {colab.nome}</DialogTitle>
                                </DialogHeader>
                                <div className="flex items-center justify-center min-h-[400px]">
                                  <Carousel className="w-full max-w-md mx-auto">
                                    <CarouselContent>
                                      {[colab.foto_url, colab.foto_url_2, colab.foto_url_3, colab.foto_url_4, colab.foto_url_5, colab.foto_url_6, colab.foto_url_7]
                                        .filter(Boolean)
                                        .map((url, idx) => (
                                          <CarouselItem key={idx}>
                                            <div className="aspect-square relative overflow-hidden flex items-center justify-center">
                                              <img 
                                                src={url} 
                                                alt={`${colab.nome} - portfólio ${idx + 1}`}
                                                className="max-w-full max-h-full object-contain"
                                              />
                                            </div>
                                          </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="left-4 bg-white/20 hover:bg-white/40 border-none text-white" />
                                    <CarouselNext className="right-4 bg-white/20 hover:bg-white/40 border-none text-white" />
                                  </Carousel>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Histórico */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Histórico
              </CardTitle>
              {cashbackEconomizado != null && cashbackEconomizado > 0 && (
                <p className="text-sm text-primary mt-1">
                  Você já economizou R$ {cashbackEconomizado.toFixed(2).replace(".", ",")} usando cashback
                </p>
              )}
            </CardHeader>
            <CardContent>
              {loadingHistorico ? (
                <p className="text-center py-4 text-muted-foreground">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  Você ainda não possui histórico de atendimentos.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {historico.map((item) => (
                    <Card key={item.id} className="bg-card hover:bg-accent/5 transition-colors border-border opacity-80">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <Badge 
                            variant="outline" 
                            className={
                              item.status === 'Finalizado' 
                                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            }
                          >
                            {item.status}
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Preferências de Comunicação (Penultimate) */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Preferências de Comunicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="promocoes" className="text-base font-semibold">Promoções</Label>
                  <p className="text-sm text-muted-foreground">
                    Aceito receber promoções e novidades no meu WhatsApp.
                  </p>
                </div>
                <Switch
                  id="promocoes"
                  checked={isPromocaoEnabled}
                  onCheckedChange={handlePromocaoToggle}
                  disabled={isUpdatingPromocao}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Informações da Conta (Last) */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Informações da Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="userName">Nome</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="userName" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <Button 
                      size="icon" 
                      onClick={handleUpdateName} 
                      disabled={isUpdatingName || newName === user.nome}
                      variant="secondary"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userLogin">Login (Telefone)</Label>
                  <Input 
                    id="userLogin" 
                    value={user.login.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")} 
                    disabled 
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="userEmail">E-mail</Label>
                  <div className="flex gap-2">
                    <Input
                      id="userEmail"
                      type="email"
                      placeholder="seu@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                    <Button
                      size="icon"
                      onClick={handleUpdateEmail}
                      disabled={isUpdatingEmail || newEmail === (user.email_usuario || "")}
                      variant="secondary"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Alterar Senha
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Alterar Minha Senha</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Senha Atual</Label>
                        <Input 
                          id="currentPassword" 
                          type="password" 
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">Nova Senha</Label>
                        <Input 
                          id="newPassword" 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                        <Input 
                          id="confirmPassword" 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsPasswordDialogOpen(false)}
                        disabled={isUpdatingPassword}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleChangePassword}
                        disabled={isUpdatingPassword}
                      >
                        {isUpdatingPassword ? "Salvando..." : "Salvar Nova Senha"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={clubeSucessoOpen} onOpenChange={setClubeSucessoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Obrigado pela confiança! 🎉</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Seu clube de assinatura já está <strong className="text-foreground">ativo e pronto para uso</strong>.</p>
            <p>Aproveite todos os benefícios e bom atendimento!</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setClubeSucessoOpen(false)} className="w-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clubeCanceladoOpen} onOpenChange={setClubeCanceladoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento cancelado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Seu pagamento foi cancelado e <strong className="text-foreground">nenhum valor foi cobrado</strong>.</p>
            <p>Você pode tentar novamente quando quiser pela sua área de cliente.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setClubeCanceladoOpen(false)} className="w-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
