import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/clube/cancelado")({ component: Cancelado });

function Cancelado() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 text-center space-y-4">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Assinatura cancelada</h1>
          <p className="text-muted-foreground">
            Você cancelou o processo. Nenhuma cobrança foi efetuada.
          </p>
          <Link to="/cliente"><Button className="w-full" variant="outline">Voltar</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
