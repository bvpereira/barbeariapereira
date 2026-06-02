import { useState, useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/cadastro")({
  component: Cadastro,
});

const formatPhone = (value: string) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

function Cadastro() {
  const { tenant } = useTenant();
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayedPassword, setDisplayedPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, "");
    if (value.length <= 11) {
      setLogin(formatPhone(value));
    }
  };

  useEffect(() => {
    if (showPassword) {
      setDisplayedPassword(senha);
      return;
    }
    
    if (senha.length === 0) {
      setDisplayedPassword("");
      return;
    }

    const masked = "*".repeat(senha.length - 1) + senha.slice(-1);
    setDisplayedPassword(masked);

    const timer = setTimeout(() => {
      setDisplayedPassword("*".repeat(senha.length));
    }, 1500);

    return () => clearTimeout(timer);
  }, [senha, showPassword]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const cleanLogin = login.replace(/[^\d]/g, "");

    if (cleanLogin.length !== 11) {
      toast.error("Erro no cadastro", {
        description: "O telefone deve ter exatamente 11 dígitos.",
      });
      setIsLoading(false);
      return;
    }
    
    if (senha.length < 6) {
      toast.error("Erro no cadastro", {
        description: "A senha precisa ter no mínimo 6 caracteres.",
      });
      setIsLoading(false);
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("Erro no cadastro", {
        description: "As senhas não coincidem.",
      });
      setIsLoading(false);
      return;
    }


    try {
      const { data, error } = await supabase
        .from("usuarios")
        .insert([
          {
            barbearia_id: tenant!.id,
            nome,
            login: cleanLogin,
            senha,
            nivel: 3, // Cliente
            registro: "nao",
            promocao: "sim"
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Erro no cadastro", {
            description: "Este número de telefone já está cadastrado.",
          });
        } else {
          toast.error("Erro no cadastro", {
            description: "Ocorreu um erro ao tentar criar sua conta.",
          });
        }
      } else {
        localStorage.setItem("user", JSON.stringify(data));
        toast.success("Conta criada com sucesso!");
        navigate({ to: "/registro" });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-xl flex flex-col items-center">
        <div className="text-center flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Barbearia Pereira Logo"
            className="w-32 h-auto mb-6"
          />
          <h2 className="text-3xl font-bold text-primary">Criar Conta</h2>
          <p className="mt-2 text-muted-foreground">Preencha seus dados abaixo</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              placeholder="Seu nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login">Telefone (Login)</Label>
            <Input
              id="login"
              type="text"
              placeholder="(xx) xxxxx-xxxx"
              value={login}
              onChange={handlePhoneChange}
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type="text"
                value={displayedPassword}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length < senha.length) {
                    setSenha(senha.slice(0, val.length));
                  } else if (val.length > senha.length) {
                    const lastChar = val.slice(-1);
                    setSenha(senha + lastChar);
                  }
                }}
                required
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              A senha deve conter no mínimo 6 caracteres.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
            <Input
              id="confirmarSenha"
              type={showPassword ? "text" : "password"}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              className="bg-background"
            />
          </div>

          <p className="text-xs text-muted-foreground text-center italic">
            "Utilizamos seu número de telefone como login pois através dele enviaremos confirmações de agendamento, lembretes e promoções."
          </p>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Criando conta..." : "Cadastrar"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Já tem uma conta? Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
