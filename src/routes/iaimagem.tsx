import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Image as ImageIcon, Save, Upload, X, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/iaimagem")({
  component: IAImagemPage,
});

function IAImagemPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<Record<string, string[]>>({
    imagem_objetivo: [],
    imagem_campanha: [],
    imagem_estilovisual: [],
    imagem_informacoes: [],
    imagem_imareferencia: [],
    imagem_comlogo: [],
    imagem_formato: [],
  });
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [createdImageUrl, setCreatedImageUrl] = useState<string | null>(null);
  const [numImagensCriadas, setNumImagensCriadas] = useState(0);
  const [numLimiteImagens, setNumLimiteImagens] = useState(0);
  const [lastResetMonth, setLastResetMonth] = useState("");
  const [showLimitAlert, setShowLimitAlert] = useState(false);

  const [selections, setSelections] = useState<Record<string, string>>({
    imagem_objetivo: "",
    imagem_campanha: "",
    imagem_estilovisual: "",
    imagem_informacoes: "",
    imagem_imareferencia: "",
    imagem_comlogo: "",
    imagem_formato: "",
  });

  const fields = [
    { key: "imagem_objetivo", label: "Objetivo da Imagem" },
    { key: "imagem_campanha", label: "Campanha" },
    { key: "imagem_estilovisual", label: "Estilo Visual" },
    { key: "imagem_imareferencia", label: "Imagem de Referência" },
    { key: "imagem_comlogo", label: "Com Logo?" },
    { key: "imagem_formato", label: "Formato de Imagem" },
    { key: "imagem_informacoes", label: "Informações Adicionais" },
  ];

  useEffect(() => {
    if (tenantLoading || !tenant) return;
    fetchOptions();
    fetchWebhookUrl();

    // Subscribe to changes in agentes_ia table for the current tenant
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agentes_ia',
          filter: `barbearia_id=eq.${tenant.id}`
        },
        (payload) => {
          console.log('Change received!', payload);
          if (payload.new && (payload.new as any).imagem_criada_ia !== undefined) {
            setCreatedImageUrl((payload.new as any).imagem_criada_ia);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant, tenantLoading]);

  const fetchWebhookUrl = async () => {
    try {
      const { data, error } = await supabase
        .from("integracoes")
        .select("webhook_url")
        .eq("tipo", "ia_gerarimagem")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar webhook:", error);
        return;
      }

      if (data) {
        console.log("Webhook de imagem carregado:", data.webhook_url);
        setWebhookUrl(data.webhook_url);
      } else {
        console.warn("Nenhum webhook encontrado para ia_gerarimagem");
      }
    } catch (error) {
      console.error("Erro ao buscar webhook:", error);
    }
  };

  const fetchOptions = async () => {
    if (!tenant?.id) return;
    try {
      const { data: selectionData, error: selectionError } = await supabase
        .from("agentes_ia")
        .select("*")
        .eq("barbearia_id", tenant.id)
        .maybeSingle();

      if (selectionError) throw selectionError;
      
      if (selectionData) {
        setCreatedImageUrl(selectionData.imagem_criada_ia || null);
        setNumLimiteImagens(selectionData.num_limite_imagens || 0);
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const dbMonth = selectionData.last_reset_month || "";
        
        if (dbMonth !== currentMonth && dbMonth !== "") {
          setNumImagensCriadas(0);
          setLastResetMonth(currentMonth);
          // Opcional: atualizar no banco aqui também para ficar sincronizado
          await supabase
            .from("agentes_ia")
            .update({ num_imagens_criadas: 0, last_reset_month: currentMonth })
            .eq("barbearia_id", tenant.id);
        } else {
          setNumImagensCriadas(selectionData.num_imagens_criadas || 0);
          setLastResetMonth(dbMonth);
        }

        // Não preenchemos os campos com os valores do banco ao carregar a página
        // para garantir que eles comecem vazios como solicitado pelo usuário.
        setSelections({
          imagem_objetivo: "",
          imagem_campanha: "",
          imagem_estilovisual: "",
          imagem_informacoes: "",
          imagem_imareferencia: "Sem imagem de referência",
          imagem_comlogo: "",
          imagem_formato: "",
        });
      }

      const newOptions: Record<string, string[]> = {
        imagem_objetivo: ["Captar cliente", "Vender", "Teste objetivo"],
        imagem_campanha: ["Post de Promoção", "Post de Comemoração", "Lançamento", "Conteúdo Informativo"],
        imagem_estilovisual: ["Minimalista", "Agressivo em vendas", "Fotorealista", "Moderno", "Limpo"],
        imagem_informacoes: [],
        imagem_imareferencia: [],
        imagem_comlogo: ["Com logo", "Sem logo"],
        imagem_formato: ["Quadrado (1:1)", "Vertical (4:5)", "Story (9:16)", "Horizontal (16:9)"],
      };

      setOptions(newOptions);
    } catch (error) {
      console.error("Erro ao buscar opções:", error);
      toast.error("Erro ao carregar opções dos campos.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!tenant) return;

    // Verificar limite de imagens
    if (numLimiteImagens > 0 && numImagensCriadas >= numLimiteImagens) {
      setShowLimitAlert(true);
      return;
    }

    const missingFields = fields
      .filter((field) => {
        const val = selections[field.key];
        if (field.key === "imagem_imareferencia") {
          return !(val === "Sem imagem de referência" || val.startsWith("http"));
        }
        return !val || (typeof val === 'string' && val.trim() === "");
      })
      .map((field) => field.label);

    if (missingFields.length > 0) {
      toast.error(`Por favor, preencha os seguintes campos: ${missingFields.join(", ")}`);
      return;
    }


    setSaving(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let newCount = numImagensCriadas + 1;
      let newResetMonth = lastResetMonth;

      if (lastResetMonth !== currentMonth) {
        newCount = 1;
        newResetMonth = currentMonth;
      }

      // 1. Salvar as configurações para a barbearia atual
      const { error: updateError } = await supabase
        .from("agentes_ia")
        .update({
          imagem_objetivo: selections.imagem_objetivo,
          imagem_campanha: selections.imagem_campanha,
          imagem_estilovisual: selections.imagem_estilovisual,
          imagem_informacoes: selections.imagem_informacoes,
          imagem_imareferencia: selections.imagem_imareferencia,
          imagem_comlogo: selections.imagem_comlogo,
          imagem_formato: selections.imagem_formato,
          num_imagens_criadas: newCount,
          last_reset_month: newResetMonth,
        })
        .eq("barbearia_id", tenant.id);

      if (updateError) throw updateError;

      // Atualizar estado local do contador
      setNumImagensCriadas(newCount);
      setLastResetMonth(newResetMonth);

      // 2. Buscar o webhook atualizado diretamente da tabela integracoes
      const { data: webhookData, error: webhookFetchError } = await supabase
        .from("integracoes")
        .select("webhook_url")
        .eq("tipo", "ia_gerarimagem")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (webhookFetchError) {
        console.error("Erro ao buscar webhook antes do disparo:", webhookFetchError);
        throw new Error("Não foi possível localizar a URL do webhook.");
      }

      if (!webhookData?.webhook_url) {
        toast.success("Configurações salvas!");
        toast.info("Atenção: Webhook 'ia_gerarimagem' não configurado em Integrações.");
        return;
      }

      // 3. Ativar o webhook
      const finalWebhookUrl = webhookData.webhook_url.trim().replace(/\s/g, '%20');
      console.log("Disparando webhook:", finalWebhookUrl);
      
      const response = await fetch(finalWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: 'no-cors', // Adicionado para evitar bloqueios de CORS em webhooks simples
        body: JSON.stringify({
          ...selections,
          barbearia_id: tenant.id,
          id_barbearia: tenant.id,
          ID_BARBEARIA: tenant.id,
          timestamp: new Date().toISOString(),
          action: "generate_image"
        }),
      });

      // Nota: Com mode 'no-cors', não conseguimos ler response.ok ou status
      // Mas o fetch dispara a requisição.
      toast.success("Geração de imagem solicitada com sucesso!");

      // Limpar todos os campos após o sucesso
      setSelections({
        imagem_objetivo: "",
        imagem_campanha: "",
        imagem_estilovisual: "",
        imagem_informacoes: "",
        imagem_imareferencia: "",
        imagem_comlogo: "",
        imagem_formato: "",
      });

    } catch (error: any) {
      console.error("Erro no processo de geração:", error);
      toast.error(error.message || "Erro ao processar a solicitação.");
    } finally {
      setSaving(false);
    }
  };

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRef(true);
    try {
      // Nome fixo para sempre sobrepor, como solicitado
      const fileName = `referencia/imagem_referencia.jpg`;
      
      // Upload para Supabase Storage (usando o balde informacoes_imagens que já existe)
      const { error: uploadError } = await supabase.storage
        .from("informacoes_imagens")
        .upload(fileName, file, {
          upsert: true // Importante para sobrepor o arquivo existente
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("informacoes_imagens")
        .getPublicUrl(fileName);

      // Adiciona um timestamp para evitar cache do navegador ao exibir a imagem nova
      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      
      setSelections(prev => ({ ...prev, imagem_imareferencia: finalUrl }));
      toast.success("Imagem de referência enviada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao enviar imagem:", error);
      toast.error("Erro ao enviar imagem: " + error.message);
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!createdImageUrl) return;
    try {
      const response = await fetch(createdImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `imagem_ia_${tenant?.id || "gerada"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar a imagem:", error);
      toast.error("Erro ao baixar a imagem.");
    }
  };

  return (
    <AdminLayout>
      <AlertDialog open={showLimitAlert} onOpenChange={setShowLimitAlert}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl">Limite de Imagens Atingido</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-gray-600">
              Você atingiu o limite de imagens criadas neste mês. Seu acesso será renovado automaticamente no <strong>dia primeiro do próximo mês</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-blue-600 hover:bg-blue-700 text-white">
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ImageIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gerar imagem por IA</h1>
            <p className="text-muted-foreground">Configure os parâmetros para criação da sua imagem personalizada.</p>
          </div>
        </div>

        <Card className="border-blue-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Parâmetros de Geração</CardTitle>
              <CardDescription>
                Selecione uma opção em cada campo para habilitar a geração da imagem.
              </CardDescription>
            </div>
            <div className="flex gap-4">
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex flex-col items-end">
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Imagens geradas este mês</span>
                <span className="text-xl font-bold text-blue-700">{numImagensCriadas}</span>
              </div>
              <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 flex flex-col items-end">
                <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Imagens restantes</span>
                <span className="text-xl font-bold text-green-700">{Math.max(0, numLimiteImagens - numImagensCriadas)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.map((field) => (
                  <div key={field.key} className={`space-y-2 ${field.key === "imagem_informacoes" ? "md:col-span-2" : ""}`}>
                    <label className="text-sm font-medium text-gray-700">{field.label}</label>
                    {field.key === "imagem_informacoes" ? (
                      <Textarea
                        value={selections[field.key]}
                        onChange={(e) => setSelections(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={`Digite ${field.label.toLowerCase()}...`}
                        className="w-full bg-white border-blue-50 focus:ring-blue-500 min-h-[100px] text-black"
                      />
                    ) : field.key === "imagem_imareferencia" ? (
                      <div className="space-y-3">
                        <Select
                          value={selections[field.key]?.startsWith("http") ? "Upar imagem de referência" : selections[field.key]}
                          onValueChange={(val) => {
                            setSelections(prev => ({ ...prev, [field.key]: val }));
                          }}
                        >
                          <SelectTrigger className="w-full bg-white border-blue-50 focus:ring-blue-500 text-black">
                            <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sem imagem de referência">Sem imagem de referência</SelectItem>
                            <SelectItem value="Upar imagem de referência">Upar imagem de referência</SelectItem>
                          </SelectContent>
                        </Select>

                        {(selections[field.key]?.startsWith("http") || selections[field.key] === "Upar imagem de referência") && (
                          <div className="p-4 border-2 border-dashed border-blue-100 rounded-lg bg-blue-50/30 space-y-3">
                            {selections[field.key]?.startsWith("http") ? (
                              <div className="relative w-full aspect-video rounded-md overflow-hidden bg-gray-100 border border-blue-100">
                                <img 
                                  src={selections[field.key]} 
                                  alt="Referência" 
                                  className="w-full h-full object-contain"
                                />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-2 right-2 h-8 w-8"
                                  onClick={() => setSelections(prev => ({ ...prev, [field.key]: "Sem imagem de referência" }))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 text-center">
                                <Upload className="h-8 w-8 text-blue-400 mb-2" />
                                <p className="text-sm text-gray-600 mb-2">Selecione uma imagem de referência</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={uploadingRef}
                                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                >
                                  {uploadingRef ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    "Escolher Arquivo"
                                  )}
                                </Button>
                                <input
                                  type="file"
                                  className="hidden"
                                  ref={fileInputRef}
                                  onChange={handleReferenceImageUpload}
                                  accept="image/*"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Select
                        value={selections[field.key]}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, [field.key]: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-blue-50 focus:ring-blue-500 text-black">
                          <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options[field.key].map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                          {options[field.key].length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Nenhuma opção encontrada
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-blue-50 flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 px-6"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Gerar imagem com IA
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Área da Imagem Criada */}
        <Card className="border-blue-100 shadow-md overflow-hidden bg-white">
          <CardHeader className="bg-blue-50/50">
            <CardTitle className="text-xl flex items-center gap-2 text-black">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              Última imagem criada pela IA
            </CardTitle>
            <CardDescription>
              A imagem gerada pela inteligência artificial aparecerá aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[400px]">
            {createdImageUrl ? (
              <div className="space-y-4 w-full flex flex-col items-center">
                <div className="relative group rounded-xl overflow-hidden border-4 border-blue-50 shadow-lg max-w-full">
                  <img 
                    src={createdImageUrl} 
                    alt="Última imagem criada pela IA" 
                    className="max-h-[600px] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex gap-4 mt-4">
                  <Button 
                    variant="outline" 
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 gap-2"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4" />
                    Baixar Imagem
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-6 bg-gray-100 rounded-full inline-block">
                  <ImageIcon className="h-16 w-16 text-gray-300" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-600">Nenhuma imagem gerada ainda</p>
                  <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    Preencha todos os campos acima e clique em "Gerar imagem com IA" para criar sua arte.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
