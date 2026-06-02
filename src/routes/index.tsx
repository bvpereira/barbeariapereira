import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-4xl font-bold font-josefin uppercase tracking-widest text-primary">
        Bem-vindo
      </h1>
    </div>
  );
}
