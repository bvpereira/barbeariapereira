import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Database } from "lucide-react";

export const Route = createFileRoute("/integracoes")({
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [instanciaEvo, setInstanciaEvo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingInstancia, setSavingInstancia] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);

  useEffect(() => {
    if (tenantLoading || !tenant) return;
    fetchInformacoes();
  }, [tenant, tenantLoading]);

  const fetchInformacoes = async () => {
    if (!tenant?.id) return;
    try {
      const { data, error } = await supabase
        .from("informacoes")
        .select("id, instancia_evo")
        .eq("barbearia_id", tenant.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar informações:", error);
        return;
      }

      if (data) {
        if (data.instancia_evo) setInstanciaEvo(data.instancia_evo);
        setInfoId(data.id);
      }
    } catch (error) {
      console.error("Exceção ao buscar informações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInstancia = async () => {
    setSavingInstancia(true);
    try {
      if (!infoId) throw new Error("ID das informações não encontrado.");

      const { error } = await supabase
        .from("informacoes")
        .update({ instancia_evo: instanciaEvo })
        .eq("id", infoId);

      if (error) throw error;

      toast.success("Instância salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar instância:", error);
      toast.error(`Erro ao salvar instância: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSavingInstancia(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground text-lg">
            Configure e gerencie as conexões externas do sistema.
          </p>
        </div>

        <Card className="border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Configurações do Evolution
              </CardTitle>
            <CardDescription>
              Identificação da instância para envio de mensagens via WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instancia-evo">Nome da Instância</Label>
              <div className="flex gap-2">
                <Input
                  id="instancia-evo"
                  placeholder="Ex: BarbeariaPereira"
                  value={instanciaEvo}
                  onChange={(e) => setInstanciaEvo(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveInstancia} disabled={savingInstancia}>
                  {savingInstancia ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
