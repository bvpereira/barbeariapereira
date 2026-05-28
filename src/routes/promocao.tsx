import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Megaphone, 
  Send, 
  TestTube, 
  History, 
  Image as ImageIcon, 
  Upload, 
  Loader2, 
  Trash2, 
  Link2,
  Calendar,
  Eye,
  Save,
  Sparkles,
  Type,
  Wand2,
  Download,
  RefreshCw,
  Copy
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/promocao")({
  component: PromocaoPage,
});

function PromocaoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingPromo, setSendingPromo] = useState(false);
  
  const [promoAtual, setPromoAtual] = useState<any>({
    texto_promo: "",
    imagem_promo: null,
    testada: "nao",
    prompt_texto: "",
    prompt_imagem: "",
    imagem_ia: null,
    texto_ia: ""
  });
  
  const [webhookUrl, setWebhookUrl] = useState("");
  const [telContato, setTelContato] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);
  const [formatosIA, setFormatosIA] = useState<any[]>([]);
  const [formatoSelecionado, setFormatoSelecionado] = useState("");
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [promoToDelete, setPromoToDelete] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    console.log("Fetching data for promotions page...");
    setLoading(true);
    try {
      // 1. Fetch current promo (numero_promo = 0)
      const { data: currentPromo, error: promoError } = await supabase
        .from("promocao")
        .select("*")
        .eq("numero_promo", 0)
        .maybeSingle();
      
      if (promoError) {
        console.error("Erro ao buscar promoção atual:", promoError);
      } else if (currentPromo) {
        setPromoAtual(currentPromo);
      }

      // 2. Fetch webhook URL for promotion
      const { data: integration, error: intError } = await supabase
        .from("integracoes")
        .select("webhook_url")
        .eq("tipo", "promocao")
        .maybeSingle();
      
      if (integration) setWebhookUrl(integration.webhook_url || "");

      // 3. Fetch tel_contato
      const { data: info, error: infoError } = await supabase
        .from("informacoes")
        .select("tel_contato")
        .eq("userrr", "admin")
        .maybeSingle();
      
      if (info) setTelContato(info.tel_contato || "");

      // 4. Fetch history (numero_promo > 0)
      const { data: history, error: histError } = await supabase
        .from("promocao")
        .select("*")
        .gt("numero_promo", 0)
        .order("data_promo", { ascending: false });
      
      if (history) setHistorico(history);
      
      // 5. Fetch formatos_ia
      const { data: formats, error: formatsError } = await supabase
        .from("agentes_ia")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (formats) {
        setFormatosIA(formats);
        if (formats.length > 0 && !formatoSelecionado) {
          setFormatoSelecionado(formats[0].imagem_formato);
        }
      }
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados da página");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `promo_${Date.now()}.jpg`;
      const { data, error: uploadError } = await supabase.storage
        .from("promocoes")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("promocoes")
        .getPublicUrl(fileName);

      // Save to Row 0 immediately and reset testada to "nao"
      const { error: updateError } = await supabase
        .from("promocao")
        .update({ 
          imagem_promo: publicUrl,
          testada: "nao"
        })
        .eq("numero_promo", 0);

      if (updateError) throw updateError;

      setPromoAtual({ ...promoAtual, imagem_promo: publicUrl, testada: "nao" });
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar imagem: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveTexto = async () => {
    if (promoAtual.texto_promo && promoAtual.texto_promo.length > 920) {
      toast.error("O texto da promoção não pode ultrapassar 920 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("promocao")
        .update({ 
          texto_promo: promoAtual.texto_promo,
          testada: "nao"
        })
        .eq("numero_promo", 0);
      
      if (error) throw error;
      setPromoAtual({ ...promoAtual, testada: "nao" });
      toast.success("Texto da promoção salvo!");
    } catch (error: any) {
      toast.error("Erro ao salvar texto: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGerarTexto = async () => {
    if (!promoAtual.prompt_texto) {
      toast.error("Digite um prompt para gerar o texto.");
      return;
    }
    setSaving(true);
    try {
      // Save prompt first
      await supabase
        .from("promocao")
        .update({ prompt_texto: promoAtual.prompt_texto })
        .eq("numero_promo", 0);
      
      toast.info("Solicitando geração de texto por IA...");
      console.log("Gerar texto com prompt:", promoAtual.prompt_texto);
      // Aqui entraria a chamada para a API de IA
    } catch (error: any) {
      toast.error("Erro ao processar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGerarImagem = async () => {
    if (!promoAtual.prompt_imagem) {
      toast.error("Digite um prompt para gerar a imagem.");
      return;
    }
    setSaving(true);
    try {
      // Save prompt first
      await supabase
        .from("promocao")
        .update({ prompt_imagem: promoAtual.prompt_imagem })
        .eq("numero_promo", 0);
      
      toast.info("Solicitando geração de imagem por IA...");
      console.log("Gerar imagem com prompt:", promoAtual.prompt_imagem);
      // Aqui entraria a chamada para a API de IA
    } catch (error: any) {
      toast.error("Erro ao processar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUseIAText = () => {
    if (!promoAtual.texto_ia) return;
    setPromoAtual({ ...promoAtual, texto_promo: promoAtual.texto_ia });
    toast.success("Texto da IA aplicado à promoção!");
  };

  const handleDownloadImage = async () => {
    if (!promoAtual.imagem_ia) return;
    try {
      const response = await fetch(promoAtual.imagem_ia);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `imagem_ia_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar imagem:", error);
      toast.error("Erro ao baixar imagem");
    }
  };


  const handleSaveWebhook = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("integracoes")
        .select("id")
        .eq("tipo", "promocao")
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from("integracoes")
          .update({ webhook_url: webhookUrl })
          .eq("tipo", "promocao");
      } else {
        await supabase
          .from("integracoes")
          .insert({ webhook_url: webhookUrl, tipo: "promocao" });
      }
      
      toast.success("Webhook salvo!");
    } catch (error: any) {
      toast.error("Erro ao salvar webhook: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const triggerWebhook = async (tipo: "teste_promo" | "envio_promo") => {
    if (!webhookUrl) {
      toast.error("Configure a URL do webhook primeiro");
      return false;
    }

    const payload = {
      tipo: tipo.toLowerCase(),
      telefone: telContato,
      url_imagem: promoAtual.imagem_promo,
      texto_promo: promoAtual.texto_promo,
      data: new Date().toISOString()
    };

    try {
      // Use edge function proxy to avoid CORS issues
      const { data, error } = await supabase.functions.invoke('proxy-webhook', {
        body: {
          url: webhookUrl,
          method: "POST",
          body: payload
        }
      });

      if (error) throw error;
      
      return true;
    } catch (error: any) {
      console.error("Erro webhook:", error);
      toast.error("Erro ao disparar webhook: " + (error.message || "Erro desconhecido"));
      return false;
    }
  };

  const handleEnviarTeste = async () => {
    if (promoAtual.texto_promo && promoAtual.texto_promo.length > 920) {
      toast.error("O texto ultrapassa o limite de 920 caracteres.");
      return;
    }
    setSendingTest(true);
    const success = await triggerWebhook("teste_promo");
    if (success) {
      // Update testada to "sim"
      const { error } = await supabase
        .from("promocao")
        .update({ testada: "sim" })
        .eq("numero_promo", 0);
      
      if (!error) {
        setPromoAtual({ ...promoAtual, testada: "sim" });
      }
      toast.success("Teste enviado com sucesso!");
    }
    setSendingTest(false);
  };

  const handleEnviarConfirmado = async () => {
    setSendingPromo(true);
    setIsConfirmOpen(false);
    
    const success = await triggerWebhook("envio_promo");
    
    if (success) {
      try {
        // Save to history
        const nextNumero = historico.length > 0 
          ? Math.max(...historico.map(h => h.numero_promo)) + 1 
          : 1;

        const { error: histError } = await supabase
          .from("promocao")
          .insert({
            numero_promo: nextNumero,
            imagem_promo: promoAtual.imagem_promo,
            texto_promo: promoAtual.texto_promo,
            data_promo: new Date().toISOString()
          });

        if (histError) throw histError;

        toast.success("Promoção enviada e salva no histórico!");
        fetchData(); // Refresh history
      } catch (error: any) {
        toast.error("Erro ao salvar no histórico: " + error.message);
      }
    }
    
    setSendingPromo(false);
  };

  const handleDeletePromo = async () => {
    if (!promoToDelete) return;
    
    try {
      const { error } = await supabase
        .from("promocao")
        .delete()
        .eq("id", promoToDelete.id);
      
      if (error) throw error;
      
      toast.success("Registro de promoção excluído!");
      setHistorico(historico.filter(h => h.id !== promoToDelete.id));
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setIsDeleteConfirmOpen(false);
      setPromoToDelete(null);
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
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Promoções</h1>
          <p className="text-muted-foreground">Crie, envie e acompanhe o histórico de promoções da barbearia.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Gerados por IA */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Gerados por IA
              </CardTitle>
              <CardDescription>Utilize inteligência artificial para criar conteúdos para suas promoções.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Parte Texto */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 font-semibold text-lg">
                    <Type className="h-5 w-5 text-primary" />
                    Texto
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="prompt-texto">Prompt para criar texto</Label>
                    <Textarea
                      id="prompt-texto"
                      placeholder="Descreva como você quer o texto da promoção..."
                      className="min-h-[100px] bg-background"
                      value={promoAtual.prompt_texto || ""}
                      onChange={(e) => setPromoAtual({ ...promoAtual, prompt_texto: e.target.value })}
                    />
                    <Button 
                      className="w-full gap-2" 
                      onClick={handleGerarTexto} 
                      disabled={saving}
                    >
                      <Sparkles className="h-4 w-4" />
                      Gerar Texto
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Texto gerado pela IA</Label>
                    <div className="p-3 rounded-md bg-background border min-h-[100px] text-sm whitespace-pre-wrap italic text-muted-foreground mb-2">
                      {promoAtual.texto_ia || "O texto gerado aparecerá aqui..."}
                    </div>
                    {promoAtual.texto_ia && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full gap-2" 
                        onClick={handleUseIAText}
                      >
                        <Copy className="h-4 w-4" />
                        Usar texto para promoção
                      </Button>
                    )}
                  </div>
                </div>

                {/* Parte Imagem */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 font-semibold text-lg">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Imagem
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formato-imagem">Formato da Imagem</Label>
                    <Select value={formatoSelecionado} onValueChange={setFormatoSelecionado}>
                      <SelectTrigger id="formato-imagem" className="bg-background">
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        {formatosIA.map((f) => (
                          <SelectItem key={f.id} value={f.imagem_formato}>
                            {f.imagem_formato}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prompt-imagem">Prompt para criar imagem</Label>
                    <Textarea
                      id="prompt-imagem"
                      placeholder="Descreva como você quer a imagem da promoção..."
                      className="min-h-[100px] bg-background"
                      value={promoAtual.prompt_imagem || ""}
                      onChange={(e) => setPromoAtual({ ...promoAtual, prompt_imagem: e.target.value })}
                    />
                    <Button 
                      className="w-full gap-2" 
                      onClick={handleGerarImagem} 
                      disabled={saving}
                    >
                      <Wand2 className="h-4 w-4" />
                      Gerar imagem
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Imagem gerada pela IA</Label>
                    <div className="relative aspect-video rounded-lg border bg-background flex items-center justify-center overflow-hidden">
                      {promoAtual.imagem_ia ? (
                        <img src={promoAtual.imagem_ia} alt="IA Gerada" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4 text-sm text-muted-foreground">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          A imagem gerada aparecerá aqui
                        </div>
                      )}
                    </div>
                    
                    {promoAtual.imagem_ia && (
                      <div className="mt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2" 
                          onClick={handleDownloadImage}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cadastro de Promoção */}
          <Card className="md:row-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Promoção Atual
              </CardTitle>
              <CardDescription>Configure os dados que serão enviados na campanha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Imagem */}
              <div className="space-y-2">
                <Label>Imagem da Promoção</Label>
                <div className="relative aspect-video rounded-lg border-2 border-dashed bg-muted flex flex-col items-center justify-center overflow-hidden">
                  {promoAtual.imagem_promo ? (
                    <>
                      <img src={promoAtual.imagem_promo} alt="Promoção" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                          Trocar Imagem
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      ) : (
                        <>
                          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            Fazer Upload
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />
                </div>
              </div>

              {/* Texto */}
              <div className="space-y-2">
                <Label htmlFor="texto-promo">Texto da Promoção (cole aqui um texto escrito no WhatsApp)</Label>
                <Textarea
                  id="texto-promo"
                  placeholder="Ex: Corte + Barba com 20% de desconto nesta quarta!"
                  className={`min-h-[120px] ${promoAtual.texto_promo?.length > 920 ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  value={promoAtual.texto_promo || ""}
                  onChange={(e) => setPromoAtual({ ...promoAtual, texto_promo: e.target.value })}
                />
                <div className="flex justify-between text-xs">
                  <span className={promoAtual.texto_promo?.length > 920 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                    {promoAtual.texto_promo?.length || 0}/920 caracteres
                  </span>
                  {promoAtual.texto_promo?.length > 920 && (
                    <span className="text-red-500 font-medium italic">Limite excedido</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleSaveTexto} disabled={saving}>
                    <Save className="h-4 w-4" />
                    Salvar Texto
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white border-none" 
                    onClick={() => setPromoAtual({ ...promoAtual, texto_promo: "" })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Apagar Texto
                  </Button>
                </div>
              </div>

              {/* Botões de Envio */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <Button 
                  variant="secondary" 
                  className="gap-2" 
                  onClick={handleEnviarTeste}
                  disabled={sendingTest || !promoAtual.texto_promo}
                >
                  {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  Enviar Teste
                </Button>
                
                <Button 
                  className="gap-2" 
                  onClick={() => {
                    if (promoAtual.testada !== "sim") {
                      toast.error("Você precisa enviar um teste antes de enviar a promoção real.");
                      return;
                    }
                    if (promoAtual.texto_promo && promoAtual.texto_promo.length > 920) {
                      toast.error("O texto ultrapassa o limite de 920 caracteres.");
                      return;
                    }
                    setIsConfirmOpen(true);
                  }}
                  disabled={sendingPromo || !promoAtual.texto_promo}
                >
                  {sendingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar Promoção
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de Webhook */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5 text-primary" />
                URL do Webhook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="https://exemplo.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <Button size="icon" onClick={handleSaveWebhook} disabled={saving}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                URL que receberá os dados da promoção via POST.
              </p>
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Envios
              </CardTitle>
              <CardDescription>Últimas campanhas disparadas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {historico.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhuma promoção enviada ainda.
                  </div>
                ) : (
                  <div className="divide-y">
                    {historico.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center gap-4">
                        <div className="h-12 w-12 rounded overflow-hidden bg-muted flex-shrink-0">
                          {item.imagem_promo ? (
                            <img src={item.imagem_promo} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-full h-full p-2 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.texto_promo || "Sem texto"}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.data_promo), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedPromo(item)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setPromoToDelete(item);
                              setIsDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Popup de Confirmação */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio de promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente enviar a promoção para todos os usuários? Esta ação não pode ser desfeita e será registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnviarConfirmado}>
              Sim, enviar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o registro desta promoção do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePromo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detalhes da Promoção */}
      <Dialog open={!!selectedPromo} onOpenChange={(open) => !open && setSelectedPromo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Promoção</DialogTitle>
          </DialogHeader>
          {selectedPromo && (
            <div className="space-y-4">
              {selectedPromo.imagem_promo && (
                <div className="aspect-video rounded-lg overflow-hidden border">
                  <img src={selectedPromo.imagem_promo} className="w-full h-full object-contain bg-black" />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Data do Envio</Label>
                <p className="text-sm font-medium">
                  {format(new Date(selectedPromo.data_promo), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Texto Enviado</Label>
                <div className="p-4 rounded-lg bg-muted text-sm whitespace-pre-wrap">
                  {selectedPromo.texto_promo}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export default PromocaoPage;