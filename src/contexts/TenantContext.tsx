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
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  refreshTenant: async () => {},
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Barbearia | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    setLoading(true);
    try {
      // Prioritize explicit slug from URL
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const slugFromUrl = pathParts[0];
      const slugFromQuery = url.searchParams.get("tenant");
      
      let targetSlug = ""; 
      
      const reservedRoutes = ["admin", "login", "cadastro", "colaborador", "cliente", "atendimentos", "clientes", "colaboradores", "financeiro", "gastos", "horarios", "iacodconsumi", "iaimagem", "integracoes", "minhaconta", "promocao", "redefinir-senha", "registro", "servicos"];

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
                .select("*")
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

      const { data, error } = await supabase
        .from("barbearias")
        .select("*")
        .eq("slug", targetSlug)
        .maybeSingle();

      if (data) {
        setTenant(data);
      } else if (targetSlug !== "barb0") {
         // Fallback if URL slug invalid
         const { data: defaultData } = await supabase
          .from("barbearias")
          .select("*")
          .eq("slug", "barb0")
          .maybeSingle();
         if (defaultData) setTenant(defaultData);
      }
    } catch (err) {
      console.error("Error fetching tenant", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading, refreshTenant: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
