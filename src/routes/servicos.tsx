import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export const Route = createFileRoute("/servicos")({
  component: ServicesPage,
});

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url: string | null;
  detalhes: string | null;
}

function ServicesPage() {
  const { tenant } = useTenant();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    if (!tenant?.id) return;
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .eq("barbearia_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar serviços: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    setDuration("");
    setDetalhes("");
    setImage(null);
    setImagePreview(null);
    setEditingService(null);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.price.toString());
    setDuration(service.duration.toString());
    setDetalhes(service.detalhes || "");
    setImagePreview(service.image_url);
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = imagePreview;

      if (image) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("service-images")
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("service-images")
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      const serviceData = {
        barbearia_id: tenant!.id,
        name,
        price: parseFloat(price),
        duration: parseInt(duration),
        image_url: imageUrl,
        detalhes,
      };

      if (editingService) {
        const { error } = await supabase
          .from("servicos")
          .update(serviceData)
          .eq("id", editingService.id);
        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("servicos")
          .insert([serviceData]);
        if (error) throw error;
        toast.success("Serviço criado com sucesso!");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error: any) {
      toast.error("Erro ao salvar serviço: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    try {
      const { error } = await supabase.from("servicos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Serviço excluído com sucesso!");
      fetchServices();
    } catch (error: any) {
      toast.error("Erro ao excluir serviço: " + error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Serviços</h1>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
              <DialogHeader>
                <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do serviço</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Ex: Corte de Cabelo" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Valor (R$)</Label>
                    <Input 
                      id="price" 
                      type="number" 
                      step="0.01" 
                      value={price} 
                      onChange={(e) => setPrice(e.target.value)} 
                      placeholder="0.00" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (min)</Label>
                    <Input 
                      id="duration" 
                      type="number" 
                      value={duration} 
                      onChange={(e) => setDuration(e.target.value)} 
                      placeholder="30" 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detalhes">Detalhes</Label>
                  <Input 
                    id="detalhes" 
                    value={detalhes} 
                    onChange={(e) => setDetalhes(e.target.value)} 
                    placeholder="Descrição breve do serviço" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Imagem</Label>
                  <Input 
                    id="image" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <div className="mt-4 flex justify-center">
                      <div className="relative w-32 h-32 border-2 border-dashed border-border rounded-lg overflow-hidden">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover aspect-square"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : (editingService ? "Atualizar" : "Salvar")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Carregando serviços...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden border-border bg-card/40 hover:bg-card/60 transition-colors">
                <CardHeader className="p-0">
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    {service.image_url ? (
                      <img 
                        src={service.image_url} 
                        alt={service.name} 
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground italic text-xs">
                        Sem imagem
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold text-lg leading-none">{service.name}</h3>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span>R$ {Number(service.price).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{service.duration} min</span>
                    </div>
                    {service.detalhes && (
                      <p className="mt-2 text-xs line-clamp-2">{service.detalhes}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 gap-2"
                    onClick={() => handleEdit(service)}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
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
