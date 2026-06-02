import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Megaphone, CheckCircle2, UserKey, Calendar, Code, Image as ImageIcon } from "lucide-react";

export function WebhookSettings() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [finishWebhookUrl, setFinishWebhookUrl] = useState("");
  const [recuperaSenhaWebhookUrl, setRecuperaSenhaWebhookUrl] = useState("");
  const [promocaoWebhookUrl, setPromocaoWebhookUrl] = useState("");
  const [iaCodConsumiWebhookUrl, setIaCodConsumiWebhookUrl] = useState("");
  const [iaGerarImagemWebhookUrl, setIaGerarImagemWebhookUrl] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFinish, setSavingFinish] = useState(false);
  const [savingRecuperaSenha, setSavingRecuperaSenha] = useState(false);
  const [savingPromocao, setSavingPromocao] = useState(false);
  const [savingIaCodConsumi, setSavingIaCodConsumi] = useState(false);
  const [savingIaGerarImagem, setSavingIaGerarImagem] = useState(false);
  
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [finishIntegrationId, setFinishIntegrationId] = useState<string | null>(null);
  const [recuperaSenhaIntegrationId, setRecuperaSenhaIntegrationId] = useState<string | null>(null);
  const [promocaoIntegrationId, setPromocaoIntegrationId] = useState<string | null>(null);
  const [iaCodConsumiIntegrationId, setIaCodConsumiIntegrationId] = useState<string | null>(null);
  const [iaGerarImagemIntegrationId, setIaGerarImagemIntegrationId] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [tenant]);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from("integracoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar integrações:", error);
        return;
      }

      if (data) {
        const standard = data.find(i => i.tipo === "atendimentos");
        const finalizacao = data.find(i => i.tipo === "finalizacao");
        const recupera = data.find(i => i.tipo === "recupera_senha");
        const promocao = data.find(i => i.tipo === "promocao");
        const iaCodConsumi = data.find(i => i.tipo === "ia_codconsumi");
        const iaGerarImagem = data.find(i => i.tipo === "ia_gerarimagem");

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

        if (promocao) {
          setPromocaoWebhookUrl(promocao.webhook_url);
          setPromocaoIntegrationId(promocao.id);
        }

        if (iaCodConsumi) {
          setIaCodConsumiWebhookUrl(iaCodConsumi.webhook_url);
          setIaCodConsumiIntegrationId(iaCodConsumi.id);
        }

        if (iaGerarImagem) {
          setIaGerarImagemWebhookUrl(iaGerarImagem.webhook_url);
          setIaGerarImagemIntegrationId(iaGerarImagem.id);
        }
      }
    } catch (error) {
      console.error("Exceção ao buscar integrações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneric = async (
    url: string, 
    tipo: string, 
    id: string | null, 
    setId: (id: string) => void, 
    setSavingState: (s: boolean) => void,
    successMsg: string
  ) => {
    let targetBarbeariaId = tenant?.id;
    
    if (!targetBarbeariaId) {
      // Se não houver tenant (estamos na home), buscar a primeira barbearia disponível
      const { data: barbs } = await supabase.from("barbearias").select("id").limit(1);
      if (barbs && barbs.length > 0) {
        targetBarbeariaId = barbs[0].id;
      }
    }

    if (!targetBarbeariaId) {
      toast.error("Nenhuma barbearia encontrada para associar o webhook.");
      return;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error("Por favor, insira uma URL de webhook válida.");
      return;
    }

    setSavingState(true);
    try {
      const { data, error } = await supabase
        .from("integracoes")
        .upsert(
          { 
            barbearia_id: targetBarbeariaId,
            webhook_url: trimmedUrl, 
            tipo: tipo,
            ...(id ? { id } : {}) 
          },
          { onConflict: 'tipo,barbearia_id' }
        )
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setId(data[0].id);
      }

      toast.success(successMsg);
    } catch (error: any) {
      console.error(`Erro ao salvar integração ${tipo}:`, error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSavingState(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Webhook de Agendamentos */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600 text-lg">
            <Calendar className="h-5 w-5" />
            Agendamentos
          </CardTitle>
          <CardDescription>
            Notifica sobre novos horários marcados, alterações ou cancelamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
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
              <Button 
                onClick={() => handleSaveGeneric(webhookUrl, "atendimentos", integrationId, setIntegrationId, setSaving, "Configuração de agendamentos salva!")} 
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook de Finalização */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600 text-lg">
            <CheckCircle2 className="h-5 w-5" />
            Finalização
          </CardTitle>
          <CardDescription>
            Disparado quando um atendimento é concluído ou marcado como "Não compareceu".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
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
              <Button 
                onClick={() => handleSaveGeneric(finishWebhookUrl, "finalizacao", finishIntegrationId, setFinishIntegrationId, setSavingFinish, "Configuração de finalização salva!")} 
                disabled={savingFinish}
              >
                {savingFinish ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook de Promoções */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-600 text-lg">
            <Megaphone className="h-5 w-5" />
            Promoções
          </CardTitle>
          <CardDescription>
            Utilizado para disparar campanhas de marketing e avisos para os clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <Label htmlFor="promocao-webhook-url">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                id="promocao-webhook-url"
                placeholder="https://exemplo.com/webhook-promocao"
                value={promocaoWebhookUrl}
                onChange={(e) => setPromocaoWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => handleSaveGeneric(promocaoWebhookUrl, "promocao", promocaoIntegrationId, setPromocaoIntegrationId, setSavingPromocao, "Configuração de promoções salva!")} 
                disabled={savingPromocao}
              >
                {savingPromocao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook de Recuperação de Senha */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600 text-lg">
            <UserKey className="h-5 w-5" />
            Recuperação de Senha
          </CardTitle>
          <CardDescription>
            Notifica quando um cliente solicita a redefinição de sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
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
              <Button 
                onClick={() => handleSaveGeneric(recuperaSenhaWebhookUrl, "recupera_senha", recuperaSenhaIntegrationId, setRecuperaSenhaIntegrationId, setSavingRecuperaSenha, "Configuração de recuperação salva!")} 
                disabled={savingRecuperaSenha}
              >
                {savingRecuperaSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook de IA Assistente Código do Consumidor */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600 text-lg">
            <Code className="h-5 w-5" />
            IA – Assistente CDC
          </CardTitle>
          <CardDescription>
            Assistente especializado no Código de Defesa do Consumidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <Label htmlFor="ia-codconsumi-webhook-url">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                id="ia-codconsumi-webhook-url"
                placeholder="https://exemplo.com/webhook-ia"
                value={iaCodConsumiWebhookUrl}
                onChange={(e) => setIaCodConsumiWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => handleSaveGeneric(iaCodConsumiWebhookUrl, "ia_codconsumi", iaCodConsumiIntegrationId, setIaCodConsumiIntegrationId, setSavingIaCodConsumi, "Configuração do assistente IA salva!")} 
                disabled={savingIaCodConsumi}
              >
                {savingIaCodConsumi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook de IA Gerar Imagem */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-600 text-lg">
            <ImageIcon className="h-5 w-5" />
            IA – Gerar Imagem
          </CardTitle>
          <CardDescription>
            Criação de imagens personalizadas através de IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <Label htmlFor="ia-gerarimagem-webhook-url">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                id="ia-gerarimagem-webhook-url"
                placeholder="https://exemplo.com/webhook-imagem"
                value={iaGerarImagemWebhookUrl}
                onChange={(e) => setIaGerarImagemWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => handleSaveGeneric(iaGerarImagemWebhookUrl, "ia_gerarimagem", iaGerarImagemIntegrationId, setIaGerarImagemIntegrationId, setSavingIaGerarImagem, "Configuração de geração de imagem salva!")} 
                disabled={savingIaGerarImagem}
              >
                {savingIaGerarImagem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
