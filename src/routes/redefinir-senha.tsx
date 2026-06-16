import { useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // States for masked display
  const [novaSenhaMasked, setNovaSenhaMasked] = useState("");
  const [confirmarSenhaMasked, setConfirmarSenhaMasked] = useState("");
  
  const timerNovaSenha = useRef<NodeJS.Timeout | null>(null);
  const timerConfirmarSenha = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const maskValue = (value: string, isLastVisible: boolean) => {
    if (!value) return "";
    if (!isLastVisible) return "•".repeat(value.length);
    if (value.length === 1) return value;
    return "•".repeat(value.length - 1) + value.slice(-1);
  };

  const handleNovaSenhaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    
    // If user is deleting, we just update the actual password
    if (newVal.length < novaSenha.length) {
      const diff = novaSenha.length - newVal.length;
      const updatedValue = novaSenha.slice(0, -diff);
      setNovaSenha(updatedValue);
      setNovaSenhaMasked(maskValue(updatedValue, false));
      return;
    }

    // If user is adding characters
    const charAdded = newVal.slice(novaSenhaMasked.length);
    const updatedValue = novaSenha + charAdded;
    
    setNovaSenha(updatedValue);
    setNovaSenhaMasked(maskValue(updatedValue, true));

    if (timerNovaSenha.current) clearTimeout(timerNovaSenha.current);
    timerNovaSenha.current = setTimeout(() => {
      setNovaSenhaMasked(maskValue(updatedValue, false));
    }, 1500); // Small delay to mask the last char
  };

  const handleConfirmarSenhaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    
    if (newVal.length < confirmarSenha.length) {
      const diff = confirmarSenha.length - newVal.length;
      const updatedValue = confirmarSenha.slice(0, -diff);
      setConfirmarSenha(updatedValue);
      setConfirmarSenhaMasked(maskValue(updatedValue, false));
      return;
    }

    const charAdded = newVal.slice(confirmarSenhaMasked.length);
    const updatedValue = confirmarSenha + charAdded;
    
    setConfirmarSenha(updatedValue);
    setConfirmarSenhaMasked(maskValue(updatedValue, true));

    if (timerConfirmarSenha.current) clearTimeout(timerConfirmarSenha.current);
    timerConfirmarSenha.current = setTimeout(() => {
      setConfirmarSenhaMasked(maskValue(updatedValue, false));
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (timerNovaSenha.current) clearTimeout(timerNovaSenha.current);
      if (timerConfirmarSenha.current) clearTimeout(timerConfirmarSenha.current);
    };
  }, []);
  
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
        .select("id, login, barbearia_id")
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

        // Buscar slug da barbearia do usuário para redirecionar ao login do tenant
        let tenantSlug: string | null = null;
        if (usuario.barbearia_id) {
          const { data: barbearia } = await supabase
            .from("barbearias")
            .select("slug")
            .eq("id", usuario.barbearia_id)
            .maybeSingle();
          tenantSlug = barbearia?.slug ?? null;
        }

        if (tenantSlug) {
          window.location.href = `/${tenantSlug}/login`;
        } else {
          navigate({ to: "/login" });
        }
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
                type={showPassword ? "text" : "text"}
                placeholder="Digite sua nova senha"
                value={showPassword ? novaSenha : novaSenhaMasked}
                onChange={handleNovaSenhaChange}
                required
                className="bg-background pr-10 font-mono"
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
                type={showConfirmPassword ? "text" : "text"}
                placeholder="Confirme sua nova senha"
                value={showConfirmPassword ? confirmarSenha : confirmarSenhaMasked}
                onChange={handleConfirmarSenhaChange}
                required
                className="bg-background pr-10 font-mono"
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