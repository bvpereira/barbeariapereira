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
import { Switch } from "@/components/ui/switch";

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
  ativo: boolean;
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
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: servicesData, error: servicesError } = await supabase
        .from("servicos")
        .select("id, name, price")
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
        .order("nome", { ascending: true });

      if (collaboratorsError) throw collaboratorsError;
      setCollaborators((collaboratorsData as any) || []);
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
    setAtivo(true);
    setEditingCollaborator(null);
  };

  const handleEdit = (colab: Collaborator) => {
    setEditingCollaborator(colab);
    setNome(colab.nome);
    setResumo(colab.resumo || "");
    setLogin(colab.login);
    setSenha(colab.senha);
    setSalarioFixo(colab.salario_fixo?.toString() || "");
    setFotoPreview(colab.foto_url);
    setAtivo(colab.ativo);
    
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
    const service = allServices.find(s => s.id === serviceId);
    const servicePrice = (service as any)?.price || 0;

    setSelectedServices(prev => prev.map(s => {
      if (s.servico_id === serviceId) {
        let newValue = value;
        
        if (field === "valor_comissao") {
          if (s.tipo_comissao === "percentual" && value > 100) {
            newValue = 100;
            toast.warning("A porcentagem não pode ser maior que 100%");
          } else if (s.tipo_comissao === "fixo" && value > servicePrice) {
            newValue = servicePrice;
            toast.warning(`O valor fixo não pode ser maior que o valor do serviço (R$ ${servicePrice})`);
          }
        } else if (field === "tipo_comissao") {
          // Quando muda o tipo, valida o valor atual contra as novas regras
          if (value === "percentual" && s.valor_comissao > 100) {
            return { ...s, [field]: value, valor_comissao: 100 };
          } else if (value === "fixo" && s.valor_comissao > servicePrice) {
            return { ...s, [field]: value, valor_comissao: servicePrice };
          }
        }
        
        return { ...s, [field]: newValue };
      }
      return s;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLogin = login.replace(/\D/g, "");
    if (cleanLogin.length !== 11) {
      toast.error("O login deve ter exatamente 11 números.");
      return;
    }
    
    setIsSubmitting(true);

    if (senha.length < 6) {
      toast.error("A senha precisa ter no mínimo 6 caracteres.");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Verificações de Login Único (apenas para novos ou se mudar o login)
      if (!editingCollaborator || cleanLogin !== editingCollaborator.login.replace(/\D/g, "")) {
        const { data: existingUser } = await supabase
          .from("usuarios")
          .select("login")
          .eq("login", cleanLogin)
          .maybeSingle();
        
        if (existingUser) {
          throw new Error("Este telefone (login) já está sendo usado por outro usuário.");
        }
      }

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
        login: cleanLogin,
        senha,
        salario_fixo: parseFloat(salarioFixo) || 0,
        foto_url: fotoUrl,
        ativo: ativo,
      };

      let colabId = editingCollaborator?.id;

      if (editingCollaborator && colabId) {
        // Update collaborator
        const { error } = await supabase
          .from("colaboradores")
          .update(colabData)
          .eq("id", colabId);
        if (error) throw error;

        // Update user in 'usuarios' table
        const { error: userError } = await supabase
          .from("usuarios")
          .update({ 
            nome, 
            login: cleanLogin, 
            senha,
            nivel: ativo ? 2 : 10 // 2 if active, 10 if inactive (prevents login)
          })
          .eq("login", editingCollaborator.login);
        if (userError) throw userError;

        // Clear existing services to re-insert
        if (colabId) {
          await supabase.from("colaborador_servicos").delete().eq("colaborador_id", colabId);
        }
      } else {
        // Create user in 'usuarios' table FIRST
        const { error: userError } = await supabase
          .from("usuarios")
          .insert([{ 
            nome, 
            login: cleanLogin, 
            senha, 
            nivel: ativo ? 2 : 10,
            registro: "sim"
          }]);
        
        if (userError) {
          if (userError.code === "23505") throw new Error("Este telefone já está cadastrado.");
          throw userError;
        }

        // Create collaborator
        const { data, error: colabError } = await supabase
          .from("colaboradores")
          .insert([colabData])
          .select()
          .maybeSingle();
        
        if (colabError || !data) {
          // Se der erro ao criar colaborador, tentamos remover o usuário criado para manter consistência
          await supabase.from("usuarios").delete().eq("login", cleanLogin);
          throw colabError || new Error("Erro ao criar colaborador");
        }
        colabId = data.id;
      }

      // Insert services
      if (colabId && selectedServices.length > 0) {
        const servicesToInsert = selectedServices.map(s => ({
          colaborador_id: colabId as string,
          servico_id: s.servico_id,
          tipo_comissao: s.tipo_comissao,
          valor_comissao: s.valor_comissao || 0
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
      // 1. Delete from colaborador_servicos explicitly just in case cascade isn't set
      await supabase.from("colaborador_servicos").delete().eq("colaborador_id", colab.id);

      // 2. Delete from colaboradores
      const { error } = await supabase.from("colaboradores").delete().eq("id", colab.id);
      if (error) throw error;

      // 3. Delete from usuarios
      const { error: userError } = await supabase.from("usuarios").delete().eq("login", colab.login);
      if (userError) throw userError;

      toast.success("Colaborador removido com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const toggleCollaboratorStatus = async (colab: Collaborator) => {
    try {
      const newStatus = !colab.ativo;
      const { error } = await supabase
        .from("colaboradores")
        .update({ ativo: newStatus })
        .eq("id", colab.id);

      if (error) throw error;

      // Also update user level in 'usuarios'
      const { error: userError } = await supabase
        .from("usuarios")
        .update({ nivel: newStatus ? 2 : 10 })
        .eq("login", colab.login);
      
      if (userError) throw userError;
      
      toast.success(`Colaborador ${newStatus ? 'ativado' : 'desativado'} com sucesso!`);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Colaboradores</h1>
          <Button className="gap-2 w-full md:w-auto" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
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
                  <Label htmlFor="login">Login (Telefone)</Label>
                  <Input 
                    id="login" 
                    value={login} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let masked = val;
                      if (val.length > 2 && val.length <= 7) {
                        masked = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                      } else if (val.length > 7) {
                        masked = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7, 11)}`;
                      }
                      setLogin(masked);
                    }} 
                    placeholder="(00) 00000-0000" 
                    required 
                  />
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

              {/* Status toggle removed from here as requested, now on the card */}

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
                <CardHeader className="flex flex-row items-center gap-3 p-3 md:gap-4 md:p-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {colab.foto_url ? (
                      <img src={colab.foto_url} alt={colab.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                        <User className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-bold truncate">{colab.nome}</h3>
                        {!colab.ativo && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded border border-destructive/20 uppercase font-bold">
                            Inativo
                          </span>
                        )}
                      </div>
                      <Switch 
                        checked={colab.ativo} 
                        onCheckedChange={() => toggleCollaboratorStatus(colab)}
                        title={colab.ativo ? "Desativar colaborador" : "Ativar colaborador"}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{colab.resumo || "Sem resumo"}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-3 h-3" /> {colab.login.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
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
