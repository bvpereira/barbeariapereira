import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Save, Loader2, Database } from "lucide-react";

export const Route = createFileRoute("/integracoes" as any)({
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [finishWebhookUrl, setFinishWebhookUrl] = useState("");
  const [recuperaSenhaWebhookUrl, setRecuperaSenhaWebhookUrl] = useState("");
  const [instanciaEvo, setInstanciaEvo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFinish, setSavingFinish] = useState(false);
  const [savingRecuperaSenha, setSavingRecuperaSenha] = useState(false);
  const [savingInstancia, setSavingInstancia] = useState(false);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [finishIntegrationId, setFinishIntegrationId] = useState<string | null>(null);
  const [recuperaSenhaIntegrationId, setRecuperaSenhaIntegrationId] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
    fetchInformacoes();
  }, []);

  const fetchInformacoes = async () => {
    try {
      const { data, error } = await supabase
        .from("informacoes")
        .select("id, instancia_evo")
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
    }
  };

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from("integracoes")
        .select("*");

      if (error) {
        console.error("Erro ao buscar integrações:", error);
        return;
      }

      if (data) {
        const standard = data.find(i => i.tipo === "atendimentos");
        const finalizacao = data.find(i => i.tipo === "finalizacao");
        const recupera = data.find(i => i.tipo === "recupera_senha");

        if (standard) {
          setWebhookUrl(standard.webhook_url);
          setIntegrationId(standard.id);
        }

        if (finalizacao) {
          setFinishWebhookUrl(finalizacao.webhook_url);
          setFinishIntegrationId(finalizacao.id);
        }

        if (recupera) {
          setRecuperaSenhaWebhookUrl(recupera.webhook_url);
          setRecuperaSenhaIntegrationId(recupera.id);
        }
      }
    } catch (error) {
      console.error("Exceção ao buscar integrações:", error);
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
          .insert({ webhook_url: webhookUrl, tipo: "atendimentos" })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setIntegrationId(data.id);
      }

      toast.success("Configuração de webhook salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar integração:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinish = async () => {
    if (!finishWebhookUrl) {
      toast.error("Por favor, insira uma URL de webhook válida.");
      return;
    }

    setSavingFinish(true);
    try {
      if (finishIntegrationId) {
        const { error } = await supabase
          .from("integracoes")
          .update({ webhook_url: finishWebhookUrl })
          .eq("id", finishIntegrationId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("integracoes")
          .insert({ webhook_url: finishWebhookUrl, tipo: "finalizacao" })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setFinishIntegrationId(data.id);
      }

      toast.success("Configuração de webhook de finalização salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar integração de finalização:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSavingFinish(false);
    }
  };

  const handleSaveRecuperaSenha = async () => {
    if (!recuperaSenhaWebhookUrl) {
      toast.error("Por favor, insira uma URL de webhook válida.");
      return;
    }

    setSavingRecuperaSenha(true);
    try {
      if (recuperaSenhaIntegrationId) {
        const { error } = await supabase
          .from("integracoes")
          .update({ webhook_url: recuperaSenhaWebhookUrl })
          .eq("id", recuperaSenhaIntegrationId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("integracoes")
          .insert({ webhook_url: recuperaSenhaWebhookUrl, tipo: "recupera_senha" })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setRecuperaSenhaIntegrationId(data.id);
      }

      toast.success("Configuração de webhook de recuperação de senha salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar integração de recuperação de senha:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSavingRecuperaSenha(false);
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
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">
            Configure webhooks para integrar a Barbearia Pereira com outros sistemas.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Configurações Gerais
            </CardTitle>
            <CardDescription>
              Configurações básicas para a conexão com o sistema Evolution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instancia-evo">Instância</Label>
              <div className="flex gap-2">
                <Input
                  id="instancia-evo"
                  placeholder="Ex: MinhaInstancia"
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Webhook de Finalização
            </CardTitle>
            <CardDescription>
              A URL abaixo receberá notificações POST em formato JSON sempre que um atendimento for marcado como "Finalizado" ou "Não compareceu".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="finish-webhook-url">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  id="finish-webhook-url"
                  placeholder="https://exemplo.com/webhook-finalizacao"
                  value={finishWebhookUrl}
                  onChange={(e) => setFinishWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveFinish} disabled={savingFinish}>
                  {savingFinish ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
              <p className="font-semibold">Eventos disparados:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Finalizado (Mudança para status "Finalizado" ou criado com esse status)</li>
                <li>Não compareceu (Mudança para status "Não compareceu" ou criado com esse status)</li>
              </ul>
              <p className="mt-4 text-xs italic">
                Nota: O webhook é disparado automaticamente para qualquer atendimento que mude para esses estados.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Webhook de Recuperação de Senha
            </CardTitle>
            <CardDescription>
              A URL abaixo receberá uma notificação POST em formato JSON contendo os dados do cliente e do sistema sempre que alguém solicitar a recuperação de senha via login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recupera-webhook-url">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  id="recupera-webhook-url"
                  placeholder="https://exemplo.com/webhook-recupera"
                  value={recuperaSenhaWebhookUrl}
                  onChange={(e) => setRecuperaSenhaWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveRecuperaSenha} disabled={savingRecuperaSenha}>
                  {savingRecuperaSenha ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
              <p className="font-semibold">JSON enviado:</p>
              <pre className="p-2 bg-background rounded border text-xs overflow-x-auto">
{`{
  "Tel_cliente": "...",
  "Nome_cliente": "...",
  "Tel_contato": "...",
  "link_recuperacao": "..."
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}