import { useQuery } from "@tanstack/react-query";
import { Bell, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestSiteNotifications } from "@/lib/notificacoes.functions";

function formatPublishedAt(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function NotificationsPanel() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["latest-site-notifications"],
    queryFn: () => getLatestSiteNotifications(),
  });
  const [latest, ...history] = data;

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader className="border-b border-primary/10 bg-primary/5">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Bell className="h-5 w-5 text-primary" /> Notificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {isLoading ? <p className="animate-pulse text-sm text-muted-foreground">Carregando notificações...</p> : null}
        {!isLoading && !latest ? <p className="text-sm text-muted-foreground">Nenhuma notificação publicada.</p> : null}
        {latest ? (
          <article className="rounded-xl border border-primary/25 bg-primary/10 p-5">
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-foreground">{latest.titulo}</h3>
              <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">Mais recente</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{latest.texto}</p>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{formatPublishedAt(latest.publicada_em)}</p>
          </article>
        ) : null}
        {history.length ? (
          <div className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Histórico recente</h3>
            {history.map((item) => (
              <article key={item.id} className="border-b border-border/70 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-medium text-foreground">{item.titulo}</h4>
                  <time className="shrink-0 text-xs text-muted-foreground">{formatPublishedAt(item.publicada_em)}</time>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.texto}</p>
              </article>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}