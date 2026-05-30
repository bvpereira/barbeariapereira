import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Image as ImageIcon, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/iaimagem")({
  component: IAImagemPage,
});

function IAImagemPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<Record<string, string[]>>({
    imagem_objetivo: [],
    imagem_campanha: [],
    imagem_estilovisual: [],
    imagem_informacoes: [],
    imagem_imareferencia: [],
    imagem_comlogo: [],
    imagem_formato: [],
  });

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
    { key: "imagem_informacoes", label: "Informações Adicionais" },
    { key: "imagem_imareferencia", label: "Imagem de Referência" },
    { key: "imagem_comlogo", label: "Com Logo?" },
    { key: "imagem_formato", label: "Formato de Imagem" },
  ];

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("agentes_ia")
        .select("*")
        .neq("linha", 0);

      if (error) throw error;

      const newOptions: Record<string, string[]> = {
        imagem_objetivo: [],
        imagem_campanha: [],
        imagem_estilovisual: [],
        imagem_informacoes: [],
        imagem_imareferencia: [],
        imagem_comlogo: [],
        imagem_formato: [],
      };

      data.forEach((row: any) => {
        fields.forEach((field) => {
          const val = row[field.key];
          if (val && !newOptions[field.key].includes(val)) {
            newOptions[field.key].push(val);
          }
        });
      });

      setOptions(newOptions);
    } catch (error) {
      console.error("Erro ao buscar opções:", error);
      toast.error("Erro ao carregar opções dos campos.");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = fields.every((field) => selections[field.key] !== "");

  const handleGenerate = async () => {
    if (!isFormValid) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("agentes_ia")
        .update({
          imagem_objetivo: selections.imagem_objetivo,
          imagem_campanha: selections.imagem_campanha,
          imagem_estilovisual: selections.imagem_estilovisual,
          imagem_informacoes: selections.imagem_informacoes,
          imagem_imareferencia: selections.imagem_imareferencia,
          imagem_comlogo: selections.imagem_comlogo,
          imagem_formato: selections.imagem_formato,
        })
        .eq("linha", 0);

      if (error) throw error;

      toast.success("Configurações de imagem salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
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
          <CardHeader>
            <CardTitle>Parâmetros de Geração</CardTitle>
            <CardDescription>
              Selecione uma opção em cada campo para habilitar a geração da imagem.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{field.label}</label>
                    <Select
                      value={selections[field.key]}
                      onValueChange={(val) => setSelections(prev => ({ ...prev, [field.key]: val }))}
                    >
                      <SelectTrigger className="w-full bg-white border-blue-50 focus:ring-blue-500">
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
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-blue-50 flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={!isFormValid || saving}
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
      </div>
    </AdminLayout>
  );
}
