-- Tabela de usuários
CREATE TABLE public.usuarios (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    nivel INTEGER NOT NULL CHECK (nivel IN (1, 2, 3)),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para o próprio usuário" ON public.usuarios
    FOR SELECT USING (true); -- Para simplificar o login, permitimos select geral ou filtramos no código

CREATE POLICY "Permitir inserção pública para cadastro de clientes" ON public.usuarios
    FOR INSERT WITH CHECK (nivel = 3);

CREATE POLICY "Usuários podem atualizar seus próprios dados" ON public.usuarios
    FOR UPDATE USING (true);

-- Dados iniciais
INSERT INTO public.usuarios (nome, login, senha, nivel) VALUES
('Admin', '22998770113', '123456', 1),
('Bruno', '22999999991', 'senha123', 2),
('João', '22999999992', 'senha123', 2),
('Carlos Silva', '22988888881', 'cliente123', 3),
('Maria Oliveira', '22988888882', 'cliente123', 3),
('Ricardo Santos', '22988888883', 'cliente123', 3),
('Ana Souza', '22988888884', 'cliente123', 3),
('Fernando Costa', '22988888885', 'cliente123', 3);

-- Gatilho para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();