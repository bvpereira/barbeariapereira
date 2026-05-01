import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  UserCircle, 
  Phone, 
  Lock, 
  StickyNote,
  ChevronDown,
  Eye,
  EyeOff,
  History,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Scissors
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addMinutes, isAfter, startOfToday } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
});

interface Cliente {
  id: string;
  nome: string;
  login: string;
  senha?: string;
  observacao: string | null;
  hasAtendimentos?: boolean;
}

interface AtendimentoHistorico {
  id: string;
  data: string;
  valor: number;
  status: 'Agendado' | 'Finalizado' | 'Não compareceu';
  colaborador: { nome: string };
  servicos: { name: string }[];
}

function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const isMobile = useIsMobile();
  const [totalClientes, setTotalClientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  // Historico states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [atendimentosCliente, setAtendimentosCliente] = useState<AtendimentoHistorico[]>([]);

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    login: "",
    senha: "",
    observacao: "",
  });

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  useEffect(() => {
    fetchTotal();
    fetchClientes();
  }, [search, limit]);

  const fetchTotal = async () => {
    const { count, error } = await supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("nivel", 3);
    
    if (error) {
      console.error("Erro ao buscar total:", error);
    } else {
      setTotalClientes(count || 0);
    }
  };

  const fetchClientes = async () => {
    setLoading(true);
    
    let finalQuery = supabase
      .from("usuarios")
      .select(`
        id, 
        nome, 
        login, 
        senha, 
        observacao,
        atendimentos:atendimentos(id)
      `, { count: "exact" })
      .eq("nivel", 3)
      .order("nome", { ascending: true });

    if (search) {
      finalQuery = finalQuery.or(`nome.ilike.%${search}%,login.ilike.%${search}%`);
    }

    const { data: finalData, error: finalError, count: filteredCount } = await finalQuery.range(0, limit - 1);

    if (finalError) {
      toast.error("Erro ao carregar clientes");
      console.error(finalError);
    } else {
      const clientesComFlag = (finalData || []).map((cliente: any) => ({
        ...cliente,
        hasAtendimentos: cliente.atendimentos && cliente.atendimentos.length > 0
      }));
      setClientes(clientesComFlag);
      setHasMore((filteredCount || 0) > limit);
    }
    setLoading(false);
  };

  const fetchHistorico = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    
    const { data, error } = await supabase
      .from("atendimentos")
      .select(`
        id,
        data,
        valor,
        status,
        colaborador:colaboradores(nome),
        servicos:atendimento_servicos(
          servico:servicos(name)
        )
      `)
      .eq("cliente_id", cliente.id)
      .order("data", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar histórico");
      console.error(error);
    } else {
      const formattedData = (data || []).map((at: any) => ({
        ...at,
        servicos: at.servicos.map((s: any) => s.servico)
      }));
      setAtendimentosCliente(formattedData);
    }
    setHistoryLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nome) {
      toast.error("O nome do cliente é obrigatório");
      return;
    }

    const loginNumeros = formData.login.replace(/\D/g, "");
    if (loginNumeros.length === 0) {
      toast.error("O telefone é obrigatório");
      return;
    }

    if (loginNumeros.length < 11) {
      toast.error("O telefone está incompleto (deve ter 11 dígitos)");
      return;
    }

    if (!formData.senha) {
      toast.error("A senha é obrigatória");
      return;
    }

    if (formData.senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    const payload = {
      nome: formData.nome,
      login: loginNumeros,
      senha: formData.senha,
      observacao: formData.observacao,
      nivel: 3,
    };

    if (isEditing && selectedCliente) {
      const { error } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("id", selectedCliente.id);

      if (error) {
        if (error.code === "23505") {
          toast.error("Este telefone já está cadastrado");
        } else {
          toast.error("Erro ao atualizar cliente");
        }
      } else {
        toast.success("Cliente atualizado com sucesso");
        setIsDialogOpen(false);
        fetchClientes();
      }
    } else {
      const { error } = await supabase
        .from("usuarios")
        .insert([payload]);

      if (error) {
        if (error.code === "23505") {
          toast.error("Este telefone já está cadastrado");
        } else {
          toast.error("Erro ao cadastrar cliente");
        }
      } else {
        toast.success("Cliente cadastrado com sucesso");
        setIsDialogOpen(false);
        fetchClientes();
        fetchTotal();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    const { error } = await supabase
      .from("usuarios")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir cliente");
    } else {
      toast.success("Cliente excluído com sucesso");
      fetchClientes();
      fetchTotal();
    }
  };

  const openAddDialog = () => {
    setIsEditing(false);
    setSelectedCliente(null);
    setShowPassword(false);
    setFormData({ nome: "", login: "", senha: "", observacao: "" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (cliente: Cliente) => {
    setIsEditing(true);
    setSelectedCliente(cliente);
    setShowPassword(false);
    setFormData({
      nome: cliente.nome,
      login: formatPhone(cliente.login),
      senha: cliente.senha || "",
      observacao: cliente.observacao || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Clientes</h1>
            <p className="text-muted-foreground">Gerencie a base de clientes da barbearia</p>
          </div>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar cliente
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <UserCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClientes}</div>
              <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && clientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        Carregando clientes...
                      </TableCell>
                    </TableRow>
                  ) : clientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientes.map((cliente) => (
                      <TableRow 
                        key={cliente.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => fetchHistorico(cliente)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {cliente.nome}
                            {cliente.hasAtendimentos && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] py-0 px-1.5 border-blue-200">
                                <History className="w-3 h-3 mr-1" />
                                Histórico
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatPhone(cliente.login)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(cliente)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(cliente.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => setLimit(prev => prev + 10)}
                  disabled={loading}
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Carregar mais 10
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog Add/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome completo</Label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    className="pl-10"
                    placeholder="Ex: João Silva"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login"
                    className="pl-10"
                    placeholder="(00) 00000-0000"
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: formatPhone(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <div className="relative">
                  <StickyNote className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="observacao"
                    className="pl-10 min-h-[100px]"
                    placeholder="Anotações sobre o cliente..."
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Histórico Dialog/Drawer */}
        {isMobile ? (
          <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="text-left border-b pb-4">
                <DrawerTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Histórico: {selectedCliente?.nome}
                </DrawerTitle>
                <DrawerDescription>
                  Histórico completo de atendimentos do cliente.
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="overflow-y-auto px-4 py-2 flex-1">
                {renderHistoryContent()}
              </div>

              <DrawerFooter className="border-t pt-4">
                <DrawerClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Histórico: {selectedCliente?.nome}
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="flex-1 overflow-y-auto px-6 py-0">
                {renderHistoryContent()}
              </ScrollArea>
              
              <DialogFooter className="p-6 pt-2 border-t">
                <Button onClick={() => setIsHistoryOpen(false)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );

  function renderHistoryContent() {
    if (historyLoading) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          Carregando histórico...
        </div>
      );
    }

    if (atendimentosCliente.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum atendimento registrado para este cliente.
        </div>
      );
    }

    return (
      <div className="space-y-4 py-4">
        {atendimentosCliente.map((atendimento) => (
          <Card key={atendimento.id} className="overflow-hidden border-l-4 border-l-primary/40">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(parseISO(atendimento.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    Profissional: {atendimento.colaborador.nome}
                  </div>
                </div>
                <Badge 
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-2 py-0",
                    atendimento.status === 'Agendado' && "bg-blue-100 text-blue-700",
                    atendimento.status === 'Finalizado' && "bg-green-100 text-green-700",
                    atendimento.status === 'Não compareceu' && "bg-red-100 text-red-700"
                  )}
                >
                  {atendimento.status === 'Agendado' && <Clock className="w-3 h-3 mr-1" />}
                  {atendimento.status === 'Finalizado' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {atendimento.status === 'Não compareceu' && <XCircle className="w-3 h-3 mr-1" />}
                  {atendimento.status}
                </Badge>
              </div>
              
              <div className="bg-muted/30 rounded-md p-2.5 space-y-2">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Scissors className="w-3 h-3" />
                  Serviços
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {atendimento.servicos.map((s, idx) => (
                    <span key={idx} className="text-xs bg-background border rounded px-2 py-0.5">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-right">
                <span className="text-sm font-bold text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atendimento.valor)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
}
