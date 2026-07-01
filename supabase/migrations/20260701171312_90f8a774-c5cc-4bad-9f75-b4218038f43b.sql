ALTER TABLE public.atendimentos ADD COLUMN IF NOT EXISTS meio_pagamento text;
ALTER TABLE public.atendimentos DROP CONSTRAINT IF EXISTS atendimentos_meio_pagamento_check;
ALTER TABLE public.atendimentos ADD CONSTRAINT atendimentos_meio_pagamento_check CHECK (meio_pagamento IS NULL OR meio_pagamento IN ('pix','dinheiro','credito','debito'));