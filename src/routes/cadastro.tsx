import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro" as any)({
  component: Cadastro,
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

function Cadastro() {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, "");
    if (value.length <= 11) {
      setLogin(formatPhone(value));
    }
  };

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


    try {
      const { data, error } = await supabase
        .from("usuarios")
        .insert([
          {
            nome,
            login: cleanLogin,
            senha,
            nivel: 3, // Cliente
            registro: "nao"
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
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-xl">
        <div className="text-center">
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
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
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
