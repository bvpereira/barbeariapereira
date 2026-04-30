import { useState } from "react";
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
      } else {
        localStorage.setItem("user", JSON.stringify(data));
        
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
      const { data, error } = await supabase
        .from("usuarios")
        .select("id")
        .eq("login", cleanLogin)
        .maybeSingle();

      if (error || !data) {
        setAlertState({
          open: true,
          title: "Usuário não encontrado",
          description: "Esse número de usuário não foi encontrado no nosso banco de dados. Crie um novo usuário e cadastre sua senha",
        });
      } else {
        const resetLink = `https://id-preview--ffc6bf25-924b-4dc4-9d40-a87b650caa0c.lovable.app/recuperarsenha?user=${cleanLogin}`;
        
        try {
          await fetch("https://n8n.servidorpereira.shop/webhook-test/barbeariaoereira", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              login: cleanLogin,
              link: resetLink
            }),
          });
        } catch (webhookErr) {
          console.error("Webhook error:", webhookErr);
        }

        setAlertState({
          open: true,
          title: "Recuperação enviada",
          description: "O link para redefinir sua senha será enviado pelo WhatsApp do seu telefone cadastrado",
        });
      }
    } catch (err) {
      console.error(err);
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
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="bg-background"
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
