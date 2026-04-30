import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, User, Phone, Lock, DollarSign, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/colaboradores" as any)({
  component: CollaboratorsPage,
});

interface Service {
  id: string;
  name: string;
}

interface CollaboratorService {
  servico_id: string;
  tipo_comissao: "fixo" | "percentual";
  valor_comissao: number;
}

interface Collaborator {
  id: string;
  nome: string;
  resumo: string | null;
  login: string;
  senha: string;
  salario_fixo: number | null;
  foto_url: string | null;
  colaborador_servicos?: (CollaboratorService & { servicos: { name: string } })[];
}

function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [resumo, setResumo] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [salarioFixo, setSalarioFixo] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<CollaboratorService[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: servicesData, error: servicesError } = await supabase
        .from("servicos")
        .select("id, name")
        .order("name");
      
      if (servicesError) throw servicesError;
      setAllServices(servicesData || []);

      const { data: collaboratorsData, error: collaboratorsError } = await supabase
        .from("colaboradores")
        .select(`
          *,
          colaborador_servicos (
            servico_id,
            tipo_comissao,
            valor_comissao,
            servicos (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (collaboratorsError) throw collaboratorsError;
      setCollaborators(collaboratorsData || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setResumo("");
    setLogin("");
    setSenha("");
    setSalarioFixo("");
    setFoto(null);
    setFotoPreview(null);
    setSelectedServices([]);
    setEditingCollaborator(null);
  };

  const handleEdit = (colab: Collaborator) => {
    setEditingCollaborator(colab);
    setNome(colab.nome);
    setResumo(colab.resumo || "");
    setLogin(colab.login);
    setSenha(colab.senha);
    setSalarioFixo(colab.salario_fixo.toString());
    setFotoPreview(colab.foto_url);
    
    const services = colab.colaborador_servicos?.map(s => ({
      servico_id: s.servico_id,
      tipo_comissao: s.tipo_comissao,
      valor_comissao: s.valor_comissao
    })) || [];
    setSelectedServices(services);
    
    setIsDialogOpen(true);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.servico_id === serviceId);
      if (exists) {
        return prev.filter(s => s.servico_id !== serviceId);
      } else {
        return [...prev, { servico_id: serviceId, tipo_comissao: "percentual", valor_comissao: 0 }];
      }
    });
  };

  const updateServiceCommission = (serviceId: string, field: keyof CollaboratorService, value: any) => {
    setSelectedServices(prev => prev.map(s => 
      s.servico_id === serviceId ? { ...s, [field]: value } : s
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (login.length !== 11 || !/^\d+$/.test(login)) {
      toast.error("O login deve ter exatamente 11 números.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      let fotoUrl = fotoPreview;

      if (foto) {
        const fileExt = foto.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("collaborator-images")
          .upload(filePath, foto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("collaborator-images")
          .getPublicUrl(filePath);
        
        fotoUrl = publicUrl;
      }

      const colabData = {
        nome,
        resumo,
        login,
        senha,
        salario_fixo: parseFloat(salarioFixo) || 0,
        foto_url: fotoUrl,
      };

      let colabId = editingCollaborator?.id;

      if (editingCollaborator) {
        // Update collaborator
        const { error } = await supabase
          .from("colaboradores")
          .update(colabData)
          .eq("id", colabId);
        if (error) throw error;

        // Update user in 'usuarios' table
        const { error: userError } = await supabase
          .from("usuarios")
          .update({ nome, login, senha })
          .eq("login", editingCollaborator.login); // Use old login to find user
        if (userError) throw userError;

        // Clear existing services to re-insert
        await supabase.from("colaborador_servicos").delete().eq("colaborador_id", colabId);
      } else {
        // Create collaborator
        const { data, error } = await supabase
          .from("colaboradores")
          .insert([colabData])
          .select()
          .single();
        if (error) throw error;
        colabId = data.id;

        // Create user in 'usuarios' table
        const { error: userError } = await supabase
          .from("usuarios")
          .insert([{ nome, login, senha, nivel: 2 }]);
        if (userError) throw userError;
      }

      // Insert services
      if (selectedServices.length > 0) {
        const servicesToInsert = selectedServices.map(s => ({
          colaborador_id: colabId,
          servico_id: s.servico_id,
          tipo_comissao: s.tipo_comissao,
          valor_comissao: s.valor_comissao
        }));
        const { error: servicesError } = await supabase
          .from("colaborador_servicos")
          .insert(servicesToInsert);
        if (servicesError) throw servicesError;
      }

      toast.success(editingCollaborator ? "Colaborador atualizado!" : "Colaborador criado!");
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (colab: Collaborator) => {
    if (!confirm(`Tem certeza que deseja remover ${colab.nome}?`)) return;

    try {
      // Delete from colaboradores (cascades to colaborador_servicos)
      const { error } = await supabase.from("colaboradores").delete().eq("id", colab.id);
      if (error) throw error;

      // Delete from usuarios
      const { error: userError } = await supabase.from("usuarios").delete().eq("login", colab.login);
      if (userError) throw userError;

      toast.success("Colaborador removido com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Colaboradores</h1>
          <Button className="gap-2" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
            Adicionar colaborador
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingCollaborator ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login">Login (Telefone 11 dígitos)</Label>
                  <Input id="login" value={login} onChange={e => setLogin(e.target.value)} placeholder="11999999999" maxLength={11} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resumo">Resumo (Texto curto)</Label>
                <Input id="resumo" value={resumo} onChange={e => setResumo(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input id="senha" type="text" value={senha} onChange={e => setSenha(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salario">Salário Fixo (R$)</Label>
                  <Input id="salario" type="number" step="0.01" value={salarioFixo} onChange={e => setSalarioFixo(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto (Quadrada 1:1)</Label>
                <Input type="file" accept="image/*" onChange={handleFotoChange} />
                {fotoPreview && (
                  <div className="mt-2 flex justify-center">
                    <img src={fotoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-border" />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-lg font-bold">Serviços que executa</Label>
                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  {allServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum serviço cadastrado.</p>
                  ) : (
                    allServices.map(service => {
                      const selected = selectedServices.find(s => s.servico_id === service.id);
                      return (
                        <div key={service.id} className="space-y-2 pb-4 border-b last:border-0 border-border">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`service-${service.id}`} 
                              checked={!!selected} 
                              onCheckedChange={() => toggleService(service.id)}
                            />
                            <Label htmlFor={`service-${service.id}`} className="font-medium cursor-pointer">{service.name}</Label>
                          </div>
                          
                          {selected && (
                            <div className="ml-6 flex flex-wrap items-center gap-4">
                              <RadioGroup 
                                value={selected.tipo_comissao} 
                                onValueChange={(val: "fixo" | "percentual") => updateServiceCommission(service.id, "tipo_comissao", val)}
                                className="flex items-center gap-4"
                              >
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="fixo" id={`fixo-${service.id}`} />
                                  <Label htmlFor={`fixo-${service.id}`} className="text-xs">Fixo (R$)</Label>
                                </div>
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="percentual" id={`percent-${service.id}`} />
                                  <Label htmlFor={`percent-${service.id}`} className="text-xs">Percentual (%)</Label>
                                </div>
                              </RadioGroup>
                              <Input 
                                type="number" 
                                step="0.01" 
                                className="w-24 h-8 text-sm" 
                                placeholder="Valor"
                                value={selected.valor_comissao}
                                onChange={e => updateServiceCommission(service.id, "valor_comissao", parseFloat(e.target.value))}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : (editingCollaborator ? "Atualizar" : "Salvar")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Carregando colaboradores...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collaborators.map((colab) => (
              <Card key={colab.id} className="overflow-hidden border-border bg-card/40 hover:bg-card/60 transition-all">
                <CardHeader className="flex flex-row items-center gap-4 p-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {colab.foto_url ? (
                      <img src={colab.foto_url} alt={colab.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{colab.nome}</h3>
                    <p className="text-sm text-muted-foreground truncate">{colab.resumo || "Sem resumo"}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-3 h-3" /> {colab.login}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="w-3 h-3" /> Salário: R$ {Number(colab.salario_fixo).toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Serviços:</p>
                    <div className="flex flex-wrap gap-1">
                      {colab.colaborador_servicos && colab.colaborador_servicos.length > 0 ? (
                        colab.colaborador_servicos.map((cs, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] border border-primary/20">
                            {cs.servicos.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Nenhum serviço</span>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleEdit(colab)}>
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(colab)}>
                    <Trash2 className="w-3 h-3" /> Remover
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
