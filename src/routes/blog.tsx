import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  ThumbsUp, 
  ExternalLink, 
  Image as ImageIcon, 
  Edit2, 
  TrendingUp,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/blog")({
  component: BlogPage,
});

interface BlogPost {
  id: string;
  titulo: string;
  resumo: string;
  link_noticia: string | null;
  imagem_url: string | null;
  autor_id: string;
  likes: string[];
  dislikes: string[];
  created_at: string;
  updated_at: string;
}

function BlogPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'likes'>('recent');

  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const adminSession = localStorage.getItem("superadmin_session");
      const userSession = localStorage.getItem("user");
      
      let currentUser = null;
      if (adminSession) {
        currentUser = JSON.parse(adminSession);
        setIsSuperAdmin(true);
      } else if (userSession) {
        currentUser = JSON.parse(userSession);
        setIsSuperAdmin(false);
      }

      if (!currentUser || ![0, 1, 2].includes(Number(currentUser.nivel))) {
        toast.error("Acesso negado");
        navigate({ to: "/login" });
        return;
      }

      setUser(currentUser);
      setIsAdmin(Number(currentUser.nivel) === 0);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchPosts(true);
    }
  }, [user, sortBy]);

  const fetchPosts = async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;
    try {
      // Cast to any to bypass type generation issues for a newly created table
      let query = (supabase.from("blog" as any) as any)
        .select("*")
        .range(currentPage * 10, (currentPage + 1) * 10 - 1);

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let processedData = (data as BlogPost[]) || [];
      if (sortBy === 'likes') {
        processedData = [...processedData].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      }

      if (reset) {
        setPosts(processedData);
        setPage(0);
      } else {
        setPosts(prev => [...prev, ...processedData]);
        setPage(currentPage);
      }
      setHasMore(data.length === 10);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar posts");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);

    try {
      let imageUrl = editingPost?.imagem_url || null;

      if (image) {
        if (editingPost?.imagem_url) {
          const oldPath = editingPost.imagem_url.split('/').pop();
          if (oldPath) await supabase.storage.from('blog_midia').remove([oldPath]);
        }

        const fileExt = image.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('blog_midia')
          .upload(fileName, image);
        
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('blog_midia').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const postData = {
        titulo,
        resumo,
        link_noticia: link,
        imagem_url: imageUrl,
        autor_id: user.id,
        barbearia_id: user.barbearia_id
      };

      if (editingPost) {
        const { error } = await (supabase.from("blog" as any) as any).update(postData).eq("id", editingPost.id);
        if (error) throw error;
        toast.success("Post atualizado!");
      } else {
        const { error } = await (supabase.from("blog" as any) as any).insert([postData]);
        if (error) throw error;
        toast.success("Post criado!");
      }

      setShowForm(false);
      setEditingPost(null);
      resetForm();
      fetchPosts(true);
    } catch (error: any) {
      toast.error("Erro ao salvar post: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitulo("");
    setResumo("");
    setLink("");
    setImage(null);
    setImagePreview(null);
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setTitulo(post.titulo);
    setResumo(post.resumo);
    setLink(post.link_noticia || "");
    setImagePreview(post.imagem_url);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (post: BlogPost) => {
    if (!confirm("Deseja realmente excluir este post?")) return;
    try {
      if (post.imagem_url) {
        const fileName = post.imagem_url.split('/').pop();
        if (fileName) await supabase.storage.from('blog_midia').remove([fileName]);
      }
      const { error } = await (supabase.from("blog" as any) as any).delete().eq("id", post.id);
      if (error) throw error;
      toast.success("Post removido");
      fetchPosts(true);
    } catch (error) {
      toast.error("Erro ao remover post");
    }
  };

  const handleLike = async (post: BlogPost) => {
    const isLiked = post.likes?.includes(user.id);
    let newLikes = post.likes || [];

    if (isLiked) {
      newLikes = newLikes.filter(id => id !== user.id);
    } else {
      newLikes = [...newLikes, user.id];
    }

    try {
      const { error } = await (supabase.from("blog" as any) as any)
        .update({ likes: newLikes })
        .eq("id", post.id);
      
      if (error) throw error;
      
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    } catch (error) {
      toast.error("Erro ao processar curtida");
    }
  };

  const content = (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-primary/10 pb-6">
        <div>
          <h1 className="text-4xl font-bold font-josefin uppercase tracking-wider text-primary">Blog & Notícias</h1>
          <p className="text-muted-foreground text-sm mt-1">Fique por dentro das novidades da barbearia</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant={sortBy === 'recent' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setSortBy('recent')}
            className="gap-2"
          >
            <Clock className="w-4 h-4" /> Recentes
          </Button>
          <Button 
            variant={sortBy === 'likes' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setSortBy('likes')}
            className="gap-2"
          >
            <TrendingUp className="w-4 h-4" /> Populares
          </Button>
          {isAdmin && !showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2 bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4" /> Novo Post
            </Button>
          )}
        </div>
      </header>

      {showForm && isAdmin && (
        <Card className="border-primary/20 bg-card/50 overflow-hidden animate-in slide-in-from-top duration-300">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-xl font-josefin uppercase tracking-wide flex items-center gap-2">
              {editingPost ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingPost ? "Editar Publicação" : "Criar Nova Publicação"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Título do Post</label>
              <Input 
                placeholder="Digite o título..." 
                value={titulo} 
                onChange={(e) => setTitulo(e.target.value)}
                className="border-primary/20 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Resumo / Conteúdo</label>
              <Textarea 
                placeholder="Breve descrição ou conteúdo do post..." 
                value={resumo} 
                onChange={(e) => setResumo(e.target.value)}
                className="min-h-[120px] border-primary/20 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Link da Notícia (opcional)</label>
              <Input 
                placeholder="https://exemplo.com/noticia" 
                value={link} 
                onChange={(e) => setLink(e.target.value)}
                className="border-primary/20 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Imagem de Capa</label>
              <div className="flex items-center gap-4">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange}
                  className="border-primary/20 cursor-pointer"
                />
              </div>
              {imagePreview && (
                <div className="mt-2 relative w-full h-48 rounded-xl overflow-hidden border border-primary/20 group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => { setImage(null); setImagePreview(null); }}
                    >
                      Remover Imagem
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="bg-primary/5 border-t border-primary/10 flex justify-end gap-3 p-4">
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingPost(null); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !titulo || !resumo} className="min-w-[120px]">
              {isSubmitting ? "Enviando..." : editingPost ? "Salvar Alterações" : "Publicar"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-8">
        {posts.map((post) => (
          <Card key={post.id} className="border-primary/10 bg-card/30 backdrop-blur-sm overflow-hidden group hover:border-primary/30 transition-all duration-300">
            <div className="flex flex-col md:flex-row">
              {post.imagem_url && (
                <div className="w-full md:w-1/3 h-64 md:h-auto overflow-hidden relative">
                  <img src={post.imagem_url} alt={post.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{post.titulo}</h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {format(new Date(post.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleEdit(post)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(post)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                  {post.resumo}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-primary/5">
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`gap-2 ${post.likes?.includes(user?.id) ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10'}`}
                      onClick={() => handleLike(post)}
                    >
                      <ThumbsUp className={`w-4 h-4 ${post.likes?.includes(user?.id) ? 'fill-primary' : ''}`} />
                      <span className="font-bold">{post.likes?.length || 0}</span>
                    </Button>
                  </div>
                  
                  {post.link_noticia && (
                    <Button variant="link" className="text-primary p-0 h-auto gap-1" asChild>
                      <a href={post.link_noticia} target="_blank" rel="noopener noreferrer">
                        Ler notícia completa <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {hasMore && (
          <Button variant="outline" className="w-full border-primary/20 text-primary hover:bg-primary/10" onClick={() => fetchPosts()} disabled={loading}>
            {loading ? "Carregando..." : "Ver Mais Publicações"}
          </Button>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-20 bg-card/20 rounded-3xl border border-dashed border-primary/10">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20 text-primary" />
            <p className="text-muted-foreground font-josefin uppercase tracking-widest">Nenhuma publicação ainda.</p>
          </div>
        )}
      </div>
    </div>
  );

  return isSuperAdmin ? (
    <SuperAdminLayout>{content}</SuperAdminLayout>
  ) : (
    <AdminLayout>{content}</AdminLayout>
  );
}

export default BlogPage;
