import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Megaphone, CheckCircle2, UserKey, Calendar, Code, Image as ImageIcon, Play } from "lucide-react";

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
  const [testingType, setTestingType] = useState<string | null>(null);

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

  const handleTestWebhook = async (url: string, tipo: string) => {
    if (!url.trim()) {
      toast.error("Insira uma URL para testar.");
      return;
    }

    let targetBarbeariaId = tenant?.id;
    if (!targetBarbeariaId) {
      const { data: barbs } = await supabase.from("barbearias").select("id").limit(1);
      if (barbs && barbs.length > 0) targetBarbeariaId = barbs[0].id;
    }

    const testPayload = {
      tipo: `TESTE_${tipo.toUpperCase()}`,
      barbearia_id: targetBarbeariaId,
      timestamp: new Date().toISOString(),
      mensagem: "Este é um disparo de teste manual para verificar a configuração do webhook.",
      origem: "Painel de Configurações"
    };

    setTestingType(tipo);
    console.log(`[Webhook Test] Enviando para ${tipo}:`, testPayload);

    try {
      const response = await supabase.functions.invoke('proxy-webhook', {
        body: {
          url: url.trim(),
          method: "POST",
          body: testPayload
        }
      });

      if (response.error) throw response.error;

      toast.success(
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="font-bold">Teste enviado!</span>
          </div>
          <p className="text-xs">O servidor de destino respondeu.</p>
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Payload enviado:</p>
            <pre className="text-[10px] bg-slate-900 text-slate-100 p-2 rounded overflow-auto max-h-32 border border-white/10">
              {JSON.stringify(testPayload, null, 2)}
            </pre>
          </div>
        </div>,
        { duration: 6000 }
      );
    } catch (error: any) {
      console.error("Erro no teste de webhook:", error);
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold">Erro no teste</span>
          <span className="text-xs">{error.message || "O servidor de destino recusou a conexão ou retornou erro."}</span>
        </div>
      );
    } finally {
      setTestingType(null);
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
                variant="outline"
                size="icon"
                onClick={() => handleTestWebhook(webhookUrl, "atendimentos")}
                disabled={testingType === "atendimentos" || !webhookUrl}
                title="Testar Webhook"
              >
                {testingType === "atendimentos" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
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
                variant="outline"
                size="icon"
                onClick={() => handleTestWebhook(finishWebhookUrl, "finalizacao")}
                disabled={testingType === "finalizacao" || !finishWebhookUrl}
                title="Testar Webhook"
              >
                {testingType === "finalizacao" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
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
                variant="outline"
                size="icon"
                onClick={() => handleTestWebhook(promocaoWebhookUrl, "promocao")}
                disabled={testingType === "promocao" || !promocaoWebhookUrl}
                title="Testar Webhook"
              >
                {testingType === "promocao" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
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
                variant="outline"
                size="icon"
                onClick={() => handleTestWebhook(recuperaSenhaWebhookUrl, "recupera_senha")}
                disabled={testingType === "recupera_senha" || !recuperaSenhaWebhookUrl}
                title="Testar Webhook"
              >
                {testingType === "recupera_senha" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
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
                variant="outline"
                size="icon"
                onClick={() => handleTestWebhook(iaCodConsumiWebhookUrl, "ia_codconsumi")}
                disabled={testingType === "ia_codconsumi" || !iaCodConsumiWebhookUrl}
                title="Testar Webhook"
              >
                {testingType === "ia_codconsumi" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
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
                variant="outline"
                size="icon"
                onClick={() => handleTestWebhook(iaGerarImagemWebhookUrl, "ia_gerarimagem")}
                disabled={testingType === "ia_gerarimagem" || !iaGerarImagemWebhookUrl}
                title="Testar Webhook"
              >
                {testingType === "ia_gerarimagem" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
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
