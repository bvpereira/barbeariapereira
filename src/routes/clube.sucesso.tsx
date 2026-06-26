import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/clube/sucesso")({ component: Sucesso });

function Sucesso() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Assinatura confirmada!</h1>
          <p className="text-muted-foreground">
            Recebemos seu pagamento. Em instantes seu acesso ao clube estará liberado.
          </p>
          <Link to="/cliente"><Button className="w-full">Voltar para minha conta</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
