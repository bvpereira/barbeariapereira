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
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Barbearia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
      // Prioritize explicit slug from URL
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const slugFromUrl = pathParts[0];
      
      let targetSlug = ""; 
      
      const reservedRoutes = ["admin", "login", "cadastro", "colaborador", "cliente", "atendimentos", "clientes", "colaboradores", "financeiro", "gastos", "horarios", "iacodconsumi", "iaimagem", "integracoes", "minhaconta", "promocao", "redefinir-senha", "registro", "servicos"];

      if (slugFromUrl && !reservedRoutes.includes(slugFromUrl)) {
        targetSlug = slugFromUrl;
      }

      if (!targetSlug) {
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
      
      setLoading(false);
    };

    fetchTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
