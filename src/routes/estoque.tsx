import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, AlertTriangle, Search, Settings2, Package, Boxes, History, Download } from "lucide-react";

export const Route = createFileRoute("/estoque")({ component: EstoquePage });

interface Produto {
  id: string;
  barbearia_id: string;
  nome: string;
  tipo: "consumivel" | "revenda";
  quantidade_atual: number;
  alerta_estoque: number;
  preco_revenda: number | null;
  custo_medio: number;
  categoria: string | null;
  marca: string | null;
  unidade_medida: string | null;
  ativo: boolean;
}

const fmtMoney = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function EstoquePage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"consumivel" | "revenda">("consumivel");
  const [search, setSearch] = useState("");
  const [soAlerta, setSoAlerta] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");

  // Dialog produto
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [createType, setCreateType] = useState<"consumivel" | "revenda">("consumivel");
  const [form, setForm] = useState({ nome: "", quantidade_atual: "0", alerta_estoque: "0", preco_revenda: "", categoria: "", marca: "", unidade_medida: "un" });


  // Ajuste manual
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Produto | null>(null);
  const [adjustQtd, setAdjustQtd] = useState("0");
  const [adjustMotivo, setAdjustMotivo] = useState("");

  // Histórico
  const [histOpen, setHistOpen] = useState(false);
  const [histTarget, setHistTarget] = useState<Produto | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);

  const fetchProdutos = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("estoque" as any)
      .select("*").eq("barbearia_id", tenant.id).is("deleted_at", null).order("nome", { ascending: true });
    if (error) toast.error("Erro: " + error.message);
    else setProdutos(((data as any) || []) as Produto[]);
    setLoading(false);
  };

  useEffect(() => { if (!tenantLoading && tenant) fetchProdutos(); }, [tenant, tenantLoading]);

  const filtered = useMemo(() => {
    let list = produtos.filter(p => p.tipo === tab);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(s));
    }
    if (categoriaFiltro !== "todas") list = list.filter(p => (p.categoria || "") === categoriaFiltro);
    if (soAlerta) list = list.filter(p => Number(p.quantidade_atual) <= Number(p.alerta_estoque));
    return list;
  }, [produtos, tab, search, soAlerta, categoriaFiltro]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    produtos.filter(p => p.tipo === tab).forEach(p => p.categoria && set.add(p.categoria));
    return Array.from(set).sort();
  }, [produtos, tab]);

  const resetForm = () => {
    setEditing(null);
    setForm({ nome: "", quantidade_atual: "0", alerta_estoque: "0", preco_revenda: "", categoria: "", marca: "", unidade_medida: "un" });
  };

  const openCreate = (tipo: "consumivel" | "revenda") => { resetForm(); setCreateType(tipo); setIsOpen(true); };
  const openEdit = (p: Produto) => {
    setEditing(p);
    setCreateType(p.tipo);
    setForm({
      nome: p.nome, quantidade_atual: String(p.quantidade_atual), alerta_estoque: String(p.alerta_estoque),
      preco_revenda: p.preco_revenda?.toString() || "", categoria: p.categoria || "", marca: p.marca || "",
      unidade_medida: p.unidade_medida || "un",
    });
    setIsOpen(true);
  };


  const handleSave = async () => {
    if (!tenant?.id) return;
    if (!form.nome.trim()) return toast.error("Informe o nome");
    const tipoProduto = editing ? editing.tipo : createType;
    const payload: any = {
      barbearia_id: tenant.id, nome: form.nome.trim(), tipo: tipoProduto,
      alerta_estoque: parseFloat(form.alerta_estoque) || 0,
      preco_revenda: tipoProduto === "revenda" ? (parseFloat(form.preco_revenda) || 0) : null,
      categoria: form.categoria.trim() || null, marca: form.marca.trim() || null,
      unidade_medida: form.unidade_medida || "un",
    };

    if (editing) {
      const { error } = await supabase.from("estoque" as any).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Produto atualizado");
    } else {
      payload.quantidade_atual = parseFloat(form.quantidade_atual) || 0;
      const { data, error } = await supabase.from("estoque" as any).insert([payload]).select().single();
      if (error) return toast.error(error.message);
      // movimento inicial
      if (payload.quantidade_atual > 0) {
        await supabase.from("estoque_movimentos" as any).insert({
          barbearia_id: tenant.id, estoque_id: (data as any).id, tipo: "entrada",
          quantidade: payload.quantidade_atual, saldo_apos: payload.quantidade_atual,
          origem: "inicial", motivo: "Saldo inicial",
        });
      }
      toast.success("Produto criado");
    }
    setIsOpen(false); resetForm(); fetchProdutos();
  };

  const handleDelete = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    const { error } = await supabase.from("estoque" as any).update({ deleted_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); fetchProdutos();
  };

  const openAdjust = (p: Produto) => { setAdjustTarget(p); setAdjustQtd(String(p.quantidade_atual)); setAdjustMotivo(""); setAdjustOpen(true); };
  const handleAdjust = async () => {
    if (!adjustTarget) return;
    const { error } = await supabase.rpc("ajustar_estoque_manual" as any, {
      p_estoque_id: adjustTarget.id, p_novo_saldo: parseFloat(adjustQtd) || 0, p_motivo: adjustMotivo || "Ajuste manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Saldo ajustado"); setAdjustOpen(false); fetchProdutos();
  };

  const openHistorico = async (p: Produto) => {
    setHistTarget(p); setHistOpen(true); setHistorico([]);
    const { data } = await supabase.from("estoque_movimentos" as any)
      .select("*").eq("estoque_id", p.id).order("created_at", { ascending: false }).limit(50);
    setHistorico((data as any) || []);
  };

  const exportarAlertas = () => {
    const alertas = produtos.filter(p => Number(p.quantidade_atual) <= Number(p.alerta_estoque));
    const csv = ["Nome,Tipo,Qtd Atual,Alerta,Unidade", ...alertas.map(p =>
      `"${p.nome}",${p.tipo},${p.quantidade_atual},${p.alerta_estoque},${p.unidade_medida || "un"}`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `sugestao-compra-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Boxes className="w-7 h-7" /> Estoque</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie produtos consumíveis e de revenda</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportarAlertas} className="gap-2"><Download className="w-4 h-4" />Exportar alertas</Button>
            <Button onClick={() => openCreate("consumivel")} className="gap-2"><Plus className="w-4 h-4" /><Package className="w-4 h-4" />Novo consumível</Button>
            <Button onClick={() => openCreate("revenda")} className="gap-2"><Plus className="w-4 h-4" /><Boxes className="w-4 h-4" />Novo revenda</Button>
          </div>

        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="consumivel" className="gap-2"><Package className="w-4 h-4" />Consumíveis</TabsTrigger>
            <TabsTrigger value="revenda" className="gap-2"><Boxes className="w-4 h-4" />Revenda</TabsTrigger>
          </TabsList>

          {(["consumivel", "revenda"] as const).map(t => (
            <TabsContent key={t} value={t} className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                {categorias.length > 0 && (
                  <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                    <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas categorias</SelectItem>
                      {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button variant={soAlerta ? "default" : "outline"} onClick={() => setSoAlerta(s => !s)} className="gap-2">
                  <AlertTriangle className="w-4 h-4" />Em alerta
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum produto encontrado.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map(p => {
                    const emAlerta = Number(p.quantidade_atual) <= Number(p.alerta_estoque);
                    return (
                      <Card key={p.id} className={emAlerta ? "border-destructive/50" : ""}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold truncate">{p.nome}</h3>
                                {emAlerta && <Badge variant="destructive" className="text-[10px]">Em alerta</Badge>}
                              </div>
                              {(p.categoria || p.marca) && (
                                <p className="text-xs text-muted-foreground mt-0.5">{[p.marca, p.categoria].filter(Boolean).join(" · ")}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Em estoque</span>
                              <p className={`font-semibold ${emAlerta ? "text-destructive" : ""}`}>{Number(p.quantidade_atual)} {p.unidade_medida}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Alerta ≤</span>
                              <p className="font-medium">{Number(p.alerta_estoque)} {p.unidade_medida}</p>
                            </div>
                            {p.tipo === "revenda" && (
                              <div>
                                <span className="text-muted-foreground text-xs">Preço venda</span>
                                <p className="font-semibold text-primary">{fmtMoney(Number(p.preco_revenda) || 0)}</p>
                              </div>
                            )}
                            {Number(p.custo_medio) > 0 && (
                              <div>
                                <span className="text-muted-foreground text-xs">Custo médio</span>
                                <p className="font-medium">{fmtMoney(Number(p.custo_medio))}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-1 pt-2 border-t">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openHistorico(p)} title="Histórico"><History className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openAdjust(p)} title="Ajustar saldo"><Settings2 className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog Criar/Editar */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar produto" : `Novo produto ${tab === "consumivel" ? "consumível" : "de revenda"}`}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: shampoo" /></div>
                <div><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm(f => ({ ...f, marca: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {!editing && (
                  <div><Label>Qtd. inicial</Label><Input type="number" step="0.001" value={form.quantidade_atual} onChange={(e) => setForm(f => ({ ...f, quantidade_atual: e.target.value }))} /></div>
                )}
                <div><Label>Alerta ≤</Label><Input type="number" step="0.001" value={form.alerta_estoque} onChange={(e) => setForm(f => ({ ...f, alerta_estoque: e.target.value }))} /></div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unidade_medida} onValueChange={(v) => setForm(f => ({ ...f, unidade_medida: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {tab === "revenda" && (
                <div><Label>Preço de revenda (R$)</Label><Input type="number" step="0.01" value={form.preco_revenda} onChange={(e) => setForm(f => ({ ...f, preco_revenda: e.target.value }))} /></div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ajuste manual */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajustar saldo · {adjustTarget?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Novo saldo</Label><Input type="number" step="0.001" value={adjustQtd} onChange={(e) => setAdjustQtd(e.target.value)} /></div>
              <div><Label>Motivo</Label><Input value={adjustMotivo} onChange={(e) => setAdjustMotivo(e.target.value)} placeholder="Ex: contagem física, perda, validade" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdjust}>Aplicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Histórico */}
        <Dialog open={histOpen} onOpenChange={setHistOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Histórico · {histTarget?.nome}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação.</p>
              ) : historico.map((m: any) => (
                <div key={m.id} className="flex justify-between text-sm border-b py-2 gap-2">
                  <div className="min-w-0">
                    <Badge variant={m.tipo === "entrada" ? "default" : m.tipo === "saida" ? "secondary" : "outline"}>{m.tipo}</Badge>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                    <p className="text-xs text-muted-foreground truncate">{m.origem}{m.motivo ? ` — ${m.motivo}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{m.quantidade > 0 ? "+" : ""}{Number(m.quantidade)}</p>
                    <p className="text-xs text-muted-foreground">Saldo: {Number(m.saldo_apos)}</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
