import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SuperAdminInstanceSettings } from "@/components/SuperAdminInstanceSettings";
import { SuperAdminReserveSettings } from "@/components/SuperAdminReserveSettings";
import { EnvioViaCard } from "@/components/EnvioViaCard";
import { useTenant } from "@/contexts/TenantContext";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { CriarBarbeariaForm } from "@/components/CriarBarbeariaForm";

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

      <div className="mb-12 w-full max-w-4xl flex flex-col items-center gap-8">
        <CriarBarbeariaForm />
        <NotificationsPanel />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-20 w-full max-w-4xl"
      >
        <div className="max-w-2xl mx-auto mb-8">
          <EnvioViaCard />
        </div>

        <div className="text-center mb-8 mt-12">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Instância Super Admin
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="max-w-2xl mx-auto">
          <SuperAdminInstanceSettings />
        </div>

        <div className="text-center mb-8 mt-12">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Instância Reserva
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="max-w-2xl mx-auto">
          <SuperAdminReserveSettings />
        </div>
      </motion.div>
    </SuperAdminLayout>
  );
}
