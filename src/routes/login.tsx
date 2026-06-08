import { useState, useRef, useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/login")({
  component: Login,
});

const formatPhone = (value: string) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

function Login() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [recoveryLogin, setRecoveryLogin] = useState("");
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");
  const navigate = useNavigate();

  useEffect(() => {
    if (!tenant) return;
    const fetchLogo = async () => {
      const { data } = await supabase
        .from("informacoes" as any)
        .select("imagem_logo")
        .eq("barbearia_id", tenant.id)
        .maybeSingle();
      if (data && (data as any).imagem_logo) {
        setLogoUrl((data as any).imagem_logo);
      }
    };
    fetchLogo();
  }, [tenant]);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setLogin(formatted);
  };

  useEffect(() => {
    // Limpeza se necessário
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLogin = login.replace(/[^\d]/g, "");
    setIsLoading(true);

    try {
      // No login, sempre filtramos pela unidade (tenant) se ela estiver disponível
      let activeTenantId = tenant?.id;

      if (!activeTenantId) {
        // Se não houver tenant na URL, tentamos identificar pelo login
        // Mas o ideal é que o login sempre ocorra dentro do contexto de uma barbearia
        const { data: userBarbearia } = await supabase
          .from("usuarios")
          .select("barbearia_id")
          .eq("login", cleanLogin)
          .limit(2);
        
        if (userBarbearia && userBarbearia.length === 1) {
          activeTenantId = userBarbearia[0].barbearia_id;
        } else if (userBarbearia && userBarbearia.length > 1) {
          toast.error("Usuário encontrado em múltiplas unidades. Por favor, acesse pelo link da sua barbearia.");
          setIsLoading(false);
          return;
        } else {
          setAlertState({
            open: true,
            title: "Usuário não encontrado",
            description: "Este número de usuário não foi encontrado no nosso banco de dados."
          });
          setIsLoading(false);
          return;
        }
      }

      // Primeiro verifica se o usuário existe na unidade identificada
      const { data: userExists, error: checkError } = await supabase
        .from("usuarios")
        .select("login")
        .eq("login", cleanLogin)
        .eq("barbearia_id", activeTenantId)
        .maybeSingle();

      if (!userExists) {
        setAlertState({
          open: true,
          title: "Usuário não encontrado",
          description: "Este número de usuário não foi encontrado nesta unidade. Verifique se você está na página da barbearia correta."
        });
        setIsLoading(false);
        return;
      }

      // Se existe, tenta o login com a senha dentro da unidade correta
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("login", cleanLogin)
        .eq("senha", senha)
        .eq("barbearia_id", activeTenantId)
        .maybeSingle();

      if (error || !data) {
        setAlertState({
          open: true,
          title: "Senha incorreta",
          description: "A senha informada está incorreta para este usuário. Por favor, tente novamente."
        });
      } else if (data.nivel === 10) {
        setAlertState({
          open: true,
          title: "Acesso bloqueado",
          description: "Este colaborador está inativo e não possui permissão para acessar o sistema."
        });
      } else {
        localStorage.setItem("user", JSON.stringify(data));
        // Adicionando cookie para persistência entre sessões (30 dias)
        document.cookie = `user=${encodeURIComponent(JSON.stringify(data))}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
        
        // Verifica se o registro está confirmado
        if (data.registro === "nao") {
          navigate({ to: "/registro" });
          return;
        }
        
        switch (data.nivel) {
          case 1:
            navigate({ to: "/admin" });
            break;
          case 2:
            navigate({ to: "/colaborador" });
            break;
          case 3:
            navigate({ to: "/cliente" });
            break;
          default:
            navigate({ to: "/" });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async () => {
    console.log("Starting handleRecovery...");
    setIsRecoveryLoading(true);
    const cleanLogin = recoveryLogin.replace(/[^\d]/g, "");
    console.log("Clean login:", cleanLogin);

    try {
      let activeTenantId = tenant?.id;

      if (!activeTenantId) {
        const { data: userBarbearia } = await supabase
          .from("usuarios")
          .select("barbearia_id")
          .eq("login", cleanLogin)
          .limit(2);
        
        if (userBarbearia && userBarbearia.length === 1) {
          activeTenantId = userBarbearia[0].barbearia_id;
        } else {
          toast.error("Unidade não identificada. Por favor, acesse pelo link da sua barbearia.");
          setIsRecoveryLoading(false);
          return;
        }
      }

      // 1. Verificar se o usuário existe
      console.log("Checking if user exists...");
      const { data: usuario, error: userError } = await supabase
        .from("usuarios")
        .select("nome, login")
        .eq("login", cleanLogin)
        .eq("barbearia_id", activeTenantId)
        .maybeSingle();
      
      console.log("User check result:", { usuario, userError });

      if (userError || !usuario) {
        setAlertState({
          open: true,
          title: "Atenção",
          description: "Este número não está cadastrado no sistema.",
        });
        setIsRecoveryLoading(false);
        return;
      }

      console.log("Generating recovery token...");
      const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
      const recoveryToken = `${usuario.login}${randomChars}`;
      console.log("Recovery token generated:", recoveryToken);
      
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ recovery_token: recoveryToken })
        .eq("login", usuario.login)
        .eq("barbearia_id", tenant!.id);

      console.log("Token update result:", updateError);

      if (updateError) {
        toast.error("Erro ao preparar recuperação. Tente novamente.");
        setIsRecoveryLoading(false);
        return;
      }

      console.log("Fetching webhook URL...");
      const { data: integracao, error: intError } = await supabase
        .from("integracoes")
        .select("webhook_url")
        .eq("tipo", "recupera_senha")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("Integration fetch result:", { integracao, intError });

      if (intError || !integracao?.webhook_url) {
        toast.error("Serviço de recuperação indisponível no momento. Por favor, contate o suporte.");
        setIsRecoveryLoading(false);
        return;
      }

      console.log("Fetching admin contact...");
      const { data: info, error: infoError } = await (supabase
        .from("informacoes" as any)
        .select("tel_contato")
        .eq("userrr", "admin")
        .eq("barbearia_id", tenant!.id)
        .maybeSingle());

      console.log("Admin info fetch result:", { info, infoError });

      const telContato = (info as any)?.tel_contato || "";

      console.log("Invoking proxy-webhook function...");
      try {
        const payload = {
          url: integracao.webhook_url,
          method: "POST",
          body: {
            tel_cliente: usuario.login,
            nome_cliente: usuario.nome,
            tel_contato: telContato,
            barbearia_id: tenant!.id,
            id_barbearia: tenant!.id,
            ID_BARBEARIA: tenant!.id,
            link_recuperacao: `${window.location.origin}/redefinir-senha?user=${recoveryToken}`
          }
        };
        console.log("Payload:", payload);
        
        const { error: invokeError } = await supabase.functions.invoke('proxy-webhook', {
          body: payload
        });
        
        console.log("Function invoke result:", invokeError);
        
        if (invokeError) {
          console.log("Function failed, trying fallback fetch...");
          // Fallback para fetch direto se a function falhar (CORS pode ocorrer, mas é uma tentativa)
          await fetch(integracao.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload.body),
          }).then(res => console.log("Fallback fetch response:", res.status))
            .catch(e => console.error("Fallback fetch error:", e));
        }
      } catch (webhookErr) {
        console.error("Webhook error:", webhookErr);
      }

      setAlertState({
        open: true,
        title: "Solicitação enviada",
        description: "Você receberá as instruções de recuperação via WhatsApp em instantes.",
      });
      
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao processar sua solicitação.");
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-xl flex flex-col items-center">
        <div className="text-center flex flex-col items-center">
          <img
            src={logoUrl}
            alt="Barbearia Pereira Logo"
            className="w-32 h-auto mb-6"
          />
          <h2 className="text-3xl font-bold text-primary">Login</h2>
          <p className="mt-2 text-muted-foreground">Entre com seus dados</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="login">Telefone</Label>
            <Input
              id="login"
              type="text"
              placeholder="(xx) xxxxx-xxxx"
              value={login}
              onChange={handleLoginChange}
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="bg-background pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSenha ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-4 text-sm w-full">
          <div className="text-center text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <Link 
              to="/cadastro" 
              search={tenant?.slug ? { tenant: tenant.slug } : undefined}
              className="text-primary hover:underline font-medium"
            >
              Clique aqui para criar agora
            </Link>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                Esqueci minha senha
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Recuperar Senha</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-login">Telefone</Label>
                  <Input
                    id="recovery-login"
                    placeholder="(xx) xxxxx-xxxx"
                    value={recoveryLogin}
                    onChange={(e) => setRecoveryLogin(formatPhone(e.target.value))}
                  />
                </div>
                <Button 
                  onClick={handleRecovery} 
                  className="w-full" 
                  disabled={isRecoveryLoading}
                >
                  {isRecoveryLoading ? "Processando..." : "Recuperar senha"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
            Voltar para página inicial
          </Link>
        </div>
      </div>

      <AlertDialog 
        open={alertState.open} 
        onOpenChange={(open) => setAlertState(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{alertState.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {alertState.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => navigate({ to: "/" })}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
