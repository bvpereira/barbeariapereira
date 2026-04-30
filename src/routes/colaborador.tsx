import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/colaborador" as any)({
  component: ColaboradorPage,
});

function ColaboradorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <h1 className="text-2xl font-bold">Esse é o nível 2</h1>
    </div>
  );
}
