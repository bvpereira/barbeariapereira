-- Rename table from services to servicos
ALTER TABLE public.services RENAME TO servicos;

-- Policies and triggers are usually renamed automatically or remain attached, 
-- but we should ensure the names reflect the new table name for clarity if needed.
-- In PostgreSQL, RENAME TABLE handles the underlying objects.

-- Let's update the RLS policy names just for consistency (optional but good practice)
ALTER POLICY "Services are viewable by everyone" ON public.servicos RENAME TO "Servicos are viewable by everyone";
ALTER POLICY "Authenticated users can manage services" ON public.servicos RENAME TO "Authenticated users can manage servicos";
