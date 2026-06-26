import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Crown, Plus, Pencil, Trash2, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { listClubes, saveClube, toggleClube, deleteClube, listExpirando } from "@/lib/clube.functions";
import { getStripeConfig, setClubeStripeOptions, syncClubeToStripe } from "@/lib/stripe.functions";
import { StripeIntegrationCard } from "@/components/StripeIntegrationCard";

export const Route = createFileRoute("/clube")({ component: ClubePage });

type Service = { id: string; name: string; price: number };
type Rule = { servico_id: string; quantidade: number; dias_semana: number[]; tipo_desconto: "percentual" | "fixo"; valor_desconto: number };
type Clube = Awaited<ReturnType<typeof listClubes>>[number];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const emptyForm = {
  id: undefined as string | undefined,
  nome: "", valor_mensal: "", descricao: "", ativo: true,
  regras: [] as Rule[],
  trial_dias: 0, stripe_coupon_id: "",
};

function ClubePage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [services, setServices] = useState<Service[]>([]);
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [expirando, setExpirando] = useState<Awaited<ReturnType<typeof listExpirando>>>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [stripeAtivo, setStripeAtivo] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const listFn = useServerFn(listClubes);
  const saveFn = useServerFn(saveClube);
  const toggleFn = useServerFn(toggleClube);
  const deleteFn = useServerFn(deleteClube);
  const expFn = useServerFn(listExpirando);
  const getStripeFn = useServerFn(getStripeConfig);
  const setOptsFn = useServerFn(setClubeStripeOptions);
  const syncOneFn = useServerFn(syncClubeToStripe);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "null"); } catch { return null; }
  }, []);
  const credentials = useMemo(() => {
    if (!tenant?.id || !user) return null;
    if (user.nivel !== 1 && user.nivel !== "1") return null;
    return { barbearia_id: tenant.id, admin_id: String(user.id), admin_password: String(user.senha) };
  }, [tenant, user]);

  const load = async () => {
    if (!credentials) return;
    try {
      const [c, e, sc] = await Promise.all([
        listFn({ data: credentials }),
        expFn({ data: credentials }),
        getStripeFn({ data: credentials }).catch(() => ({ ativo: false } as any)),
      ]);
      setClubes(c); setExpirando(e); setStripeAtivo(Boolean(sc?.ativo));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao carregar clubes."); }
  };

  const handleSync = async (clube: Clube) => {
    if (!credentials) return;
    setSyncingId(clube.id);
    try {
      await syncOneFn({ data: { ...credentials, clube_id: clube.id } });
      toast.success("Clube sincronizado com o Stripe.");
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao sincronizar."); }
    finally { setSyncingId(null); }
  };

  useEffect(() => {
    if (tenantLoading || !tenant?.id) return;
    if (user && user.nivel !== 1 && user.nivel !== "1") {
      window.location.href = "/";
      return;
    }
    supabase.from("servicos").select("id, name, price").eq("barbearia_id", tenant.id).order("name")
      .then(({ data }) => setServices((data as Service[]) ?? []));
    void load();
  }, [tenant?.id, tenantLoading]);

  const reset = () => setForm(emptyForm);
  const edit = async (clube: Clube) => {
    let trial_dias = 0, stripe_coupon_id = "";
    try {
      const { data } = await supabase.from("clube_assinatura")
        .select("trial_dias, stripe_coupon_id").eq("id", clube.id).maybeSingle();
      trial_dias = Number((data as any)?.trial_dias ?? 0);
      stripe_coupon_id = (data as any)?.stripe_coupon_id ?? "";
    } catch { /* ignore */ }
    setForm({
      id: clube.id, nome: clube.nome, valor_mensal: String(clube.valor_mensal),
      descricao: clube.descricao, ativo: clube.ativo,
      regras: clube.regras_servicos.map((r) => ({ ...r, valor_desconto: Number(r.valor_desconto) })),
      trial_dias, stripe_coupon_id,
    });
    setOpen(true);
  };

  const toggleService = (id: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      regras: checked
        ? [...f.regras, { servico_id: id, quantidade: 1, dias_semana: [0,1,2,3,4,5,6], tipo_desconto: "percentual", valor_desconto: 100 }]
        : f.regras.filter((r) => r.servico_id !== id),
    }));
  };

  const updateRule = (id: string, patch: Partial<Rule>) =>
    setForm((f) => ({ ...f, regras: f.regras.map((r) => r.servico_id === id ? { ...r, ...patch } : r) }));

  const submit = async () => {
    if (!credentials) return;
    if (!form.nome.trim()) return toast.error("Informe o nome.");
    const valor = Number(form.valor_mensal);
    if (!valor || valor <= 0) return toast.error("Valor mensal inválido.");
    if (!form.regras.length) return toast.error("Selecione ao menos um serviço.");
    for (const r of form.regras) {
      if (!r.quantidade || r.quantidade < 1) return toast.error("Informe a quantidade de cada serviço.");
      if (!r.dias_semana.length) return toast.error("Selecione os dias da semana de cada serviço.");
      if (!r.valor_desconto || r.valor_desconto <= 0) return toast.error("Informe o desconto de cada serviço.");
    }
    setSaving(true);
    try {
      const saved: any = await saveFn({ data: {
        ...credentials, id: form.id, nome: form.nome, valor_mensal: valor,
        descricao: form.descricao, ativo: form.ativo, regras_servicos: form.regras,
      } });
      const savedId: string | undefined = form.id ?? saved?.id ?? saved?.[0]?.id;
      if (stripeAtivo && savedId) {
        try {
          await setOptsFn({ data: { ...credentials, clube_id: savedId,
            trial_dias: form.trial_dias || 0,
            stripe_coupon_id: form.stripe_coupon_id?.trim() || null } });
          await syncOneFn({ data: { ...credentials, clube_id: savedId } });
        } catch (e) { console.error("Stripe sync failed", e); toast.error("Salvo, mas houve erro ao sincronizar com Stripe."); }
      }
      toast.success(form.id ? "Clube atualizado." : "Clube criado.");
      setOpen(false); reset(); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };

  const handleToggle = async (clube: Clube) => {
    if (!credentials) return;
    try {
      await toggleFn({ data: { ...credentials, id: clube.id, ativo: !clube.ativo } });
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
  };

  const handleDelete = async (clube: Clube) => {
    if (!credentials || !confirm(`Excluir o clube "${clube.nome}"?`)) return;
    try {
      await deleteFn({ data: { ...credentials, id: clube.id } });
      toast.success("Clube excluído."); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Crown className="text-primary" /> Clube de Assinatura</h1>
            <p className="text-muted-foreground">Gerencie planos de assinatura e benefícios dos clientes.</p>
          </div>
          <Button onClick={() => { reset(); setOpen(true); }}><Plus /> Novo clube</Button>
        </div>

        <Tabs defaultValue="clubes">
          <TabsList>
            <TabsTrigger value="clubes">Clubes</TabsTrigger>
            <TabsTrigger value="expirando">Prestes a expirar ({expirando.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="clubes" className="mt-4">
            {clubes.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Nenhum clube criado.</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {clubes.map((clube) => (
                  <Card key={clube.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Crown className="text-primary w-5 h-5" />{clube.nome}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">R$ {Number(clube.valor_mensal).toFixed(2)}/mês</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={clube.ativo} onCheckedChange={() => void handleToggle(clube)} />
                          <Badge variant={clube.ativo ? "default" : "secondary"}>{clube.ativo ? "Ativo" : "Inativo"}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {clube.descricao && <p className="text-sm text-muted-foreground">{clube.descricao}</p>}
                      <div className="text-sm space-y-1">
                        {clube.regras_servicos.map((r) => {
                          const s = services.find((x) => x.id === r.servico_id);
                          return (
                            <div key={r.servico_id} className="flex justify-between border-l-2 border-primary/40 pl-2">
                              <span>{s?.name ?? "Serviço"} <span className="text-muted-foreground">× {r.quantidade}</span></span>
                              <span className="text-primary font-medium">
                                {r.tipo_desconto === "percentual" ? `${r.valor_desconto}%` : `R$ ${Number(r.valor_desconto).toFixed(2)}`} OFF
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <Accordion type="single" collapsible>
                        <AccordionItem value="assinantes">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {clube.total_assinantes} assinante(s) ativo(s)</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            {clube.assinantes.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Sem assinantes ativos.</p>
                            ) : (
                              <ul className="space-y-1 text-sm">
                                {clube.assinantes.map((a) => (
                                  <li key={a.id} className="flex justify-between">
                                    <span>{a.nome}</span>
                                    <span className="text-muted-foreground">até {format(parseISO(a.data_fim), "dd/MM/yyyy")}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => edit(clube)}><Pencil className="w-4 h-4" /> Editar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void handleDelete(clube)}>
                          <Trash2 className="w-4 h-4" /> Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="expirando" className="mt-4">
            {expirando.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Nenhum cliente com clube prestes a expirar (≤ 5 dias).</div>
            ) : (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  {expirando.map((e) => (
                    <div key={e.cliente_id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{e.cliente_nome}</p>
                        <p className="text-sm text-muted-foreground">{e.clube_nome}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />
                          {e.dias_restantes === 0 ? "Expira hoje" : `${e.dias_restantes} dia(s)`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">até {format(parseISO(e.data_fim), "dd/MM/yyyy")}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader><DialogTitle>{form.id ? "Editar clube" : "Novo clube"}</DialogTitle></DialogHeader>
            <div className="grid gap-5 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Nome</Label>
                  <Input maxLength={100} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor mensal (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.valor_mensal}
                    onChange={(e) => setForm({ ...form, valor_mensal: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label>
                <Textarea maxLength={1000} value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Clube ativo</Label>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Serviços contemplados</Label>
                  <p className="text-xs text-muted-foreground">Escolha quais serviços fazem parte e configure a regra de desconto.</p>
                </div>
                <div className="space-y-3">
                  {services.map((s) => {
                    const rule = form.regras.find((r) => r.servico_id === s.id);
                    return (
                      <div key={s.id} className="rounded-lg border p-3 space-y-3">
                        <label className="flex items-center gap-3">
                          <Checkbox checked={Boolean(rule)} onCheckedChange={(c) => toggleService(s.id, Boolean(c))} />
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">R$ {Number(s.price).toFixed(2)}</p>
                          </div>
                        </label>
                        {rule && (
                          <div className="grid gap-3 pl-7 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Quantidade no período</Label>
                              <Input type="number" min={1} value={rule.quantidade}
                                onChange={(e) => updateRule(s.id, { quantidade: Number(e.target.value) || 1 })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Dias da semana</Label>
                              <div className="flex flex-wrap gap-1">
                                {weekdays.map((d, i) => (
                                  <button key={d} type="button"
                                    onClick={() => updateRule(s.id, { dias_semana: rule.dias_semana.includes(i)
                                      ? rule.dias_semana.filter((x) => x !== i) : [...rule.dias_semana, i] })}
                                    className={`px-2 py-1 text-xs rounded border ${rule.dias_semana.includes(i)
                                      ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                                    {d}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tipo de desconto</Label>
                              <Select value={rule.tipo_desconto}
                                onValueChange={(v) => updateRule(s.id, { tipo_desconto: v as "percentual" | "fixo" })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                                  <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Valor do desconto</Label>
                              <Input type="number" step="0.01" min="0.01"
                                max={rule.tipo_desconto === "percentual" ? 100 : undefined}
                                value={rule.valor_desconto}
                                onChange={(e) => updateRule(s.id, { valor_desconto: Number(e.target.value) || 0 })} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={saving} onClick={() => void submit()}>{saving ? "Salvando..." : "Salvar clube"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
