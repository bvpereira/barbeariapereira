import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Lock, Save, Phone } from "lucide-react";

export const Route = createFileRoute("/minhaconta" as any)({
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Profile state
  const [nome, setNome] = useState("");
  const [telContato, setTelContato] = useState("");
  const [infoId, setInfoId] = useState<string | null>(null);
  
  // Password state
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate({ to: "/login" });
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setNome(parsedUser.nome || "");

    const fetchInformacoes = async () => {
      try {
        const { data, error } = await supabase
          .from("informacoes")
          .select("*")
          .eq("user_id", parsedUser.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setTelContato(data.tel_contato || "");
          setInfoId(data.id);
        }
      } catch (error) {
        console.error("Erro ao buscar informações:", error);
      }
    };

    fetchInformacoes();
  }, [navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome não pode estar vazio");
      return;
    }

    setLoading(true);
    try {
      // Update basic profile
      const { error: profileError } = await supabase
        .from("usuarios")
        .update({ nome })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update or insert tel_contato in informacoes table
      if (infoId) {
        const { error: infoError } = await supabase
          .from("informacoes")
          .update({ tel_contato: telContato })
          .eq("id", infoId);
        if (infoError) throw infoError;
      } else {
        const { data: newInfo, error: infoError } = await supabase
          .from("informacoes")
          .insert({ tel_contato: telContato, user_id: user.id })
          .select()
          .single();
        if (infoError) throw infoError;
        if (newInfo) setInfoId(newInfo.id);
      }

      // Update local storage
      const updatedUser = { ...user, nome };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      toast.success("Informações atualizadas com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao atualizar perfil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      toast.error("Preencha todos os campos de senha");
      return;
    }

    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      toast.error("A nova senha e a confirmação não coincidem");
      return;
    }

    setLoading(true);
    try {
      // Verificar se a senha atual está correta
      const { data: userData, error: fetchError } = await supabase
        .from("usuarios")
        .select("senha")
        .eq("id", user.id)
        .single();

      if (fetchError) throw fetchError;

      if (userData.senha !== senhaAtual) {
        toast.error("A senha atual está incorreta");
        setLoading(false);
        return;
      }

      // Atualizar para a nova senha
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ senha: novaSenha })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao alterar senha: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minha Conta</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança.</p>
        </div>

        <div className="grid gap-6">
          {/* Perfil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Dados do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telContato">Telefone de contato</Label>
                  <Input
                    id="telContato"
                    value={telContato}
                    onChange={(e) => setTelContato(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login">Telefone (Login)</Label>
                  <Input
                    id="login"
                    value={user?.login || ""}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">O telefone de acesso não pode ser alterado por aqui.</p>
                </div>
                <Button type="submit" disabled={loading} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <div className="py-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsChangingPassword(true)}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Alterar minha senha
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="senhaAtual">Senha Atual</Label>
                    <Input
                      id="senhaAtual"
                      type="password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="novaSenha">Nova Senha</Label>
                    <Input
                      id="novaSenha"
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmarNovaSenha">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmarNovaSenha"
                      type="password"
                      value={confirmarNovaSenha}
                      onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Processando..." : "Confirmar Nova Senha"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        setIsChangingPassword(false);
                        setSenhaAtual("");
                        setNovaSenha("");
                        setConfirmarNovaSenha("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
