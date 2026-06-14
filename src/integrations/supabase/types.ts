export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agentes_ia: {
        Row: {
          barbearia_id: string
          created_at: string
          edit_acessorios: string | null
          edit_cor_fundo: string | null
          edit_escala_produto: string | null
          edit_estilo_cor: string | null
          edit_formato: string | null
          edit_imagemeditada: string | null
          edit_imagemupada: string | null
          edit_intensidade_luz: string | null
          edit_nitidez: string | null
          edit_nivel_retoque: string | null
          edit_sombra: string | null
          edit_temperatura_cor: string | null
          edit_textura_fundo: string | null
          edit_tipo_fundo: string | null
          edit_tipo_iluminacao: string | null
          edit_tipo_produto: string | null
          id: string
          imagem_campanha: string | null
          imagem_comlogo: string | null
          imagem_criada_ia: string | null
          imagem_elem_central: string | null
          imagem_endereco: string | null
          imagem_estilovisual: string | null
          imagem_formato: string
          imagem_imareferencia: string | null
          imagem_informacoes: string | null
          imagem_instagram: string | null
          imagem_objetivo: string | null
          imagem_paleta: string | null
          imagem_referencia_ia: string | null
          imagem_telcontato: string | null
          last_reset_month: string | null
          legenda_criada_ia: string | null
          linha: number | null
          num_imagens_criadas: number | null
          num_limite_imagens: number | null
          oq_criar: string | null
          texto_emoji: string | null
          texto_endereco: string | null
          texto_estilo: string | null
          texto_instagram: string | null
          texto_telcontato: string | null
          tom_comunicacao: string | null
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          edit_acessorios?: string | null
          edit_cor_fundo?: string | null
          edit_escala_produto?: string | null
          edit_estilo_cor?: string | null
          edit_formato?: string | null
          edit_imagemeditada?: string | null
          edit_imagemupada?: string | null
          edit_intensidade_luz?: string | null
          edit_nitidez?: string | null
          edit_nivel_retoque?: string | null
          edit_sombra?: string | null
          edit_temperatura_cor?: string | null
          edit_textura_fundo?: string | null
          edit_tipo_fundo?: string | null
          edit_tipo_iluminacao?: string | null
          edit_tipo_produto?: string | null
          id?: string
          imagem_campanha?: string | null
          imagem_comlogo?: string | null
          imagem_criada_ia?: string | null
          imagem_elem_central?: string | null
          imagem_endereco?: string | null
          imagem_estilovisual?: string | null
          imagem_formato: string
          imagem_imareferencia?: string | null
          imagem_informacoes?: string | null
          imagem_instagram?: string | null
          imagem_objetivo?: string | null
          imagem_paleta?: string | null
          imagem_referencia_ia?: string | null
          imagem_telcontato?: string | null
          last_reset_month?: string | null
          legenda_criada_ia?: string | null
          linha?: number | null
          num_imagens_criadas?: number | null
          num_limite_imagens?: number | null
          oq_criar?: string | null
          texto_emoji?: string | null
          texto_endereco?: string | null
          texto_estilo?: string | null
          texto_instagram?: string | null
          texto_telcontato?: string | null
          tom_comunicacao?: string | null
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          edit_acessorios?: string | null
          edit_cor_fundo?: string | null
          edit_escala_produto?: string | null
          edit_estilo_cor?: string | null
          edit_formato?: string | null
          edit_imagemeditada?: string | null
          edit_imagemupada?: string | null
          edit_intensidade_luz?: string | null
          edit_nitidez?: string | null
          edit_nivel_retoque?: string | null
          edit_sombra?: string | null
          edit_temperatura_cor?: string | null
          edit_textura_fundo?: string | null
          edit_tipo_fundo?: string | null
          edit_tipo_iluminacao?: string | null
          edit_tipo_produto?: string | null
          id?: string
          imagem_campanha?: string | null
          imagem_comlogo?: string | null
          imagem_criada_ia?: string | null
          imagem_elem_central?: string | null
          imagem_endereco?: string | null
          imagem_estilovisual?: string | null
          imagem_formato?: string
          imagem_imareferencia?: string | null
          imagem_informacoes?: string | null
          imagem_instagram?: string | null
          imagem_objetivo?: string | null
          imagem_paleta?: string | null
          imagem_referencia_ia?: string | null
          imagem_telcontato?: string | null
          last_reset_month?: string | null
          legenda_criada_ia?: string | null
          linha?: number | null
          num_imagens_criadas?: number | null
          num_limite_imagens?: number | null
          oq_criar?: string | null
          texto_emoji?: string | null
          texto_endereco?: string | null
          texto_estilo?: string | null
          texto_instagram?: string | null
          texto_telcontato?: string | null
          tom_comunicacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agentes_ia_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: true
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_servicos: {
        Row: {
          atendimento_id: string
          barbearia_id: string
          created_at: string
          id: string
          name_servico: string | null
          servico_id: string
          tipo_desconto_cupom: string | null
          valor_desconto: number
          valor_original: number
          valor_regra_cupom: number | null
          valor_servico: number
        }
        Insert: {
          atendimento_id: string
          barbearia_id: string
          created_at?: string
          id?: string
          name_servico?: string | null
          servico_id: string
          tipo_desconto_cupom?: string | null
          valor_desconto?: number
          valor_original: number
          valor_regra_cupom?: number | null
          valor_servico: number
        }
        Update: {
          atendimento_id?: string
          barbearia_id?: string
          created_at?: string
          id?: string
          name_servico?: string | null
          servico_id?: string
          tipo_desconto_cupom?: string | null
          valor_desconto?: number
          valor_original?: number
          valor_regra_cupom?: number | null
          valor_servico?: number
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_servicos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos: {
        Row: {
          barbearia_id: string
          cliente_id: string
          colaborador_id: string
          comissao: number
          created_at: string
          cupom_aplicado_em: string | null
          cupom_codigo: string | null
          cupom_id: string | null
          cupom_invalidado_em: string | null
          cupom_motivo_invalidacao: string | null
          cupom_nome: string | null
          cupom_status: string | null
          data: string
          id: string
          pedido_exclusao: boolean | null
          servicos_atendimento: string | null
          status: string
          updated_at: string
          valor: number
          valor_desconto: number
          valor_original: number
        }
        Insert: {
          barbearia_id: string
          cliente_id: string
          colaborador_id: string
          comissao?: number
          created_at?: string
          cupom_aplicado_em?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          cupom_invalidado_em?: string | null
          cupom_motivo_invalidacao?: string | null
          cupom_nome?: string | null
          cupom_status?: string | null
          data: string
          id?: string
          pedido_exclusao?: boolean | null
          servicos_atendimento?: string | null
          status: string
          updated_at?: string
          valor?: number
          valor_desconto?: number
          valor_original: number
        }
        Update: {
          barbearia_id?: string
          cliente_id?: string
          colaborador_id?: string
          comissao?: number
          created_at?: string
          cupom_aplicado_em?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          cupom_invalidado_em?: string | null
          cupom_motivo_invalidacao?: string | null
          cupom_nome?: string | null
          cupom_status?: string | null
          data?: string
          id?: string
          pedido_exclusao?: boolean | null
          servicos_atendimento?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_desconto?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons_desconto"
            referencedColumns: ["id"]
          },
        ]
      }
      barbearias: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog: {
        Row: {
          autor_id: string
          barbearia_id: string | null
          created_at: string
          dislikes: string[] | null
          id: string
          imagem_url: string | null
          likes: string[] | null
          link_noticia: string | null
          resumo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          barbearia_id?: string | null
          created_at?: string
          dislikes?: string[] | null
          id?: string
          imagem_url?: string | null
          likes?: string[] | null
          link_noticia?: string | null
          resumo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          barbearia_id?: string | null
          created_at?: string
          dislikes?: string[] | null
          id?: string
          imagem_url?: string | null
          likes?: string[] | null
          link_noticia?: string | null
          resumo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      colaborador_servicos: {
        Row: {
          barbearia_id: string
          colaborador_id: string | null
          created_at: string
          id: string
          servico_id: string | null
          tipo_comissao: string | null
          valor_comissao: number | null
        }
        Insert: {
          barbearia_id: string
          colaborador_id?: string | null
          created_at?: string
          id?: string
          servico_id?: string | null
          tipo_comissao?: string | null
          valor_comissao?: number | null
        }
        Update: {
          barbearia_id?: string
          colaborador_id?: string | null
          created_at?: string
          id?: string
          servico_id?: string | null
          tipo_comissao?: string | null
          valor_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_servicos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          ativo: boolean
          barbearia_id: string
          created_at: string
          foto_url: string | null
          foto_url_2: string | null
          foto_url_3: string | null
          foto_url_4: string | null
          foto_url_5: string | null
          foto_url_6: string | null
          foto_url_7: string | null
          id: string
          login: string
          nome: string
          resumo: string | null
          salario_fixo: number | null
          senha: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          barbearia_id: string
          created_at?: string
          foto_url?: string | null
          foto_url_2?: string | null
          foto_url_3?: string | null
          foto_url_4?: string | null
          foto_url_5?: string | null
          foto_url_6?: string | null
          foto_url_7?: string | null
          id?: string
          login: string
          nome: string
          resumo?: string | null
          salario_fixo?: number | null
          senha: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          barbearia_id?: string
          created_at?: string
          foto_url?: string | null
          foto_url_2?: string | null
          foto_url_3?: string | null
          foto_url_4?: string | null
          foto_url_5?: string | null
          foto_url_6?: string | null
          foto_url_7?: string | null
          id?: string
          login?: string
          nome?: string
          resumo?: string | null
          salario_fixo?: number | null
          senha?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidade: {
        Row: {
          autor_id: string
          created_at: string | null
          id: string
          imagem_url: string | null
          parent_id: string | null
          reacao_tipo: string | null
          status: string | null
          texto: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          autor_id: string
          created_at?: string | null
          id?: string
          imagem_url?: string | null
          parent_id?: string | null
          reacao_tipo?: string | null
          status?: string | null
          texto?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          autor_id?: string
          created_at?: string | null
          id?: string
          imagem_url?: string | null
          parent_id?: string | null
          reacao_tipo?: string | null
          status?: string | null
          texto?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunidade_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidade_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comunidade"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons_desconto: {
        Row: {
          barbearia_id: string
          codigo: string
          created_at: string
          data_fim: string
          data_inicio: string
          deleted_at: string | null
          descricao: string
          dias_semana: number[]
          id: string
          inatividade_dias: number | null
          limite_por_cliente: string
          nome: string
          regras_servicos: Json
          somente_novos_clientes: boolean
          tipo_desconto_total: string | null
          updated_at: string
          valor_desconto_total: number | null
          valor_minimo_total: number | null
        }
        Insert: {
          barbearia_id: string
          codigo: string
          created_at?: string
          data_fim: string
          data_inicio: string
          deleted_at?: string | null
          descricao?: string
          dias_semana: number[]
          id?: string
          inatividade_dias?: number | null
          limite_por_cliente?: string
          nome: string
          regras_servicos?: Json
          somente_novos_clientes?: boolean
          tipo_desconto_total?: string | null
          updated_at?: string
          valor_desconto_total?: number | null
          valor_minimo_total?: number | null
        }
        Update: {
          barbearia_id?: string
          codigo?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          deleted_at?: string | null
          descricao?: string
          dias_semana?: number[]
          id?: string
          inatividade_dias?: number | null
          limite_por_cliente?: string
          nome?: string
          regras_servicos?: Json
          somente_novos_clientes?: boolean
          tipo_desconto_total?: string | null
          updated_at?: string
          valor_desconto_total?: number | null
          valor_minimo_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_desconto_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      dias_agenda: {
        Row: {
          ativo: boolean
          barbearia_id: string
          created_at: string
          data: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          barbearia_id: string
          created_at?: string
          data: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          barbearia_id?: string
          created_at?: string
          data?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_agenda_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          barbearia_id: string
          created_at: string
          data: string
          id: string
          nome: string
          valor: number
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          data?: string
          id?: string
          nome: string
          valor: number
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          data?: string
          id?: string
          nome?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_colaboradores: {
        Row: {
          ativo: boolean | null
          barbearia_id: string
          colaborador_id: string
          created_at: string
          data: string
          id: string
          manha_fim: string | null
          manha_inicio: string | null
          tarde_fim: string | null
          tarde_inicio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          barbearia_id: string
          colaborador_id: string
          created_at?: string
          data: string
          id?: string
          manha_fim?: string | null
          manha_inicio?: string | null
          tarde_fim?: string | null
          tarde_inicio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          barbearia_id?: string
          colaborador_id?: string
          created_at?: string
          data?: string
          id?: string
          manha_fim?: string | null
          manha_inicio?: string | null
          tarde_fim?: string | null
          tarde_inicio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_colaboradores_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_colaboradores_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      informacoes: {
        Row: {
          barbearia_id: string
          created_at: string
          email: string | null
          endereco: string | null
          foto_perfil: string | null
          google_avaliacao: string | null
          id: string
          imagem_1: string | null
          imagem_2: string | null
          imagem_3: string | null
          imagem_4: string | null
          imagem_5: string | null
          imagem_6: string | null
          imagem_7: string | null
          imagem_8: string | null
          imagem_logo: string | null
          instagram: string | null
          instancia_api: string | null
          instancia_evo: string | null
          instancia_propria: string | null
          nome_barbearia: string | null
          tel_contato: string | null
          tempo_excluir: number | null
          tempo_marcar: number | null
          updated_at: string
          user_id: string | null
          userrr: string | null
          usuario_id: string | null
          video_local: string | null
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          foto_perfil?: string | null
          google_avaliacao?: string | null
          id?: string
          imagem_1?: string | null
          imagem_2?: string | null
          imagem_3?: string | null
          imagem_4?: string | null
          imagem_5?: string | null
          imagem_6?: string | null
          imagem_7?: string | null
          imagem_8?: string | null
          imagem_logo?: string | null
          instagram?: string | null
          instancia_api?: string | null
          instancia_evo?: string | null
          instancia_propria?: string | null
          nome_barbearia?: string | null
          tel_contato?: string | null
          tempo_excluir?: number | null
          tempo_marcar?: number | null
          updated_at?: string
          user_id?: string | null
          userrr?: string | null
          usuario_id?: string | null
          video_local?: string | null
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          foto_perfil?: string | null
          google_avaliacao?: string | null
          id?: string
          imagem_1?: string | null
          imagem_2?: string | null
          imagem_3?: string | null
          imagem_4?: string | null
          imagem_5?: string | null
          imagem_6?: string | null
          imagem_7?: string | null
          imagem_8?: string | null
          imagem_logo?: string | null
          instagram?: string | null
          instancia_api?: string | null
          instancia_evo?: string | null
          instancia_propria?: string | null
          nome_barbearia?: string | null
          tel_contato?: string | null
          tempo_excluir?: number | null
          tempo_marcar?: number | null
          updated_at?: string
          user_id?: string | null
          userrr?: string | null
          usuario_id?: string | null
          video_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "informacoes_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          barbearia_id: string | null
          created_at: string | null
          id: string
          tipo: string | null
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          barbearia_id?: string | null
          created_at?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          barbearia_id?: string | null
          created_at?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          barbearia_id: string | null
          created_at: string
          id: string
          msg_wpp_cliente_avisofinal_10: string | null
          msg_wpp_cliente_eve_alterado_05: string | null
          msg_wpp_cliente_eve_cancelado_06: string | null
          msg_wpp_cliente_eve_criado_04: string | null
          msg_wpp_cliente_finalizado_07: string | null
          msg_wpp_cliente_lembrete_11: string | null
          msg_wpp_cliente_naocompareceu_08: string | null
          msg_wpp_colab_avisofinal_09: string | null
          msg_wpp_colab_eve_alterado_02: string | null
          msg_wpp_colab_eve_cancelado_03: string | null
          msg_wpp_colab_eve_criado_01: string | null
          updated_at: string
        }
        Insert: {
          barbearia_id?: string | null
          created_at?: string
          id?: string
          msg_wpp_cliente_avisofinal_10?: string | null
          msg_wpp_cliente_eve_alterado_05?: string | null
          msg_wpp_cliente_eve_cancelado_06?: string | null
          msg_wpp_cliente_eve_criado_04?: string | null
          msg_wpp_cliente_finalizado_07?: string | null
          msg_wpp_cliente_lembrete_11?: string | null
          msg_wpp_cliente_naocompareceu_08?: string | null
          msg_wpp_colab_avisofinal_09?: string | null
          msg_wpp_colab_eve_alterado_02?: string | null
          msg_wpp_colab_eve_cancelado_03?: string | null
          msg_wpp_colab_eve_criado_01?: string | null
          updated_at?: string
        }
        Update: {
          barbearia_id?: string | null
          created_at?: string
          id?: string
          msg_wpp_cliente_avisofinal_10?: string | null
          msg_wpp_cliente_eve_alterado_05?: string | null
          msg_wpp_cliente_eve_cancelado_06?: string | null
          msg_wpp_cliente_eve_criado_04?: string | null
          msg_wpp_cliente_finalizado_07?: string | null
          msg_wpp_cliente_lembrete_11?: string | null
          msg_wpp_cliente_naocompareceu_08?: string | null
          msg_wpp_colab_avisofinal_09?: string | null
          msg_wpp_colab_eve_alterado_02?: string | null
          msg_wpp_colab_eve_cancelado_03?: string | null
          msg_wpp_colab_eve_criado_01?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: true
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          barbearia_id: string | null
          canal: string
          created_at: string
          id: string
          noti_texto_auxiliar: string | null
          noti_titulo_auxiliar: string | null
          numero_notificacao: number | null
          publicada_em: string | null
          testada: boolean
          texto: string
          titulo: string
          updated_at: string
        }
        Insert: {
          barbearia_id?: string | null
          canal: string
          created_at?: string
          id?: string
          noti_texto_auxiliar?: string | null
          noti_titulo_auxiliar?: string | null
          numero_notificacao?: number | null
          publicada_em?: string | null
          testada?: boolean
          texto?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          barbearia_id?: string | null
          canal?: string
          created_at?: string
          id?: string
          noti_texto_auxiliar?: string | null
          noti_titulo_auxiliar?: string | null
          numero_notificacao?: number | null
          publicada_em?: string | null
          testada?: boolean
          texto?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      promocao: {
        Row: {
          barbearia_id: string
          created_at: string | null
          data_promo: string | null
          id: string
          imagem_banner: string | null
          imagem_ia: string | null
          imagem_promo: string | null
          numero_promo: number
          testada: string | null
          texto_promo: string | null
          texto_promo_auxiliar: string | null
          texto_promo_ia_2: string | null
          texto_promo_ia_3: string | null
        }
        Insert: {
          barbearia_id: string
          created_at?: string | null
          data_promo?: string | null
          id?: string
          imagem_banner?: string | null
          imagem_ia?: string | null
          imagem_promo?: string | null
          numero_promo: number
          testada?: string | null
          texto_promo?: string | null
          texto_promo_auxiliar?: string | null
          texto_promo_ia_2?: string | null
          texto_promo_ia_3?: string | null
        }
        Update: {
          barbearia_id?: string
          created_at?: string | null
          data_promo?: string | null
          id?: string
          imagem_banner?: string | null
          imagem_ia?: string | null
          imagem_promo?: string | null
          numero_promo?: number
          testada?: string | null
          texto_promo?: string | null
          texto_promo_auxiliar?: string | null
          texto_promo_ia_2?: string | null
          texto_promo_ia_3?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promocao_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          barbearia_id: string
          created_at: string
          detalhes: string | null
          duration: number
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          image_url_4: string | null
          image_url_5: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          detalhes?: string | null
          duration: number
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          image_url_4?: string | null
          image_url_5?: string | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          detalhes?: string | null
          duration?: number
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          image_url_4?: string | null
          image_url_5?: string | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_financeiras: {
        Row: {
          barbearia_id: string
          categoria: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          updated_at: string
          valor: number
        }
        Insert: {
          barbearia_id: string
          categoria: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          updated_at?: string
          valor?: number
        }
        Update: {
          barbearia_id?: string
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_financeiras_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          barbearia_id: string | null
          created_at: string
          id: string
          login: string
          nivel: number
          nome: string
          observacao: string | null
          promocao: string | null
          recovery_token: string | null
          registro: string | null
          senha: string
          updated_at: string
        }
        Insert: {
          barbearia_id?: string | null
          created_at?: string
          id?: string
          login: string
          nivel: number
          nome: string
          observacao?: string | null
          promocao?: string | null
          recovery_token?: string | null
          registro?: string | null
          senha: string
          updated_at?: string
        }
        Update: {
          barbearia_id?: string | null
          created_at?: string
          id?: string
          login?: string
          nivel?: number
          nome?: string
          observacao?: string | null
          promocao?: string | null
          recovery_token?: string | null
          registro?: string | null
          senha?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_coupon_to_appointment: {
        Args: {
          p_atendimento_id: string
          p_barbearia_id: string
          p_cliente_id: string
          p_codigo: string
        }
        Returns: Json
      }
      get_atendimento_servicos_names: {
        Args: { atendimento_id_val: string }
        Returns: string
      }
      get_latest_site_notifications: {
        Args: never
        Returns: {
          id: string
          publicada_em: string
          texto: string
          titulo: string
        }[]
      }
      manage_notificacoes: {
        Args: {
          p_action: string
          p_admin_id: string
          p_login: string
          p_payload?: Json
          p_senha: string
        }
        Returns: Json
      }
      remove_coupon_from_appointment: {
        Args: { p_atendimento_id: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      tipo_transacao: "receita" | "despesa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      tipo_transacao: ["receita", "despesa"],
    },
  },
} as const
