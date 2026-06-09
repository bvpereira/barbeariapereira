import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Send, 
  Image as ImageIcon, 
  CheckCircle, 
  Clock, 
  User,
  Trash2,
  Lock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/comunidade")({
  component: ComunidadePage,
});

interface Post {
  id: string;
  texto: string;
  imagem_url: string | null;
  status: 'pendente' | 'aprovado';
  autor_id: string;
  created_at: string;
  autor: { nome: string };
  likes: number;
  dislikes: number;
  user_reaction: 'like' | 'dislike' | null;
  comentarios: any[];
}

function ComunidadePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState("feed");

  useEffect(() => {
    const checkUser = () => {
      const adminSession = localStorage.getItem("superadmin_session");
      const userSession = localStorage.getItem("user");
      
      if (adminSession) {
        setUser(JSON.parse(adminSession));
        setIsAdmin(true);
      } else if (userSession) {
        setUser(JSON.parse(userSession));
        setIsAdmin(false);
      } else {
        navigate({ to: "/login" });
      }
    };
    checkUser();
  }, [navigate]);


  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user, page, activeTab]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("comunidade")
        .select(`
          *,
          autor:usuarios!autor_id(nome)
        `)
        .eq("tipo", "post")
        .order("created_at", { ascending: false })
        .range(page * 10, (page + 1) * 10 - 1);

      if (activeTab === "meus") {
        query = query.eq("autor_id", user.id);
      } else if (activeTab === "pendentes" && user.nivel === 0) {
        query = query.eq("status", "pendente");
      } else {
        // Feed padrão para nível 1: apenas aprovados
        // Se for nível 0, vê tudo no feed ou usa aba pendentes
        if (user.nivel !== 0) {
          query = query.eq("status", "aprovado");
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const postsWithDetails = await Promise.all(data.map(async (post: any) => {
          // Buscar Reações
          const { data: reactions } = await supabase
            .from("comunidade")
            .select("reacao_tipo, autor_id")
            .eq("parent_id", post.id)
            .eq("tipo", "reacao");

          // Buscar Comentários
          const { data: comments } = await supabase
            .from("comunidade")
            .select("*, autor:usuarios!autor_id(nome)")
            .eq("parent_id", post.id)
            .eq("tipo", "comentario")
            .order("created_at", { ascending: true });

          const likes = reactions?.filter(r => r.reacao_tipo === 'like').length || 0;
          const dislikes = reactions?.filter(r => r.reacao_tipo === 'dislike').length || 0;
          const user_reaction = reactions?.find(r => r.autor_id === user.id)?.reacao_tipo || null;

          return {
            ...post,
            likes,
            dislikes,
            user_reaction,
            comentarios: comments || []
          };
        }));

        if (page === 0) {
          setPosts(postsWithDetails);
        } else {
          setPosts(prev => [...prev, ...postsWithDetails]);
        }
        setHasMore(data.length === 10);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar posts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim()) {
      toast.error("O texto do post é obrigatório");
      return;
    }

    try {
      console.log("Tentando criar post:", { texto: newPostText, imagem_url: imageUrl, autor_id: user.id });
      const { data, error } = await supabase.from("comunidade").insert({
        texto: newPostText,
        imagem_url: imageUrl,
        autor_id: user.id,
        tipo: "post",
        status: user.nivel === 0 ? "aprovado" : "pendente"
      }).select();

      if (error) {
        console.error("Erro detalhado do Supabase (Insert):", error);
        throw error;
      }

      console.log("Post criado com sucesso:", data);
      toast.success(user.nivel === 0 ? "Post publicado!" : "Post enviado para aprovação!");
      setNewPostText("");
      setImageUrl(null);
      setPage(0);
      fetchPosts();
    } catch (error: any) {
      console.error("Erro capturado no handleCreatePost:", error);
      toast.error(`Erro ao criar post: ${error.message || "Erro desconhecido"}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      console.log("Iniciando upload de arquivo:", file.name, "Tamanho:", file.size);
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('comunidade_midia')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Erro detalhado do Supabase (Storage Upload):", uploadError);
        throw uploadError;
      }

      console.log("Upload concluído:", uploadData);
      const { data } = supabase.storage.from('comunidade_midia').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
      console.log("URL pública gerada:", data.publicUrl);
    } catch (error: any) {
      console.error("Erro capturado no handleImageUpload:", error);
      toast.error(`Erro no upload da imagem: ${error.message || "Verifique se o bucket 'comunidade_midia' é público e existe"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleReaction = async (postId: string, type: 'like' | 'dislike') => {
    try {
      // Remover reação anterior se existir
      await supabase
        .from("comunidade")
        .delete()
        .eq("parent_id", postId)
        .eq("autor_id", user.id)
        .eq("tipo", "reacao");

      // Adicionar nova
      const { error } = await supabase.from("comunidade").insert({
        parent_id: postId,
        autor_id: user.id,
        tipo: "reacao",
        reacao_tipo: type
      });

      if (error) throw error;
      fetchPosts(); // Recarregar para atualizar contadores
    } catch (error) {
      toast.error("Erro ao reagir");
    }
  };

  const handleComment = async (postId: string, text: string) => {
    if (!text.trim()) return;
    try {
      const { error } = await supabase.from("comunidade").insert({
        parent_id: postId,
        autor_id: user.id,
        tipo: "comentario",
        texto: text
      });
      if (error) throw error;
      fetchPosts();
    } catch (error) {
      toast.error("Erro ao comentar");
    }
  };

  const handleApprove = async (postId: string) => {
    try {
      const { error } = await supabase
        .from("comunidade")
        .update({ status: "aprovado" })
        .eq("id", postId);
      if (error) throw error;
      toast.success("Post aprovado!");
      fetchPosts();
    } catch (error) {
      toast.error("Erro ao aprovar");
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Deseja realmente excluir este post?")) return;
    try {
      const postToDelete = posts.find(p => p.id === postId);
      
      // Deletar imagem do storage se existir
      if (postToDelete?.imagem_url) {
        const url = postToDelete.imagem_url;
        const bucket = 'comunidade_midia';
        const urlParts = url.split(`/public/${bucket}/`);
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from(bucket).remove([filePath]);
        }
      }

      const { error } = await supabase.from("comunidade").delete().eq("id", postId);
      if (error) throw error;
      toast.success("Post removido");
      fetchPosts();
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast.error("Erro ao remover");
    }
  };

  const content = (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-josefin uppercase tracking-wider text-primary">Comunidade</h1>
      </header>

      {/* Área de Criação */}


        <Card className="border-primary/20 bg-card/50">
          <CardContent className="pt-6 space-y-4">
            <Textarea 
              placeholder="O que está acontecendo na barbearia?"
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              className="resize-none border-primary/10 focus-visible:ring-primary"
            />
            {imageUrl && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden border border-primary/20">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => setImageUrl(null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <input type="file" id="image-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                <label htmlFor="image-upload">
                  <Button variant="ghost" size="sm" className="gap-2 cursor-pointer" asChild>
                    <span>
                      <ImageIcon className="h-4 w-4" />
                      Imagem
                    </span>
                  </Button>
                </label>
              </div>
              <Button onClick={handleCreatePost} disabled={uploading || !newPostText.trim()} className="gap-2">
                <Send className="h-4 w-4" />
                Publicar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-primary/5">
            <TabsTrigger value="feed">Explorar</TabsTrigger>
            <TabsTrigger value="meus">Meus Posts</TabsTrigger>
            {user?.nivel === 0 && <TabsTrigger value="pendentes">Aprovação</TabsTrigger>}
          </TabsList>
        </Tabs>

        {/* Lista de Posts */}
        <div className="space-y-6">
          {posts.map((post) => (
            <Card key={post.id} className="border-primary/10 bg-card/30 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase">{post.autor?.nome || "Usuário"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(post.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {post.status === 'pendente' ? (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1">
                      <Clock className="h-3 w-3" /> Pendente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                      <CheckCircle className="h-3 w-3" /> Aprovado
                    </Badge>
                  )}
                  {(user?.nivel === 0 || (post.autor_id === user?.id && post.status === 'pendente')) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(post.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {post.texto && <p className="text-sm leading-relaxed">{post.texto}</p>}
                {post.imagem_url && (
                  <div className="rounded-xl overflow-hidden border border-primary/5">
                    <img src={post.imagem_url} alt="Post" className="w-full h-auto max-h-[400px] object-cover" />
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col border-t border-primary/5 pt-4">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`gap-2 ${post.user_reaction === 'like' ? 'text-primary' : ''}`}
                      onClick={() => handleReaction(post.id, 'like')}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span className="text-xs font-bold">{post.likes}</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`gap-2 ${post.user_reaction === 'dislike' ? 'text-destructive' : ''}`}
                      onClick={() => handleReaction(post.id, 'dislike')}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      <span className="text-xs font-bold">{post.dislikes}</span>
                    </Button>
                  </div>
                  {user?.nivel === 0 && post.status === 'pendente' && (
                    <Button size="sm" onClick={() => handleApprove(post.id)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                  )}
                  {post.status === 'aprovado' && post.autor_id === user?.id && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic">
                      <Lock className="h-3 w-3" /> Post Aprovado (Não editável)
                    </div>
                  )}
                </div>

                {/* Comentários */}
                <div className="w-full mt-4 space-y-3">
                  <div className="space-y-2">
                    {post.comentarios.map((comment) => (
                      <div key={comment.id} className="bg-primary/5 p-3 rounded-lg text-xs">
                        <span className="font-bold text-primary mr-2 uppercase">{comment.autor?.nome}:</span>
                        {comment.texto}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Escreva um comentário..."
                      className="flex-1 bg-primary/5 border-none rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleComment(post.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}

          {hasMore && (
            <Button variant="outline" className="w-full border-primary/20 text-primary" onClick={() => setPage(prev => prev + 1)}>
              Carregar Mais
            </Button>
          )}

          {!loading && posts.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma publicação encontrada.</p>
            </div>
          )}
    </div>
  );








  return isAdmin ? (
    <SuperAdminLayout>{content}</SuperAdminLayout>
  ) : (
    <AdminLayout>{content}</AdminLayout>
  );
}

