CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT '',
  texto text NOT NULL DEFAULT '',
  canal text NOT NULL,
  numero_notificacao integer,
  testada boolean NOT NULL DEFAULT false,
  publicada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacoes_canal_valido CHECK (canal IN ('site', 'whatsapp')),
  CONSTRAINT notificacoes_numero_por_canal CHECK (
    (canal = 'site' AND numero_notificacao IS NULL) OR
    (canal = 'whatsapp' AND numero_notificacao IS NOT NULL AND numero_notificacao >= 0)
  )
);

GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso a notificacoes somente pelo servidor"
ON public.notificacoes
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE UNIQUE INDEX notificacoes_whatsapp_atual_idx
ON public.notificacoes (numero_notificacao)
WHERE canal = 'whatsapp' AND numero_notificacao = 0;

CREATE INDEX notificacoes_site_publicadas_idx
ON public.notificacoes (publicada_em DESC)
WHERE canal = 'site' AND publicada_em IS NOT NULL;

CREATE INDEX notificacoes_whatsapp_historico_idx
ON public.notificacoes (numero_notificacao DESC)
WHERE canal = 'whatsapp' AND numero_notificacao > 0;

CREATE TRIGGER update_notificacoes_updated_at
BEFORE UPDATE ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.notificacoes (titulo, texto, canal, numero_notificacao, testada)
VALUES ('', '', 'whatsapp', 0, false);