
-- =============================================================
-- Security hardening — fixes safe under the project's custom auth
-- =============================================================

-- ---------- 1) Privilege escalation on usuarios ----------
-- Remove the always-true and "(auth.uid()=id) OR true" UPDATE policies
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios dados" ON public.usuarios;
DROP POLICY IF EXISTS "Acesso publico total update usuarios" ON public.usuarios;

-- Replace with a single UPDATE policy (still permissive at row level because
-- the app's custom auth runs through the anon role; column privileges below
-- prevent role escalation).
CREATE POLICY "usuarios_update_open"
ON public.usuarios FOR UPDATE
TO public
USING (true) WITH CHECK (true);

-- Block clients from changing privileged columns (nivel, barbearia_id) via
-- the Data API. The app must perform admin/level changes through SECURITY
-- DEFINER functions or the service_role.
REVOKE UPDATE ON public.usuarios FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  nome, login, senha, observacao, registro, promocao, recovery_token,
  dias_inativo, email_usuario, bloqueado,
  cashback_saldo, cashback_receber, cashback_usado, updated_at
) ON public.usuarios TO anon, authenticated;
GRANT ALL ON public.usuarios TO service_role;

-- ---------- 2) Enable RLS on integracoes ----------
-- Linter: policies existed but RLS was disabled. Enable RLS so policies apply.
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

-- ---------- 3) Function search_path hardening ----------
-- Set a fixed search_path on the two functions still missing it.
ALTER FUNCTION public.update_comunidade_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_atendimento_finalizacao_webhook() SET search_path = public;
