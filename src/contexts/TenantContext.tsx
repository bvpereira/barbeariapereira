import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  config: any;
}

interface TenantContextType {
  tenant: Barbearia | null;
  loading: boolean;
  refreshTenant: (forceSlug?: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  refreshTenant: async () => {},
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Barbearia | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async (forceSlug?: string) => {
    setLoading(true);
    try {
      // Prioritize explicit slug from URL
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const slugFromUrl = forceSlug || pathParts[0];
      const slugFromQuery = forceSlug || url.searchParams.get("tenant");
      
      let targetSlug = ""; 
      
      const reservedRoutes = ["admin", "login", "cadastro", "colaborador", "cliente", "atendimentos", "clientes", "colaboradores", "comunidade", "financeiro", "gastos", "horarios", "iacodconsumi", "iaimagem", "integracoes", "minhaconta", "promocao", "redefinir-senha", "registro", "servicos", "clube", "blog", "notificacoes", "barbearias", "superadmin", "superlogin", "coresdosistema"];

      if (slugFromUrl && !reservedRoutes.includes(slugFromUrl)) {
        targetSlug = slugFromUrl;
      } else if (slugFromQuery) {
        targetSlug = slugFromQuery;
      }

      if (!targetSlug) {
        // Fallback to logged in user's barbearia
        const userData = localStorage.getItem("user");
        if (userData) {
          try {
            const parsedUser = JSON.parse(userData);
            if (parsedUser.barbearia_id) {
              const { data: barbearia } = await supabase
                .from("barbearias")
                .select("id,nome,slug,config,ativa,deleted_at")
                .eq("id", parsedUser.barbearia_id)
                .maybeSingle();
              if (barbearia) {
                setTenant(barbearia);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.error("Error parsing user data", e);
          }
        }
        setTenant(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("barbearias")
        .select("id,nome,slug,config,ativa,deleted_at")
        .eq("slug", targetSlug)
        .is("deleted_at", null)
        .maybeSingle();

      if (data && (data as any).ativa !== false) {
        setTenant(data);
      } else if (data && (data as any).ativa === false) {
        // Slug existe mas está desativada — não fazer fallback
        setTenant(null);
      } else if (targetSlug !== "barb0") {
         const { data: defaultData } = await supabase
          .from("barbearias")
          .select("id,nome,slug,config,ativa,deleted_at")
          .eq("slug", "barb0")
          .is("deleted_at", null)
          .maybeSingle();
         if (defaultData && (defaultData as any).ativa !== false) {
           setTenant(defaultData);
         } else {
           setTenant(null);
         }
      } else {
        setTenant(null);
      }

    } catch (err) {
      console.error("Error fetching tenant", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
    
    // Check for slug changes in the URL path
    let lastPathname = window.location.pathname;
    let lastSearch = window.location.search;
    
    const checkSlugChange = () => {
      if (window.location.pathname !== lastPathname || window.location.search !== lastSearch) {
        lastPathname = window.location.pathname;
        lastSearch = window.location.search;
        fetchTenant();
      }
    };

    const interval = setInterval(checkSlugChange, 500);

    window.addEventListener('popstate', checkSlugChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', checkSlugChange);
    };
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading, refreshTenant: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
