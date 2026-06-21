import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Clock, DollarSign, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { deleteByPublicUrl, uploadImage } from "@/lib/storage";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CouponsSection } from "@/components/CouponsSection";

export const Route = createFileRoute("/servicos")({
  component: ServicesPage,
});

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  image_url_4: string | null;
  image_url_5: string | null;
  detalhes: string | null;
  cashback_ativo?: boolean | null;
  cashback_percentual?: number | null;
}

function ServicesPage() {
  const { tenant, loading: tenantLoading } = useTenant();
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
  
  // Imagens adicionais
  const [extraImages, setExtraImages] = useState<(File | null)[]>([null, null, null, null]);
  const [extraPreviews, setExtraPreviews] = useState<(string | null)[]>([null, null, null, null]);

  // Cashback
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackToggling, setCashbackToggling] = useState(false);
  const [cashbackAtivo, setCashbackAtivo] = useState(false);
  const [cashbackPercentual, setCashbackPercentual] = useState("");

  useEffect(() => {
    if (!tenantLoading && tenant) {
      fetchServices();
      fetchCashbackFlag();
    }
  }, [tenant, tenantLoading]);

  const fetchCashbackFlag = async () => {
    if (!tenant?.id) return;
    const { data } = await supabase
      .from("informacoes")
      .select("cashback")
      .eq("barbearia_id", tenant.id)
      .maybeSingle();
    setCashbackEnabled(!!(data as any)?.cashback);
  };

  const toggleCashbackGlobal = async (value: boolean) => {
    if (!tenant?.id) return;
    setCashbackToggling(true);
    try {
      const { error } = await supabase
        .from("informacoes")
        .update({ cashback: value } as any)
        .eq("barbearia_id", tenant.id);
      if (error) throw error;
      setCashbackEnabled(value);
      toast.success(value ? "Cashback ativado" : "Cashback desativado");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setCashbackToggling(false);
    }
  };

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
    setExtraImages([null, null, null, null]);
    setExtraPreviews([null, null, null, null]);
    setCashbackAtivo(false);
    setCashbackPercentual("");
    setEditingService(null);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.price.toString());
    setDuration(service.duration.toString());
    setDetalhes(service.detalhes || "");
    setImagePreview(service.image_url);
    setExtraPreviews([
      service.image_url_2,
      service.image_url_3,
      service.image_url_4,
      service.image_url_5,
    ]);
    setCashbackAtivo(!!service.cashback_ativo);
    setCashbackPercentual(service.cashback_percentual != null ? String(service.cashback_percentual) : "");
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

  const handleExtraImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newImages = [...extraImages];
      newImages[index] = file;
      setExtraImages(newImages);

      const reader = new FileReader();
      reader.onloadend = () => {
        const newPreviews = [...extraPreviews];
        newPreviews[index] = reader.result as string;
        setExtraPreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeExtraImage = async (index: number) => {
    const oldUrl = extraPreviews[index];
    if (oldUrl && !extraImages[index]) {
      if (confirm("Deseja remover esta imagem permanentemente?")) {
        await deleteByPublicUrl("service-images", oldUrl);
        if (editingService) {
          const colName = `image_url_${index + 2}`;
          const updateData: any = {};
          updateData[colName] = null;
          await supabase.from("servicos").update(updateData).eq("id", editingService.id);
        }
      } else {
        return;
      }
    }

    const newImages = [...extraImages];
    newImages[index] = null;
    setExtraImages(newImages);

    const newPreviews = [...extraPreviews];
    newPreviews[index] = null;
    setExtraPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setIsSubmitting(true);

    try {
      let currentServiceId = editingService?.id;

      if (!editingService) {
        const { data, error: insertError } = await supabase
          .from("servicos")
          .insert([{
            barbearia_id: tenant.id,
            name,
            price: parseFloat(price),
            duration: parseInt(duration),
            detalhes,
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        currentServiceId = data.id;
      }

      if (!currentServiceId) throw new Error("ID do serviço não encontrado");

      let mainUrl = imagePreview;
      if (image) {
        if (editingService?.image_url) {
          await deleteByPublicUrl("service-images", editingService.image_url);
        }
        mainUrl = await uploadImage("service-images", tenant.id, currentServiceId, "main", image);
      }

      const extraUrls = [...extraPreviews];
      for (let i = 0; i < extraImages.length; i++) {
        if (extraImages[i]) {
          const oldUrl = extraPreviews[i];
          if (oldUrl) {
            await deleteByPublicUrl("service-images", oldUrl);
          }
          extraUrls[i] = await uploadImage("service-images", tenant.id, currentServiceId, (i + 2).toString(), extraImages[i]!);
        }
      }

      const cbPerc = cashbackEnabled && cashbackAtivo ? parseFloat(cashbackPercentual || "0") : 0;
      if (cashbackEnabled && cashbackAtivo && (isNaN(cbPerc) || cbPerc < 0 || cbPerc > 100)) {
        throw new Error("Percentual de cashback deve estar entre 0 e 100.");
      }

      const serviceData: any = {
        name,
        price: parseFloat(price),
        duration: parseInt(duration),
        detalhes,
        image_url: mainUrl,
        image_url_2: extraUrls[0],
        image_url_3: extraUrls[1],
        image_url_4: extraUrls[2],
        image_url_5: extraUrls[3],
        cashback_ativo: cashbackEnabled && cashbackAtivo,
        cashback_percentual: cashbackEnabled && cashbackAtivo ? cbPerc : null,
      };

      const { error: updateError } = await supabase
        .from("servicos")
        .update(serviceData)
        .eq("id", currentServiceId);
      
      if (updateError) throw updateError;

      toast.success(editingService ? "Serviço atualizado!" : "Serviço criado!");
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
      const { data: service } = await supabase
        .from("servicos")
        .select("image_url, image_url_2, image_url_3, image_url_4, image_url_5")
        .eq("id", id)
        .single();
      
      if (service) {
        await deleteByPublicUrl("service-images", service.image_url);
        await deleteByPublicUrl("service-images", service.image_url_2);
        await deleteByPublicUrl("service-images", service.image_url_3);
        await deleteByPublicUrl("service-images", service.image_url_4);
        await deleteByPublicUrl("service-images", service.image_url_5);
      }

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">Serviços</h1>
          <div className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card">
            <Label htmlFor="cb-global" className="text-sm">Cashback</Label>
            <Switch id="cb-global" checked={cashbackEnabled} disabled={cashbackToggling}
              onCheckedChange={toggleCashbackGlobal} />
          </div>
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
                <div className="space-y-2">
                  <Label>Imagens adicionais (até 4)</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {extraPreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square border-2 border-dashed border-border rounded-lg overflow-hidden group">
                        {preview ? (
                          <>
                            <img src={preview} alt={`Extra ${index + 2}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label className="cursor-pointer p-1 bg-white/20 hover:bg-white/40 rounded-full">
                                <Upload className="w-4 h-4 text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleExtraImageChange(index, e)} />
                              </label>
                              <button type="button" onClick={() => removeExtraImage(index)} className="p-1 bg-white/20 hover:bg-white/40 rounded-full">
                                <X className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                            <Plus className="w-6 h-6 text-muted-foreground" />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleExtraImageChange(index, e)} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {cashbackEnabled && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cb-service">Habilitar cashback neste serviço</Label>
                      <Switch id="cb-service" checked={cashbackAtivo} onCheckedChange={setCashbackAtivo} />
                    </div>
                    {cashbackAtivo && (
                      <div className="space-y-2">
                        <Label htmlFor="cb-perc">Percentual de cashback (%)</Label>
                        <Input id="cb-perc" type="number" min="0" max="100" step="0.01"
                          value={cashbackPercentual}
                          onChange={(e) => setCashbackPercentual(e.target.value)}
                          required />
                      </div>
                    )}
                  </div>
                )}

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden border-border bg-card/40 hover:bg-card/60 transition-colors">
                <CardHeader className="p-0">
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    {service.image_url ? (
                      <img 
                        src={service.image_url} 
                        alt={service.name} 
                        loading="lazy"
                        decoding="async"
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
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-none">{service.name}</h3>
                    {cashbackEnabled && service.cashback_ativo && service.cashback_percentual != null && (
                      <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                        Cashback {Number(service.cashback_percentual)}%
                      </Badge>
                    )}
                  </div>
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
                    className="flex-1 gap-2 border border-white text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        {!isLoading && tenant?.id && <CouponsSection tenantId={tenant.id} services={services} />}
      </div>
    </AdminLayout>
  );
}
