import { Link, Outlet } from "@tanstack/react-router";
import { Scissors, LayoutDashboard, LogOut, Users, Clock, Wallet, UserCircle, Calendar, DollarSign, Home, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    title: "Página Inicial",
    icon: Home,
    href: "/admin",
  },
  {
    title: "Atendimentos",
    icon: Calendar,
    href: "/atendimentos",
  },
  {
    title: "Serviços",
    icon: Scissors,
    href: "/servicos",
  },
  {
    title: "Colaboradores",
    icon: Users,
    href: "/colaboradores",
  },
  {
    title: "Clientes",
    icon: UserCircle,
    href: "/clientes",
  },
  {
    title: "Horários",
    icon: Clock,
    href: "/horarios",
  },
  {
    title: "Gastos",
    icon: Wallet,
    href: "/gastos",
  },
  {
    title: "Financeiro",
    icon: DollarSign,
    href: "/financeiro",
  },
  {
    title: "Minha Conta",
    icon: UserCircle,
    href: "/minhaconta",
  },
  {
    title: "Integrações",
    icon: Link2,
    href: "/integracoes",
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-sm fixed h-full z-10 hidden md:block">
        <div className="p-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            Admin
          </h2>
        </div>
        <nav className="px-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              activeProps={{
                className: "bg-primary text-primary-foreground",
              }}
              inactiveProps={{
                className: "hover:bg-accent text-muted-foreground hover:text-foreground",
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.title}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-8 px-4 w-full">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => window.location.href = '/login'}
          >
            <LogOut className="w-5 h-5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-8">
        {children || <Outlet />}
      </main>
    </div>
  );
}
