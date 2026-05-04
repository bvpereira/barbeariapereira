import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Save, Loader2 } from "lucide-react";

export const Route = createFileRoute("/integracoes" as any)({
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrationId, setIntegrationId] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from("integracoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setWebhookUrl(data.webhook_url);
        setIntegrationId(data.id);
      }
    } catch (error) {
      console.error("Erro ao buscar integração:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl) {
      toast.error("Por favor, insira uma URL de webhook válida.");
      return;
    }

    setSaving(true);
    try {
      if (integrationId) {
        const { error } = await supabase
          .from("integracoes")
          .update({ webhook_url: webhookUrl })
          .eq("id", integrationId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("integracoes")
          .insert({ webhook_url: webhookUrl })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setIntegrationId(data.id);
      }

      toast.success("Configuração de webhook salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar integração:", error);
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">
            Configure webhooks para integrar a Barbearia Pereira com outros sistemas.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Webhook de Agendamentos
            </CardTitle>
            <CardDescription>
              A URL abaixo receberá notificações POST em formato JSON sempre que um cliente (Nível 3) realizar, alterar ou excluir um agendamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  placeholder="https://exemplo.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
              <p className="font-semibold">Eventos disparados:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Agendamento (Criação)</li>
                <li>Remarcacao (Alteração de data ou horário)</li>
                <li>Exclusao (Cancelamento)</li>
              </ul>
              <p className="mt-4 text-xs italic">
                Nota: O webhook é disparado apenas para ações realizadas por usuários de Nível 3 (Clientes).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
