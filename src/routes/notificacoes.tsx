import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronLeft, ChevronRight, Eye, History, Loader2, MessageCircle, Send, TestTube, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteNotification, getNotificationsPage, publishSiteNotification, sendWhatsAppNotification, testWhatsAppNotification } from "@/lib/notificacoes.functions";

export const Route = createFileRoute("/notificacoes")({ component: NotificacoesPage });

type Credentials = { id: string; login: string; senha: string; nivel: number };
type FormValue = { titulo: string; texto: string };
type HistoryItem = { id: string; titulo: string; texto: string; canal: string; numero_notificacao: number | null; publicada_em: string | null; created_at: string };
const emptyForm: FormValue = { titulo: "", texto: "" };

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "";
}

function getCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem("superadmin_session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.id || !session?.login || !session?.senha || Number(session.nivel) !== 0) return null;
    return { id: session.id, login: session.login, senha: session.senha, nivel: Number(session.nivel) };
  } catch {
    return null;
  }
}

function NotificacoesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [page, setPage] = useState(0);
  const [siteForm, setSiteForm] = useState<FormValue>(emptyForm);
  const [whatsappForm, setWhatsappForm] = useState<FormValue>(emptyForm);
  const [whatsappTested, setWhatsappTested] = useState(false);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [deleting, setDeleting] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const session = getCredentials();
    if (!session) {
      localStorage.removeItem("superadmin_session");
      navigate({ to: "/superlogin", replace: true });
      return;
    }
    setCredentials(session);
  }, [navigate]);

  const historyQuery = useQuery({
    queryKey: ["superadmin-notifications", page],
    queryFn: () => getNotificationsPage({ data: { credentials: credentials as Credentials, page } }),
    enabled: Boolean(credentials),
  });

  useEffect(() => {
    const draft = historyQuery.data?.draft;
    if (!draft) return;
    setWhatsappForm({ titulo: draft.titulo, texto: draft.texto });
    setWhatsappTested(draft.testada);
  }, [historyQuery.data?.draft]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["superadmin-notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["latest-site-notifications"] }),
    ]);
  };

  const siteMutation = useMutation({
    mutationFn: () => publishSiteNotification({ data: { credentials: credentials as Credentials, notification: siteForm } }),
    onSuccess: async () => { setSiteForm(emptyForm); await refresh(); toast.success("Notificação publicada no sistema."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const testMutation = useMutation({
    mutationFn: () => testWhatsAppNotification({ data: { credentials: credentials as Credentials, notification: whatsappForm } }),
    onSuccess: async () => { setWhatsappTested(true); await refresh(); toast.success("Teste enviado com sucesso."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const sendMutation = useMutation({
    mutationFn: () => sendWhatsAppNotification({ data: { credentials: credentials as Credentials } }),
    onSuccess: async () => { setWhatsappForm(emptyForm); setWhatsappTested(false); await refresh(); toast.success("Notificação enviada por WhatsApp."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { credentials: credentials as Credentials, id } }),
    onSuccess: async () => { setDeleting(null); await refresh(); toast.success("Notificação excluída."); },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeWhatsApp = (field: keyof FormValue, value: string) => {
    setWhatsappForm((current) => ({ ...current, [field]: value }));
    setWhatsappTested(false);
  };
  const rows = historyQuery.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((historyQuery.data?.count ?? 0) / 10));

  if (!credentials) return null;
  return (
    <SuperAdminLayout>
      <div className="w-full max-w-7xl space-y-8">
        <header><h1 className="font-josefin text-3xl font-bold uppercase tracking-widest text-primary md:text-5xl">Notificações</h1><p className="mt-2 text-muted-foreground">Publique avisos no painel dos administradores ou envie mensagens pelo WhatsApp.</p></header>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notificação pelo sistema</CardTitle><CardDescription>Aparece nos dashboards de todos os administradores.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="site-title">Título</Label><Input id="site-title" maxLength={150} value={siteForm.titulo} onChange={(event) => setSiteForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Título da notificação" /></div>
              <div className="space-y-2"><Label htmlFor="site-text">Texto</Label><Textarea id="site-text" maxLength={3000} className="min-h-36" value={siteForm.texto} onChange={(event) => setSiteForm((current) => ({ ...current, texto: event.target.value }))} placeholder="Escreva o aviso completo" /></div>
              <Button className="w-full" disabled={siteMutation.isPending || !siteForm.titulo.trim() || !siteForm.texto.trim()} onClick={() => siteMutation.mutate()}>{siteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publicar</Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" />Notificação por WhatsApp</CardTitle><CardDescription>O envio real é liberado somente após um teste bem-sucedido.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="whatsapp-title">Título</Label><Input id="whatsapp-title" maxLength={150} value={whatsappForm.titulo} onChange={(event) => changeWhatsApp("titulo", event.target.value)} disabled={whatsappTested} placeholder="Título da mensagem" /></div>
              <div className="space-y-2"><Label htmlFor="whatsapp-text">Texto</Label><Textarea id="whatsapp-text" maxLength={3000} className="min-h-36" value={whatsappForm.texto} onChange={(event) => changeWhatsApp("texto", event.target.value)} disabled={whatsappTested} placeholder="Escreva a mensagem completa" /></div>
              {whatsappTested ? <p className="text-sm font-medium text-primary">Teste aprovado. A mensagem está pronta para envio.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2"><Button variant="secondary" disabled={testMutation.isPending || whatsappTested || !whatsappForm.titulo.trim() || !whatsappForm.texto.trim()} onClick={() => testMutation.mutate()}>{testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}Enviar teste</Button><Button disabled={sendMutation.isPending || !whatsappTested} onClick={() => sendMutation.mutate()}>{sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar por WhatsApp</Button></div>
              {whatsappTested ? <Button variant="outline" className="w-full" onClick={() => setWhatsappTested(false)}>Alterar mensagem</Button> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Histórico de notificações</CardTitle><CardDescription>Publicações do sistema e envios por WhatsApp, dez por página.</CardDescription></CardHeader>
          <CardContent>
            {historyQuery.isLoading ? <p className="animate-pulse text-muted-foreground">Carregando histórico...</p> : null}
            {!historyQuery.isLoading && !rows.length ? <p className="py-8 text-center text-muted-foreground">Nenhuma notificação enviada.</p> : null}
            <div className="divide-y divide-border">{rows.map((item) => <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-semibold">{item.titulo}</h3><Badge variant="outline">{item.canal === "site" ? "Sistema" : "WhatsApp"}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{item.texto}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.publicada_em ?? item.created_at)}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(item)}><Eye className="h-4 w-4" />Detalhes</Button><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Excluir notificação" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Anterior</Button><span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span><Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Próxima<ChevronRight className="h-4 w-4" /></Button></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{selected?.titulo}</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-xs text-muted-foreground">{formatDate(selected?.publicada_em ?? selected?.created_at ?? null)}</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{selected?.texto}</p></div></DialogContent></Dialog>
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir notificação?</AlertDialogTitle><AlertDialogDescription>Esta ação removerá permanentemente a notificação do histórico e não poderá ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </SuperAdminLayout>
  );
}