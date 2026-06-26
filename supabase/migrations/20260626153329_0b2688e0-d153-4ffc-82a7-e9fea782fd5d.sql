
-- Stripe integration columns
ALTER TABLE public.informacoes
  ADD COLUMN IF NOT EXISTS chave_stripe TEXT,
  ADD COLUMN IF NOT EXISTS stripe_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Protect secret columns from anon/authenticated
REVOKE SELECT (chave_stripe, stripe_webhook_secret) ON public.informacoes FROM anon, authenticated;
REVOKE UPDATE (chave_stripe, stripe_webhook_secret) ON public.informacoes FROM anon, authenticated;

ALTER TABLE public.clube_assinatura
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_dias INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_coupon_id TEXT;

ALTER TABLE public.clube_usuarios
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_stripe TEXT;

CREATE INDEX IF NOT EXISTS idx_clube_usuarios_subscription ON public.clube_usuarios(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_clube_usuarios_customer ON public.clube_usuarios(stripe_customer_id);

-- Idempotency table for webhooks
CREATE TABLE IF NOT EXISTS public.stripe_eventos (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  barbearia_id UUID,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_eventos TO service_role;

ALTER TABLE public.stripe_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.stripe_eventos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
