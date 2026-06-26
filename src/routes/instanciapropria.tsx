import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { QrCode } from "lucide-react";

export const Route = createFileRoute("/instanciapropria")({
  component: InstanciaPropriaPage,
});

function InstanciaPropriaPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; barbearia_id: string; nivel: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : null;
      if (!u || Number(u.nivel) !== 1) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUser(u);
    } catch {
      navigate({ to: "/login", replace: true });
    }
  }, [navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["instancia-propria", user?.barbearia_id],
    enabled: !!user?.barbearia_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informacoes" as any)
        .select("instancia_propria, qrcode_instancia_propria")
        .eq("barbearia_id", user!.barbearia_id)
        .maybeSingle();
      if (error) throw error;
      return data as { instancia_propria: string | null; qrcode_instancia_propria: string | null } | null;
    },
  });

  if (!user) return null;

  const temInstancia = data?.instancia_propria === "sim";
  const qrUrl = data?.qrcode_instancia_propria ?? null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Instância Própria</h1>
            <p className="text-muted-foreground">Conecte sua própria instância de WhatsApp via QR code.</p>
          </div>
          <Badge variant={temInstancia ? "default" : "secondary"} className="w-fit text-sm">
            {isLoading ? "Carregando..." : temInstancia ? "Possui instância própria" : "Sem instância própria"}
          </Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR code da Instância
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : qrUrl ? (
              <img
                src={qrUrl}
                alt="QR code da instância própria"
                className="h-72 w-72 rounded-md border border-primary/15 bg-white object-contain p-3"
              />
            ) : (
              <p className="text-center text-muted-foreground">
                Atualmente não existe nenhum QR code gerado para conectar a sua própria instância.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
