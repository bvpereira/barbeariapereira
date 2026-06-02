import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";

export const Route = createFileRoute("/integracoes")({
  component: IntegracoesPage,
});

function IntegracoesPage() {
  return (
    <AdminLayout>
      <div className="space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground text-lg">
            As configurações de integração foram movidas para a página inicial.
          </p>
        </div>
        
        <div className="bg-card p-6 rounded-lg border border-primary/20">
          <p>Você pode encontrar as configurações de Webhooks e do Evolution na <a href="/" className="text-primary hover:underline">Página Inicial</a>.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
