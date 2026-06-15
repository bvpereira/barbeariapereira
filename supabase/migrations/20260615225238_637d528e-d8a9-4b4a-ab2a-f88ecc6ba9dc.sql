
DO $$
DECLARE v_id uuid := '139b84a5-baff-456f-91fb-f1a9a678319f';
BEGIN
  DELETE FROM public.atendimento_servicos WHERE barbearia_id = v_id;
  DELETE FROM public.atendimentos WHERE barbearia_id = v_id;
  DELETE FROM public.horarios_colaboradores WHERE barbearia_id = v_id;
  DELETE FROM public.colaborador_servicos WHERE barbearia_id = v_id;
  DELETE FROM public.transacoes_financeiras WHERE barbearia_id = v_id;
  DELETE FROM public.gastos WHERE barbearia_id = v_id;
  DELETE FROM public.notificacoes WHERE barbearia_id = v_id;
  DELETE FROM public.mensagens WHERE barbearia_id = v_id;
  DELETE FROM public.blog WHERE barbearia_id = v_id;
  DELETE FROM public.promocao WHERE barbearia_id = v_id;
  DELETE FROM public.cupons_desconto WHERE barbearia_id = v_id;
  DELETE FROM public.clube_assinatura WHERE barbearia_id = v_id;
  DELETE FROM public.dias_agenda WHERE barbearia_id = v_id;
  DELETE FROM public.integracoes WHERE barbearia_id = v_id;
  DELETE FROM public.agentes_ia WHERE barbearia_id = v_id;
  DELETE FROM public.informacoes WHERE barbearia_id = v_id;
  DELETE FROM public.servicos WHERE barbearia_id = v_id;
  DELETE FROM public.colaboradores WHERE barbearia_id = v_id;
  DELETE FROM public.usuarios WHERE barbearia_id = v_id;
  DELETE FROM public.barbearias WHERE id = v_id;
END $$;
