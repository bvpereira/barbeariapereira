import { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Scissors, LayoutDashboard, LogOut, Users, Clock, Wallet, UserCircle, Calendar, DollarSign, Home, Link2, Megaphone, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

const menuItems = [
  { title: "Página Inicial", icon: Home, href: "/admin" },
  { title: "Atendimentos", icon: Calendar, href: "/atendimentos" },
  { title: "Serviços", icon: Scissors, href: "/servicos" },
  { title: "Colaboradores", icon: Users, href: "/colaboradores" },
  { title: "Clientes", icon: UserCircle, href: "/clientes" },
  { title: "Horários", icon: Clock, href: "/horarios" },
  { title: "Gastos", icon: Wallet, href: "/gastos" },
  { title: "Financeiro", icon: DollarSign, href: "/financeiro" },
  { title: "Minha Conta", icon: UserCircle, href: "/minhaconta" },
  { title: "Integrações", icon: Link2, href: "/integracoes" },
  { title: "Promoções", icon: Megaphone, href: "/promocao" },
];

function handleLogout() {
  localStorage.removeItem("user");
  document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  window.location.href = "/login";
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="px-4 space-y-2">
      {menuItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "hover:bg-accent text-muted-foreground hover:text-foreground" }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
        >
          <item.icon className="w-5 h-5" />
          <span className="font-medium">{item.title}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-sm fixed h-full z-10 hidden md:block">
        <div className="p-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            Admin
          </h2>
        </div>
        <NavLinks />
        <div className="absolute bottom-8 px-4 w-full">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 z-20 flex items-center justify-between px-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          Admin
        </h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SheetHeader className="p-6">
              <SheetTitle className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                Admin
              </SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="px-4 mt-6">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8">
        {children || <Outlet />}
      </main>
    </div>
  );
}
