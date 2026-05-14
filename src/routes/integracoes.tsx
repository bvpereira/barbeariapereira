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
  const [promocaoWebhookUrl, setPromocaoWebhookUrl] = useState("");
  const [recuperaSenhaWebhookUrl, setRecuperaSenhaWebhookUrl] = useState("");
  const [instanciaEvo, setInstanciaEvo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFinish, setSavingFinish] = useState(false);
  const [savingPromocao, setSavingPromocao] = useState(false);
  const [savingRecuperaSenha, setSavingRecuperaSenha] = useState(false);
  const [savingInstancia, setSavingInstancia] = useState(false);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [finishIntegrationId, setFinishIntegrationId] = useState<string | null>(null);
  const [promocaoIntegrationId, setPromocaoIntegrationId] = useState<string | null>(null);
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
        const promocao = data.find(i => i.tipo === "promocao");
        const recupera = data.find(i => i.tipo === "recupera_senha");

        if (standard) {
          setWebhookUrl(standard.webhook_url);
          setIntegrationId(standard.id);
        }

        if (finalizacao) {
          setFinishWebhookUrl(finalizacao.webhook_url);
          setFinishIntegrationId(finalizacao.id);
        }

        if (promocao) {
          setPromocaoWebhookUrl(promocao.webhook_url);
          setPromocaoIntegrationId(promocao.id);
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

  const handleSavePromocao = async () => {
    if (!promocaoWebhookUrl) {
      toast.error("Por favor, insira uma URL de webhook válida.");
      return;
    }

    setSavingPromocao(true);
    try {
      if (promocaoIntegrationId) {
        const { error } = await supabase
          .from("integracoes")
          .update({ webhook_url: promocaoWebhookUrl })
          .eq("id", promocaoIntegrationId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("integracoes")
          .insert({ webhook_url: promocaoWebhookUrl, tipo: "promocao" })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setPromocaoIntegrationId(data.id);
      }

      toast.success("Configuração de webhook de promoção salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar integração de promoção:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSavingPromocao(false);
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
            <CardTitle className="flex items-center gap-2 text-xl">
              <Link2 className="h-5 w-5" />
              Webhooks de Envio
            </CardTitle>
            <CardDescription>
              Configure os endereços de destino para os eventos do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Webhook Promoção */}
            <div className="space-y-2">
              <Label htmlFor="promocao-webhook-url" className="text-sm font-medium">webhook promoção</Label>
              <div className="flex gap-2">
                <Input
                  id="promocao-webhook-url"
                  placeholder="https://exemplo.com/webhook-promocao"
                  value={promocaoWebhookUrl}
                  onChange={(e) => setPromocaoWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSavePromocao} disabled={savingPromocao} size="sm">
                  {savingPromocao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>

            {/* Webhook Finalização */}
            <div className="space-y-2">
              <Label htmlFor="finish-webhook-url" className="text-sm font-medium">webhook finalização</Label>
              <div className="flex gap-2">
                <Input
                  id="finish-webhook-url"
                  placeholder="https://exemplo.com/webhook-finalizacao"
                  value={finishWebhookUrl}
                  onChange={(e) => setFinishWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveFinish} disabled={savingFinish} size="sm">
                  {savingFinish ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>

            {/* Instância (Colocado acima do agendamentos conforme solicitado anteriormente) */}
            <div className="space-y-2">
              <Label htmlFor="instancia-evo" className="text-sm font-medium">instância</Label>
              <div className="flex gap-2">
                <Input
                  id="instancia-evo"
                  placeholder="Ex: MinhaInstancia"
                  value={instanciaEvo}
                  onChange={(e) => setInstanciaEvo(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveInstancia} disabled={savingInstancia} size="sm">
                  {savingInstancia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>

            {/* Webhook de Agendamentos */}
            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-sm font-medium">webhook de agendamentos</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  placeholder="https://exemplo.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>

            {/* Webhook de Recuperação de Senha */}
            <div className="space-y-2">
              <Label htmlFor="recupera-webhook-url" className="text-sm font-medium">webhook recuperação de senha</Label>
              <div className="flex gap-2">
                <Input
                  id="recupera-webhook-url"
                  placeholder="https://exemplo.com/webhook-recupera"
                  value={recuperaSenhaWebhookUrl}
                  onChange={(e) => setRecuperaSenhaWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveRecuperaSenha} disabled={savingRecuperaSenha} size="sm">
                  {savingRecuperaSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Informações de Agendamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                O webhook de agendamentos é disparado para criação, remarcação e exclusão de horários por clientes.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Informações de Finalização</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Disparado quando um atendimento é marcado como "Finalizado" ou "Não compareceu".
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}