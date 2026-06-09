CREATE TABLE public.blog (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    resumo TEXT NOT NULL,
    link_noticia TEXT,
    imagem_url TEXT,
    autor_id UUID NOT NULL,
    barbearia_id UUID,
    likes UUID[] DEFAULT '{}',
    dislikes UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog TO authenticated;
GRANT ALL ON public.blog TO service_role;

ALTER TABLE public.blog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode gerenciar blog" ON public.blog FOR ALL USING (true) WITH CHECK (true);
