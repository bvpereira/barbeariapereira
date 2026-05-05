import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/registro" as any)({
  component: Registro,
});

function Registro() {
  const [adminPhone, setAdminPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.id) {
      navigate({ to: "/login" });
      return;
    }

    // Se já estiver registrado, manda pro dashboard
    if (user.registro === "sim") {
      navigate({ to: "/cliente" });
      return;
    }

    const fetchAdminPhone = async () => {
      try {
        const { data, error } = await supabase
          .from("informacoes" as any)
          .select("tel_contato")
          .eq("userrr", "admin")
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const rawPhone = (data as any).tel_contato || "";
          // Remove todos os caracteres não numéricos para o link do wa.me
          setAdminPhone(rawPhone.replace(/\D/g, ""));
        }
      } catch (err) {
        console.error("Erro ao buscar telefone do admin:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminPhone();
  }, [navigate]);

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Olá, acabei de me cadastrar e gostaria de confirmar meu registro");
    const phone = adminPhone || "5522998770113"; // Fallback para o número fixo se não encontrar na tabela
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-xl text-center">
        <div className="flex justify-center">
          <img 
            src="/logo.png" 
            alt="Barbearia Pereira Logo" 
            className="w-32 md:w-40 mb-2" 
          />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-primary">Confirmação de Registro</h2>
          <p className="text-muted-foreground leading-relaxed">
            Olá! Para garantir a segurança e autenticidade do seu acesso, é necessário confirmar seu cadastro através do nosso WhatsApp.
          </p>
          <p className="text-sm font-medium text-foreground">
            Clique no botão abaixo para nos enviar uma mensagem automática de confirmação.
          </p>
        </div>

        <Button 
          onClick={handleWhatsAppClick}
          className="w-full h-14 text-lg font-bold bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full flex items-center justify-center gap-3 transition-transform hover:scale-105"
        >
          <MessageCircle size={24} />
          CONFIRMAR VIA WHATSAPP
        </Button>

        <div className="pt-4">
          <button 
            onClick={() => navigate({ to: "/login" })}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );
}
