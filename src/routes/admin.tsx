import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin" as any)({
  component: AdminPage,
});

function AdminPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Painel do Administrador</h1>
        <p className="text-muted-foreground">Bem-vindo à área de gestão da sua barbearia.</p>
      </div>
    </AdminLayout>
  );
}
