import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Lock, Save, Phone, Image as ImageIcon, X, Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/minhaconta" as any)({
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Profile state
  const [nome, setNome] = useState("");
  const [telContato, setTelContato] = useState("");
  const [infoId, setInfoId] = useState<string | null>(null);
  const [imagens, setImagens] = useState<(string | null)[]>(Array(8).fill(null));
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Password state
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate({ to: "/login" });
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setNome(parsedUser.nome || "");

    const fetchInformacoes = async () => {
      try {
        const { data, error } = await (supabase
          .from("informacoes" as any)
          .select("*")
          .eq("userrr", "admin")
          .maybeSingle());

        if (error) throw error;
        
        if (data) {
          setTelContato(data.tel_contato || "");
          setInfoId(data.id);
          setImagens([
            data.imagem_1, data.imagem_2, data.imagem_3, data.imagem_4,
            data.imagem_5, data.imagem_6, data.imagem_7, data.imagem_8
          ]);
        }
      } catch (error) {
        console.error("Erro ao buscar informações:", error);
      }
    };

    fetchInformacoes();
  }, [navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome não pode estar vazio");
      return;
    }

    // Validação do telefone: apenas números, deve ter exatamente 11 dígitos
    const phoneDigits = telContato.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      toast.error("O telefone de contato deve ter exatamente 11 números");
      return;
    }

    setLoading(true);
    try {
      // Update basic profile
      const { error: profileError } = await supabase
        .from("usuarios")
        .update({ nome })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update or insert tel_contato in informacoes table where userrr is 'admin'
      const { data: existingInfo } = await (supabase
        .from("informacoes" as any)
        .select("id")
        .eq("userrr", "admin")
        .maybeSingle());

      if (existingInfo) {
        const { error: infoError } = await (supabase
          .from("informacoes" as any)
          .update({ tel_contato: telContato, usuario_id: user.id } as any)
          .eq("id", (existingInfo as any).id);
        if (infoError) throw infoError;
        setInfoId(existingInfo.id);
      } else {
        const { data: newInfo, error: infoError } = await (supabase
          .from("informacoes" as any)
          .insert({ tel_contato: telContato, user_id: user.id, usuario_id: user.id, userrr: "admin" } as any)
          .select()
          .single();
        if (infoError) throw infoError;
        if (newInfo) setInfoId(newInfo.id);
      }

      // Update local storage
      const updatedUser = { ...user, nome };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      toast.success("Informações atualizadas com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao atualizar perfil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      toast.error("Preencha todos os campos de senha");
      return;
    }

    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      toast.error("A nova senha e a confirmação não coincidem");
      return;
    }

    setLoading(true);
    try {
      // Verificar se a senha atual está correta
      const { data: userData, error: fetchError } = await supabase
        .from("usuarios")
        .select("senha")
        .eq("id", user.id)
        .single();

      if (fetchError) throw fetchError;

      if (userData.senha !== senhaAtual) {
        toast.error("A senha atual está incorreta");
        setLoading(false);
        return;
      }

      // Atualizar para a nova senha
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ senha: novaSenha })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao alterar senha: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Encontrar o primeiro slot vazio
    const emptySlotIndex = imagens.findIndex(img => img === null);
    if (emptySlotIndex === -1) {
      toast.error("Você já atingiu o limite de 8 imagens");
      return;
    }

    setUploadingImage(emptySlotIndex);

    try {
      // 1. Processar a imagem para ser quadrada (usando Canvas API simples)
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = imageUrl;
      
      await new Promise((resolve) => { img.onload = resolve; });
      
      const canvas = document.createElement("canvas");
      const size = Math.min(img.width, img.height);
      canvas.width = 500; // Tamanho fixo para economia de espaço
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(
          img,
          (img.width - size) / 2, (img.height - size) / 2, size, size, // Source
          0, 0, 500, 500 // Destination
        );
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (!blob) throw new Error("Erro ao processar imagem");

      // 2. Upload para Supabase Storage
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data, error: uploadError } = await supabase.storage
        .from("informacoes_imagens")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // 3. Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("informacoes_imagens")
        .getPublicUrl(fileName);

      // 4. Atualizar estado e banco de dados
      const newImagens = [...imagens];
      newImagens[emptySlotIndex] = publicUrl;
      setImagens(newImagens);

      const updateObj: any = { usuario_id: user.id };
      updateObj[`imagem_${emptySlotIndex + 1}`] = publicUrl;
      const { data: existingInfo } = await (supabase
        .from("informacoes" as any)
        .select("id")
        .eq("userrr", "admin")
        .maybeSingle());

      if (existingInfo) {
        await (supabase.from("informacoes") as any).update(updateObj).eq("id", (existingInfo as any).id);
        setInfoId(existingInfo.id);
      } else {
        const { data: newInfo } = await (supabase
          .from("informacoes") as any)
          .insert({ ...updateObj, user_id: user.id, userrr: "admin" } as any)
          .select()
          .single();
        if (newInfo) setInfoId(newInfo.id);
      }

      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar imagem: " + error.message);
    } finally {
      setUploadingImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = async (index: number) => {
    if (!infoId) return;

    try {
      const newImagens = [...imagens];
      newImagens[index] = null;
      setImagens(newImagens);

      const updateObj: any = {};
      updateObj[`imagem_${index + 1}`] = null;

      const { error } = await (supabase
        .from("informacoes" as any)
        .update(updateObj)
        .eq("id", infoId));

      if (error) throw error;
      toast.success("Imagem removida");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao remover imagem");
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minha Conta</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança.</p>
        </div>

        <div className="grid gap-6">
          {/* Perfil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Dados do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telContato">Telefone de contato</Label>
                  <Input
                    id="telContato"
                    value={telContato}
                    onChange={(e) => setTelContato(e.target.value)}
                    placeholder="Ex: 11999999999"
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">Insira exatamente 11 números (DDD + número).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login">Telefone (Login)</Label>
                  <Input
                    id="login"
                    value={user?.login || ""}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">O telefone de acesso não pode ser alterado por aqui.</p>
                </div>
                <Button type="submit" disabled={loading} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Imagens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Galeria de Imagens (Até 8)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {imagens.map((src, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden border bg-muted flex items-center justify-center group">
                    {src ? (
                      <>
                        <img src={src} alt={`Imagem ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : uploadingImage === index ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage !== null || imagens.every(img => img !== null)}
                >
                  <Upload className="h-4 w-4" />
                  {imagens.every(img => img !== null) ? "Limite atingido" : "Adicionar Imagem"}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  As imagens serão automaticamente ajustadas para formato quadrado.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <div className="py-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsChangingPassword(true)}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Alterar minha senha
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="senhaAtual">Senha Atual</Label>
                    <Input
                      id="senhaAtual"
                      type="password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="novaSenha">Nova Senha</Label>
                    <Input
                      id="novaSenha"
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmarNovaSenha">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmarNovaSenha"
                      type="password"
                      value={confirmarNovaSenha}
                      onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Processando..." : "Confirmar Nova Senha"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        setIsChangingPassword(false);
                        setSenhaAtual("");
                        setNovaSenha("");
                        setConfirmarNovaSenha("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
