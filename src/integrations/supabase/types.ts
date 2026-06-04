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
          id: string
          imagem_campanha: string | null
          imagem_comlogo: string | null
          imagem_criada_ia: string | null
          imagem_estilovisual: string | null
          imagem_formato: string
          imagem_imareferencia: string | null
          imagem_informacoes: string | null
          imagem_objetivo: string | null
          last_reset_month: string | null
          linha: number | null
          num_imagens_criadas: number | null
          num_limite_imagens: number | null
          texto_emoji: string | null
          texto_estilo: string | null
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          id?: string
          imagem_campanha?: string | null
          imagem_comlogo?: string | null
          imagem_criada_ia?: string | null
          imagem_estilovisual?: string | null
          imagem_formato: string
          imagem_imareferencia?: string | null
          imagem_informacoes?: string | null
          imagem_objetivo?: string | null
          last_reset_month?: string | null
          linha?: number | null
          num_imagens_criadas?: number | null
          num_limite_imagens?: number | null
          texto_emoji?: string | null
          texto_estilo?: string | null
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          id?: string
          imagem_campanha?: string | null
          imagem_comlogo?: string | null
          imagem_criada_ia?: string | null
          imagem_estilovisual?: string | null
          imagem_formato?: string
          imagem_imareferencia?: string | null
          imagem_informacoes?: string | null
          imagem_objetivo?: string | null
          last_reset_month?: string | null
          linha?: number | null
          num_imagens_criadas?: number | null
          num_limite_imagens?: number | null
          texto_emoji?: string | null
          texto_estilo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agentes_ia_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
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
          valor_servico: number
        }
        Insert: {
          atendimento_id: string
          barbearia_id: string
          created_at?: string
          id?: string
          name_servico?: string | null
          servico_id: string
          valor_servico: number
        }
        Update: {
          atendimento_id?: string
          barbearia_id?: string
          created_at?: string
          id?: string
          name_servico?: string | null
          servico_id?: string
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
          data: string
          id: string
          pedido_exclusao: boolean | null
          servicos_atendimento: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          barbearia_id: string
          cliente_id: string
          colaborador_id: string
          comissao?: number
          created_at?: string
          data: string
          id?: string
          pedido_exclusao?: boolean | null
          servicos_atendimento?: string | null
          status: string
          updated_at?: string
          valor?: number
        }
        Update: {
          barbearia_id?: string
          cliente_id?: string
          colaborador_id?: string
          comissao?: number
          created_at?: string
          data?: string
          id?: string
          pedido_exclusao?: boolean | null
          servicos_atendimento?: string | null
          status?: string
          updated_at?: string
          valor?: number
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
          instancia_evo: string | null
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
          instancia_evo?: string | null
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
          instancia_evo?: string | null
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
          barbearia_id: string
          created_at: string | null
          id: string
          tipo: string | null
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          barbearia_id?: string
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
      promocao: {
        Row: {
          barbearia_id: string
          created_at: string | null
          data_promo: string | null
          id: string
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
          barbearia_id: string
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
          barbearia_id: string
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
          barbearia_id?: string
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
      get_atendimento_servicos_names: {
        Args: { atendimento_id_val: string }
        Returns: string
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
