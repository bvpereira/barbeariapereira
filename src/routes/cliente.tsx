import { useState, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookingButton } from "@/components/BookingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Calendar, Clock, Scissors, User, LogOut, Trash2, Edit2, Bell, Settings, Lock, Save } from "lucide-react";
import { format, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { triggerWebhook } from "@/lib/webhook";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPromocaoEnabled, setIsPromocaoEnabled] = useState(true);
  const [isUpdatingPromocao, setIsUpdatingPromocao] = useState(false);
  const [newName, setNewName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [tempoExcluir, setTempoExcluir] = useState<number>(60);


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

  const fetchHistorico = useCallback(async (userId: string) => {
    setLoadingHistorico(true);
    const { data } = await supabase
      .from('atendimentos')
      .select(`
        *,
        colaborador:colaboradores(id, nome),
        atendimento_servicos(servicos(id, name))
      `)
      .eq('cliente_id', userId)
      .in('status', ['Finalizado', 'Não compareceu'])
      .order('data', { ascending: false });
    
    setHistorico(data || []);
    setLoadingHistorico(false);
  }, []);

  const fetchUserPromocao = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('promocao')
      .eq('id', userId)
      .maybeSingle();
    
    if (!error && data) {
      setIsPromocaoEnabled(data.promocao === 'sim');
    }
  }, []);

  const fetchTempoExcluir = useCallback(async () => {
    const { data } = await supabase
      .from('informacoes')
      .select('tempo_excluir')
      .eq('userrr', 'admin')
      .maybeSingle();
    
    if (data) {
      setTempoExcluir(data.tempo_excluir ?? 60);
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

      if (tenant?.id && parsedUser.barbearia_id !== tenant.id) {
        toast.error("Acesso negado.");
        navigate({ to: "/" });
        return;
      }

      setUser(parsedUser);
      setNewName(parsedUser.nome);
      fetchAgendamentos(parsedUser.id);
      fetchHistorico(parsedUser.id);
      fetchUserPromocao(parsedUser.id);
      fetchTempoExcluir();
    }
  }, [fetchAgendamentos, fetchHistorico, fetchUserPromocao, fetchTempoExcluir]);

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
          {/* Section 1: Novo Agendamento */}
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
                            onSuccess={() => {
                              fetchAgendamentos(user.id);
                              fetchHistorico(user.id);
                            }}
                          />
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
    </div>
  );
}
