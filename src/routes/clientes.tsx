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
  ChevronDown
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
});

interface Cliente {
  id: string;
  nome: string;
  login: string;
  senha?: string;
  observacao: string | null;
}

function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    login: "",
    senha: "",
    observacao: "",
  });

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
      .select("id, nome, login, senha, observacao", { count: "exact" })
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
      setClientes(finalData || []);
      setHasMore((filteredCount || 0) > limit);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.login || !formData.senha) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const loginNumeros = formData.login.replace(/\D/g, "");
    if (loginNumeros.length !== 11) {
      toast.error("O telefone deve ter 11 dígitos");
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
    setFormData({ nome: "", login: "", senha: "", observacao: "" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (cliente: Cliente) => {
    setIsEditing(true);
    setSelectedCliente(cliente);
    setFormData({
      nome: cliente.nome,
      login: cliente.login,
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
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell>{cliente.login}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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
                <Label htmlFor="login">Telefone (11 dígitos)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login"
                    className="pl-10"
                    placeholder="Ex: 11999999999"
                    maxLength={11}
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    className="pl-10"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  />
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
      </div>
    </AdminLayout>
  );
}
