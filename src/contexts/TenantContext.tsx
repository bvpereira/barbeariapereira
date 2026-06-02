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
      // Detect tenant from URL path: /barb0/dashboard -> slug is barb0
      // If we are at root / without slug, we might want a default or a generic landing
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const slug = pathParts[0];

      if (slug && slug !== "admin" && slug !== "login" && slug !== "cadastro") {
        const { data, error } = await supabase
          .from("barbearias")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (data) {
          setTenant(data);
        }
      } else {
        // Fallback for current transition: assume 'barb0' if no slug found yet
        const { data } = await supabase
          .from("barbearias")
          .select("*")
          .eq("slug", "barb0")
          .maybeSingle();
        if (data) setTenant(data);
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
