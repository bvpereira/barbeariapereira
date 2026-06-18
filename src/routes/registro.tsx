import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/registro")({
  component: Registro,
});

function Registro() {
  const [adminPhone, setAdminPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { tenant } = useTenant();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.id) {
      navigate({ to: "/login" });
      return;
    }

    if (user.registro === "sim") {
      navigate({ to: "/cliente" });
      return;
    }

    const fetchAdminPhone = async () => {
      try {
        const { data, error } = await supabase
          .from("informacoes" as any)
          .select("instancia_numero")
          .eq("userrr", "admin")
          .eq("barbearia_id", user.barbearia_id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const rawPhone = (data as any).instancia_numero || "";
          setAdminPhone(rawPhone.replace(/\D/g, ""));
        }
      } catch (err) {
        console.error("Erro ao buscar telefone da instância:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminPhone();
  }, [navigate]);

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Olá, acabei de me cadastrar e gostaria de confirmar meu registro");
    const phone = adminPhone || "5522998770113";
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const handleBackToHome = () => {
    const slug = tenant?.slug;
    if (slug) {
      window.location.href = `/${slug}`;
    } else {
      navigate({ to: "/" });
    }
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

        <div className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-muted-foreground leading-relaxed text-left">
          <p>
            <strong className="text-foreground">Atenção:</strong> Se você enviou a mensagem pelo WhatsApp e não recebeu uma confirmação, ou se já solicitou a confirmação e não obteve resposta, entre em contato através dos contatos disponíveis na página inicial informando que tentou realizar o cadastro mas não obteve resposta.
          </p>
        </div>

        <div className="pt-4">
          <button 
            onClick={handleBackToHome}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Voltar para página inicial
          </button>
        </div>
      </div>
    </div>
  );
}
