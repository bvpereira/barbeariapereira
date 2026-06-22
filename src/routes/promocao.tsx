import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toLocalISOString } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
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
  Loader2, 
  Trash2, 
  Calendar,
  Eye,
  Save,
  ClipboardPaste,
  Copy,
  RefreshCw,
  MessageSquareText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/promocao")({
  component: PromocaoPage,
});

function PromocaoPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingPromo, setSendingPromo] = useState(false);
  
  const [promoAtual, setPromoAtual] = useState<any>({
    texto_promo: "",
    imagem_promo: null,
    imagem_banner: null,
    testada: "nao",
    tipo_promo: "",
    promo_para_quem: "",
  });

  // UI-only state for "Enviar para quem"
  const [paraQuemMode, setParaQuemMode] = useState<"todos" | "nunca_cortaram" | "dias" | "">("");
  const [paraQuemDias, setParaQuemDias] = useState<string>("");
  
  const [webhookUrl, setWebhookUrl] = useState("");
  const [telContato, setTelContato] = useState("");
  const [envioVia, setEnvioVia] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [promoToDelete, setPromoToDelete] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isTestInfoOpen, setIsTestInfoOpen] = useState(false);
  const [refreshingIa, setRefreshingIa] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track the current draft image + tenant id so the unmount cleanup
  // doesn't read stale state.
  const draftImageRef = useRef<{ url: string | null; barbeariaId: string | null }>({
    url: null,
    barbeariaId: null,
  });

  // Extract the storage object path from a public URL for a given bucket.
  const extractStoragePath = (url: string | null | undefined, bucket: string): string | null => {
    if (!url) return null;
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  };

  useEffect(() => {
    if (!tenantLoading && tenant) {
      fetchData();
    }
  }, [tenant, tenantLoading]);

  // Keep the draft ref in sync with current state.
  useEffect(() => {
    draftImageRef.current = {
      url: promoAtual.imagem_promo ?? null,
      barbeariaId: tenant?.id ?? null,
    };
  }, [promoAtual.imagem_promo, tenant?.id]);

  // On unmount: if there's a draft image still attached to row 0,
  // remove it from storage and clear it from the DB. Images that were
  // already sent are handled by handleEnviarConfirmado and persisted
  // on the history row.
  useEffect(() => {
    return () => {
      const { url, barbeariaId } = draftImageRef.current;
      if (!url || !barbeariaId) return;
      const path = extractStoragePath(url, "promocoes");
      (async () => {
        try {
          if (path) {
            await supabase.storage.from("promocoes").remove([path]);
          }
          await supabase
            .from("promocao")
            .update({ imagem_promo: null })
            .eq("numero_promo", 0)
            .eq("barbearia_id", barbeariaId);
        } catch (err) {
          console.error("Erro na limpeza da imagem ao sair da página:", err);
        }
      })();
    };
  }, []);

  const fetchData = async () => {
    if (!tenant) return;
    console.log("Fetching data for promotions page...");
    setLoading(true);
    try {
      // 1. Fetch current promo (numero_promo = 0)
      const { data: currentPromo, error: promoError } = await supabase
        .from("promocao")
        .select("*")
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id)
        .maybeSingle();
      
      if (promoError) {
        console.error("Erro ao buscar promoção atual:", promoError);
      } else if (currentPromo) {
        setPromoAtual(currentPromo);
        const pq = currentPromo.promo_para_quem;
        if (pq === "todos" || pq === "nunca_cortaram") {
          setParaQuemMode(pq);
          setParaQuemDias("");
        } else if (pq && /^\d+$/.test(pq)) {
          setParaQuemMode("dias");
          setParaQuemDias(pq);
        }
      }

      // 2. Fetch webhook URL for promotion
      const { data: integration, error: intError } = await supabase
        .from("integracoes")
        .select("webhook_url")
        .eq("tipo", "promocao")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (integration) setWebhookUrl(integration.webhook_url || "");

      // 3. Fetch tel_contato + envio_via
      const { data: info, error: infoError } = await supabase
        .from("informacoes")
        .select("tel_contato, envio_via")
        .eq("barbearia_id", tenant.id)
        .maybeSingle();
      
      if (info) {
        setTelContato(info.tel_contato || "");
        setEnvioVia(((info as any).envio_via as string) || "");
      }

      // 4. Fetch history (numero_promo > 0)
      const { data: history, error: histError } = await supabase
        .from("promocao")
        .select("*")
        .eq("barbearia_id", tenant.id)
        .gt("numero_promo", 0)
        .order("data_promo", { ascending: false });
      
      if (history) setHistorico(history);
      
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados da página");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBanner: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;

    setUploading(true);
    try {
      const bucket = "promocoes";
      const existingUrl = isBanner ? promoAtual.imagem_banner : promoAtual.imagem_promo;

      // Deletar imagem anterior se existir
      if (existingUrl) {
        const oldPath = extractStoragePath(existingUrl, bucket);
        if (oldPath) {
          try {
            await supabase.storage.from(bucket).remove([oldPath]);
          } catch (err) {
            console.error("Erro ao remover imagem anterior:", err);
          }
        }
      }

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const slot = isBanner ? "banner" : "promo";
      const filePath = `${tenant.id}/${slot}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { contentType: file.type || undefined, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      // Update Database
      const updateData: any = {};
      if (isBanner) {
        updateData.imagem_banner = publicUrl;
      } else {
        updateData.imagem_promo = publicUrl;
        updateData.imagem_upada = publicUrl;
        updateData.testada = "nao";
      }

      const { error: updateError } = await supabase
        .from("promocao")
        .update(updateData)
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id);

      if (updateError) throw updateError;

      if (isBanner) {
        setPromoAtual({ ...promoAtual, imagem_banner: publicUrl });
      } else {
        setPromoAtual({ ...promoAtual, imagem_promo: publicUrl, testada: "nao" });
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar imagem: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePromoImage = async () => {
    if (!tenant || !promoAtual.imagem_promo) return;
    setUploading(true);
    try {
      const path = extractStoragePath(promoAtual.imagem_promo, "promocoes");
      if (path) {
        await supabase.storage.from("promocoes").remove([path]);
      }
      const { error } = await supabase
        .from("promocao")
        .update({ imagem_promo: null, testada: "nao" })
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id);
      if (error) throw error;
      setPromoAtual({ ...promoAtual, imagem_promo: null, testada: "nao" });
      toast.success("Imagem removida com sucesso!");
    } catch (error: any) {
      console.error("Erro ao remover imagem:", error);
      toast.error("Erro ao remover imagem: " + (error.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!tenant || !promoAtual.imagem_banner) return;

    setUploading(true);
    try {
      const path = extractStoragePath(promoAtual.imagem_banner, "promocoes");
      if (path) {
        await supabase.storage.from("promocoes").remove([path]);
      }

      const { error } = await supabase
        .from("promocao")
        .update({ imagem_banner: null })
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id);

      if (error) throw error;

      setPromoAtual({ ...promoAtual, imagem_banner: null });
      toast.success("Banner removido com sucesso!");
    } catch (error: any) {
      console.error("Erro ao remover banner:", error);
      toast.error("Erro ao remover banner");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveTexto = async () => {
    if (!tenant) return;
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
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id);
      
      if (error) throw error;
      setPromoAtual({ ...promoAtual, testada: "nao" });
      toast.success("Texto da promoção salvo!");
    } catch (error: any) {
      toast.error("Erro ao salvar texto: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasteTexto = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPromoAtual({ ...promoAtual, texto_promo: text, testada: "nao" });
        toast.success("Texto colado com sucesso!");
      } else {
        toast.error("Nenhum texto encontrado na área de transferência.");
      }
    } catch (err) {
      console.error("Erro ao colar texto:", err);
      toast.error("Erro ao acessar a área de transferência. Verifique as permissões do seu navegador.");
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
      barbearia_id: tenant?.id,
      id_barbearia: tenant?.id,
      ID_BARBEARIA: tenant?.id,
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

  const computeParaQuem = (): string | null => {
    if (paraQuemMode === "todos" || paraQuemMode === "nunca_cortaram") return paraQuemMode;
    if (paraQuemMode === "dias") {
      if (!/^\d+$/.test(paraQuemDias)) return null;
      return paraQuemDias;
    }
    return null;
  };

  const validarCamposEnvio = (): { tipo: string; paraQuem: string } | null => {
    if (!promoAtual.tipo_promo) {
      toast.error('Selecione o "Tipo de envio".');
      return null;
    }
    if (promoAtual.tipo_promo === "imagem_legenda" && !promoAtual.imagem_promo) {
      toast.error('Faça o upload de uma imagem para enviar como "Imagem com legenda".');
      return null;
    }
    const paraQuem = computeParaQuem();
    if (!paraQuem) {
      toast.error('Preencha o campo "Enviar para quem".');
      return null;
    }
    return { tipo: promoAtual.tipo_promo, paraQuem };
  };

  const persistirTipoEParaQuem = async (tipo: string, paraQuem: string) => {
    if (!tenant) return;
    await supabase
      .from("promocao")
      .update({ tipo_promo: tipo, promo_para_quem: paraQuem })
      .eq("numero_promo", 0)
      .eq("barbearia_id", tenant.id);
  };


  const handleEnviarTeste = async () => {
    if (!tenant) return;
    const validos = validarCamposEnvio();
    if (!validos) return;
    if (promoAtual.texto_promo && promoAtual.texto_promo.length > 920) {
      toast.error("O texto ultrapassa o limite de 920 caracteres.");
      return;
    }
    await persistirTipoEParaQuem(validos.tipo, validos.paraQuem);
    
    // Salvar texto automaticamente antes de enviar o teste
    setSendingTest(true);
    try {
      const { error: saveError } = await supabase
        .from("promocao")
        .update({ 
          texto_promo: promoAtual.texto_promo,
          testada: "sim"
        })
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id);
      
      if (saveError) throw saveError;
      
      // Atualiza o estado local para marcar como testada e o texto salvo
      setPromoAtual({ ...promoAtual, testada: "sim" });
    } catch (error: any) {
      console.error("Erro ao salvar texto antes do teste:", error);
    }

    const success = await triggerWebhook("teste_promo");
    if (success) {
      setIsTestInfoOpen(true);
    }
    setSendingTest(false);
  };

  const refreshIaTextos = async () => {
    if (!tenant) return;
    setRefreshingIa(true);
    try {
      const { data, error } = await supabase
        .from("promocao")
        .select("texto_promo, texto_promo_ia_2, texto_promo_ia_3")
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setPromoAtual((prev: any) => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      toast.error("Erro ao atualizar textos: " + (err.message || ""));
    } finally {
      setRefreshingIa(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado!");
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
  };

  const handleApagarTexto = async () => {
    if (!tenant) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("promocao")
        .update({ 
          texto_promo: "",
          testada: "nao"
        })
        .eq("numero_promo", 0)
        .eq("barbearia_id", tenant.id);
      
      if (error) throw error;
      
      setPromoAtual({ ...promoAtual, texto_promo: "", testada: "nao" });
      toast.success("Texto apagado do banco de dados!");
    } catch (error: any) {
      console.error("Erro ao apagar texto:", error);
      toast.error("Erro ao apagar texto: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarConfirmado = async () => {
    if (!tenant) return;
    setSendingPromo(true);
    setIsConfirmOpen(false);
    
    // Armazenar os dados atuais antes de limpar
    const textoParaHistorico = promoAtual.texto_promo;
    const imagemParaLimpar = promoAtual.imagem_promo;

    const success = await triggerWebhook("envio_promo");
    
    if (success) {
      try {
        // 1. Save to history (keeps the image URL so it shows in history)
        const nextNumero = historico.length > 0
          ? Math.max(...historico.map(h => h.numero_promo)) + 1
          : 1;

        const incluiImagem = promoAtual.tipo_promo === "imagem_legenda" && !!imagemParaLimpar;

        const { error: histError } = await supabase
          .from("promocao")
          .insert({
            barbearia_id: tenant.id,
            numero_promo: nextNumero,
            texto_promo: textoParaHistorico,
            imagem_promo: incluiImagem ? imagemParaLimpar : null,
            tipo_promo: promoAtual.tipo_promo || null,
            promo_para_quem: computeParaQuem() || promoAtual.promo_para_quem || null,
            data_promo: toLocalISOString()
          });

        if (histError) throw histError;

        // 2. Atualizar contador mensal de promoções enviadas (reset no início de cada mês).
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const prevCount = promoAtual.last_reset_month === currentMonth
          ? (promoAtual.num_promo_criadas || 0)
          : 0;
        const newCount = prevCount + 1;

        // 3. Backup text to auxiliar column and clear text and image from Row 0 in database.
        // The image file stays in storage because it now belongs to the history row.
        const { error: clearError } = await supabase
          .from("promocao")
          .update({
            texto_promo: "",
            texto_promo_auxiliar: textoParaHistorico,
            imagem_promo: null,
            testada: "nao",
            num_promo_criadas: newCount,
            last_reset_month: currentMonth,
          })
          .eq("numero_promo", 0)
          .eq("barbearia_id", tenant.id);

        if (clearError) throw clearError;

        setPromoAtual((prev: any) => ({
          ...prev,
          num_promo_criadas: newCount,
          last_reset_month: currentMonth,
        }));

        // 3. If the promo was Text-only but had a leftover image, remove it from storage.
        if (!incluiImagem && imagemParaLimpar) {
          const path = extractStoragePath(imagemParaLimpar, "promocoes");
          if (path) {
            try {
              await supabase.storage.from("promocoes").remove([path]);
            } catch (err) {
              console.error("Erro ao remover imagem do storage:", err);
            }
          }
        }

        // 4. Reset local state
        setPromoAtual({
          ...promoAtual,
          texto_promo: "",
          imagem_promo: null,
          testada: "nao"
        });

        toast.success("Promoção enviada e limpa com sucesso!");
        fetchData(); // Refresh history
      } catch (error: any) {
        console.error("Erro após envio da promoção:", error);
        toast.error("Erro ao processar limpeza pós-envio: " + error.message);
      }
    }
    
    setSendingPromo(false);
  };

  const handleDeletePromo = async () => {
    if (!promoToDelete) return;

    try {
      // Remove image from storage if this history row had one
      if (promoToDelete.imagem_promo) {
        const path = extractStoragePath(promoToDelete.imagem_promo, "promocoes");
        if (path) {
          try {
            await supabase.storage.from("promocoes").remove([path]);
          } catch (err) {
            console.error("Erro ao remover imagem do histórico:", err);
          }
        }
      }

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
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Notificações e Promoções</h1>
          <p className="text-muted-foreground">Crie, envie e acompanhe o histórico de notificações e promoções da barbearia.</p>
        </div>


        {/* Banner + Cards de uso mensal lado a lado */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload de Banner para a página de clientes */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Banner para Clientes
              </CardTitle>
              <CardDescription>Esta imagem aparecerá no topo da página do cliente (Barber Web).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="relative w-full md:w-64 aspect-video rounded-lg border-2 border-dashed border-primary/30 bg-background flex items-center justify-center overflow-hidden">
                  {promoAtual.imagem_banner ? (
                    <img src={promoAtual.imagem_banner} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                      <p className="text-xs text-muted-foreground">Sem banner</p>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => handleImageUpload(e as any, true);
                        input.click();
                      }}
                      disabled={uploading}
                      className="gap-2"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {promoAtual.imagem_banner ? "Alterar Banner" : "Fazer Upload"}
                    </Button>

                    {promoAtual.imagem_banner && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteBanner}
                        disabled={uploading}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    * Recomendado: 1200x400px ou proporção 3:1 para melhor exibição.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coluna direita: envio atual + cards de uso mensal (3 cards empilhados) */}
          {(() => {
            const isWhats = envioVia === "Whatsapp";
            const isEmail = envioVia === "E-mail";
            const color = isWhats
              ? "text-green-500 border-green-500/40 bg-green-500/10"
              : isEmail
              ? "text-yellow-500 border-yellow-500/40 bg-yellow-500/10"
              : "text-muted-foreground border-primary/15 bg-background/40";
            const currentMonth = new Date().toISOString().slice(0, 7);
            const enviadas = promoAtual.last_reset_month === currentMonth
              ? (promoAtual.num_promo_criadas || 0)
              : 0;
            const limite = promoAtual.num_limite_promo;
            const disponiveis = typeof limite === "number" ? Math.max(0, limite - enviadas) : null;
            return (
              <div className="flex flex-col gap-4">
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardDescription>Atualmente o envio está sendo via</CardDescription>
                    <div className={`mt-1 rounded-md border px-3 py-2 text-center text-lg font-semibold ${color}`}>
                      {envioVia || "Não definido"}
                    </div>
                    {isEmail && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Estamos trabalhando para que o envio via Whatsapp seja restabelecido em breve.
                      </p>
                    )}
                  </CardHeader>
                </Card>
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardDescription>Notificações/Promoções enviadas neste mês</CardDescription>
                    <CardTitle className="text-3xl text-primary">{enviadas}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardDescription>Notificações/Promoções disponíveis neste mês</CardDescription>
                    <CardTitle className="text-3xl text-primary">
                      {disponiveis === null ? "—" : disponiveis}
                      {typeof limite === "number" && (
                        <span className="text-base text-muted-foreground font-normal"> / {limite}</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            );
          })()}

        </div>


        {/* Cadastro de Promoção (largura total) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Notificação/Promoção Atual
            </CardTitle>
            <CardDescription>Configure os dados que serão enviados na campanha.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">

              <div className="space-y-6">
              {/* Tipo de envio */}
              <div className="space-y-2">
                <Label>Tipo de envio</Label>
                <RadioGroup
                  value={promoAtual.tipo_promo || ""}
                  onValueChange={(v) => setPromoAtual({ ...promoAtual, tipo_promo: v })}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="texto" id="tipo-texto" />
                    <Label htmlFor="tipo-texto" className="font-normal cursor-pointer">Texto</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="imagem_legenda" id="tipo-imagem" />
                    <Label htmlFor="tipo-imagem" className="font-normal cursor-pointer">Imagem com legenda</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Enviar para quem */}
              <div className="space-y-2">
                <Label>Enviar para quem</Label>
                <RadioGroup
                  value={paraQuemMode || ""}
                  onValueChange={(v) => setParaQuemMode(v as any)}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="todos" id="pq-todos" />
                    <Label htmlFor="pq-todos" className="font-normal cursor-pointer">Todos</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nunca_cortaram" id="pq-nunca" />
                    <Label htmlFor="pq-nunca" className="font-normal cursor-pointer">Nunca cortaram</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="dias" id="pq-dias" />
                    <Label htmlFor="pq-dias" className="font-normal cursor-pointer">Dias sem atendimento</Label>
                  </div>
                </RadioGroup>
                {paraQuemMode === "dias" && (
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Ex: 30"
                    value={paraQuemDias}
                    onChange={(e) => setParaQuemDias(e.target.value.replace(/\D/g, ""))}
                    className="max-w-[180px]"
                  />
                )}
              </div>
              </div>

              <div className="space-y-6">
              {/* Imagem */}
              <div className="space-y-2">

                <Label>Imagem da Notificação/Promoção</Label>
                <div className="flex flex-col gap-4">
                  <div className="relative aspect-video rounded-lg border-2 border-dashed bg-muted flex flex-col items-center justify-center overflow-hidden">
                    {promoAtual.imagem_promo ? (
                      <img src={promoAtual.imagem_promo} alt="Promoção" className="w-full h-full object-cover" />
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

                  {promoAtual.imagem_promo && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                        Alterar Imagem
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={handleDeletePromoImage}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Excluir Imagem
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              </div>

              <div className="space-y-6">
              {/* Texto */}
              <div className="space-y-2">

                <Label htmlFor="texto-promo">Texto da Notificação/Promoção (cole aqui um texto escrito no WhatsApp)</Label>
                <Textarea
                  id="texto-promo"
                  placeholder="Ex: Aviso importante ou Corte + Barba com 20% de desconto nesta quarta!"
                  className={`min-h-[120px] ${promoAtual.texto_promo?.length > 920 ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  value={promoAtual.texto_promo || ""}
                  onChange={(e) => setPromoAtual({ ...promoAtual, texto_promo: e.target.value })}
                  disabled={promoAtual.testada === "sim"}
                />
                <div className="flex justify-between text-xs">
                  <span className={promoAtual.texto_promo?.length > 920 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                    {promoAtual.texto_promo?.length || 0}/920 caracteres
                  </span>
                  {promoAtual.texto_promo?.length > 920 && (
                    <span className="text-red-500 font-medium italic">Limite excedido</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full gap-2 bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100" 
                    onClick={handlePasteTexto}
                    disabled={promoAtual.testada === "sim"}
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    Colar Texto
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white border-none" 
                    onClick={handleApagarTexto}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                  disabled={sendingTest || !promoAtual.texto_promo || !promoAtual.tipo_promo || !computeParaQuem() || (promoAtual.tipo_promo === "imagem_legenda" && !promoAtual.imagem_promo)}
                >
                  {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  Enviar Teste
                </Button>
                
                <Button 
                  className="gap-2" 
                  onClick={async () => {
                    if (promoAtual.testada !== "sim") {
                      toast.error("Você precisa enviar um teste antes do envio real.");
                      return;
                    }
                    const validos = validarCamposEnvio();
                    if (!validos) return;
                    if (promoAtual.texto_promo && promoAtual.texto_promo.length > 920) {
                      toast.error("O texto ultrapassa o limite de 920 caracteres.");
                      return;
                    }
                    await persistirTipoEParaQuem(validos.tipo, validos.paraQuem);
                    setIsConfirmOpen(true);
                  }}
                  disabled={sendingPromo || !promoAtual.texto_promo || !promoAtual.tipo_promo || !computeParaQuem() || (promoAtual.tipo_promo === "imagem_legenda" && !promoAtual.imagem_promo)}
                >
                  {sendingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar Notificação/Promoção
                </Button>
              </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Textos da notificação/promoção */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-primary" />
                    Textos da notificação/promoção
                  </CardTitle>
                  <CardDescription>Texto do teste e textos geradas pela IA</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={refreshIaTextos}
                  disabled={refreshingIa}
                >
                  {refreshingIa ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {promoAtual.texto_promo ? (
                <>
                  <div className="space-y-2">
                    <Label>Texto do teste</Label>
                    <Textarea
                      readOnly
                      value={promoAtual.texto_promo || ""}
                      className="min-h-[100px] bg-muted/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto 1 criado pela IA</Label>
                    <Textarea
                      readOnly
                      value={promoAtual.texto_promo_ia_2 || ""}
                      className="min-h-[100px] bg-muted/40"
                      placeholder="Aguardando geração pela IA..."
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleCopyText(promoAtual.texto_promo_ia_2 || "")}
                      disabled={!promoAtual.texto_promo_ia_2}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar texto
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Texto 2 criado pela IA</Label>
                    <Textarea
                      readOnly
                      value={promoAtual.texto_promo_ia_3 || ""}
                      className="min-h-[100px] bg-muted/40"
                      placeholder="Aguardando geração pela IA..."
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleCopyText(promoAtual.texto_promo_ia_3 || "")}
                      disabled={!promoAtual.texto_promo_ia_3}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar texto
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum texto disponível ainda. Envie um teste e clique em "Atualizar" para ver os textos gerados.
                </p>
              )}
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
                    Nenhuma notificação/promoção enviada ainda.
                  </div>
                ) : (
                  <div className="divide-y">
                    {historico.map((item) => {
                      const paraQuemLabel =
                        item.promo_para_quem === "todos"
                          ? "Todos"
                          : item.promo_para_quem === "nunca_cortaram"
                          ? "Nunca cortaram"
                          : /^\d+$/.test(item.promo_para_quem || "")
                          ? `${item.promo_para_quem} dias sem atendimento`
                          : null;
                      return (
                      <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center gap-4">
                        {item.imagem_promo ? (
                          <img
                            src={item.imagem_promo}
                            alt="Imagem da promoção"
                            className="h-12 w-12 rounded object-cover flex-shrink-0 border"
                          />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.texto_promo || "Sem texto"}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(item.data_promo), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                            {paraQuemLabel && (
                              <>
                                <span>•</span>
                                <span>Enviado para: {paraQuemLabel}</span>
                              </>
                            )}
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
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Popup informativo após Enviar Teste */}
      <AlertDialog open={isTestInfoOpen} onOpenChange={setIsTestInfoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teste enviado!</AlertDialogTitle>
            <AlertDialogDescription>
              Em poucos instantes você receberá o resultado do teste no WhatsApp.
              Você também pode clicar em "Atualizar" na área "Textos da notificação/promoção"
              para ver os textos gerados pela IA assim que estiverem prontos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsTestInfoOpen(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Popup de Confirmação */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente enviar a notificação/promoção para todos os usuários selecionados? Esta ação não pode ser desfeita e será registrada no histórico.
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
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente este registro do histórico.
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
            <DialogTitle>Detalhes do Envio</DialogTitle>
          </DialogHeader>
          {selectedPromo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Data do Envio</Label>
                <p className="text-sm font-medium">
                  {format(new Date(selectedPromo.data_promo), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {selectedPromo.imagem_promo && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Imagem Enviada</Label>
                  <img
                    src={selectedPromo.imagem_promo}
                    alt="Imagem da promoção"
                    className="w-full max-h-80 object-contain rounded-lg border bg-muted"
                  />
                </div>
              )}
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