import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Scissors } from "lucide-react";
import { WebhookSettings } from "@/components/WebhookSettings";
import { EvolutionSettings } from "@/components/EvolutionSettings";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: barbearias, isLoading } = useQuery({
    queryKey: ["barbearias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbearias")
        .select("id, nome, slug")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-bold font-josefin uppercase tracking-widest text-primary mb-4">
          Bem-vindo
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto mb-8" />
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Escolha uma de nossas unidades para agendar seu atendimento.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="animate-pulse text-primary font-josefin">Carregando unidades...</div>
      ) : (
        <div className="grid gap-6 w-full max-w-md">
          {barbearias?.map((barb, index) => (
            <motion.div
              key={barb.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={`/${barb.slug}`}
                className="group flex items-center justify-between p-6 bg-card border border-primary/10 rounded-2xl hover:border-primary/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Scissors className="text-primary w-6 h-6" />
                  </div>
                  <span className="text-xl font-bold font-josefin uppercase tracking-wide">
                    {barb.nome}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  →
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-20 w-full max-w-6xl"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Configurações de Webhooks
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-primary/10 rounded-3xl p-8 mb-8">
          <WebhookSettings />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-josefin uppercase tracking-widest text-primary mb-2">
            Configurações do Evolution
          </h2>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
        </div>
        <div className="max-w-2xl mx-auto">
          <EvolutionSettings />
        </div>
      </motion.div>
    </div>
  );
}

