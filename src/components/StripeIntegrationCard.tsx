import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getStripeConfig, saveStripeConfig, syncAllClubes, recreateStripeWebhook, backfillStripeSubscriptions, listStripeWebhooks } from "@/lib/stripe.functions";

interface Props {
  credentials: { barbearia_id: string; admin_id: string; admin_password: string };
  onChange?: () => void;
}

export function StripeIntegrationCard({ credentials, onChange }: Props) {
  const getFn = useServerFn(getStripeConfig);
  const saveFn = useServerFn(saveStripeConfig);
  const syncFn = useServerFn(syncAllClubes);
  const [cfg, setCfg] = useState<{ ativo: boolean; configurado: boolean; account_id: string | null; chave_mascarada: string } | null>(null);
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCfg(await getFn({ data: credentials })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [credentials.barbearia_id]);

  const save = async (ativo: boolean) => {
    setSaving(true);
    try {
      await saveFn({ data: {
        ...credentials,
        chave_stripe: chave.trim() || null,
        ativo,
        base_url: window.location.origin,
      } });
      setChave("");
      toast.success("Configuração do Stripe salva.");
      if (ativo) {
        try {
          const r = await syncFn({ data: credentials });
          if (r.synced) toast.success(`${r.synced} clube(s) sincronizado(s) com o Stripe.`);
        } catch (e) { console.error(e); }
      }
      await load();
      onChange?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <Card><CardContent className="pt-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</CardContent></Card>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Stripe</CardTitle>
          {cfg?.ativo ? (
            <Badge className="gap-1"><ShieldCheck className="w-3 h-3" /> Ativo</Badge>
          ) : cfg?.configurado ? (
            <Badge variant="secondary">Configurado (desativado)</Badge>
          ) : (
            <Badge variant="outline">Não configurado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ative para que seus clientes possam assinar os clubes diretamente com cartão pelo Stripe Checkout.
          Cada barbearia usa sua própria conta Stripe. Pegue sua chave em{" "}
          <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline">dashboard.stripe.com/apikeys</a>.
        </p>

        {cfg?.configurado && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Chave atual:</span> <code>{cfg.chave_mascarada}</code></div>
            {cfg.account_id && <div><span className="text-muted-foreground">Conta:</span> <code>{cfg.account_id}</code></div>}
          </div>
        )}

        <div className="space-y-2">
          <Label>Chave secreta (sk_live_… ou sk_test_…)</Label>
          <Input
            type="password"
            placeholder={cfg?.configurado ? "Deixe em branco para manter a atual" : "sk_..."}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> A chave nunca é exibida após salva. Só você e o servidor do Stripe têm acesso.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(cfg?.ativo)}
              onCheckedChange={(v) => void save(v)}
              disabled={saving || (!cfg?.configurado && !chave.trim())}
            />
            <Label className="cursor-pointer" onClick={() => void save(!cfg?.ativo)}>
              {cfg?.ativo ? "Integração ativada" : "Integração desativada"}
            </Label>
          </div>
          <Button onClick={() => void save(cfg?.ativo ?? false)} disabled={saving || !chave.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar chave
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
