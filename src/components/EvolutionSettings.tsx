import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Database } from "lucide-react";

interface EvolutionSettingsProps {
  barbeariaId?: string;
}

export function EvolutionSettings({ barbeariaId }: EvolutionSettingsProps) {
  const [instanciaEvo, setInstanciaEvo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingInstancia, setSavingInstancia] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);

  useEffect(() => {
    fetchInformacoes();
  }, [barbeariaId]);

  const fetchInformacoes = async () => {
    try {
      let query = supabase
        .from("informacoes")
        .select("id, instancia_evo");
      
      if (barbeariaId) {
        query = query.eq("barbearia_id", barbeariaId);
      }
      
      const { data, error } = await query.limit(1).maybeSingle();

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
    } finally {
      setLoading(false);
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
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-black/40 backdrop-blur-sm">
      <CardHeader className="bg-primary/5">
        <CardTitle className="flex items-center gap-2 text-white">
          <Database className="h-5 w-5 text-primary" />
          Configurações do Evolution
        </CardTitle>
        <CardDescription className="text-gray-400">
          Identificação da instância para envio de mensagens via WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2 text-left">
          <Label htmlFor="instancia-evo" className="text-gray-300">Nome da Instância</Label>
          <div className="flex gap-2">
            <Input
              id="instancia-evo"
              placeholder="Ex: BarbeariaPereira"
              value={instanciaEvo}
              onChange={(e) => setInstanciaEvo(e.target.value)}
              className="flex-1 bg-black/50 border-primary/20 text-white placeholder:text-gray-600 focus:border-primary/50"
            />
            <Button 
              onClick={handleSaveInstancia} 
              disabled={savingInstancia}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {savingInstancia ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
