import { useState, useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Scissors, LayoutDashboard, LogOut, Users, Clock, Wallet, UserCircle, Calendar, DollarSign, Home, Link2, Megaphone, Menu, Scale, Image as ImageIcon, Wand2, MessageSquare, Crown, Bell, Palette, QrCode, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

type MenuItem = { title: string; icon: any; href: string; minNivel?: number };
type MenuSection = { title?: string; items: MenuItem[] };

const menuSections: MenuSection[] = [
  {
    items: [{ title: "Dashboard Inicial", icon: Home, href: "/admin" }],
  },
  {
    title: "OPERAÇÃO",
    items: [
      { title: "Atendimentos", icon: Calendar, href: "/atendimentos" },
      { title: "Serviços", icon: Scissors, href: "/servicos" },
      { title: "Horários", icon: Clock, href: "/horarios" },
      { title: "Colaboradores", icon: Users, href: "/colaboradores" },
    ],
  },
  {
    title: "CLIENTES",
    items: [
      { title: "Clientes", icon: UserCircle, href: "/clientes" },
      { title: "Clube de Assinatura", icon: Crown, href: "/clube" },
      { title: "Notificações/Promoções", icon: Bell, href: "/promocao" },
    ],
  },
  {
    title: "FINANCEIRO",
    items: [
      { title: "Gastos", icon: Wallet, href: "/gastos" },
      { title: "Financeiro", icon: DollarSign, href: "/financeiro" },
      { title: "Calculadora", icon: Calculator, href: "/calculadora", minNivel: 1 },
    ],
  },
  {
    title: "INTELIGÊNCIA ARTIFICIAL",
    items: [
      { title: "IA – CDC", icon: Scale, href: "/iacodconsumi" },
      { title: "IA – Imagem", icon: ImageIcon, href: "/iaimagem" },
      { title: "IA – Edição", icon: Wand2, href: "/iaedicao" },
    ],
  },
  {
    title: "CONTEÚDO",
    items: [
      { title: "Blog de Notícias", icon: LayoutDashboard, href: "/blog" },
      { title: "Comunidade", icon: MessageSquare, href: "/comunidade" },
    ],
  },
  {
    title: "CONFIGURAÇÕES",
    items: [
      { title: "Cores do sistema", icon: Palette, href: "/cores", minNivel: 1 },
      { title: "Instância Própria", icon: QrCode, href: "/instanciapropria", minNivel: 1 },
    ],
  },
  {
    title: "CONTA",
    items: [{ title: "Minha Conta", icon: UserCircle, href: "/minhaconta" }],
  },
];

function handleLogout() {
  localStorage.removeItem("user");
  document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  window.location.href = "/login";
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [userNivel, setUserNivel] = useState<number | null>(null);
  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) setUserNivel(JSON.parse(u).nivel ?? null);
    } catch {}
  }, []);
  return (
    <nav className="px-4 space-y-4">
      {menuSections.map((section, idx) => {
        const items = section.items.filter(
          (it) => it.minNivel === undefined || (userNivel !== null && userNivel <= it.minNivel)
        );
        if (items.length === 0) return null;
        return (
          <div key={idx} className="space-y-1">
            {section.title && (
              <h3 className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                {section.title}
              </h3>
            )}
            {items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
                inactiveProps={{ className: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80" }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium whitespace-nowrap">{item.title}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}


export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");

  useEffect(() => {
    const fetchLogo = async () => {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      
      try {
        const user = JSON.parse(userData);
        const { data, error } = await supabase
          .from("informacoes" as any)
          .select("imagem_logo")
          .eq("barbearia_id", user.barbearia_id)
          .maybeSingle();

        if (data && (data as any).imagem_logo) {
          setLogoUrl((data as any).imagem_logo);
        }
      } catch (err) {
        console.error("Erro ao buscar logo no layout:", err);
      }
    };

    fetchLogo();
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-sm fixed h-full z-10 hidden md:block overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-sidebar-foreground">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            Admin
          </h2>
        </div>
        <NavLinks />
        <div className="px-4 mt-2 pb-8">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 z-20 flex items-center justify-between px-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-sm">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" />
          Admin
        </h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
            <SheetHeader className="p-6">
              <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
                <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                Admin
              </SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="px-4 mt-6">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-20 md:pt-8">
        {children || <Outlet />}
      </main>
    </div>
  );
}
