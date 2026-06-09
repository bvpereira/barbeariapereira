-- Criar tabela única comunidade
CREATE TABLE IF NOT EXISTS public.comunidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.comunidade(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES public.usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('post', 'comentario', 'reacao')),
    texto TEXT,
    imagem_url TEXT,
    reacao_tipo TEXT CHECK (reacao_tipo IN ('like', 'dislike')),
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.comunidade ENABLE ROW LEVEL SECURITY;

-- Permissões básicas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunidade TO authenticated;
GRANT ALL ON public.comunidade TO service_role;

-- Políticas de Segurança (RLS)

-- 1. Qualquer nível 0 ou 1 pode ler posts aprovados ou seus próprios posts
CREATE POLICY "Leitura de posts" ON public.comunidade
FOR SELECT TO authenticated
USING (
    (tipo = 'post' AND (status = 'aprovado' OR autor_id IN (SELECT id FROM usuarios WHERE id = auth.uid() OR nivel = 0)))
    OR (tipo != 'post') -- Simplificado: comentários e reações visíveis se o post for visível (tratado na aplicação)
);

-- 2. Inserção: Nível 0 e 1 podem inserir
CREATE POLICY "Inserção de conteúdo" ON public.comunidade
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND nivel IN (0, 1))
);

-- 3. Atualização: 
-- Nível 0 pode atualizar tudo.
-- Nível 1 só pode atualizar seus próprios posts se estiverem 'pendentes'.
CREATE POLICY "Atualização de conteúdo" ON public.comunidade
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND nivel = 0)
    OR (autor_id = (SELECT id FROM usuarios WHERE id = auth.uid()) AND status = 'pendente')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND nivel = 0)
    OR (autor_id = (SELECT id FROM usuarios WHERE id = auth.uid()) AND status = 'pendente')
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_comunidade_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comunidade_timestamp
BEFORE UPDATE ON public.comunidade
FOR EACH ROW
EXECUTE FUNCTION public.update_comunidade_updated_at();
