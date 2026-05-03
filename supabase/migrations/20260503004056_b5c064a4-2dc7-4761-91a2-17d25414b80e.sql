-- Criar a tabela informacoes
CREATE TABLE public.informacoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    usuario_id UUID, -- Referência à tabela public.usuarios (id)
    userrr TEXT, -- Para o identificador 'admin'
    tel_contato TEXT,
    imagem_1 TEXT,
    imagem_2 TEXT,
    imagem_3 TEXT,
    imagem_4 TEXT,
    imagem_5 TEXT,
    imagem_6 TEXT,
    imagem_7 TEXT,
    imagem_8 TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.informacoes ENABLE ROW LEVEL SECURITY;

-- Criar política permissiva para usuários autenticados (conforme solicitado anteriormente para evitar erros de RLS)
CREATE POLICY "Permitir tudo para usuários autenticados na tabela informacoes"
ON public.informacoes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Gatilho para updated_at
CREATE TRIGGER update_informacoes_updated_at
BEFORE UPDATE ON public.informacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();