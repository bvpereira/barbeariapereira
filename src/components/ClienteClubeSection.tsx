import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Crown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { listClubes, setClienteClube, removeClienteClube, getClienteClubeStatus } from "@/lib/clube.functions";

interface Props {
  tenantId: string;
  clienteId: string;
}

export function ClienteClubeSection({ tenantId, clienteId }: Props) {
  const listFn = useServerFn(listClubes);
  const setFn = useServerFn(setClienteClube);
  const removeFn = useServerFn(removeClienteClube);
  const statusFn = useServerFn(getClienteClubeStatus);

  const [enabled, setEnabled] = useState(false);
  const [clubes, setClubes] = useState<Awaited<ReturnType<typeof listClubes>>>([]);
  const [clubeId, setClubeId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getClienteClubeStatus>> | null>(null);
  const [saving, setSaving] = useState(false);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "null"); } catch { return null; }
  }, []);
  const creds = user ? { barbearia_id: tenantId, admin_id: String(user.id), admin_password: String(user.senha) } : null;

  const load = async () => {
    if (!creds) return;
    try {
      const [list, st] = await Promise.all([
        listFn({ data: creds }),
        statusFn({ data: { barbearia_id: tenantId, cliente_id: clienteId } }),
      ]);
      setClubes(list.filter((c) => c.ativo));
      setStatus(st);
      if (st.ativo || st.expirado) {
        setEnabled(true);
        setClubeId(st.clube_id ?? "");
        setDataInicio(st.data_inicio ? parseISO(st.data_inicio) : undefined);
        setDataFim(st.data_fim ? parseISO(st.data_fim) : undefined);
        setValor(st.valor != null ? String(st.valor) : "");
      } else {
        setEnabled(false); setClubeId(""); setDataInicio(undefined); setDataFim(undefined); setValor("");
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao carregar clube."); }
  };

  useEffect(() => { void load(); }, [tenantId, clienteId]);

  useEffect(() => {
    if (!clubeId) return;
    const found = clubes.find((c) => c.id === clubeId);
    if (found && !valor) setValor(String(found.valor_mensal));
  }, [clubeId, clubes]);

  const save = async () => {
    if (!creds) return;
    if (enabled) {
      if (!clubeId) return toast.error("Selecione um clube.");
      if (!dataInicio || !dataFim) return toast.error("Informe o período.");
      const v = Number(valor);
      if (v < 0) return toast.error("Valor inválido.");
      setSaving(true);
      try {
        await setFn({ data: {
          ...creds, cliente_id: clienteId, clube_id: clubeId,
          data_inicio: format(dataInicio, "yyyy-MM-dd"),
          data_fim: format(dataFim, "yyyy-MM-dd"), valor: v,
        }});
        toast.success("Clube atualizado.");
        await load();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
      finally { setSaving(false); }
    } else if (status?.ativo || status?.expirado) {
      setSaving(true);
      try {
        await removeFn({ data: { ...creds, cliente_id: clienteId } });
        toast.success("Clube removido."); await load();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
      finally { setSaving(false); }
    }
  };

  const found = clubes.find((c) => c.id === clubeId);

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2"><Crown className="w-4 h-4 text-primary" /> Clube de assinatura</Label>
        <div className="flex items-center gap-2">
          {status?.expirado && <Badge variant="destructive">Expirado</Badge>}
          {status?.ativo && <Badge>Ativo</Badge>}
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <div className="space-y-3 rounded-md border p-3 bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Clube</Label>
            <Select value={clubeId} onValueChange={(v) => { setClubeId(v); setValor(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um clube" /></SelectTrigger>
              <SelectContent>
                {clubes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome} — R$ {Number(c.valor_mensal).toFixed(2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} className="pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dataFim} onSelect={setDataFim} className="pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor pago (R$)</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder={found ? String(found.valor_mensal) : "0,00"} />
          </div>
        </div>
      )}

      <Button size="sm" onClick={() => void save()} disabled={saving} variant="outline" className="w-full">
        {saving ? "Salvando..." : "Salvar clube"}
      </Button>

      {status && status.historico && status.historico.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1"><History className="w-3 h-3" /> Histórico</Label>
          <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
            {status.historico.map((h, i) => (
              <div key={i} className="flex justify-between border-l-2 border-muted-foreground/30 pl-2 py-1">
                <span>{h.clube_nome}</span>
                <span className="text-muted-foreground">
                  {h.data_inicio && format(parseISO(h.data_inicio), "dd/MM/yyyy")} — {h.data_fim && format(parseISO(h.data_fim), "dd/MM/yyyy")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
