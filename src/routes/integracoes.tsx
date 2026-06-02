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
import { Link2, Save, Loader2, Database, Megaphone, CheckCircle2, UserKey, Calendar, Code, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/integracoes")({
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [finishWebhookUrl, setFinishWebhookUrl] = useState("");
  const [recuperaSenhaWebhookUrl, setRecuperaSenhaWebhookUrl] = useState("");
  const [promocaoWebhookUrl, setPromocaoWebhookUrl] = useState("");
  const [iaCodConsumiWebhookUrl, setIaCodConsumiWebhookUrl] = useState("");
  const [iaGerarImagemWebhookUrl, setIaGerarImagemWebhookUrl] = useState("");
  const [instanciaEvo, setInstanciaEvo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFinish, setSavingFinish] = useState(false);
  const [savingRecuperaSenha, setSavingRecuperaSenha] = useState(false);
  const [savingPromocao, setSavingPromocao] = useState(false);
  const [savingIaCodConsumi, setSavingIaCodConsumi] = useState(false);
  const [savingIaGerarImagem, setSavingIaGerarImagem] = useState(false);
  const [savingInstancia, setSavingInstancia] = useState(false);
  
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [finishIntegrationId, setFinishIntegrationId] = useState<string | null>(null);
  const [recuperaSenhaIntegrationId, setRecuperaSenhaIntegrationId] = useState<string | null>(null);
  const [promocaoIntegrationId, setPromocaoIntegrationId] = useState<string | null>(null);
  const [iaCodConsumiIntegrationId, setIaCodConsumiIntegrationId] = useState<string | null>(null);
  const [iaGerarImagemIntegrationId, setIaGerarImagemIntegrationId] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);

  useEffect(() => {
    if (tenantLoading || !tenant) return;
    fetchIntegrations();
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
    }
  };

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
    if (!tenant) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error("Por favor, insira uma URL de webhook válida.");
      return;
    }

    setSavingState(true);
    try {
      // Usamos upsert baseado no 'tipo' para garantir que sempre atualizamos a linha correta
      const { data, error } = await supabase
        .from("integracoes")
        .upsert(
          { 
            barbearia_id: tenant.id,
            webhook_url: trimmedUrl, 
            tipo: tipo,
            // Se tivermos o ID, incluímos para garantir que estamos tratando da mesma linha, 
            // mas o constraint de unicidade no 'tipo' é o que realmente importa aqui
            ...(id ? { id } : {}) 
          },
          { onConflict: 'tipo,barbearia_id' }
        )
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setId(data.id);
      }

      toast.success(successMsg);
    } catch (error: any) {
      console.error(`Erro ao salvar integração ${tipo}:`, error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSavingState(false);
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

        {/* Configurações Gerais */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Webhook de Agendamentos */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <Calendar className="h-5 w-5" />
                Agendamentos
              </CardTitle>
              <CardDescription>
                Notifica sobre novos horários marcados, alterações ou cancelamentos realizados pelos clientes.
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
              <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-xs border border-blue-100">
                <p className="font-semibold mb-1">Eventos:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Criação de agendamento</li>
                  <li>Remarcação (data/hora)</li>
                  <li>Cancelamento (exclusão)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Webhook de Finalização */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
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
              <div className="p-3 bg-green-50 text-green-700 rounded-md text-xs border border-green-100">
                <p className="font-semibold mb-1">Eventos:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Status alterado para "Finalizado"</li>
                  <li>Status alterado para "Não compareceu"</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Webhook de Promoções */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Megaphone className="h-5 w-5" />
                Promoções
              </CardTitle>
              <CardDescription>
                Utilizado para disparar campanhas de marketing e avisos para os clientes cadastrados.
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
              <div className="p-3 bg-purple-50 text-purple-700 rounded-md text-xs border border-purple-100">
                <p className="font-semibold mb-1">Utilização:</p>
                <p>Envia dados da promoção ativa (texto e imagem) para disparo em massa via sistema externo.</p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook de Recuperação de Senha */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <UserKey className="h-5 w-5" />
                Recuperação de Senha
              </CardTitle>
              <CardDescription>
                Notifica quando um cliente solicita a redefinição de sua senha de acesso.
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
              <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-xs border border-blue-100">
                <p className="font-semibold mb-1">Dados enviados:</p>
                <p>Nome, Telefone e Link de Recuperação exclusivo para o cliente.</p>
              </div>
            </CardContent>
          </Card>
          {/* Webhook de IA Assistente Código do Consumidor */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Code className="h-5 w-5" />
                IA – Assistente Código do Consumidor
              </CardTitle>
              <CardDescription>
                Webhook para o assistente de IA especializado no Código de Defesa do Consumidor.
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
              <div className="p-3 bg-orange-50 text-orange-700 rounded-md text-xs border border-orange-100">
                <p className="font-semibold mb-1">Finalidade:</p>
                <p>Integração com o fluxo de IA para consultas e assistência baseada no Código de Defesa do Consumidor.</p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook de IA Gerar Imagem */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <ImageIcon className="h-5 w-5" />
                IA – Gerar Imagem
              </CardTitle>
              <CardDescription>
                Webhook para criação de imagens personalizadas através de Inteligência Artificial.
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
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-md text-xs border border-indigo-100">
                <p className="font-semibold mb-1">Utilização:</p>
                <p>Envia os parâmetros selecionados para o fluxo de geração de imagens via IA.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
