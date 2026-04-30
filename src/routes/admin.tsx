import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin" as any)({
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <h1 className="text-2xl font-bold">Esse é o nível 1</h1>
    </div>
  );
}
