import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Scissors, Trash2 } from "lucide-react";
import { WebhookSettings } from "@/components/WebhookSettings";
import { EvolutionSettings } from "@/components/EvolutionSettings";
import { useTenant } from "@/contexts/TenantContext";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { CriarBarbeariaForm } from "@/components/CriarBarbeariaForm";
import { hardDeleteBarbeariaFn } from "@/lib/barbearias-admin.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MODELO_BARBEARIA_ID = "01879baf-8f8b-4c3d-810f-7740b6432cd9";

export const Route = createFileRoute("/superadmin")({
  component: SuperAdmin,
});


function SuperAdmin() {
  const { refreshTenant } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [confirmSenha, setConfirmSenha] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const session = localStorage.getItem("superadmin_session");
    if (!session) {
      navigate({ to: "/superlogin" });
      return;
    }
    const user = JSON.parse(session);
    setDeleting(true);
    try {
      await hardDeleteBarbeariaFn({
        data: {
          adminId: user.id,
          adminLogin: user.login,
          adminSenha: user.senha,
          id: deleteTarget.id,
          confirmSenha,
        },
      });
      toast.success(`Barbearia "${deleteTarget.nome}" excluída.`);
      setDeleteTarget(null);
      setConfirmSenha("");
      await queryClient.invalidateQueries({ queryKey: ["barbearias"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeleting(false);
    }
  };


  const { data: barbearias, isLoading } = useQuery({
    queryKey: ["barbearias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbearias")
        .select("id, nome, slug")
        .is("deleted_at", null)
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

      <div className="mb-12 w-full max-w-4xl flex flex-col items-center gap-8">
        <CriarBarbeariaForm />
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
              className="relative"
            >
              <Link
                to={`/${barb.slug}`}
                className="group flex items-center justify-between p-6 pr-16 bg-card border border-primary/10 rounded-2xl hover:border-primary/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
              {barb.id !== MODELO_BARBEARIA_ID && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteTarget({ id: barb.id, nome: barb.nome });
                    setConfirmSenha("");
                  }}
                  aria-label={`Excluir ${barb.nome}`}
                  className="absolute top-1/2 -translate-y-1/2 right-14 w-9 h-9 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
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

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setConfirmSenha("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir barbearia</DialogTitle>
            <DialogDescription>
              Esta ação irá apagar permanentemente todos os dados e imagens da barbearia
              <span className="font-semibold"> {deleteTarget?.nome}</span>. Digite sua senha
              de superadmin para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Senha de superadmin"
            value={confirmSenha}
            onChange={(e) => setConfirmSenha(e.target.value)}
            autoFocus
            disabled={deleting}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setConfirmSenha("");
              }}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting || confirmSenha.length === 0}
            >
              {deleting ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}


