import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { WebhookSettings } from "@/components/WebhookSettings";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";

export const Route = createFileRoute("/webhooks")({
  component: WebhooksPage,
});

function WebhooksPage() {
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
    }
  }, [navigate]);

  return (
    <SuperAdminLayout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-bold font-josefin uppercase tracking-widest text-primary mb-4">
          Webhooks
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto mb-8" />
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Configurações globais de webhooks.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Configurações de Webhooks
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-primary/10 rounded-3xl p-8 overflow-x-auto">
          <WebhookSettings />
        </div>
      </motion.div>
    </SuperAdminLayout>
  );
}
