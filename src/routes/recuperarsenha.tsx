import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/recuperarsenha" as any)({
  component: RecuperarSenha,
});

function RecuperarSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const searchParams = new URLSearchParams(window.location.search);
  const userPhone = searchParams.get("user");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userPhone) {
      toast.error("Erro", {
        description: "Informações de usuário ausentes na URL.",
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("Erro", {
        description: "As senhas não coincidem.",
      });
      return;
    }

    if (novaSenha.length < 6) {
      toast.error("Erro", {
        description: "A senha precisa ter no mínimo 6 caracteres.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ senha: novaSenha })
        .eq("login", userPhone);

      if (error) {
        toast.error("Erro ao atualizar senha", {
          description: "Não foi possível atualizar sua senha. Tente novamente.",
        });
      } else {
        toast.success("Sucesso!", {
          description: "Sua senha foi redefinida com sucesso. Faça login agora.",
        });
        navigate({ to: "/login" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro", {
        description: "Ocorreu um erro inesperado.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary">Nova Senha</h2>
          <p className="mt-2 text-muted-foreground">Digite sua nova senha abaixo</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="novaSenha">Nova Senha</Label>
            <Input
              id="novaSenha"
              type="password"
              placeholder="Digite sua nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
            <Input
              id="confirmarSenha"
              type="password"
              placeholder="Confirme sua nova senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              className="bg-background"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Redefinir Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
