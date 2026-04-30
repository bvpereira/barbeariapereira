import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cliente" as any)({
  component: ClientePage,
});

function ClientePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <h1 className="text-2xl font-bold">Esse é o nível 3</h1>
    </div>
  );
}
