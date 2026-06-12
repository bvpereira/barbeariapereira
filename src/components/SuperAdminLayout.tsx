import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Scissors, LogOut, MessageSquare, LayoutDashboard, Menu, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const sidebarLinks = [
  { title: "Painel SuperAdmin", icon: LayoutDashboard, href: "/superadmin" as const },
  { title: "Barbearias", icon: Store, href: "/barbearias" as const },
  { title: "Comunidade", icon: MessageSquare, href: "/comunidade" as const },
  { title: "Blog", icon: LayoutDashboard, href: "/blog" as const },
];

function SidebarContent({ onNavigate, handleLogout }: { onNavigate?: () => void; handleLogout: () => void }) {
  return (
    <div className="flex flex-col h-full bg-card border-r border-primary/10">
      <div className="p-6">
        <h2 className="text-xl font-bold font-josefin uppercase tracking-widest text-primary flex items-center gap-2">
          <Scissors className="w-6 h-6" />
          SuperAdmin
        </h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {sidebarLinks.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-primary/10 text-muted-foreground hover:text-primary pointer-events-auto cursor-pointer"
            activeProps={{ className: "bg-primary/20 text-primary border border-primary/20" }}
          >
            <link.icon className="w-5 h-5" />
            <span className="font-medium">{link.title}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-primary/10 relative z-50">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLogout();
          }}
        >
          <LogOut className="w-5 h-5" />
          Sair
        </Button>
      </div>
    </div>
  );
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("superadmin_session");
    navigate({ to: "/superlogin" });
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 fixed h-full z-40 top-0 left-0">
        <SidebarContent handleLogout={handleLogout} />
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 inset-x-0 h-16 z-30 flex items-center justify-between px-4 bg-black/80 backdrop-blur-sm border-b border-primary/10">
        <h2 className="text-lg font-bold font-josefin text-primary flex items-center gap-2">
          <Scissors className="w-5 h-5" />
          SuperAdmin
        </h2>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-primary">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-black border-r border-primary/20">
            <SheetHeader className="p-6 border-b border-primary/10 text-left">
              <SheetTitle className="text-primary font-josefin uppercase tracking-widest flex items-center gap-2">
                <Scissors className="w-6 h-6" />
                Menu
              </SheetTitle>
            </SheetHeader>
            <SidebarContent 
              handleLogout={handleLogout} 
              onNavigate={() => setIsMobileMenuOpen(false)} 
            />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 flex flex-col items-center">
        {children}
      </main>
    </div>
  );
}
