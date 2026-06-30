import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { DateRange } from "react-day-picker";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCoupon, listCoupons, saveCoupon } from "@/lib/coupons.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Service = { id: string; name: string; price: number };
type Rule = { servico_id: string; tipo_desconto: "percentual" | "fixo" | null; valor_desconto: number | null };
type Coupon = Awaited<ReturnType<typeof listCoupons>>[number];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const emptyForm = {
  id: undefined as string | undefined, nome: "", descricao: "", codigo: "", dias_semana: [] as number[],
  limite_por_cliente: "ilimitado" as "1" | "ilimitado", somente_novos_clientes: false,
  inatividade_mode: "todos" as "todos" | "dias", inatividade_dias: "",
  tipo_desconto: "percentual" as "percentual" | "fixo", valor_desconto: "",
  servicos_ids: [] as string[],
};

export function CouponsSection({ tenantId, services }: { tenantId: string; services: Service[] }) {
  const listFn = useServerFn(listCoupons);
  const saveFn = useServerFn(saveCoupon);
  const deleteFn = useServerFn(deleteCoupon);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const [form, setForm] = useState(emptyForm);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "null"); } catch { return null; }
  }, []);
  const credentials = user ? { barbearia_id: tenantId, admin_id: String(user.id), admin_password: String(user.senha) } : null;

  const load = async () => {
    if (!credentials) return;
    try { setCoupons(await listFn({ data: credentials })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao carregar cupons."); }
  };

  useEffect(() => { void load(); }, [tenantId]);

  const reset = () => { setForm(emptyForm); setRange(undefined); };
  const edit = (coupon: Coupon) => {
    const rules = Array.isArray(coupon.regras_servicos) ? coupon.regras_servicos as unknown as Rule[] : [];
    const first = rules[0];
    setForm({
      id: coupon.id, nome: coupon.nome, descricao: coupon.descricao, codigo: coupon.codigo,
      dias_semana: coupon.dias_semana, limite_por_cliente: coupon.limite_por_cliente as "1" | "ilimitado",
      somente_novos_clientes: coupon.somente_novos_clientes,
      inatividade_mode: coupon.inatividade_dias ? "dias" : "todos", inatividade_dias: coupon.inatividade_dias?.toString() ?? "",
      tipo_desconto: (first?.tipo_desconto as "percentual" | "fixo") ?? "percentual",
      valor_desconto: first?.valor_desconto?.toString() ?? "",
      servicos_ids: rules.map((r) => r.servico_id),
    });
    setRange({ from: parseISO(coupon.data_inicio), to: parseISO(coupon.data_fim) }); setOpen(true);
  };

  const toggleService = (id: string, checked: boolean) => setForm((current) => ({
    ...current, servicos_ids: checked ? [...current.servicos_ids, id] : current.servicos_ids.filter((sid) => sid !== id),
  }));

  const submit = async () => {
    if (!credentials || !range?.from || !range.to) return toast.error("Selecione o período completo do cupom.");
    if (!form.dias_semana.length || !form.servicos_ids.length) return toast.error("Selecione dias e serviços elegíveis.");
    const valor = Number(form.valor_desconto);
    if (!valor || valor <= 0) return toast.error("Informe o valor do desconto.");
    setSaving(true);
    try {
      await saveFn({ data: {
        ...credentials, id: form.id, nome: form.nome, descricao: form.descricao, codigo: form.codigo,
        data_inicio: format(range.from, "yyyy-MM-dd"), data_fim: format(range.to, "yyyy-MM-dd"), dias_semana: form.dias_semana,
        limite_por_cliente: form.limite_por_cliente, somente_novos_clientes: form.somente_novos_clientes,
        inatividade_dias: !form.somente_novos_clientes && form.inatividade_mode === "dias" ? Number(form.inatividade_dias) : null,
        valor_minimo_total: null, tipo_desconto_total: null, valor_desconto_total: null,
        regras_servicos: form.servicos_ids.map((sid) => ({ servico_id: sid, tipo_desconto: form.tipo_desconto, valor_desconto: valor })),
      } });
      toast.success(form.id ? "Cupom atualizado." : "Cupom criado."); setOpen(false); reset(); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar cupom."); }
    finally { setSaving(false); }
  };

  const remove = async (coupon: Coupon) => {
    if (!credentials || !confirm(`Excluir o cupom ${coupon.codigo}?`)) return;
    try { await deleteFn({ data: { ...credentials, id: coupon.id } }); toast.success("Cupom excluído."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao excluir cupom."); }
  };

  return <section className="space-y-5 border-t pt-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-2xl font-bold">Cupons de desconto</h2><p className="text-sm text-muted-foreground">Crie regras de desconto por período, público e serviço.</p></div>
      <Button onClick={() => { reset(); setOpen(true); }}><Plus /> Novo cupom</Button>
    </div>
    {coupons.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Nenhum cupom criado.</div> :
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{coupons.map((coupon) => {
        const today = startOfDay(new Date()); const start = parseISO(coupon.data_inicio); const end = parseISO(coupon.data_fim);
        const status = today < start ? "Futuro" : today > end ? "Expirado" : "Ativo";
        return <Card key={coupon.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Tag className="text-primary" />{coupon.nome}</CardTitle><p className="mt-1 font-mono text-sm text-primary">{coupon.codigo}</p></div><Badge variant={status === "Ativo" ? "default" : "secondary"}>{status}</Badge></div></CardHeader>
          <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{coupon.descricao || "Sem descrição"}</p><div className="text-sm"><p>{format(start, "dd/MM/yyyy")} — {format(end, "dd/MM/yyyy")}</p><p className="text-muted-foreground">{coupon.dias_semana.map((day) => weekdays[day]).join(", ")} · {coupon.usos} aplicação(ões)</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => edit(coupon)}><Pencil /> Editar</Button><Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(coupon)}><Trash2 /> Excluir</Button></div></CardContent></Card>;
      })}</div>}

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{form.id ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
      <div className="grid gap-5 py-2">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Nome</Label><Input maxLength={100} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div><div className="space-y-2"><Label>Código</Label><Input minLength={4} maxLength={10} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} /></div></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea maxLength={500} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
        <div className="space-y-2"><Label>Duração</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarDays />{range?.from ? `${format(range.from, "dd/MM/yyyy")} — ${range.to ? format(range.to, "dd/MM/yyyy") : "..."}` : "Selecionar período"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={range} onSelect={setRange} locale={ptBR} className="pointer-events-auto" /></PopoverContent></Popover></div>
        <div className="space-y-2"><Label>Dias da semana</Label><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdays.map((day, index) => <label key={day} className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox checked={form.dias_semana.includes(index)} onCheckedChange={(checked) => setForm({ ...form, dias_semana: checked ? [...form.dias_semana, index] : form.dias_semana.filter((value) => value !== index) })} />{day}</label>)}</div></div>
        <div className="grid gap-5 sm:grid-cols-2"><Choice label="Número de uso por usuário" value={form.limite_por_cliente} onChange={(value) => setForm({ ...form, limite_por_cliente: value as "1" | "ilimitado" })} options={[["1", "Uma vez"], ["ilimitado", "Ilimitado"]]} /><Choice label="Novos clientes" value={form.somente_novos_clientes ? "sim" : "nao"} onChange={(value) => setForm({ ...form, somente_novos_clientes: value === "sim", inatividade_mode: value === "sim" ? "todos" : form.inatividade_mode, inatividade_dias: value === "sim" ? "" : form.inatividade_dias })} options={[["sim", "Sim"], ["nao", "Não"]]} /></div>
        <div className="space-y-3"><Label>Tempo de cliente inativo</Label><RadioGroup disabled={form.somente_novos_clientes} value={form.inatividade_mode} onValueChange={(value) => setForm({ ...form, inatividade_mode: value as "todos" | "dias" })} className="flex gap-5"><RadioOption value="todos" label="Todos os clientes" /><RadioOption value="dias" label="Após número de dias" /></RadioGroup>{form.inatividade_mode === "dias" && !form.somente_novos_clientes && <Input type="number" min={1} step={1} placeholder="Ex: 60" value={form.inatividade_dias} onChange={(e) => setForm({ ...form, inatividade_dias: e.target.value })} />}</div>
        <div className="space-y-2"><Label>Desconto aplicado aos serviços selecionados</Label><div className="grid gap-3 sm:grid-cols-2"><Select value={form.tipo_desconto} onValueChange={(value) => setForm({ ...form, tipo_desconto: value as "percentual" | "fixo" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentual">Percentual (%)</SelectItem><SelectItem value="fixo">Valor fixo (R$)</SelectItem></SelectContent></Select><Input type="number" min={1} step={1} placeholder={form.tipo_desconto === "percentual" ? "Ex: 10" : "Ex: 5"} value={form.valor_desconto} onChange={(e) => setForm({ ...form, valor_desconto: e.target.value })} /></div><p className="text-xs text-muted-foreground">O mesmo desconto será aplicado a cada serviço marcado abaixo.</p></div>
        <div className="space-y-3"><div><Label>Serviços</Label><p className="text-xs text-muted-foreground">O cupom será válido se o atendimento contiver qualquer serviço marcado.</p></div><div className="space-y-2">{services.map((service) => <label key={service.id} className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={form.servicos_ids.includes(service.id)} onCheckedChange={(checked) => toggleService(service.id, Boolean(checked))} /><span><strong>{service.name}</strong><small className="block text-muted-foreground">R$ {Number(service.price).toFixed(2)}</small></span></label>)}</div></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void submit()}>{saving ? "Salvando..." : "Salvar cupom"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}

function RadioOption({ value, label }: { value: string; label: string }) { return <label className="flex items-center gap-2 text-sm"><RadioGroupItem value={value} />{label}</label>; }
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <div className="space-y-3"><Label>{label}</Label><RadioGroup value={value} onValueChange={onChange} className="flex gap-5">{options.map(([optionValue, optionLabel]) => <RadioOption key={optionValue} value={optionValue} label={optionLabel} />)}</RadioGroup></div>; }
