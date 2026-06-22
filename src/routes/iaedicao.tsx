import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Image as ImageIcon, Upload, Download } from "lucide-react";
import { toast } from "sonner";
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

export const Route = createFileRoute("/iaedicao")({
  component: IAEdicaoPage,
});

function IAEdicaoPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [editSelections, setEditSelections] = useState<Record<EditFieldKey, string>>({ ...EMPTY_EDIT_SELECTIONS });
  const [editUploadedImage, setEditUploadedImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [numImagensCriadas, setNumImagensCriadas] = useState(0);
  const [numLimiteImagens, setNumLimiteImagens] = useState(0);
  const [lastResetMonth, setLastResetMonth] = useState("");
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editUploadedPathRef = useRef<string | null>(null);
  const isEditConfirmedRef = useRef(false);

  useEffect(() => {
    if (tenantLoading || !tenant) return;

    const load = async () => {
      const { data } = await supabase
        .from("agentes_ia")
        .select("*")
        .eq("barbearia_id", tenant.id)
        .maybeSingle();
      if (data) {
        setEditedImage((data as any).edit_imagemeditada || null);
        setNumImagensCriadas((data as any).num_imagens_criadas || 0);
        setLastResetMonth((data as any).last_reset_month || "");
      }
    };
    load();

    const channel = supabase
      .channel('iaedicao-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agentes_ia', filter: `barbearia_id=eq.${tenant.id}` },
        (payload) => {
          if (payload.new && (payload.new as any).edit_imagemeditada !== undefined) {
            setEditedImage((payload.new as any).edit_imagemeditada || null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (!isEditConfirmedRef.current && editUploadedPathRef.current && tenant?.id) {
        const editPath = editUploadedPathRef.current;
        supabase
          .from("agentes_ia")
          .update({ edit_imagemupada: null })
          .eq("barbearia_id", tenant.id)
          .then(({ error }) => { if (error) console.error(error); });
        supabase.storage.from("informacoes_imagens").remove([editPath]).then(({ error }) => {
          if (error) console.error(error);
        });
      }
    };
  }, [tenant, tenantLoading]);

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
      console.error(error);
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
      console.error(error);
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
                  <p className="text-xs font-semibold text-blue-600 uppercase">{field.label}</p>
                  <p className="text-sm text-gray-800">{editSelections[field.key]}</p>
                </div>
              ))}
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancelar</Button>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); confirmImageEdit(); }} className="bg-blue-600 hover:bg-blue-700 text-white">
              Confirmar e gerar edição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ImageIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edição de imagem por IA</h1>
            <p className="text-muted-foreground">Envie uma imagem e defina como a IA deve editá-la.</p>
          </div>
        </div>

        <Card className="border-blue-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-900 flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-blue-600" />
              Edição de Imagem
            </CardTitle>
            <CardDescription>Envie uma imagem e defina como a inteligência artificial deve editá-la.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Coluna 1: Imagem original */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-blue-700 border-b border-blue-100 pb-2">Imagem original</h3>
                <div className="rounded-xl border-2 border-dashed border-blue-100 bg-blue-50/30 p-5">
                  {editUploadedImage ? (
                    <div className="flex flex-col items-center gap-5">
                      <img src={editUploadedImage} alt="Imagem enviada para edição" className="h-44 w-full rounded-lg object-contain bg-white border" />
                      <div className="space-y-2 text-center">
                        <p className="text-sm text-gray-600">Imagem salva para esta barbearia.</p>
                        <Button type="button" variant="outline" onClick={() => editFileInputRef.current?.click()} disabled={uploadingEdit}>Trocar imagem</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-7 text-center">
                      <Upload className="h-10 w-10 text-blue-400 mb-3" />
                      <p className="text-sm text-gray-600 mb-4">Envie uma imagem de até 10 MB.</p>
                      <Button type="button" variant="outline" onClick={() => editFileInputRef.current?.click()} disabled={uploadingEdit}>
                        {uploadingEdit ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : "Escolher imagem"}
                      </Button>
                    </div>
                  )}
                  <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditImageUpload} />
                </div>
              </div>

              {/* Colunas 2 e 3: pares de sessões */}
              {[[0, 1], [2, 3]].map((pair) => (
                <div key={pair.join("-")} className="space-y-8">
                  {pair.map((idx) => {
                    const section = EDIT_SECTIONS[idx];
                    return (
                      <section key={section.title} className="space-y-4">
                        <h3 className="text-lg font-semibold text-blue-700 border-b border-blue-100 pb-2">{section.title}</h3>
                        <div className="grid grid-cols-1 gap-4">
                          {section.fields.map((field) => {
                            const disabled = field.onlyInfinite && editSelections.edit_tipo_fundo !== "Fundo infinito";
                            return (
                              <div key={field.key} className="space-y-2">
                                <label className="text-sm font-medium text-gray-800">{field.label}</label>
                                <Select
                                  value={editSelections[field.key]}
                                  disabled={disabled}
                                  onValueChange={(value) => setEditSelections((previous) => ({
                                    ...previous,
                                    [field.key]: value,
                                    ...(field.key === "edit_tipo_fundo" && value !== "Fundo infinito" ? { edit_cor_fundo: "" } : {}),
                                  }))}
                                >
                                  <SelectTrigger className="w-full bg-white text-gray-900"><SelectValue placeholder={disabled ? "Disponível apenas para Fundo infinito" : "Selecione uma opção"} /></SelectTrigger>
                                  <SelectContent>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-blue-100">
              <Button onClick={requestEditConfirmation} disabled={savingEdit || uploadingEdit} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Gerar edição de imagem
              </Button>
            </div>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-700 border-b border-blue-100 pb-2">Imagem editada</h3>
              {editedImage ? (
                <div className="flex flex-col items-center gap-4">
                  <img src={editedImage} alt="Imagem editada pela IA" className="max-h-[520px] w-full rounded-xl object-contain bg-gray-50 border border-blue-100" />
                  <Button variant="outline" onClick={downloadEditedImage} className="border-blue-200 text-blue-600 gap-2"><Download className="h-4 w-4" /> Baixar imagem editada</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                  <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">A imagem editada aparecerá aqui.</p>
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
