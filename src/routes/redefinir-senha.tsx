import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/redefinir-senha" as any)({
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("user");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast.error("Erro", {
        description: "Token de recuperação ausente ou inválido.",
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
      // 1. Verificar se o token é válido e encontrar o usuário
      const { data: usuario, error: fetchError } = await supabase
        .from("usuarios")
        .select("id, login")
        .eq("recovery_token", token)
        .maybeSingle();

      if (fetchError || !usuario) {
        toast.error("Erro", {
          description: "Token de recuperação inválido ou expirado.",
        });
        setIsLoading(false);
        return;
      }

      // 2. Atualizar a senha e limpar o token
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ 
          senha: novaSenha,
          recovery_token: null 
        })
        .eq("id", usuario.id);

      if (updateError) {
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
            <div className="relative">
              <Input
                id="novaSenha"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="confirmarSenha"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirme sua nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Redefinir Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}