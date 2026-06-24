import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Image as ImageIcon, Save, Upload, X, Download, AlertCircle, Copy, Check } from "lucide-react";
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

type EditFieldKey =
  | "edit_tipo_fundo" | "edit_cor_fundo" | "edit_textura_fundo"
  | "edit_tipo_iluminacao" | "edit_intensidade_luz" | "edit_temperatura_cor" | "edit_sombra"
  | "edit_estilo_cor" | "edit_nivel_retoque" | "edit_nitidez" | "edit_formato"
  | "edit_tipo_produto" | "edit_acessorios" | "edit_escala_produto";

type EditField = { key: EditFieldKey; label: string; options: readonly string[]; onlyInfinite?: boolean };

const EDIT_SECTIONS: ReadonlyArray<{ title: string; fields: ReadonlyArray<EditField> }> = [
  {
    title: "Fundo e cenário",
    fields: [
      { key: "edit_tipo_fundo", label: "Tipo de fundo", options: ["Fundo infinito", "Fundo desfocado", "Ambiente natural", "Ambiente urbano", "Estúdio minimalista", "Manter fundo original"] },
      { key: "edit_cor_fundo", label: "Cor do fundo infinito", options: ["Branco", "Preto", "Cinza", "Chumbo", "Azul", "Automático (cores do produto)"], onlyInfinite: true },
      { key: "edit_textura_fundo", label: "Textura do fundo", options: ["Lisa", "Concreto", "Madeira", "Mármore", "Tecido", "Sem textura"] },
    ],
  },
  {
    title: "Iluminação",
    fields: [
      { key: "edit_tipo_iluminacao", label: "Tipo de iluminação", options: ["Luz de estúdio (softbox)", "Luz natural suave", "Luz dramática (contraste alto)", "Luz lateral", "Luz de produto (ring light)", "Contraluz (backlight)"] },
      { key: "edit_intensidade_luz", label: "Intensidade da luz", options: ["Suave", "Equilibrada", "Intensa"] },
      { key: "edit_temperatura_cor", label: "Temperatura da cor", options: ["Fria (azulada)", "Neutra", "Quente (amarelada)"] },
      { key: "edit_sombra", label: "Sombra", options: ["Sem sombra", "Sombra suave no chão", "Sombra projetada", "Sombra espelhada (reflexo)"] },
    ],
  },
  {
    title: "Tratamento da imagem",
    fields: [
      { key: "edit_estilo_cor", label: "Estilo de cor", options: ["Natural e fiel", "Cores vibrantes", "Tons pastéis", "Preto e branco", "Vintage/filme", "High key (muito claro)", "Low key (muito escuro)"] },
      { key: "edit_nivel_retoque", label: "Nível de retoque", options: ["Sem retoque", "Retoque leve (remover imperfeições)", "Retoque completo (pele/produto perfeito)"] },
      { key: "edit_nitidez", label: "Nitidez", options: ["Padrão", "Hiper-nítido", "Levemente suavizado"] },
      { key: "edit_formato", label: "Formato", options: ["Quadrado", "Vertical", "horizontal"] },
    ],
  },
  {
    title: "Produto e contexto",
    fields: [
      { key: "edit_tipo_produto", label: "Tipo de produto", options: ["Produto isolado", "Produto em uso", "Produto com props/acessórios", "Produto em embalagem"] },
      { key: "edit_acessorios", label: "Props/Acessórios", options: ["Sem props", "Flores e folhas", "Tecidos e texturas", "Alimentos (para culinária)", "Objetos de lifestyle", "Deixar a IA sugerir"] },
      { key: "edit_escala_produto", label: "Escala do produto na imagem", options: ["Produto pequeno (ambiente em destaque)", "Produto médio (equilibrado)", "Produto grande (produto em destaque)", "Produto ocupando quase toda a imagem"] },
    ],
  },
];

const EMPTY_EDIT_SELECTIONS = Object.fromEntries(
  EDIT_SECTIONS.flatMap((section) => section.fields.map((field) => [field.key, ""])),
) as Record<EditFieldKey, string>;

const IMAGE_CREATION_WEBHOOK_URL = "https://n8n.servidorpereira.shop/webhook-test/bfa3904d-7309-4c15-baf5-e762c939df92";

export const Route = createFileRoute("/iaimagem")({
  component: IAImagemPage,
});

function IAImagemPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImageUrlRef = useRef<string | null>(null);
  const isGenerationConfirmedRef = useRef(false);
  const [options, setOptions] = useState<Record<string, string[]>>({
    imagem_objetivo: [],
    imagem_campanha: [],
    imagem_estilovisual: [],
    imagem_informacoes: [],
    imagem_imareferencia: [],
    imagem_comlogo: [],
    imagem_formato: [],
    texto_estilo: ["Estilo formal", "Estilo informal"],
    texto_emoji: ["Com emojis", "Sem emojis"],
    imagem_endereco: ["Com endereço", "Sem endereço"],
    imagem_instagram: ["Com instagram", "Sem instagram"],
    imagem_telcontato: ["Com telefone", "Sem telefone"],
    texto_endereco: ["Com endereço", "Sem endereço"],
    texto_instagram: ["Com instagram", "Sem instagram"],
    texto_telcontato: ["Com telefone", "Sem telefone"],
    tom_comunicacao: ["Urgente", "Amigável", "Sofisticado", "descontraído", "Técnico"],
    imagem_paleta: ["Neutros", "Vibrantes", "Dark", "Pastéis", "Minha paleta (baseada no logo)"],
    imagem_elem_central: ["Produto", "Pessoa", "Texto", "Ambiente", "Ícone"],
  });
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [createdImageUrl, setCreatedImageUrl] = useState<string | null>(null);
  const [createdCaption, setCreatedCaption] = useState<string | null>(null);
  const [numImagensCriadas, setNumImagensCriadas] = useState(0);
  const [numLimiteImagens, setNumLimiteImagens] = useState(0);
  const [lastResetMonth, setLastResetMonth] = useState("");
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [generationType, setGenerationType] = useState<"ambos" | "imagem" | "legenda">("ambos");
  const [editSelections, setEditSelections] = useState<Record<EditFieldKey, string>>({ ...EMPTY_EDIT_SELECTIONS });
  const [editUploadedImage, setEditUploadedImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editUploadedPathRef = useRef<string | null>(null);
  const isEditConfirmedRef = useRef(false);

  const [selections, setSelections] = useState<Record<string, string>>({
    imagem_objetivo: "",
    imagem_campanha: "",
    imagem_estilovisual: "",
    imagem_informacoes: "",
    imagem_imareferencia: "",
    imagem_comlogo: "",
    imagem_formato: "",
    texto_estilo: "",
    texto_emoji: "",
    imagem_endereco: "",
    imagem_instagram: "",
    imagem_telcontato: "",
    texto_endereco: "",
    texto_instagram: "",
    texto_telcontato: "",
    tom_comunicacao: "",
    imagem_paleta: "",
    imagem_elem_central: "",
  });

  const fields = [
    { key: "imagem_informacoes", label: "Informações Adicionais" },
    { key: "imagem_objetivo", label: "Objetivo da Imagem" },
    { key: "imagem_campanha", label: "Campanha" },
    { key: "tom_comunicacao", label: "Tom de comunicação" },
    { key: "imagem_estilovisual", label: "Estilo Visual" },
    { key: "imagem_paleta", label: "Paleta de cores" },
    { key: "imagem_elem_central", label: "Elemento central" },
    { key: "imagem_formato", label: "Formato de Imagem" },
    { key: "imagem_comlogo", label: "Com Logo?" },
    { key: "imagem_imareferencia", label: "Imagem de Referência" },
    { key: "imagem_endereco", label: "Com endereço? (Imagem)" },
    { key: "imagem_instagram", label: "Com instagram? (Imagem)" },
    { key: "imagem_telcontato", label: "Com telefone de contato? (Imagem)" },
    { key: "texto_estilo", label: "Estilo de Texto" },
    { key: "texto_emoji", label: "Uso de emojis" },
    { key: "texto_endereco", label: "Com endereço? (Texto)" },
    { key: "texto_instagram", label: "Com instagram? (Texto)" },
    { key: "texto_telcontato", label: "Com telefone de contato? (Texto)" },
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
          if (payload.new) {
            if ((payload.new as any).imagem_criada_ia !== undefined) {
              setCreatedImageUrl((payload.new as any).imagem_criada_ia);
            }
            if ((payload.new as any).legenda_criada_ia !== undefined) {
              setCreatedCaption((payload.new as any).legenda_criada_ia);
            }
            if ((payload.new as any).edit_imagemeditada !== undefined) {
              setEditedImage((payload.new as any).edit_imagemeditada || null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      
      // Limpeza da imagem de referência se não foi confirmada a geração
      if (!isGenerationConfirmedRef.current && uploadedImageUrlRef.current && tenant?.id) {
        console.log("Limpando imagem de referência não utilizada do banco de dados...");
        const tenantId = tenant.id;
        supabase
          .from("agentes_ia")
          .update({ imagem_referencia_ia: null })
          .eq("barbearia_id", tenantId)
          .then(({ error }) => {
            if (error) console.error("Erro ao limpar imagem de referência:", error);
          });
        // Também remove o arquivo do storage
        const filePath = `${tenantId}/referencia/imagem_referencia.jpg`;
        supabase.storage.from("informacoes_imagens").remove([filePath]).then(({ error }) => {
          if (error) console.error("Erro ao remover arquivo de referência do storage:", error);
        });
      }

      if (!isEditConfirmedRef.current && editUploadedPathRef.current) {
        const editPath = editUploadedPathRef.current;
        supabase
          .from("agentes_ia")
          .update({ edit_imagemupada: null })
          .eq("barbearia_id", tenant.id)
          .then(({ error }) => {
            if (error) console.error("Erro ao limpar imagem de edição:", error);
          });
        supabase.storage.from("informacoes_imagens").remove([editPath]).then(({ error }) => {
          if (error) console.error("Erro ao remover imagem de edição do storage:", error);
        });
      }
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
        setCreatedCaption(selectionData.legenda_criada_ia || null);
        setNumLimiteImagens(selectionData.num_limite_imagens || 0);
        setEditUploadedImage(null);
        setEditedImage((selectionData as any).edit_imagemeditada || null);
        setEditSelections({ ...EMPTY_EDIT_SELECTIONS });
        
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

        // Campos sempre iniciam vazios (não carregamos seleções do banco).

      }

      const newOptions: Record<string, string[]> = {
        imagem_objetivo: ["Captar cliente", "Vender", "Teste objetivo", "engajamento", "Institucional", "Retenção"],
        imagem_campanha: ["Promoção", "Data comemorativa", "Lançamento", "Conteúdo informativo", "Depoimento", "Urgência", "Dica/tutorial"],
        imagem_estilovisual: ["Minimalista", "Agressivo em vendas", "Fotorealista", "Moderno", "Limpo", "Corporativo", "Divertido", "Luxury/Premium", "Flat design", "Tipográfico"],
        imagem_informacoes: [],
        imagem_imareferencia: [],
        imagem_comlogo: ["Com logo", "Sem logo"],
        imagem_formato: ["Quadrado", "Vertical", "Horizontal"],
        texto_estilo: ["Estilo formal", "Estilo informal"],
        texto_emoji: ["Com emojis", "Sem emojis"],
        imagem_endereco: ["Com endereço", "Sem endereço"],
        imagem_instagram: ["Com instagram", "Sem instagram"],
        imagem_telcontato: ["Com telefone", "Sem telefone"],
        texto_endereco: ["Com endereço", "Sem endereço"],
        texto_instagram: ["Com instagram", "Sem instagram"],
        texto_telcontato: ["Com telefone", "Sem telefone"],
        tom_comunicacao: ["Urgente", "Amigável", "Sofisticado", "descontraído", "Técnico"],
        imagem_paleta: ["Neutros", "Vibrantes", "Dark", "Pastéis", "Minha paleta (baseada no logo)"],
        imagem_elem_central: ["Produto", "Pessoa", "Texto", "Ambiente", "Ícone"],
      };

      setOptions(newOptions);
    } catch (error) {
      console.error("Erro ao buscar opções:", error);
      toast.error("Erro ao carregar opções dos campos.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (type: "ambos" | "imagem" | "legenda") => {
    if (!tenant) return;

    // Verificar limite de imagens (apenas para imagem ou ambos)
    if (type !== "legenda" && numLimiteImagens > 0 && numImagensCriadas >= numLimiteImagens) {
      setShowLimitAlert(true);
      return;
    }

    const subAreas = {
      dadosCriacao: ["imagem_informacoes", "imagem_objetivo", "imagem_campanha", "tom_comunicacao"],
      visualReferencia: ["imagem_estilovisual", "imagem_paleta", "imagem_elem_central", "imagem_formato", "imagem_comlogo", "imagem_imareferencia", "imagem_endereco", "imagem_instagram", "imagem_telcontato"],
      configuracoesTexto: ["texto_estilo", "texto_emoji", "texto_endereco", "texto_instagram", "texto_telcontato"]
    };

    let requiredFields: string[] = [];
    if (type === "ambos") {
      requiredFields = [...subAreas.dadosCriacao, ...subAreas.visualReferencia, ...subAreas.configuracoesTexto];
    } else if (type === "imagem") {
      requiredFields = [...subAreas.dadosCriacao, ...subAreas.visualReferencia];
    } else if (type === "legenda") {
      requiredFields = [...subAreas.dadosCriacao, ...subAreas.configuracoesTexto];
    }

    const missingFields = fields
      .filter((field) => requiredFields.includes(field.key))
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

    // Validação: "Minha paleta (baseada no logo)" requer "Com logo"
    if (
      (type === "ambos" || type === "imagem") &&
      selections.imagem_paleta === "Minha paleta (baseada no logo)" &&
      selections.imagem_comlogo !== "Com logo"
    ) {
      toast.error("Para usar 'Minha paleta (baseada no logo)' é necessário selecionar 'Com logo' no campo 'Com logo?'.");
      return;
    }

    setGenerationType(type);
    setShowConfirmModal(true);
  };

  const confirmGenerate = async () => {
    if (!tenant) return;
    setShowConfirmModal(false);
    setSaving(true);
    isGenerationConfirmedRef.current = true;
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let newCount = numImagensCriadas;
      let newResetMonth = lastResetMonth;

      // Incrementar se for imagem ou ambos
      if (generationType !== "legenda") {
        newCount = numImagensCriadas + 1;
        if (lastResetMonth !== currentMonth) {
          newCount = 1;
          newResetMonth = currentMonth;
        }
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
          texto_estilo: selections.texto_estilo,
          texto_emoji: selections.texto_emoji,
          imagem_endereco: selections.imagem_endereco,
          imagem_instagram: selections.imagem_instagram,
          imagem_telcontato: selections.imagem_telcontato,
          texto_endereco: selections.texto_endereco,
          texto_instagram: selections.texto_instagram,
          texto_telcontato: selections.texto_telcontato,
          tom_comunicacao: selections.tom_comunicacao,
          imagem_paleta: selections.imagem_paleta,
          imagem_elem_central: selections.imagem_elem_central,
          num_imagens_criadas: newCount,
          last_reset_month: newResetMonth,
          oq_criar: generationType,
        })
        .eq("barbearia_id", tenant.id);

      if (updateError) throw updateError;

      // Atualizar estado local do contador
      setNumImagensCriadas(newCount);
      setLastResetMonth(newResetMonth);

      // 2. Buscar o webhook atualizado diretamente da tabela integracoes (removido filtro por barbearia para usar o global)
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
          action: "generate_image",
          oq_criar: generationType,
        }),
      });

      // Nota: Com mode 'no-cors', não conseguimos ler response.ok ou status
      // Mas o fetch dispara a requisição.
      toast.success("Geração de imagem solicitada com sucesso!");

      // Limpar campos gerados após o sucesso, mas manter as seleções
      // para que o usuário saiba o que foi enviado e possa ajustar se necessário.
      // (Campos de seleção não são mais resetados para strings vazias aqui)
      
      // No entanto, se quiser manter o comportamento de reset após a geração, 
      // descomente abaixo, mas por agora vamos manter para persistência visual.
      /*
      setSelections({
        imagem_objetivo: "",
        imagem_campanha: "",
        imagem_estilovisual: "",
        imagem_informacoes: "",
        imagem_imareferencia: "",
        imagem_comlogo: "",
        imagem_formato: "",
        texto_estilo: "",
        texto_emoji: "",
        imagem_endereco: "",
        imagem_instagram: "",
        imagem_telcontato: "",
        texto_endereco: "",
        texto_instagram: "",
        texto_telcontato: "",
      });
      */

    } catch (error: any) {
      console.error("Erro no processo de geração:", error);
      toast.error(error.message || "Erro ao processar a solicitação.");
    } finally {
      setSaving(false);
    }
  };

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    setUploadingRef(true);
    try {
      // Nome único por barbearia
      const fileName = `${tenant.id}/referencia/imagem_referencia.jpg`;
      
      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("informacoes_imagens")
        .upload(fileName, file, {
          upsert: true 
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("informacoes_imagens")
        .getPublicUrl(fileName);

      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      
      // Salvar a URL na nova coluna da barbearia
      const { error: dbError } = await supabase
        .from("agentes_ia")
        .update({ imagem_referencia_ia: finalUrl })
        .eq("barbearia_id", tenant.id);

      if (dbError) throw dbError;

      setSelections(prev => ({ ...prev, imagem_imareferencia: finalUrl }));
      uploadedImageUrlRef.current = finalUrl;
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

  const handleCopyCaption = () => {
    if (!createdCaption) return;
    navigator.clipboard.writeText(createdCaption);
    toast.success("Legenda copiada com sucesso!");
  };

  const handleEditImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenant?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10 MB.");
      return;
    }

    setUploadingEdit(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${tenant.id}/edicao/imagem-original.${extension}`;
      const { data: previousFiles, error: listError } = await supabase.storage
        .from("informacoes_imagens")
        .list(`${tenant.id}/edicao`);
      if (listError) throw listError;

      const previousPaths = (previousFiles ?? []).map((storedFile) => `${tenant.id}/edicao/${storedFile.name}`);

      if (previousPaths.length > 0) {
        const { error: removeError } = await supabase.storage.from("informacoes_imagens").remove(previousPaths);
        if (removeError) throw removeError;
      }

      const { error: uploadError } = await supabase.storage
        .from("informacoes_imagens")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("informacoes_imagens").getPublicUrl(filePath);
      const imageUrl = `${publicData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("agentes_ia")
        .update({ edit_imagemupada: imageUrl })
        .eq("barbearia_id", tenant.id);
      if (updateError) throw updateError;

      editUploadedPathRef.current = filePath;
      isEditConfirmedRef.current = false;
      setEditUploadedImage(imageUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error: unknown) {
      console.error("Erro no upload da imagem para edição:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingEdit(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const requestEditConfirmation = () => {
    if (!editUploadedImage) {
      toast.error("Envie uma imagem antes de gerar a edição.");
      return;
    }
    const missing = EDIT_SECTIONS.flatMap((section) => section.fields)
      .filter((field) => !field.onlyInfinite || editSelections.edit_tipo_fundo === "Fundo infinito")
      .filter((field) => !editSelections[field.key])
      .map((field) => field.label);
    if (missing.length > 0) {
      toast.error(`Preencha os campos: ${missing.join(", ")}`);
      return;
    }
    setShowEditConfirm(true);
  };

  const confirmImageEdit = async () => {
    if (!tenant?.id || !editUploadedImage) return;
    setShowEditConfirm(false);
    setSavingEdit(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const newCount = lastResetMonth === currentMonth ? numImagensCriadas + 1 : 1;
      const payload = {
        ...editSelections,
        edit_cor_fundo: editSelections.edit_tipo_fundo === "Fundo infinito" ? editSelections.edit_cor_fundo : null,
        edit_imagemupada: editUploadedImage,
        num_imagens_criadas: newCount,
        last_reset_month: currentMonth,
        oq_criar: "edicao_imagem",
      };
      const { error: updateError } = await supabase
        .from("agentes_ia")
        .update(payload)
        .eq("barbearia_id", tenant.id);
      if (updateError) throw updateError;

      isEditConfirmedRef.current = true;
      setNumImagensCriadas(newCount);
      setLastResetMonth(currentMonth);

      await fetch(IMAGE_CREATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          ...payload,
          barbearia_id: tenant.id,
          id_barbearia: tenant.id,
          ID_BARBEARIA: tenant.id,
          action: "edit_image",
          timestamp: new Date().toISOString(),
        }),
      });
      toast.success("Edição de imagem solicitada com sucesso!");
    } catch (error: unknown) {
      console.error("Erro ao solicitar edição:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar a edição.");
    } finally {
      setSavingEdit(false);
    }
  };

  const downloadEditedImage = async () => {
    if (!editedImage) return;
    try {
      const response = await fetch(editedImage);
      if (!response.ok) throw new Error("Falha ao baixar a imagem.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `imagem_editada_${tenant?.id || "ia"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Não foi possível baixar a imagem editada.");
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
            <AlertDialogAction className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent className="bg-white max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-gray-900">
              Confirmar Criação de {generationType === "ambos" ? "Imagem e Legenda" : generationType === "imagem" ? "Apenas Imagem" : "Apenas Legenda"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-600">
              Revise os parâmetros selecionados antes de gerar:
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4 space-y-3">
            {fields.filter(f => {
              const subAreas = {
                dadosCriacao: ["imagem_informacoes", "imagem_objetivo", "imagem_campanha"],
                visualReferencia: ["imagem_estilovisual", "imagem_formato", "imagem_comlogo", "imagem_imareferencia"],
                configuracoesTexto: ["texto_estilo", "texto_emoji"]
              };
              if (generationType === "imagem") return [...subAreas.dadosCriacao, ...subAreas.visualReferencia].includes(f.key);
              if (generationType === "legenda") return [...subAreas.dadosCriacao, ...subAreas.configuracoesTexto].includes(f.key);
              return true;
            }).map((field) => (
              <div key={field.key} className="flex flex-col border-b border-gray-50 pb-2 last:border-0">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">{field.label}</span>
                <span className="text-sm text-gray-800 break-words">
                  {field.key === "imagem_imareferencia" && selections[field.key]?.startsWith("http") 
                    ? "Imagem enviada" 
                    : (selections[field.key] || "Não preenchido")}
                </span>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmModal(false)} 
              disabled={saving}
              className="border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmGenerate();
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Confirmar e Gerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
        <AlertDialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-gray-900">Confirmar edição de imagem</AlertDialogTitle>
            <AlertDialogDescription>Revise os dados escolhidos antes de solicitar a edição.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
            {EDIT_SECTIONS.flatMap((section) => section.fields)
              .filter((field) => !field.onlyInfinite || editSelections.edit_tipo_fundo === "Fundo infinito")
              .map((field) => (
                <div key={field.key} className="border-b border-gray-100 pb-2">
                  <p className="text-xs font-semibold text-primary uppercase">{field.label}</p>
                  <p className="text-sm text-gray-800">{editSelections[field.key]}</p>
                </div>
              ))}
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancelar</Button>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); confirmImageEdit(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Confirmar e gerar edição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ImageIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gerar imagem por IA</h1>
            <p className="text-muted-foreground">Configure os parâmetros para criação da sua imagem personalizada.</p>
          </div>
        </div>

        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Parâmetros de Geração</CardTitle>
              <CardDescription>
                Selecione uma opção em cada campo para habilitar a geração da imagem.
              </CardDescription>
            </div>
            <div className="flex gap-4">
              <div className="bg-primary/5 px-4 py-2 rounded-lg border border-primary/20 flex flex-col items-end">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Imagens geradas/editadas este mês</span>
                <span className="text-xl font-bold text-primary">{numImagensCriadas}</span>
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Primeira sub-área: Dados para criação */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-primary/20 pb-2">Dados para criação</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {/* Informações Adicionais (Full width) */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-white">Informações Adicionais</label>
                      <Textarea
                        value={selections.imagem_informacoes}
                        onChange={(e) => setSelections(prev => ({ ...prev, imagem_informacoes: e.target.value }))}
                        placeholder="Digite informações adicionais..."
                        className="w-full bg-white border-primary/10 focus:ring-primary min-h-[100px] text-black"
                      />
                    </div>
                    {/* Objetivo da Imagem */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Objetivo da Imagem</label>
                      <Select
                        value={selections.imagem_objetivo}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_objetivo: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione objetivo da imagem..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_objetivo].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Campanha */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Campanha</label>
                      <Select
                        value={selections.imagem_campanha}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_campanha: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione campanha..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_campanha].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Tom de comunicação */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Tom de comunicação</label>
                      <Select
                        value={selections.tom_comunicacao}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, tom_comunicacao: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione tom de comunicação..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.tom_comunicacao].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Segunda sub-área */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-primary/20 pb-2">Visual e Referência</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Estilo Visual */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Estilo visual</label>
                      <Select
                        value={selections.imagem_estilovisual}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_estilovisual: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione estilo visual..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_estilovisual].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Paleta de cores */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Paleta de cores</label>
                      <Select
                        value={selections.imagem_paleta}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_paleta: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione paleta de cores..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_paleta].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Elemento central */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Elemento central</label>
                      <Select
                        value={selections.imagem_elem_central}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_elem_central: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione elemento central..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_elem_central].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Formato de Imagem */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Formato de Imagem</label>
                      <Select
                        value={selections.imagem_formato}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_formato: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione formato de imagem..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_formato].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Com Logo? */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com logo?</label>
                      <Select
                        value={selections.imagem_comlogo}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_comlogo: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com logo?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_comlogo].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Com endereço? (Imagem) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com endereço?</label>
                      <Select
                        value={selections.imagem_endereco}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_endereco: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com endereço?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_endereco].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Com instagram? (Imagem) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com instagram?</label>
                      <Select
                        value={selections.imagem_instagram}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_instagram: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com instagram?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_instagram].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Com telefone de contato? (Imagem) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com telefone de contato?</label>
                      <Select
                        value={selections.imagem_telcontato}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, imagem_telcontato: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com telefone de contato?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.imagem_telcontato].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Imagem de Referência (largura total da coluna) */}
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium text-white">Imagem de Referência</label>
                      <div className="space-y-3">
                        <Select
                          value={selections.imagem_imareferencia?.startsWith("http") ? "Upar imagem de referência" : selections.imagem_imareferencia}
                          onValueChange={(val) => {
                            setSelections(prev => ({ ...prev, imagem_imareferencia: val }));
                          }}
                        >
                          <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                            <SelectValue placeholder="Selecione imagem de referência..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sem imagem de referência">Sem imagem de referência</SelectItem>
                            <SelectItem value="Upar imagem de referência">Upar imagem de referência</SelectItem>
                          </SelectContent>
                        </Select>

                        {(selections.imagem_imareferencia?.startsWith("http") || selections.imagem_imareferencia === "Upar imagem de referência") && (
                          <div className="p-4 border-2 border-dashed border-primary/20 rounded-lg bg-primary/5 space-y-3">
                            {selections.imagem_imareferencia?.startsWith("http") ? (
                              <div className="relative w-full aspect-video rounded-md overflow-hidden bg-gray-100 border border-primary/20">
                                <img
                                  src={selections.imagem_imareferencia}
                                  alt="Referência"
                                  className="w-full h-full object-contain"
                                />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-2 right-2 h-8 w-8"
                                  onClick={() => setSelections(prev => ({ ...prev, imagem_imareferencia: "" }))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 text-center">
                                <Upload className="h-8 w-8 text-primary/60 mb-2" />
                                <p className="text-sm text-gray-600 mb-2">Selecione uma imagem de referência</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={uploadingRef}
                                  className="border-primary/30 text-primary hover:bg-primary/5"
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
                    </div>
                  </div>
                </div>

                {/* Terceira sub-área: Estilo de Texto e Emojis */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-primary/20 pb-2">Configurações de Texto</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Estilo de Texto */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Estilo de Texto</label>
                      <Select
                        value={selections.texto_estilo}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, texto_estilo: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione estilo de texto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.texto_estilo].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Uso de emojis */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Uso de emojis</label>
                      <Select
                        value={selections.texto_emoji}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, texto_emoji: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione uso de emojis..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.texto_emoji].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Com endereço? (Texto) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com endereço?</label>
                      <Select
                        value={selections.texto_endereco}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, texto_endereco: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com endereço?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.texto_endereco].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Com instagram? (Texto) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com instagram?</label>
                      <Select
                        value={selections.texto_instagram}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, texto_instagram: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com instagram?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.texto_instagram].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Com telefone de contato? (Texto) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Com telefone de contato?</label>
                      <Select
                        value={selections.texto_telcontato}
                        onValueChange={(val) => setSelections(prev => ({ ...prev, texto_telcontato: val }))}
                      >
                        <SelectTrigger className="w-full bg-white border-primary/10 focus:ring-primary text-black">
                          <SelectValue placeholder="Selecione com telefone de contato?..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...options.texto_telcontato].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </div>
              </div>
            )}

            <div className="pt-4 border-t border-primary/10 flex flex-wrap gap-4 justify-end">
              <Button
                onClick={() => handleGenerate("legenda")}
                disabled={saving}
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/5 gap-2 h-11 px-6"
              >
                {saving && generationType === "legenda" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Gerar apenas legenda
              </Button>

              <Button
                onClick={() => handleGenerate("imagem")}
                disabled={saving}
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/5 gap-2 h-11 px-6"
              >
                {saving && generationType === "imagem" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Gerar apenas imagem
              </Button>

              <Button
                onClick={() => handleGenerate("ambos")}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 px-6"
              >
                {saving && generationType === "ambos" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Gerar imagem e legenda com IA
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Área das Criações */}
        <Card className="border-primary/20 shadow-md overflow-hidden bg-white">
          <CardHeader className="bg-primary/10">
            <CardTitle className="text-xl flex items-center gap-2 text-black">
              <ImageIcon className="h-5 w-5 text-primary" />
              Últimas criações feitas pela IA
            </CardTitle>
            <CardDescription>
              As criações geradas pela inteligência artificial aparecerão aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 min-h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna da Imagem */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Imagem</h3>
                {createdImageUrl ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative group rounded-xl overflow-hidden border-4 border-primary/10 shadow-lg w-full">
                      <img 
                        src={createdImageUrl} 
                        alt="Imagem criada pela IA" 
                        className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-primary/30 text-primary hover:bg-primary/5 gap-2"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4" />
                      Baixar Imagem
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma imagem gerada ainda</p>
                  </div>
                )}
              </div>

              {/* Coluna da Legenda */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Legenda</h3>
                {createdCaption ? (
                  <div className="flex flex-col space-y-4">
                    <div className="bg-gray-50 rounded-xl border border-primary/10 p-6 shadow-inner min-h-[200px]">
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {createdCaption}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-primary/30 text-primary hover:bg-primary/5 gap-2 self-start"
                      onClick={handleCopyCaption}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Legenda
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 h-full min-h-[200px]">
                    <AlertCircle className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma legenda gerada ainda</p>
                  </div>
                )}
              </div>
            </div>

            {!createdImageUrl && !createdCaption && (
              <div className="text-center mt-12 space-y-4 w-full">
                <div className="space-y-2">
                  <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    Preencha todos os campos acima e clique nos botões de gerar para criar seus conteúdos.
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
