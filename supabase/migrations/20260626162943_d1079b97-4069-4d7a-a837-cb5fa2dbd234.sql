
-- 1) Config de taxa por barbearia
ALTER TABLE public.informacoes
  ADD COLUMN IF NOT EXISTS stripe_fee_percent numeric(6,5) NOT NULL DEFAULT 0.0399,
  ADD COLUMN IF NOT EXISTS stripe_fee_fixed numeric(10,2) NOT NULL DEFAULT 0.39;

-- 2) Tabela de pagamentos do clube
CREATE TABLE IF NOT EXISTS public.clube_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id uuid NOT NULL,
  clube_id uuid,
  cliente_id uuid,
  clube_usuario_id uuid,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_subscription_id text,
  stripe_event_id text,
  valor_bruto numeric(10,2) NOT NULL DEFAULT 0,
  taxa_stripe numeric(10,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(10,2) NOT NULL DEFAULT 0,
  refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  moeda text NOT NULL DEFAULT 'brl',
  status text NOT NULL DEFAULT 'paid',
  tipo text NOT NULL DEFAULT 'payment', -- 'payment' | 'refund'
  pago_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clube_pagamentos_invoice_unique
  ON public.clube_pagamentos (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL AND tipo = 'payment';

CREATE UNIQUE INDEX IF NOT EXISTS clube_pagamentos_event_unique
  ON public.clube_pagamentos (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clube_pagamentos_barbearia_idx
  ON public.clube_pagamentos (barbearia_id, pago_em DESC);

CREATE INDEX IF NOT EXISTS clube_pagamentos_clube_idx
  ON public.clube_pagamentos (clube_id, pago_em DESC);

CREATE INDEX IF NOT EXISTS clube_pagamentos_charge_idx
  ON public.clube_pagamentos (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

GRANT SELECT ON public.clube_pagamentos TO authenticated;
GRANT ALL ON public.clube_pagamentos TO service_role;

ALTER TABLE public.clube_pagamentos ENABLE ROW LEVEL SECURITY;

-- O projeto usa um modelo de auth próprio com leitura ampla via authenticated/anon;
-- as server functions usam supabaseAdmin para writes e gating de admin.
CREATE POLICY "clube_pagamentos_read_all_authenticated"
  ON public.clube_pagamentos
  FOR SELECT
  TO authenticated
  USING (true);
