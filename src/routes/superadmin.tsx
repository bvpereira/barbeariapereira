import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Scissors } from "lucide-react";
import { WebhookSettings } from "@/components/WebhookSettings";
import { EvolutionSettings } from "@/components/EvolutionSettings";
import { useTenant } from "@/contexts/TenantContext";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { NotificationsPanel } from "@/components/NotificationsPanel";

export const Route = createFileRoute("/superadmin")({
  component: SuperAdmin,
});

function SuperAdmin() {
  const { refreshTenant } = useTenant();
  const navigate = useNavigate();
  
  useEffect(() => {
    const session = localStorage.getItem("superadmin_session");
    if (!session) {
      navigate({ to: "/superlogin" });
      return;
    }
    
    const user = JSON.parse(session);
    if (user.nivel !== 0) {
      localStorage.removeItem("superadmin_session");
      navigate({ to: "/superlogin" });
      return;
    }

    refreshTenant();
  }, [refreshTenant, navigate]);

  const { data: barbearias, isLoading } = useQuery({
    queryKey: ["barbearias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbearias")
        .select("id, nome, slug")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  return (
    <SuperAdminLayout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-bold font-josefin uppercase tracking-widest text-primary mb-4">
          Painel Super Admin
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto mb-8" />
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Gerenciamento global de unidades e integrações.
        </p>
      </motion.div>

      <div className="mb-12 w-full max-w-4xl">
        <NotificationsPanel />
      </div>

      {isLoading ? (
        <div className="animate-pulse text-primary font-josefin">Carregando unidades...</div>
      ) : (
        <div className="grid gap-6 w-full max-w-md">
          {barbearias?.map((barb, index) => (
            <motion.div
              key={barb.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={`/${barb.slug}`}
                className="group flex items-center justify-between p-6 bg-card border border-primary/10 rounded-2xl hover:border-primary/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Scissors className="text-primary w-6 h-6" />
                  </div>
                  <span className="text-xl font-bold font-josefin uppercase tracking-wide">
                    {barb.nome}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  →
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-20 w-full max-w-4xl"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Configurações de Webhooks
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-primary/10 rounded-3xl p-8 mb-8 overflow-x-auto">
          <WebhookSettings />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Configurações do Evolution
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="max-w-2xl mx-auto">
          <EvolutionSettings />
        </div>
      </motion.div>
    </SuperAdminLayout>
  );
}

