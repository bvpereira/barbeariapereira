import { useState, useRef, useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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

export const Route = createFileRoute("/login" as any)({
  component: Login,
});

const formatPhone = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 3) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
  }
  return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(
    2,
    7
  )}-${phoneNumber.slice(7, 11)}`;
};

function Login() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [displaySenha, setDisplaySenha] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [recoveryLogin, setRecoveryLogin] = useState("");
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });
  const navigate = useNavigate();

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setLogin(formatted);
  };

  const handleSenhaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Detectar se foi uma deleção
    if (value.length < senha.length) {
      const newSenha = value; // Simplificado para deleção
      setSenha(newSenha);
      setDisplaySenha("•".repeat(newSenha.length));
      return;
    }

    // Se adicionou caracteres
    const addedChars = value.length - senha.length;
    const newChars = value.slice(-addedChars);
    const newSenha = senha + newChars;
    setSenha(newSenha);

    // Mostrar os anteriores mascarados e o último visível
    const masked = "•".repeat(newSenha.length - 1) + newSenha.slice(-1);
    setDisplaySenha(masked);

    // Limpar timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Ocultar após 1 segundo
    timeoutRef.current = setTimeout(() => {
      setDisplaySenha("•".repeat(newSenha.length));
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanLogin = login.replace(/[^\d]/g, "");

    try {
      // Primeiro verifica se o usuário existe
      const { data: userExists, error: checkError } = await supabase
        .from("usuarios")
        .select("login")
        .eq("login", cleanLogin)
        .maybeSingle();

      if (!userExists) {
        setAlertState({
          open: true,
          title: "Usuário não encontrado",
          description: "Este número de usuário não foi encontrado no nosso banco de dados. Crie um novo usuário e cadastre sua senha."
        });
        setIsLoading(false);
        return;
      }

      // Se existe, tenta o login com a senha
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("login", cleanLogin)
        .eq("senha", senha)
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
    setIsRecoveryLoading(true);
    const cleanLogin = recoveryLogin.replace(/[^\d]/g, "");

    try {
      // 1. Verificar se o usuário existe
      const { data: usuario, error: userError } = await supabase
        .from("usuarios")
        .select("nome, login")
        .eq("login", cleanLogin)
        .maybeSingle();

      if (userError || !usuario) {
        setAlertState({
          open: true,
          title: "Número não cadastrado",
          description: "Este número não está cadastrado no sistema. Por favor, verifique o número informado ou crie uma nova conta.",
        });
        setIsRecoveryLoading(false);
        return;
      }

      // 2. Buscar o webhook de recuperação de senha
      const { data: integracao, error: intError } = await supabase
        .from("integracoes")
        .select("webhook_url")
        .eq("tipo", "recupera_senha")
        .maybeSingle();

      if (intError || !integracao?.webhook_url) {
        toast.error("Serviço de recuperação indisponível no momento. Por favor, contate o suporte.");
        setIsRecoveryLoading(false);
        return;
      }

      // 3. Buscar o telefone de contato (admin)
      const { data: info, error: infoError } = await (supabase
        .from("informacoes" as any)
        .select("tel_contato")
        .eq("userrr", "admin")
        .maybeSingle());

      const telContato = (info as any)?.tel_contato || "";

      // 4. Disparar o webhook
      try {
        await fetch(integracao.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Tel_cliente: usuario.login,
            Nome_cliente: usuario.nome,
            Tel_contato: telContato
          }),
        });
      } catch (webhookErr) {
        console.error("Webhook error:", webhookErr);
        // Continuamos mesmo se o fetch falhar para mostrar a mensagem de sucesso ao usuário, 
        // já que o webhook pode ser assíncrono ou ter problemas de CORS mas ainda funcionar no servidor
      }

      setAlertState({
        open: true,
        title: "Solicitação enviada",
        description: "Se o seu número estiver correto, você receberá as instruções de recuperação via WhatsApp em instantes.",
      });
      
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao processar sua solicitação.");
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-xl">
        <div className="text-center">
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
            <Input
              id="senha"
              type="text"
              value={displaySenha}
              onChange={handleSenhaChange}
              required
              className="bg-background"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-4 text-sm">
          <Link to="/cadastro" className="text-primary hover:underline">
            Criar conta
          </Link>
          
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
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
