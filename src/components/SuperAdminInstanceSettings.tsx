import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Server, Key, Phone } from "lucide-react";

export function SuperAdminInstanceSettings() {
  const [instanciaEvo, setInstanciaEvo] = useState("");
  const [instanciaApi, setInstanciaApi] = useState("");
  const [instanciaNumero, setInstanciaNumero] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    void fetchRecord();
  }, []);

  const fetchRecord = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("superadmin")
        .select("id, instancia_principal_evo, instancia_principal_api, instancia_principal_numero")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar superadmin:", error);
        return;
      }

      if (data) {
        setRecordId(data.id);
        setInstanciaEvo(data.instancia_principal_evo ?? "");
        setInstanciaApi(data.instancia_principal_api ?? "");
        setInstanciaNumero(data.instancia_principal_numero ?? "");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        instancia_principal_evo: instanciaEvo || null,
        instancia_principal_api: instanciaApi || null,
        instancia_principal_numero: instanciaNumero || null,
      };

      if (recordId) {
        const { error } = await (supabase as any)
          .from("superadmin")
          .update(payload)
          .eq("id", recordId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("superadmin")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setRecordId(data.id);
      }

      toast.success("Instância Super Admin salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-black/40 backdrop-blur-sm">
      <CardHeader className="bg-primary/5">
        <CardTitle className="flex items-center gap-2 text-white">
          <Server className="h-5 w-5 text-primary" />
          Instância Super Admin
        </CardTitle>
        <CardDescription className="text-gray-400">
          Configurações da instância principal, independente de barbearia.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2 text-left">
          <Label htmlFor="sa-instancia" className="text-gray-300 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> Instância Principal
          </Label>
          <Input
            id="sa-instancia"
            placeholder="Ex: InstanciaPrincipal"
            value={instanciaEvo}
            onChange={(e) => setInstanciaEvo(e.target.value)}
            className="bg-black/50 border-primary/20 text-white placeholder:text-gray-600 focus:border-primary/50"
          />
        </div>

        <div className="space-y-2 text-left">
          <Label htmlFor="sa-api" className="text-gray-300 flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> Chave API da instância
          </Label>
          <Input
            id="sa-api"
            placeholder="Cole a chave da API"
            value={instanciaApi}
            onChange={(e) => setInstanciaApi(e.target.value)}
            className="bg-black/50 border-primary/20 text-white placeholder:text-gray-600 focus:border-primary/50"
          />
        </div>

        <div className="space-y-2 text-left">
          <Label htmlFor="sa-numero" className="text-gray-300 flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Número de telefone da instância
          </Label>
          <Input
            id="sa-numero"
            placeholder="Ex: 5511999999999"
            value={instanciaNumero}
            onChange={(e) => setInstanciaNumero(e.target.value)}
            className="bg-black/50 border-primary/20 text-white placeholder:text-gray-600 focus:border-primary/50"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
