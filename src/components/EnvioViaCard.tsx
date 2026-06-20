import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

export function EnvioViaCard() {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("superadmin" as any)
        .select("envio_via")
        .limit(1)
        .maybeSingle();
      setValue(((data as any)?.envio_via as string) ?? "");
      setLoading(false);
    })();
  }, []);

  const isWhats = value === "Whatsapp";
  const isEmail = value === "E-mail";
  const invalid = !loading && !isWhats && !isEmail;

  const colorClass = isWhats
    ? "text-green-500 border-green-500/40 bg-green-500/10"
    : isEmail
    ? "text-yellow-500 border-yellow-500/40 bg-yellow-500/10"
    : "text-muted-foreground border-primary/15 bg-background/40";

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-primary/10 rounded-3xl p-8">
      <h3 className="text-xl font-bold font-josefin uppercase tracking-widest text-primary mb-4 text-center">
        Envio via
      </h3>
      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className={`rounded-md border px-4 py-3 text-center text-lg font-semibold ${colorClass}`}>
            {value || "Não definido"}
          </div>
          {invalid && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Valor inválido. Pode haver algo escrito errado na tabela "superadmin" do Supabase. Use "Whatsapp" ou "E-mail".
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
