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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analises_ia: {
        Row: {
          created_at: string
          id: string
          resultado: Json
          site_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resultado: Json
          site_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resultado?: Json
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analises_ia_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_ia_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_recursos: {
        Row: {
          atividade_id: string
          created_at: string
          id: string
          recurso_id: string
        }
        Insert: {
          atividade_id: string
          created_at?: string
          id?: string
          recurso_id: string
        }
        Update: {
          atividade_id?: string
          created_at?: string
          id?: string
          recurso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividade_recursos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades_planejamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_recursos_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades_planejamento: {
        Row: {
          created_at: string
          data_fim_prevista: string | null
          data_inicio: string | null
          frente_id: string
          id: string
          is_principal: boolean
          item_lpu_id: string | null
          nome: string
          ordem: number
          producao_diaria_prevista: number
          quantidade_total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim_prevista?: string | null
          data_inicio?: string | null
          frente_id: string
          id?: string
          is_principal?: boolean
          item_lpu_id?: string | null
          nome: string
          ordem?: number
          producao_diaria_prevista?: number
          quantidade_total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim_prevista?: string | null
          data_inicio?: string | null
          frente_id?: string
          id?: string
          is_principal?: boolean
          item_lpu_id?: string | null
          nome?: string
          ordem?: number
          producao_diaria_prevista?: number
          quantidade_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_planejamento_frente_id_fkey"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_planejamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_planejamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "atividades_planejamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "atividades_planejamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "atividades_planejamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          campos_alterados: string[] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          operacao: string
          registro_id: string
          tabela: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          operacao: string
          registro_id: string
          tabela: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          operacao?: string
          registro_id?: string
          tabela?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      avaliacoes_fornecedor: {
        Row: {
          atraso_dias: number | null
          avaliado_por: string | null
          created_at: string
          dias_entregues: number | null
          dias_prometidos: number | null
          fornecedor_id: string
          id: string
          nota_prazo: number
          nota_preco: number
          nota_qualidade: number
          nota_responsividade: number | null
          observacao: string | null
          pedido_id: string
        }
        Insert: {
          atraso_dias?: number | null
          avaliado_por?: string | null
          created_at?: string
          dias_entregues?: number | null
          dias_prometidos?: number | null
          fornecedor_id: string
          id?: string
          nota_prazo: number
          nota_preco: number
          nota_qualidade: number
          nota_responsividade?: number | null
          observacao?: string | null
          pedido_id: string
        }
        Update: {
          atraso_dias?: number | null
          avaliado_por?: string | null
          created_at?: string
          dias_entregues?: number | null
          dias_prometidos?: number | null
          fornecedor_id?: string
          id?: string
          nota_prazo?: number
          nota_preco?: number
          nota_qualidade?: number
          nota_responsividade?: number | null
          observacao?: string | null
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_fornecedor_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_fornecedor_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_fornecedor_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "vw_pedidos_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_aplicacoes: {
        Row: {
          aplicador_id: string | null
          apr_id: string | null
          area_id: string | null
          codigo: string | null
          colaborador_id: string | null
          created_at: string
          data_aplicacao: string | null
          data_conclusao: string | null
          empresa_id: string
          funcao_id: string | null
          id: string
          incidente_id: string | null
          inspecao_id: string | null
          modelo_id: string
          nao_conformidade_id: string | null
          observacoes_gerais: string | null
          percentual_conformidade: number | null
          pgr_id: string | null
          pontuacao_maxima: number | null
          pontuacao_obtida: number | null
          projeto_id: string | null
          pt_id: string | null
          responsavel_id: string | null
          status: string
          total_conforme: number | null
          total_itens: number | null
          total_na: number | null
          total_nao_conforme: number | null
          updated_at: string
        }
        Insert: {
          aplicador_id?: string | null
          apr_id?: string | null
          area_id?: string | null
          codigo?: string | null
          colaborador_id?: string | null
          created_at?: string
          data_aplicacao?: string | null
          data_conclusao?: string | null
          empresa_id: string
          funcao_id?: string | null
          id?: string
          incidente_id?: string | null
          inspecao_id?: string | null
          modelo_id: string
          nao_conformidade_id?: string | null
          observacoes_gerais?: string | null
          percentual_conformidade?: number | null
          pgr_id?: string | null
          pontuacao_maxima?: number | null
          pontuacao_obtida?: number | null
          projeto_id?: string | null
          pt_id?: string | null
          responsavel_id?: string | null
          status?: string
          total_conforme?: number | null
          total_itens?: number | null
          total_na?: number | null
          total_nao_conforme?: number | null
          updated_at?: string
        }
        Update: {
          aplicador_id?: string | null
          apr_id?: string | null
          area_id?: string | null
          codigo?: string | null
          colaborador_id?: string | null
          created_at?: string
          data_aplicacao?: string | null
          data_conclusao?: string | null
          empresa_id?: string
          funcao_id?: string | null
          id?: string
          incidente_id?: string | null
          inspecao_id?: string | null
          modelo_id?: string
          nao_conformidade_id?: string | null
          observacoes_gerais?: string | null
          percentual_conformidade?: number | null
          pgr_id?: string | null
          pontuacao_maxima?: number | null
          pontuacao_obtida?: number | null
          projeto_id?: string | null
          pt_id?: string | null
          responsavel_id?: string | null
          status?: string
          total_conforme?: number | null
          total_itens?: number | null
          total_na?: number | null
          total_nao_conforme?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_aplicacoes_aplicador_id_fkey"
            columns: ["aplicador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_aplicacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_evidencias: {
        Row: {
          aplicacao_id: string
          created_at: string
          empresa_id: string
          id: string
          nome_arquivo: string | null
          r2_key: string | null
          r2_url: string
          resposta_id: string | null
          tamanho: number | null
          tipo_mime: string | null
        }
        Insert: {
          aplicacao_id: string
          created_at?: string
          empresa_id: string
          id?: string
          nome_arquivo?: string | null
          r2_key?: string | null
          r2_url: string
          resposta_id?: string | null
          tamanho?: number | null
          tipo_mime?: string | null
        }
        Update: {
          aplicacao_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome_arquivo?: string | null
          r2_key?: string | null
          r2_url?: string
          resposta_id?: string | null
          tamanho?: number | null
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_evidencias_aplicacao_id_fkey"
            columns: ["aplicacao_id"]
            isOneToOne: false
            referencedRelation: "checklist_aplicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_evidencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_evidencias_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "checklist_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_itens: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          exigir_comentario_nao_conforme: boolean
          exigir_foto_nao_conforme: boolean
          gerar_plano_acao_nao_conforme: boolean
          id: string
          obrigatorio: boolean
          opcoes_selecao: string[] | null
          ordem: number
          peso_pontuacao: number
          secao_id: string
          tipo_resposta: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id: string
          exigir_comentario_nao_conforme?: boolean
          exigir_foto_nao_conforme?: boolean
          gerar_plano_acao_nao_conforme?: boolean
          id?: string
          obrigatorio?: boolean
          opcoes_selecao?: string[] | null
          ordem?: number
          peso_pontuacao?: number
          secao_id: string
          tipo_resposta?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          exigir_comentario_nao_conforme?: boolean
          exigir_foto_nao_conforme?: boolean
          gerar_plano_acao_nao_conforme?: boolean
          id?: string
          obrigatorio?: boolean
          opcoes_selecao?: string[] | null
          ordem?: number
          peso_pontuacao?: number
          secao_id?: string
          tipo_resposta?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_itens_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "checklist_secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelos: {
        Row: {
          area_id: string | null
          categoria: string
          codigo: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          periodicidade_sugerida: string | null
          projeto_id: string | null
          responsavel_id: string | null
          status: string
          tipo_aplicacao: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          categoria?: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          periodicidade_sugerida?: string | null
          projeto_id?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_aplicacao?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          categoria?: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          periodicidade_sugerida?: string | null
          projeto_id?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_aplicacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_modelos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_modelos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_modelos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_modelos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "checklist_modelos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_planos_acao: {
        Row: {
          aplicacao_id: string
          codigo: string | null
          como_fazer: string | null
          created_at: string
          data_conclusao: string | null
          data_validacao: string | null
          empresa_id: string
          evidencia_conclusao_r2_url: string | null
          id: string
          item_id: string | null
          nao_conformidade_sgsst_id: string | null
          o_que_fazer: string
          onde: string | null
          por_que: string | null
          prioridade: string
          quando_prazo: string | null
          quanto_custo: number | null
          quem_responsavel_id: string | null
          resposta_id: string | null
          status: string
          updated_at: string
          validado_por_id: string | null
        }
        Insert: {
          aplicacao_id: string
          codigo?: string | null
          como_fazer?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_validacao?: string | null
          empresa_id: string
          evidencia_conclusao_r2_url?: string | null
          id?: string
          item_id?: string | null
          nao_conformidade_sgsst_id?: string | null
          o_que_fazer: string
          onde?: string | null
          por_que?: string | null
          prioridade?: string
          quando_prazo?: string | null
          quanto_custo?: number | null
          quem_responsavel_id?: string | null
          resposta_id?: string | null
          status?: string
          updated_at?: string
          validado_por_id?: string | null
        }
        Update: {
          aplicacao_id?: string
          codigo?: string | null
          como_fazer?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_validacao?: string | null
          empresa_id?: string
          evidencia_conclusao_r2_url?: string | null
          id?: string
          item_id?: string | null
          nao_conformidade_sgsst_id?: string | null
          o_que_fazer?: string
          onde?: string | null
          por_que?: string | null
          prioridade?: string
          quando_prazo?: string | null
          quanto_custo?: number | null
          quem_responsavel_id?: string | null
          resposta_id?: string | null
          status?: string
          updated_at?: string
          validado_por_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_planos_acao_aplicacao_id_fkey"
            columns: ["aplicacao_id"]
            isOneToOne: false
            referencedRelation: "checklist_aplicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_planos_acao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_planos_acao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_planos_acao_quem_responsavel_id_fkey"
            columns: ["quem_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_planos_acao_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "checklist_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_planos_acao_validado_por_id_fkey"
            columns: ["validado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_regras: {
        Row: {
          acao_regra: string
          created_at: string
          empresa_id: string
          id: string
          item_id: string
          resposta_gatilho: string
        }
        Insert: {
          acao_regra: string
          created_at?: string
          empresa_id: string
          id?: string
          item_id: string
          resposta_gatilho: string
        }
        Update: {
          acao_regra?: string
          created_at?: string
          empresa_id?: string
          id?: string
          item_id?: string
          resposta_gatilho?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_regras_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_respostas: {
        Row: {
          aplicacao_id: string
          comentario: string | null
          created_at: string
          empresa_id: string
          id: string
          is_critico: boolean | null
          is_nao_conforme: boolean | null
          item_id: string
          pontos_obtidos: number | null
          resposta_valor: string
          updated_at: string
        }
        Insert: {
          aplicacao_id: string
          comentario?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          is_critico?: boolean | null
          is_nao_conforme?: boolean | null
          item_id: string
          pontos_obtidos?: number | null
          resposta_valor: string
          updated_at?: string
        }
        Update: {
          aplicacao_id?: string
          comentario?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          is_critico?: boolean | null
          is_nao_conforme?: boolean | null
          item_id?: string
          pontos_obtidos?: number | null
          resposta_valor?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_respostas_aplicacao_id_fkey"
            columns: ["aplicacao_id"]
            isOneToOne: false
            referencedRelation: "checklist_aplicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_secoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          modelo_id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          modelo_id: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          modelo_id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_secoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_secoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cep: string | null
          cnpj: string | null
          created_at: string
          empresa_id: string
          endereco_completo: string | null
          id: string
          logo_url: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          endereco_completo?: string | null
          id?: string
          logo_url?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          endereco_completo?: string | null
          id?: string
          logo_url?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contaazul_tokens: {
        Row: {
          access_token: string
          created_at: string
          empresa_id: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          empresa_id: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          empresa_id?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contaazul_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          arquivo_url: string | null
          cliente_ids: string[] | null
          condicoes_pagamento: string | null
          contrato_pai_id: string | null
          created_at: string
          empresa_id: string
          escopo: string | null
          garantias: string | null
          id: string
          liberacao_garantias: string | null
          medicoes: string | null
          multas: string | null
          numero_contrato: string | null
          observacoes: string | null
          prazo_fim: string | null
          prazo_inicio: string | null
          reajuste: string | null
          status_processamento: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          arquivo_url?: string | null
          cliente_ids?: string[] | null
          condicoes_pagamento?: string | null
          contrato_pai_id?: string | null
          created_at?: string
          empresa_id: string
          escopo?: string | null
          garantias?: string | null
          id?: string
          liberacao_garantias?: string | null
          medicoes?: string | null
          multas?: string | null
          numero_contrato?: string | null
          observacoes?: string | null
          prazo_fim?: string | null
          prazo_inicio?: string | null
          reajuste?: string | null
          status_processamento?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          arquivo_url?: string | null
          cliente_ids?: string[] | null
          condicoes_pagamento?: string | null
          contrato_pai_id?: string | null
          created_at?: string
          empresa_id?: string
          escopo?: string | null
          garantias?: string | null
          id?: string
          liberacao_garantias?: string | null
          medicoes?: string | null
          multas?: string | null
          numero_contrato?: string | null
          observacoes?: string | null
          prazo_fim?: string | null
          prazo_inicio?: string | null
          reajuste?: string | null
          status_processamento?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "view_bi_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "view_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_itens: {
        Row: {
          cotacao_id: string
          created_at: string
          id: string
          observacao: string | null
          prazo_entrega_dias: number | null
          preco_unitario: number
          quantidade: number
          requisicao_item_id: string
        }
        Insert: {
          cotacao_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          prazo_entrega_dias?: number | null
          preco_unitario?: number
          quantidade?: number
          requisicao_item_id: string
        }
        Update: {
          cotacao_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          prazo_entrega_dias?: number | null
          preco_unitario?: number
          quantidade?: number
          requisicao_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_requisicao_item_id_fkey"
            columns: ["requisicao_item_id"]
            isOneToOne: false
            referencedRelation: "requisicao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          condicao_pagamento: string | null
          created_at: string
          desconto_percentual: number | null
          empresa_id: string
          fornecedor_id: string
          frete: number | null
          id: string
          numero: string
          observacoes: string | null
          prazo_entrega_dias: number | null
          requisicao_id: string
          status: string
          updated_at: string
          validade: string | null
          valor_total: number | null
        }
        Insert: {
          condicao_pagamento?: string | null
          created_at?: string
          desconto_percentual?: number | null
          empresa_id: string
          fornecedor_id: string
          frete?: number | null
          id?: string
          numero: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          requisicao_id: string
          status?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
        }
        Update: {
          condicao_pagamento?: string | null
          created_at?: string
          desconto_percentual?: number | null
          empresa_id?: string
          fornecedor_id?: string
          frete?: number | null
          id?: string
          numero?: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          requisicao_id?: string
          status?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      custo_real_erp: {
        Row: {
          categoria_analise: string | null
          categoria_confirmada: boolean | null
          categoria_erp: string
          categoria_interna: string
          categoria_sugerida_ia: string | null
          centro_custo: string | null
          created_at: string | null
          data_competencia: string | null
          data_pagamento: string | null
          descricao: string
          erp_id: string
          id: string
          projeto_id: string | null
          site_id: string | null
          status_erp: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria_analise?: string | null
          categoria_confirmada?: boolean | null
          categoria_erp?: string
          categoria_interna?: string
          categoria_sugerida_ia?: string | null
          centro_custo?: string | null
          created_at?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          descricao?: string
          erp_id: string
          id?: string
          projeto_id?: string | null
          site_id?: string | null
          status_erp?: string
          updated_at?: string | null
          valor?: number
        }
        Update: {
          categoria_analise?: string | null
          categoria_confirmada?: boolean | null
          categoria_erp?: string
          categoria_interna?: string
          categoria_sugerida_ia?: string | null
          centro_custo?: string | null
          created_at?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          descricao?: string
          erp_id?: string
          id?: string
          projeto_id?: string | null
          site_id?: string | null
          status_erp?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      dependencias_atividade: {
        Row: {
          atividade_id: string
          created_at: string
          id: string
          predecessora_id: string
        }
        Insert: {
          atividade_id: string
          created_at?: string
          id?: string
          predecessora_id: string
        }
        Update: {
          atividade_id?: string
          created_at?: string
          id?: string
          predecessora_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependencias_atividade_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades_planejamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencias_atividade_predecessora_id_fkey"
            columns: ["predecessora_id"]
            isOneToOne: false
            referencedRelation: "atividades_planejamento"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_campo_fotos: {
        Row: {
          created_at: string | null
          diario_campo_id: string
          id: string
          legenda: string | null
          thumb_600_url: string | null
          thumb_url: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          diario_campo_id: string
          id?: string
          legenda?: string | null
          thumb_600_url?: string | null
          thumb_url?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          diario_campo_id?: string
          id?: string
          legenda?: string | null
          thumb_600_url?: string | null
          thumb_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_campo_fotos_diario_campo_id_fkey"
            columns: ["diario_campo_id"]
            isOneToOne: false
            referencedRelation: "diarios_campo"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_equipamentos: {
        Row: {
          created_at: string | null
          custo_hora: number
          custo_total: number
          descricao: string
          diario_id: string
          horas: number
          id: string
        }
        Insert: {
          created_at?: string | null
          custo_hora?: number
          custo_total?: number
          descricao: string
          diario_id: string
          horas?: number
          id?: string
        }
        Update: {
          created_at?: string | null
          custo_hora?: number
          custo_total?: number
          descricao?: string
          diario_id?: string
          horas?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_equipamentos_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diarios_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_equipe: {
        Row: {
          created_at: string | null
          custo_hora: number
          custo_total: number
          diario_id: string
          funcao: string | null
          horas: number
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          custo_hora?: number
          custo_total?: number
          diario_id: string
          funcao?: string | null
          horas?: number
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          custo_hora?: number
          custo_total?: number
          diario_id?: string
          funcao?: string | null
          horas?: number
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_equipe_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diarios_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_fotos: {
        Row: {
          classificacao: string
          created_at: string | null
          diario_id: string
          diario_producao_id: string | null
          id: string
          legenda: string | null
          ordem: number
          thumb_600_url: string | null
          thumb_url: string | null
          url: string
        }
        Insert: {
          classificacao?: string
          created_at?: string | null
          diario_id: string
          diario_producao_id?: string | null
          id?: string
          legenda?: string | null
          ordem?: number
          thumb_600_url?: string | null
          thumb_url?: string | null
          url: string
        }
        Update: {
          classificacao?: string
          created_at?: string | null
          diario_id?: string
          diario_producao_id?: string | null
          id?: string
          legenda?: string | null
          ordem?: number
          thumb_600_url?: string | null
          thumb_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_fotos_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diarios_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_fotos_diario_producao_id_fkey"
            columns: ["diario_producao_id"]
            isOneToOne: false
            referencedRelation: "diario_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_fotos_diario_producao_id_fkey"
            columns: ["diario_producao_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_fotos_diario_producao_id_fkey"
            columns: ["diario_producao_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_fotos_diario_producao_id_fkey"
            columns: ["diario_producao_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_producao: {
        Row: {
          created_at: string | null
          diario_id: string
          id: string
          item_lpu_id: string
          preco_unitario_congelado: number
          quantidade: number
          valor_total: number
        }
        Insert: {
          created_at?: string | null
          diario_id: string
          id?: string
          item_lpu_id: string
          preco_unitario_congelado?: number
          quantidade?: number
          valor_total?: number
        }
        Update: {
          created_at?: string | null
          diario_id?: string
          id?: string
          item_lpu_id?: string
          preco_unitario_congelado?: number
          quantidade?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "diario_producao_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diarios_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "diario_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "diario_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "diario_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
        ]
      }
      diario_veiculos: {
        Row: {
          created_at: string | null
          custo_diaria: number
          descricao: string
          diario_id: string
          id: string
          km_final: number | null
          km_inicial: number | null
          km_rodados: number | null
          placa: string | null
        }
        Insert: {
          created_at?: string | null
          custo_diaria?: number
          descricao: string
          diario_id: string
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          km_rodados?: number | null
          placa?: string | null
        }
        Update: {
          created_at?: string | null
          custo_diaria?: number
          descricao?: string
          diario_id?: string
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          km_rodados?: number | null
          placa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_veiculos_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diarios_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      diarios_campo: {
        Row: {
          clima: string | null
          created_at: string | null
          data: string
          descricao_servico: string | null
          equipe_campo: string | null
          id: string
          municipio: string | null
          observacoes: string | null
          projeto_id: string | null
          site_id: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          clima?: string | null
          created_at?: string | null
          data: string
          descricao_servico?: string | null
          equipe_campo?: string | null
          id?: string
          municipio?: string | null
          observacoes?: string | null
          projeto_id?: string | null
          site_id?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          clima?: string | null
          created_at?: string | null
          data?: string
          descricao_servico?: string | null
          equipe_campo?: string | null
          id?: string
          municipio?: string | null
          observacoes?: string | null
          projeto_id?: string | null
          site_id?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "diarios_campo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "diarios_campo_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diarios_campo_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      diarios_obra: {
        Row: {
          clima: string | null
          created_at: string | null
          data: string
          id: string
          municipio: string | null
          observacoes: string | null
          site_id: string
          status_ativo: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          clima?: string | null
          created_at?: string | null
          data: string
          id?: string
          municipio?: string | null
          observacoes?: string | null
          site_id: string
          status_ativo?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          clima?: string | null
          created_at?: string | null
          data?: string
          id?: string
          municipio?: string | null
          observacoes?: string | null
          site_id?: string
          status_ativo?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      escopo_itens: {
        Row: {
          created_at: string | null
          custo_unitario: number
          id: string
          item_lpu_id: string | null
          nome: string
          quantidade: number
          site_id: string
          unidade: string
          updated_at: string | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string | null
          custo_unitario?: number
          id?: string
          item_lpu_id?: string | null
          nome: string
          quantidade?: number
          site_id: string
          unidade: string
          updated_at?: string | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string | null
          custo_unitario?: number
          id?: string
          item_lpu_id?: string | null
          nome?: string
          quantidade?: number
          site_id?: string
          unidade?: string
          updated_at?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "escopo_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escopo_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "escopo_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "escopo_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "escopo_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "escopo_itens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escopo_itens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      escopos_historico: {
        Row: {
          created_at: string | null
          id: string
          site_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          site_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          site_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "escopos_historico_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escopos_historico_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      faturamento_itens: {
        Row: {
          created_at: string
          faturamento_id: string
          id: string
          item_lpu_id: string
          quantidade_faturada: number
          site_id: string
          valor_faturado: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          faturamento_id: string
          id?: string
          item_lpu_id: string
          quantidade_faturada?: number
          site_id: string
          valor_faturado?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          faturamento_id?: string
          id?: string
          item_lpu_id?: string
          quantidade_faturada?: number
          site_id?: string
          valor_faturado?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_itens_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "faturamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "faturamento_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "faturamento_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "faturamento_itens_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "faturamento_itens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_itens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      faturamentos: {
        Row: {
          created_at: string
          data_emissao: string
          descontos: number
          id: string
          impostos_percentual: number
          impostos_valor: number
          numero_fatura: string | null
          observacao: string | null
          projeto_id: string
          status: string
          updated_at: string
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          created_at?: string
          data_emissao?: string
          descontos?: number
          id?: string
          impostos_percentual?: number
          impostos_valor?: number
          numero_fatura?: string | null
          observacao?: string | null
          projeto_id: string
          status?: string
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number
        }
        Update: {
          created_at?: string
          data_emissao?: string
          descontos?: number
          id?: string
          impostos_percentual?: number
          impostos_valor?: number
          numero_fatura?: string | null
          observacao?: string | null
          projeto_id?: string
          status?: string
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      faturamentos_conta_azul: {
        Row: {
          centro_custo: string | null
          cliente_nome: string | null
          created_at: string | null
          data_emissao: string
          descricao: string | null
          empresa_id: string | null
          erp_id: string
          id: string
          numero_nota: string | null
          numero_venda: string | null
          payload_json: Json | null
          projeto_id: string | null
          status: string | null
          updated_at: string | null
          valor_aberto: number | null
          valor_baixado: number | null
          valor_total: number
        }
        Insert: {
          centro_custo?: string | null
          cliente_nome?: string | null
          created_at?: string | null
          data_emissao: string
          descricao?: string | null
          empresa_id?: string | null
          erp_id: string
          id?: string
          numero_nota?: string | null
          numero_venda?: string | null
          payload_json?: Json | null
          projeto_id?: string | null
          status?: string | null
          updated_at?: string | null
          valor_aberto?: number | null
          valor_baixado?: number | null
          valor_total: number
        }
        Update: {
          centro_custo?: string | null
          cliente_nome?: string | null
          created_at?: string | null
          data_emissao?: string
          descricao?: string | null
          empresa_id?: string | null
          erp_id?: string
          id?: string
          numero_nota?: string | null
          numero_venda?: string | null
          payload_json?: Json | null
          projeto_id?: string | null
          status?: string | null
          updated_at?: string | null
          valor_aberto?: number | null
          valor_baixado?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamentos_conta_azul_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "faturamentos_conta_azul_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      fca_eventos: {
        Row: {
          acao: string
          causa: string
          created_at: string | null
          created_by: string | null
          fato: string
          id: string
          mes_referencia: string
          projeto_id: string
          updated_at: string | null
        }
        Insert: {
          acao: string
          causa: string
          created_at?: string | null
          created_by?: string | null
          fato: string
          id?: string
          mes_referencia: string
          projeto_id: string
          updated_at?: string | null
        }
        Update: {
          acao?: string
          causa?: string
          created_at?: string | null
          created_by?: string | null
          fato?: string
          id?: string
          mes_referencia?: string
          projeto_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "fca_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      flash_category_mapping: {
        Row: {
          conta_azul_account_id: string | null
          conta_azul_account_name: string | null
          conta_azul_category_id: string | null
          conta_azul_category_name: string | null
          created_at: string
          empresa_id: string
          flash_category: string | null
          flash_cost_center: string | null
          flash_description_pattern: string | null
          flash_type: string
          id: string
          last_feedback_at: string | null
          last_feedback_source: string | null
          learned: boolean
          manual_confirmations: number
          tipo_operacao: string
          updated_at: string
        }
        Insert: {
          conta_azul_account_id?: string | null
          conta_azul_account_name?: string | null
          conta_azul_category_id?: string | null
          conta_azul_category_name?: string | null
          created_at?: string
          empresa_id: string
          flash_category?: string | null
          flash_cost_center?: string | null
          flash_description_pattern?: string | null
          flash_type: string
          id?: string
          last_feedback_at?: string | null
          last_feedback_source?: string | null
          learned?: boolean
          manual_confirmations?: number
          tipo_operacao?: string
          updated_at?: string
        }
        Update: {
          conta_azul_account_id?: string | null
          conta_azul_account_name?: string | null
          conta_azul_category_id?: string | null
          conta_azul_category_name?: string | null
          created_at?: string
          empresa_id?: string
          flash_category?: string | null
          flash_cost_center?: string | null
          flash_description_pattern?: string | null
          flash_type?: string
          id?: string
          last_feedback_at?: string | null
          last_feedback_source?: string | null
          learned?: boolean
          manual_confirmations?: number
          tipo_operacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_category_mapping_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_integration_logs: {
        Row: {
          conta_azul_protocolo: string | null
          conta_azul_transaction_id: string | null
          created_at: string
          duracao_ms: number | null
          empresa_id: string
          erro: string | null
          evento: string
          flash_transaction_id: string | null
          http_status: number | null
          id: string
          reconciliado: boolean | null
          reconciliado_at: string | null
          request: Json
          response: Json | null
          status: string
        }
        Insert: {
          conta_azul_protocolo?: string | null
          conta_azul_transaction_id?: string | null
          created_at?: string
          duracao_ms?: number | null
          empresa_id: string
          erro?: string | null
          evento?: string
          flash_transaction_id?: string | null
          http_status?: number | null
          id?: string
          reconciliado?: boolean | null
          reconciliado_at?: string | null
          request?: Json
          response?: Json | null
          status?: string
        }
        Update: {
          conta_azul_protocolo?: string | null
          conta_azul_transaction_id?: string | null
          created_at?: string
          duracao_ms?: number | null
          empresa_id?: string
          erro?: string | null
          evento?: string
          flash_transaction_id?: string | null
          http_status?: number | null
          id?: string
          reconciliado?: boolean | null
          reconciliado_at?: string | null
          request?: Json
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_integration_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_normalizacao: {
        Row: {
          conta_azul_account_id: string | null
          conta_azul_account_name: string | null
          conta_azul_category_id: string | null
          conta_azul_category_name: string | null
          conta_azul_payload: Json | null
          created_at: string
          empresa_id: string
          enviado_at: string | null
          flash_transaction_id: string
          flash_type_detectado: string | null
          id: string
          mapping_id_usado: string | null
          motivo: string | null
          normalizado_at: string | null
          observacao: string | null
          status: string
          tipo_operacao: string
          updated_at: string
        }
        Insert: {
          conta_azul_account_id?: string | null
          conta_azul_account_name?: string | null
          conta_azul_category_id?: string | null
          conta_azul_category_name?: string | null
          conta_azul_payload?: Json | null
          created_at?: string
          empresa_id: string
          enviado_at?: string | null
          flash_transaction_id: string
          flash_type_detectado?: string | null
          id?: string
          mapping_id_usado?: string | null
          motivo?: string | null
          normalizado_at?: string | null
          observacao?: string | null
          status?: string
          tipo_operacao?: string
          updated_at?: string
        }
        Update: {
          conta_azul_account_id?: string | null
          conta_azul_account_name?: string | null
          conta_azul_category_id?: string | null
          conta_azul_category_name?: string | null
          conta_azul_payload?: Json | null
          created_at?: string
          empresa_id?: string
          enviado_at?: string | null
          flash_transaction_id?: string
          flash_type_detectado?: string | null
          id?: string
          mapping_id_usado?: string | null
          motivo?: string | null
          normalizado_at?: string | null
          observacao?: string | null
          status?: string
          tipo_operacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_normalizacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_normalizacao_flash_transaction_id_fkey"
            columns: ["flash_transaction_id"]
            isOneToOne: true
            referencedRelation: "flash_transactions_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_normalizacao_flash_transaction_id_fkey"
            columns: ["flash_transaction_id"]
            isOneToOne: true
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_transactions_raw: {
        Row: {
          amount: number | null
          created_at: string
          empresa_id: string
          external_id: string
          id: string
          payload_json: Json
          transaction_date: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          empresa_id: string
          external_id: string
          id?: string
          payload_json: Json
          transaction_date?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          empresa_id?: string
          external_id?: string
          id?: string
          payload_json?: Json
          transaction_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flash_transactions_raw_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          avaliacao: number | null
          categoria: string | null
          cep: string | null
          cnpj: string | null
          complemento: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          empresa_id: string
          endereco: string | null
          id: string
          municipio: string | null
          observacoes: string | null
          razao_social: string
          score: number | null
          score_prazo: number | null
          score_preco: number | null
          score_qualidade: number | null
          score_responsividade: number | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          avaliacao?: number | null
          categoria?: string | null
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empresa_id: string
          endereco?: string | null
          id?: string
          municipio?: string | null
          observacoes?: string | null
          razao_social: string
          score?: number | null
          score_prazo?: number | null
          score_preco?: number | null
          score_qualidade?: number | null
          score_responsividade?: number | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          avaliacao?: number | null
          categoria?: string | null
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empresa_id?: string
          endereco?: string | null
          id?: string
          municipio?: string | null
          observacoes?: string | null
          razao_social?: string
          score?: number | null
          score_prazo?: number | null
          score_preco?: number | null
          score_qualidade?: number | null
          score_responsividade?: number | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      foto_geolocalizacao_ajustes: {
        Row: {
          created_at: string | null
          foto_id: string
          id: string
          latitude: number
          longitude: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          foto_id: string
          id?: string
          latitude: number
          longitude: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          foto_id?: string
          id?: string
          latitude?: number
          longitude?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foto_geolocalizacao_ajustes_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: true
            referencedRelation: "diario_fotos"
            referencedColumns: ["id"]
          },
        ]
      }
      foto_geolocalizacao_cache: {
        Row: {
          created_at: string | null
          latitude: number
          longitude: number
          source: string
          url: string
        }
        Insert: {
          created_at?: string | null
          latitude: number
          longitude: number
          source: string
          url: string
        }
        Update: {
          created_at?: string | null
          latitude?: number
          longitude?: number
          source?: string
          url?: string
        }
        Relationships: []
      }
      frentes_obra: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          projeto_id: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          projeto_id: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          projeto_id?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "frentes_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "frentes_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frentes_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      integracoes_erp_config: {
        Row: {
          ativo: boolean
          auth_token: string | null
          auth_type: string
          created_at: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          ativo?: boolean
          auth_token?: string | null
          auth_type?: string
          created_at?: string | null
          empresa_id: string
          id?: string
          nome?: string
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          ativo?: boolean
          auth_token?: string | null
          auth_type?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_erp_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_erp_log: {
        Row: {
          config_id: string
          created_at: string | null
          empresa_id: string
          erro: string | null
          evento: string
          id: string
          payload: Json
          resposta: Json | null
          status: string
          tentativas: number
          updated_at: string | null
        }
        Insert: {
          config_id: string
          created_at?: string | null
          empresa_id: string
          erro?: string | null
          evento: string
          id?: string
          payload?: Json
          resposta?: Json | null
          status?: string
          tentativas?: number
          updated_at?: string | null
        }
        Update: {
          config_id?: string
          created_at?: string | null
          empresa_id?: string
          erro?: string | null
          evento?: string
          id?: string
          payload?: Json
          resposta?: Json | null
          status?: string
          tentativas?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_erp_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "integracoes_erp_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_erp_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      item_lpu_bdi_mensal: {
        Row: {
          bdi: number
          created_at: string
          id: string
          item_lpu_id: string
          mes_referencia: string
          updated_at: string
        }
        Insert: {
          bdi?: number
          created_at?: string
          id?: string
          item_lpu_id: string
          mes_referencia: string
          updated_at?: string
        }
        Update: {
          bdi?: number
          created_at?: string
          id?: string
          item_lpu_id?: string
          mes_referencia?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_lpu_bdi_mensal_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_lpu_bdi_mensal_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "item_lpu_bdi_mensal_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "item_lpu_bdi_mensal_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "item_lpu_bdi_mensal_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
        ]
      }
      itens_lpu: {
        Row: {
          ativo: boolean | null
          bdi: number
          categoria: string | null
          codigo: string
          created_at: string
          descricao: string
          id: string
          preco_unitario: number
          projeto_id: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          bdi?: number
          categoria?: string | null
          codigo: string
          created_at?: string
          descricao: string
          id?: string
          preco_unitario?: number
          projeto_id?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          bdi?: number
          categoria?: string | null
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          preco_unitario?: number
          projeto_id?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "itens_lpu_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      lancamentos_faturamento: {
        Row: {
          created_at: string
          data_faturamento: string
          id: string
          item_lpu_id: string
          numero_nf: string | null
          numero_po: string | null
          observacao: string | null
          quantidade: number
          site_id: string
          updated_at: string
          valor_faturado: number | null
        }
        Insert: {
          created_at?: string
          data_faturamento: string
          id?: string
          item_lpu_id: string
          numero_nf?: string | null
          numero_po?: string | null
          observacao?: string | null
          quantidade: number
          site_id: string
          updated_at?: string
          valor_faturado?: number | null
        }
        Update: {
          created_at?: string
          data_faturamento?: string
          id?: string
          item_lpu_id?: string
          numero_nf?: string | null
          numero_po?: string | null
          observacao?: string | null
          quantidade?: number
          site_id?: string
          updated_at?: string
          valor_faturado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_faturamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_faturamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_faturamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_faturamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_faturamento_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_faturamento_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_faturamento_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      lancamentos_medicao: {
        Row: {
          anexo_url: string | null
          capa_url: string | null
          created_at: string
          data_medicao: string
          data_resposta: string | null
          fotos_por_pagina: number | null
          id: string
          item_lpu_id: string
          legenda_padrao_fotos: string | null
          logo_empresa_url: string | null
          modo_somente_fotos: boolean | null
          mostrar_lpu: boolean | null
          mostrar_valores_site: boolean | null
          numero_medicao: string | null
          numero_po: string | null
          observacao: string | null
          observacao_acompanhamento: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          quantidade: number
          quantidade_aprovada: number | null
          quantidade_pendente: number | null
          quantidade_rejeitada: number | null
          site_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          anexo_url?: string | null
          capa_url?: string | null
          created_at?: string
          data_medicao: string
          data_resposta?: string | null
          fotos_por_pagina?: number | null
          id?: string
          item_lpu_id: string
          legenda_padrao_fotos?: string | null
          logo_empresa_url?: string | null
          modo_somente_fotos?: boolean | null
          mostrar_lpu?: boolean | null
          mostrar_valores_site?: boolean | null
          numero_medicao?: string | null
          numero_po?: string | null
          observacao?: string | null
          observacao_acompanhamento?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          quantidade: number
          quantidade_aprovada?: number | null
          quantidade_pendente?: number | null
          quantidade_rejeitada?: number | null
          site_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          anexo_url?: string | null
          capa_url?: string | null
          created_at?: string
          data_medicao?: string
          data_resposta?: string | null
          fotos_por_pagina?: number | null
          id?: string
          item_lpu_id?: string
          legenda_padrao_fotos?: string | null
          logo_empresa_url?: string | null
          modo_somente_fotos?: boolean | null
          mostrar_lpu?: boolean | null
          mostrar_valores_site?: boolean | null
          numero_medicao?: string | null
          numero_po?: string | null
          observacao?: string | null
          observacao_acompanhamento?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          quantidade?: number
          quantidade_aprovada?: number | null
          quantidade_pendente?: number | null
          quantidade_rejeitada?: number | null
          site_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_medicao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_medicao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_medicao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_medicao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_medicao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_medicao_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_medicao_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      lancamentos_producao: {
        Row: {
          created_at: string
          data_producao: string
          empresa_executora: string | null
          id: string
          item_lpu_id: string
          municipio: string | null
          observacao: string | null
          quantidade: number
          site_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_producao: string
          empresa_executora?: string | null
          id?: string
          item_lpu_id: string
          municipio?: string | null
          observacao?: string | null
          quantidade: number
          site_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_producao?: string
          empresa_executora?: string | null
          id?: string
          item_lpu_id?: string
          municipio?: string | null
          observacao?: string | null
          quantidade?: number
          site_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "itens_lpu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_producao_item_lpu_id_fkey"
            columns: ["item_lpu_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["item_lpu_id"]
          },
          {
            foreignKeyName: "lancamentos_producao_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_producao_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      mapeamento_categorias_erp: {
        Row: {
          ativo: boolean
          categoria_erp: string
          categoria_interna: string
          created_at: string | null
          criado_por_ia: boolean | null
          id: string
        }
        Insert: {
          ativo?: boolean
          categoria_erp: string
          categoria_interna?: string
          created_at?: string | null
          criado_por_ia?: boolean | null
          id?: string
        }
        Update: {
          ativo?: boolean
          categoria_erp?: string
          categoria_interna?: string
          created_at?: string | null
          criado_por_ia?: boolean | null
          id?: string
        }
        Relationships: []
      }
      medicao_exports: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_size: number | null
          filename: string
          id: string
          medicao_id: string
          metadata: Json | null
          quality: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_size?: number | null
          filename: string
          id?: string
          medicao_id: string
          metadata?: Json | null
          quality?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          medicao_id?: string
          metadata?: Json | null
          quality?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicao_exports_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_medicao"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao_report_photo_captions: {
        Row: {
          created_at: string | null
          foto_id: string
          id: string
          legenda: string | null
          numero_medicao: string
          ordem: number | null
        }
        Insert: {
          created_at?: string | null
          foto_id: string
          id?: string
          legenda?: string | null
          numero_medicao: string
          ordem?: number | null
        }
        Update: {
          created_at?: string | null
          foto_id?: string
          id?: string
          legenda?: string | null
          numero_medicao?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicao_report_photo_captions_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "diario_fotos"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao_status_historico: {
        Row: {
          data_mudanca: string | null
          id: string
          numero_medicao: string | null
          observacao: string | null
          site_id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          data_mudanca?: string | null
          id?: string
          numero_medicao?: string | null
          observacao?: string | null
          site_id: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          data_mudanca?: string | null
          id?: string
          numero_medicao?: string | null
          observacao?: string | null
          site_id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicao_status_historico_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_status_historico_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      mkp_parametros: {
        Row: {
          area: string | null
          bdi_venda: number
          created_at: string | null
          id: string
          obra_codigo: string | null
          perc_custo_direto: number
          perc_gerencia: number
          perc_inflacao: number
          perc_mb_esperado: number
          perc_risco: number
          perc_treinamento: number
          projeto_id: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          bdi_venda?: number
          created_at?: string | null
          id?: string
          obra_codigo?: string | null
          perc_custo_direto?: number
          perc_gerencia?: number
          perc_inflacao?: number
          perc_mb_esperado?: number
          perc_risco?: number
          perc_treinamento?: number
          projeto_id?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          bdi_venda?: number
          created_at?: string | null
          id?: string
          obra_codigo?: string | null
          perc_custo_direto?: number
          perc_gerencia?: number
          perc_inflacao?: number
          perc_mb_esperado?: number
          perc_risco?: number
          perc_treinamento?: number
          projeto_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "mkp_parametros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      municipios_ibge: {
        Row: {
          codigo_ibge: string
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          uf: string
        }
        Insert: {
          codigo_ibge: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          uf: string
        }
        Update: {
          codigo_ibge?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string
          tipo: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem: string
          tipo?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string
          tipo?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          pedido_id: string
          preco_unitario: number
          quantidade: number
          quantidade_entregue: number | null
          sc_item_id: string | null
          status: string | null
          unidade: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          pedido_id: string
          preco_unitario?: number
          quantidade?: number
          quantidade_entregue?: number | null
          sc_item_id?: string | null
          status?: string | null
          unidade?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          quantidade?: number
          quantidade_entregue?: number | null
          sc_item_id?: string | null
          status?: string | null
          unidade?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_sc_item_id_fkey"
            columns: ["sc_item_id"]
            isOneToOne: false
            referencedRelation: "sc_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_recebimento_itens: {
        Row: {
          id: string
          pedido_item_id: string
          quantidade_recebida: number
          recebimento_id: string
        }
        Insert: {
          id?: string
          pedido_item_id: string
          quantidade_recebida: number
          recebimento_id: string
        }
        Update: {
          id?: string
          pedido_item_id?: string
          quantidade_recebida?: number
          recebimento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_recebimento_itens_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "pedido_recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_recebimentos: {
        Row: {
          created_at: string
          data_recebimento: string
          id: string
          observacao: string | null
          pedido_id: string
          recebido_por: string | null
        }
        Insert: {
          created_at?: string
          data_recebimento?: string
          id?: string
          observacao?: string | null
          pedido_id: string
          recebido_por?: string | null
        }
        Update: {
          created_at?: string
          data_recebimento?: string
          id?: string
          observacao?: string | null
          pedido_id?: string
          recebido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_recebimentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_recebimentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pedidos_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          condicao_pagamento: string | null
          cotacao_id: string
          created_at: string
          criado_por: string | null
          data_emissao: string | null
          data_entrega_real: string | null
          data_prevista_entrega: string | null
          empresa_id: string
          fornecedor_id: string
          frete: number | null
          id: string
          motivo_cancelamento: string | null
          nf_arquivo_url: string | null
          nf_emitida_em: string | null
          nf_numero: string | null
          nf_serie: string | null
          numero: string
          observacoes: string | null
          prazo_entrega_dias: number | null
          projeto_id: string | null
          requisicao_id: string
          status: Database["public"]["Enums"]["pedido_status"]
          updated_at: string
          valor_total: number
        }
        Insert: {
          condicao_pagamento?: string | null
          cotacao_id: string
          created_at?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_entrega_real?: string | null
          data_prevista_entrega?: string | null
          empresa_id: string
          fornecedor_id: string
          frete?: number | null
          id?: string
          motivo_cancelamento?: string | null
          nf_arquivo_url?: string | null
          nf_emitida_em?: string | null
          nf_numero?: string | null
          nf_serie?: string | null
          numero: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          projeto_id?: string | null
          requisicao_id: string
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
          valor_total: number
        }
        Update: {
          condicao_pagamento?: string | null
          cotacao_id?: string
          created_at?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_entrega_real?: string | null
          data_prevista_entrega?: string | null
          empresa_id?: string
          fornecedor_id?: string
          frete?: number | null
          id?: string
          motivo_cancelamento?: string | null
          nf_arquivo_url?: string | null
          nf_emitida_em?: string | null
          nf_numero?: string | null
          nf_serie?: string | null
          numero?: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          projeto_id?: string | null
          requisicao_id?: string
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "pedidos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "pedidos_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          aprovado_por: string | null
          condicao_pagamento: string | null
          cotacao_id: string | null
          created_at: string
          data_aprovacao: string | null
          data_emissao: string
          data_entrega_prevista: string | null
          empresa_id: string
          fornecedor_id: string
          frete: number | null
          id: string
          numero: string
          observacoes: string | null
          requisicao_id: string | null
          status: string
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          aprovado_por?: string | null
          condicao_pagamento?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_emissao?: string
          data_entrega_prevista?: string | null
          empresa_id: string
          fornecedor_id: string
          frete?: number | null
          id?: string
          numero: string
          observacoes?: string | null
          requisicao_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          aprovado_por?: string | null
          condicao_pagamento?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_emissao?: string
          data_entrega_prevista?: string | null
          empresa_id?: string
          fornecedor_id?: string
          frete?: number | null
          id?: string
          numero?: string
          observacoes?: string | null
          requisicao_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aprovado: boolean
          avatar_url: string | null
          cargo: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          empresa_id: string | null
          id: string
          nome: string | null
          pode_aprovar_compra: boolean | null
          pode_criar_cotacao: boolean | null
          pode_criar_pedido: boolean | null
          pode_receber_compra: boolean | null
          pode_rejeitar_compra: boolean | null
          sexo: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado?: boolean
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          empresa_id?: string | null
          id: string
          nome?: string | null
          pode_aprovar_compra?: boolean | null
          pode_criar_cotacao?: boolean | null
          pode_criar_pedido?: boolean | null
          pode_receber_compra?: boolean | null
          pode_rejeitar_compra?: boolean | null
          sexo?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado?: boolean
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string | null
          pode_aprovar_compra?: boolean | null
          pode_criar_cotacao?: boolean | null
          pode_criar_pedido?: boolean | null
          pode_receber_compra?: boolean | null
          pode_rejeitar_compra?: boolean | null
          sexo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_impostos: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          perc_cofins: number
          perc_csll: number | null
          perc_dara: number
          perc_icms: number
          perc_inss: number
          perc_irpj: number | null
          perc_issqn: number
          perc_pis: number
          perc_total_impostos: number | null
          projeto_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          perc_cofins?: number
          perc_csll?: number | null
          perc_dara?: number
          perc_icms?: number
          perc_inss?: number
          perc_irpj?: number | null
          perc_issqn?: number
          perc_pis?: number
          perc_total_impostos?: number | null
          projeto_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          perc_cofins?: number
          perc_csll?: number | null
          perc_dara?: number
          perc_icms?: number
          perc_inss?: number
          perc_irpj?: number | null
          perc_issqn?: number
          perc_pis?: number
          perc_total_impostos?: number | null
          projeto_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "projeto_impostos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      projetos: {
        Row: {
          area_analise: string | null
          area_id: string | null
          cliente: string | null
          cliente_id: string | null
          codigo: string
          contrato_id: string | null
          contrato_ids: string[] | null
          coordenador: string | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          forecast_data: Json | null
          id: string
          nome: string
          status: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          area_analise?: string | null
          area_id?: string | null
          cliente?: string | null
          cliente_id?: string | null
          codigo: string
          contrato_id?: string | null
          contrato_ids?: string[] | null
          coordenador?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          forecast_data?: Json | null
          id?: string
          nome: string
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          area_analise?: string | null
          area_id?: string | null
          cliente?: string | null
          cliente_id?: string | null
          codigo?: string
          contrato_id?: string | null
          contrato_ids?: string[] | null
          coordenador?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          forecast_data?: Json | null
          id?: string
          nome?: string
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_bi_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      recurso_alocacoes: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          projeto_id: string
          recurso_id: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          projeto_id: string
          recurso_id: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          projeto_id?: string
          recurso_id?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurso_alocacoes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      recurso_custos: {
        Row: {
          created_at: string
          custo_unitario: number
          data_fim: string | null
          data_inicio: string
          id: string
          motivo: string | null
          recurso_id: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          data_fim?: string | null
          data_inicio?: string
          id?: string
          motivo?: string | null
          recurso_id: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          data_fim?: string | null
          data_inicio?: string
          id?: string
          motivo?: string | null
          recurso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurso_custos_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["id"]
          },
        ]
      }
      recursos: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          placa: string | null
          status: string
          tipo: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          placa?: string | null
          status?: string
          tipo: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          placa?: string | null
          status?: string
          tipo?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recursos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string | null
          fotos_por_pagina: number | null
          id: string
          is_default: boolean | null
          legenda_padrao_fotos: string | null
          modo_somente_fotos: boolean | null
          mostrar_lpu: boolean | null
          mostrar_valores_site: boolean | null
          nome: string
          projeto_id: string
          tipo_medicao: string | null
        }
        Insert: {
          created_at?: string | null
          fotos_por_pagina?: number | null
          id?: string
          is_default?: boolean | null
          legenda_padrao_fotos?: string | null
          modo_somente_fotos?: boolean | null
          mostrar_lpu?: boolean | null
          mostrar_valores_site?: boolean | null
          nome: string
          projeto_id: string
          tipo_medicao?: string | null
        }
        Update: {
          created_at?: string | null
          fotos_por_pagina?: number | null
          id?: string
          is_default?: boolean | null
          legenda_padrao_fotos?: string | null
          modo_somente_fotos?: boolean | null
          mostrar_lpu?: boolean | null
          mostrar_valores_site?: boolean | null
          nome?: string
          projeto_id?: string
          tipo_medicao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "report_templates_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      requisicao_historico: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          requisicao_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          requisicao_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          requisicao_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisicao_historico_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicao_itens: {
        Row: {
          created_at: string
          descricao_livre: string | null
          especificacao: string | null
          id: string
          quantidade: number
          requisicao_id: string
          sc_item_id: string | null
          unidade: string
        }
        Insert: {
          created_at?: string
          descricao_livre?: string | null
          especificacao?: string | null
          id?: string
          quantidade?: number
          requisicao_id: string
          sc_item_id?: string | null
          unidade?: string
        }
        Update: {
          created_at?: string
          descricao_livre?: string | null
          especificacao?: string | null
          id?: string
          quantidade?: number
          requisicao_id?: string
          sc_item_id?: string | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicao_itens_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_sc_item_id_fkey"
            columns: ["sc_item_id"]
            isOneToOne: false
            referencedRelation: "sc_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicoes_compra: {
        Row: {
          aprovado_por: string | null
          created_at: string
          data_aprovacao: string | null
          data_necessidade: string | null
          empresa_id: string
          id: string
          justificativa: string | null
          local_entrega_id: string | null
          numero: string
          observacoes: string | null
          prioridade: string
          projeto_id: string | null
          solicitante_id: string
          status: string
          updated_at: string
          workflow_status: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_necessidade?: string | null
          empresa_id: string
          id?: string
          justificativa?: string | null
          local_entrega_id?: string | null
          numero: string
          observacoes?: string | null
          prioridade?: string
          projeto_id?: string | null
          solicitante_id: string
          status?: string
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_necessidade?: string | null
          empresa_id?: string
          id?: string
          justificativa?: string | null
          local_entrega_id?: string | null
          numero?: string
          observacoes?: string | null
          prioridade?: string
          projeto_id?: string | null
          solicitante_id?: string
          status?: string
          updated_at?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicoes_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_compra_local_entrega_id_fkey"
            columns: ["local_entrega_id"]
            isOneToOne: false
            referencedRelation: "sc_locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      sc_historico: {
        Row: {
          created_at: string
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          id: string
          observacoes: string | null
          status_anterior: string | null
          status_novo: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          id?: string
          observacoes?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          observacoes?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sc_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_itens: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          codigo: string
          created_at: string
          descricao: string
          empresa_id: string
          especificacao: string | null
          id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          codigo: string
          created_at?: string
          descricao: string
          empresa_id: string
          especificacao?: string | null
          id?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          codigo?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          especificacao?: string | null
          id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sc_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_locais: {
        Row: {
          ativo: boolean | null
          created_at: string
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          projeto_id: string | null
          site_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          projeto_id?: string | null
          site_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          projeto_id?: string | null
          site_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sc_locais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sc_locais_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sc_locais_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sc_locais_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      sgsst_apr: {
        Row: {
          area_id: string | null
          atividade: string
          codigo: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          projeto_id: string
          responsavel_id: string | null
          site_id: string | null
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
          validade: string | null
        }
        Insert: {
          area_id?: string | null
          atividade: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          projeto_id: string
          responsavel_id?: string | null
          site_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
          validade?: string | null
        }
        Update: {
          area_id?: string | null
          atividade?: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          projeto_id?: string
          responsavel_id?: string | null
          site_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_apr_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_apr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_apr_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_apr_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_apr_etapas: {
        Row: {
          apr_id: string
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          observacoes: string | null
          ordem: number
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          apr_id: string
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          ordem?: number
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          apr_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          ordem?: number
          responsavel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_apr_etapas_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_etapas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_apr_historico: {
        Row: {
          apr_id: string
          created_at: string
          empresa_id: string
          id: string
          novo_status: string
          observacao: string | null
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          apr_id: string
          created_at?: string
          empresa_id: string
          id?: string
          novo_status: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          apr_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          novo_status?: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_apr_historico_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_apr_medidas: {
        Row: {
          apr_risco_id: string
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          prazo: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          apr_risco_id: string
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          apr_risco_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_apr_medidas_apr_risco_id_fkey"
            columns: ["apr_risco_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr_riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_medidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_medidas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_apr_participantes: {
        Row: {
          apr_id: string
          colaborador_dados_id: string | null
          confirmacao: boolean | null
          created_at: string
          empresa_id: string
          funcao_id: string | null
          id: string
          participacao: string | null
        }
        Insert: {
          apr_id: string
          colaborador_dados_id?: string | null
          confirmacao?: boolean | null
          created_at?: string
          empresa_id: string
          funcao_id?: string | null
          id?: string
          participacao?: string | null
        }
        Update: {
          apr_id?: string
          colaborador_dados_id?: string | null
          confirmacao?: boolean | null
          created_at?: string
          empresa_id?: string
          funcao_id?: string | null
          id?: string
          participacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_apr_participantes_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_participantes_colaborador_dados_id_fkey"
            columns: ["colaborador_dados_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_participantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_participantes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_apr_riscos: {
        Row: {
          classificacao: string | null
          consequencia: string | null
          created_at: string
          empresa_id: string
          etapa_id: string
          id: string
          nivel_risco: number | null
          perigo: string
          probabilidade: number
          risco: string
          risco_catalogo_id: string | null
          severidade: number
          updated_at: string
        }
        Insert: {
          classificacao?: string | null
          consequencia?: string | null
          created_at?: string
          empresa_id: string
          etapa_id: string
          id?: string
          nivel_risco?: number | null
          perigo: string
          probabilidade: number
          risco: string
          risco_catalogo_id?: string | null
          severidade: number
          updated_at?: string
        }
        Update: {
          classificacao?: string | null
          consequencia?: string | null
          created_at?: string
          empresa_id?: string
          etapa_id?: string
          id?: string
          nivel_risco?: number | null
          perigo?: string
          probabilidade?: number
          risco?: string
          risco_catalogo_id?: string | null
          severidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_apr_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_riscos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_apr_riscos_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_aso_exames: {
        Row: {
          aso_id: string
          created_at: string
          empresa_id: string
          exame_id: string
          id: string
        }
        Insert: {
          aso_id: string
          created_at?: string
          empresa_id: string
          exame_id: string
          id?: string
        }
        Update: {
          aso_id?: string
          created_at?: string
          empresa_id?: string
          exame_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_aso_exames_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "sgsst_asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_aso_exames_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_aso_exames_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "sgsst_exames"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_asos: {
        Row: {
          aptidao: string
          colaborador_id: string
          created_at: string
          crm_coordenador: string | null
          crm_medico: string | null
          data_emissao: string
          data_inicio_restricao: string | null
          data_termino_restricao: string | null
          descricao_restricao: string | null
          descricao_riscos: string | null
          empresa_cnpj: string | null
          empresa_id: string
          empresa_nome: string | null
          exame_id: string | null
          id: string
          medico_coordenador: string | null
          medico_responsavel: string | null
          numero_documento: string | null
          observacoes: string | null
          pcmso_id: string | null
          status: string
          tipo: string
          updated_at: string
          validade: string
        }
        Insert: {
          aptidao?: string
          colaborador_id: string
          created_at?: string
          crm_coordenador?: string | null
          crm_medico?: string | null
          data_emissao?: string
          data_inicio_restricao?: string | null
          data_termino_restricao?: string | null
          descricao_restricao?: string | null
          descricao_riscos?: string | null
          empresa_cnpj?: string | null
          empresa_id: string
          empresa_nome?: string | null
          exame_id?: string | null
          id?: string
          medico_coordenador?: string | null
          medico_responsavel?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          pcmso_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          validade: string
        }
        Update: {
          aptidao?: string
          colaborador_id?: string
          created_at?: string
          crm_coordenador?: string | null
          crm_medico?: string | null
          data_emissao?: string
          data_inicio_restricao?: string | null
          data_termino_restricao?: string | null
          descricao_restricao?: string | null
          descricao_riscos?: string | null
          empresa_cnpj?: string | null
          empresa_id?: string
          empresa_nome?: string | null
          exame_id?: string | null
          id?: string
          medico_coordenador?: string | null
          medico_responsavel?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          pcmso_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_asos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_asos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_asos_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "sgsst_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_asos_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pcmso"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_asos_historico: {
        Row: {
          aso_id: string
          created_at: string
          empresa_id: string
          id: string
          novo_status: string
          observacao: string | null
          operacao: string
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          aso_id: string
          created_at?: string
          empresa_id: string
          id?: string
          novo_status: string
          observacao?: string | null
          operacao: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          aso_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          novo_status?: string
          observacao?: string | null
          operacao?: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_asos_historico_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "sgsst_asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_asos_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_asos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_cats: {
        Row: {
          area_id: string | null
          cid: string | null
          colaborador_id: string | null
          created_at: string
          created_by: string | null
          data_acidente: string
          data_emissao: string
          descricao: string | null
          dias_afastamento: number | null
          empresa_id: string
          houve_obito: boolean
          id: string
          incidente_id: string | null
          numero_cat: string | null
          observacoes: string | null
          projeto_id: string | null
          tipo_cat: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id?: string | null
          cid?: string | null
          colaborador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_acidente: string
          data_emissao?: string
          descricao?: string | null
          dias_afastamento?: number | null
          empresa_id: string
          houve_obito?: boolean
          id?: string
          incidente_id?: string | null
          numero_cat?: string | null
          observacoes?: string | null
          projeto_id?: string | null
          tipo_cat?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string | null
          cid?: string | null
          colaborador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_acidente?: string
          data_emissao?: string
          descricao?: string | null
          dias_afastamento?: number | null
          empresa_id?: string
          houve_obito?: boolean
          id?: string
          incidente_id?: string | null
          numero_cat?: string | null
          observacoes?: string | null
          projeto_id?: string | null
          tipo_cat?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_cats_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_cats_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_cats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_cats_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_cats_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "sgsst_incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_cats_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_cats_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_clinicas: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          crm_responsavel: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          exames_realizados: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_tecnico: string | null
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          crm_responsavel?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          exames_realizados?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_tecnico?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          crm_responsavel?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          exames_realizados?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_tecnico?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_clinicas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_clinicas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_clinicas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_colaborador_dados: {
        Row: {
          area_id: string | null
          centro_custo: string | null
          cep: string | null
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_validade: string | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          endereco_complemento: string | null
          foto_r2_key: string | null
          foto_url: string | null
          funcao_id: string | null
          genero: string | null
          id: string
          matricula: string | null
          nome: string | null
          profile_id: string | null
          projeto_id: string | null
          recurso_id: string | null
          rg: string | null
          status: string
          tamanho_calca: string | null
          tamanho_calcado: string | null
          tamanho_camisa: string | null
          telefone: string | null
          tipo_vinculo: string
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          centro_custo?: string | null
          cep?: string | null
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          endereco_complemento?: string | null
          foto_r2_key?: string | null
          foto_url?: string | null
          funcao_id?: string | null
          genero?: string | null
          id?: string
          matricula?: string | null
          nome?: string | null
          profile_id?: string | null
          projeto_id?: string | null
          recurso_id?: string | null
          rg?: string | null
          status?: string
          tamanho_calca?: string | null
          tamanho_calcado?: string | null
          tamanho_camisa?: string | null
          telefone?: string | null
          tipo_vinculo: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          centro_custo?: string | null
          cep?: string | null
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          endereco_complemento?: string | null
          foto_r2_key?: string | null
          foto_url?: string | null
          funcao_id?: string | null
          genero?: string | null
          id?: string
          matricula?: string | null
          nome?: string | null
          profile_id?: string | null
          projeto_id?: string | null
          recurso_id?: string | null
          rg?: string | null
          status?: string
          tamanho_calca?: string | null
          tamanho_calcado?: string | null
          tamanho_camisa?: string | null
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_colaborador_dados_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_dados_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_colaborador_treinamentos: {
        Row: {
          carga_horaria: number | null
          certificado_r2_key: string | null
          certificado_url: string | null
          colaborador_id: string
          created_at: string
          data_conclusao: string | null
          data_validade: string | null
          empresa_id: string
          id: string
          nome_treinamento: string
          observacoes: string | null
          treinamento_id: string | null
          updated_at: string
        }
        Insert: {
          carga_horaria?: number | null
          certificado_r2_key?: string | null
          certificado_url?: string | null
          colaborador_id: string
          created_at?: string
          data_conclusao?: string | null
          data_validade?: string | null
          empresa_id: string
          id?: string
          nome_treinamento: string
          observacoes?: string | null
          treinamento_id?: string | null
          updated_at?: string
        }
        Update: {
          carga_horaria?: number | null
          certificado_r2_key?: string | null
          certificado_url?: string | null
          colaborador_id?: string
          created_at?: string
          data_conclusao?: string | null
          data_validade?: string | null
          empresa_id?: string
          id?: string
          nome_treinamento?: string
          observacoes?: string | null
          treinamento_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_colaborador_treinamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_colaborador_treinamentos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "sgsst_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_documentos: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          nome: string
          r2_key: string
          r2_url: string
          status: string
          tamanho: number
          tipo_mime: string
          updated_at: string
          updated_by: string | null
          versao_atual: number
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          nome: string
          r2_key: string
          r2_url: string
          status?: string
          tamanho: number
          tipo_mime: string
          updated_at?: string
          updated_by?: string | null
          versao_atual?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          nome?: string
          r2_key?: string
          r2_url?: string
          status?: string
          tamanho?: number
          tipo_mime?: string
          updated_at?: string
          updated_by?: string | null
          versao_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_documentos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_documentos_historico: {
        Row: {
          created_at: string
          documento_id: string | null
          empresa_id: string
          id: string
          observacao: string | null
          operacao: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          documento_id?: string | null
          empresa_id: string
          id?: string
          observacao?: string | null
          operacao: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          documento_id?: string | null
          empresa_id?: string
          id?: string
          observacao?: string | null
          operacao?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_documentos_historico_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "sgsst_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_documentos_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_documentos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_documentos_versoes: {
        Row: {
          created_at: string
          documento_id: string
          empresa_id: string
          id: string
          numero_versao: number
          observacao: string | null
          r2_key: string
          r2_url: string
          tamanho: number
          tipo_mime: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          documento_id: string
          empresa_id: string
          id?: string
          numero_versao: number
          observacao?: string | null
          r2_key: string
          r2_url: string
          tamanho: number
          tipo_mime: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          documento_id?: string
          empresa_id?: string
          id?: string
          numero_versao?: number
          observacao?: string | null
          r2_key?: string
          r2_url?: string
          tamanho?: number
          tipo_mime?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_documentos_versoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "sgsst_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_documentos_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_documentos_versoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_epi_devolucoes: {
        Row: {
          condicao_epi: string
          created_at: string
          data_devolucao: string
          empresa_id: string
          entrega_id: string
          id: string
          motivo: string | null
          observacao: string | null
          quantidade_devolvida: number
          responsavel_devolucao_id: string | null
        }
        Insert: {
          condicao_epi?: string
          created_at?: string
          data_devolucao?: string
          empresa_id: string
          entrega_id: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          quantidade_devolvida?: number
          responsavel_devolucao_id?: string | null
        }
        Update: {
          condicao_epi?: string
          created_at?: string
          data_devolucao?: string
          empresa_id?: string
          entrega_id?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          quantidade_devolvida?: number
          responsavel_devolucao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_epi_devolucoes_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "sgsst_epi_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_epi_devolucoes_responsavel_devolucao_id_fkey"
            columns: ["responsavel_devolucao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_epi_entregas: {
        Row: {
          colaborador_id: string
          confirmacao_recebimento: boolean
          created_at: string
          data_entrega: string
          empresa_id: string
          epi_id: string
          id: string
          motivo: string
          observacao: string | null
          quantidade: number
          responsavel_entrega_id: string | null
          tamanho_modelo: string | null
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          confirmacao_recebimento?: boolean
          created_at?: string
          data_entrega?: string
          empresa_id: string
          epi_id: string
          id?: string
          motivo?: string
          observacao?: string | null
          quantidade?: number
          responsavel_entrega_id?: string | null
          tamanho_modelo?: string | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          confirmacao_recebimento?: boolean
          created_at?: string
          data_entrega?: string
          empresa_id?: string
          epi_id?: string
          id?: string
          motivo?: string
          observacao?: string | null
          quantidade?: number
          responsavel_entrega_id?: string | null
          tamanho_modelo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_epi_entregas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_epi_entregas_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "sgsst_epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_epi_entregas_responsavel_entrega_id_fkey"
            columns: ["responsavel_entrega_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_epi_historico: {
        Row: {
          colaborador_id: string | null
          created_at: string
          empresa_id: string
          epi_id: string | null
          id: string
          observacao: string | null
          operacao: string
          quantidade: number | null
          usuario_id: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          empresa_id: string
          epi_id?: string | null
          id?: string
          observacao?: string | null
          operacao: string
          quantidade?: number | null
          usuario_id?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          empresa_id?: string
          epi_id?: string | null
          id?: string
          observacao?: string | null
          operacao?: string
          quantidade?: number | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_epi_historico_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_epi_historico_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "sgsst_epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_epi_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_epis: {
        Row: {
          abaixo_minimo: boolean | null
          ca: string
          categoria: string
          codigo: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          estoque_atual: number
          estoque_minimo: number
          fabricante: string | null
          id: string
          modelo: string | null
          nome: string
          status: string
          unidade_medida: string
          updated_at: string
          updated_by: string | null
          validade_ca: string | null
        }
        Insert: {
          abaixo_minimo?: boolean | null
          ca: string
          categoria?: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          estoque_atual?: number
          estoque_minimo?: number
          fabricante?: string | null
          id?: string
          modelo?: string | null
          nome: string
          status?: string
          unidade_medida?: string
          updated_at?: string
          updated_by?: string | null
          validade_ca?: string | null
        }
        Update: {
          abaixo_minimo?: boolean | null
          ca?: string
          categoria?: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          estoque_atual?: number
          estoque_minimo?: number
          fabricante?: string | null
          id?: string
          modelo?: string | null
          nome?: string
          status?: string
          unidade_medida?: string
          updated_at?: string
          updated_by?: string | null
          validade_ca?: string | null
        }
        Relationships: []
      }
      sgsst_exames: {
        Row: {
          clinica_id: string | null
          colaborador_id: string
          created_at: string
          data_agendada: string | null
          data_realizacao: string | null
          data_solicitacao: string
          empresa_id: string
          hora_agendada: string | null
          id: string
          medico_responsavel: string | null
          motivo_remarcacao: string | null
          natureza: string
          nome_exame: string
          observacoes: string | null
          pcmso_exame_id: string | null
          pcmso_id: string | null
          remarcacoes: number
          resultado: string | null
          resultado_classificacao: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          clinica_id?: string | null
          colaborador_id: string
          created_at?: string
          data_agendada?: string | null
          data_realizacao?: string | null
          data_solicitacao?: string
          empresa_id: string
          hora_agendada?: string | null
          id?: string
          medico_responsavel?: string | null
          motivo_remarcacao?: string | null
          natureza?: string
          nome_exame: string
          observacoes?: string | null
          pcmso_exame_id?: string | null
          pcmso_id?: string | null
          remarcacoes?: number
          resultado?: string | null
          resultado_classificacao?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string | null
          colaborador_id?: string
          created_at?: string
          data_agendada?: string | null
          data_realizacao?: string | null
          data_solicitacao?: string
          empresa_id?: string
          hora_agendada?: string | null
          id?: string
          medico_responsavel?: string | null
          motivo_remarcacao?: string | null
          natureza?: string
          nome_exame?: string
          observacoes?: string | null
          pcmso_exame_id?: string | null
          pcmso_id?: string | null
          remarcacoes?: number
          resultado?: string | null
          resultado_classificacao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_exames_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "sgsst_clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_exames_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_exames_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_exames_pcmso_exame_id_fkey"
            columns: ["pcmso_exame_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pcmso_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_exames_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pcmso"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_funcao_epis: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          epi_id: string
          funcao_id: string
          id: string
          obrigatorio: boolean
          observacoes: string | null
          periodicidade_troca_meses: number | null
          quantidade_padrao: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          epi_id: string
          funcao_id: string
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          periodicidade_troca_meses?: number | null
          quantidade_padrao?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          epi_id?: string
          funcao_id?: string
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          periodicidade_troca_meses?: number | null
          quantidade_padrao?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_funcao_epis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_epis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_epis_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "sgsst_epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_epis_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_funcao_riscos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          funcao_id: string
          id: string
          observacoes: string | null
          risco_catalogo_id: string
          tempo_exposicao: string | null
          tipo_exposicao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          funcao_id: string
          id?: string
          observacoes?: string | null
          risco_catalogo_id: string
          tempo_exposicao?: string | null
          tipo_exposicao?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          funcao_id?: string
          id?: string
          observacoes?: string | null
          risco_catalogo_id?: string
          tempo_exposicao?: string | null
          tipo_exposicao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_funcao_riscos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_riscos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_riscos_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_funcao_treinamentos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          funcao_id: string
          id: string
          obrigatorio: boolean
          observacoes: string | null
          treinamento_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          funcao_id: string
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          treinamento_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          funcao_id?: string
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          treinamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_funcao_treinamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_treinamentos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_funcao_treinamentos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "sgsst_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_funcoes: {
        Row: {
          cbo: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          requisitos_minimos: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          cbo?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          requisitos_minimos?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          cbo?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          requisitos_minimos?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_funcoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_hht: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          empresa_id: string
          horas: number
          id: string
          media_trabalhadores: number | null
          mes: number
          observacao: string | null
          origem: string
          projeto_id: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          empresa_id: string
          horas: number
          id?: string
          media_trabalhadores?: number | null
          mes: number
          observacao?: string | null
          origem?: string
          projeto_id?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          horas?: number
          id?: string
          media_trabalhadores?: number | null
          mes?: number
          observacao?: string | null
          origem?: string
          projeto_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_hht_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_hht_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_hht_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      sgsst_incidentes: {
        Row: {
          apr_id: string | null
          area_id: string | null
          cat_emitida: boolean
          codigo: string | null
          created_at: string
          created_by: string | null
          data_afastamento: string | null
          data_ocorrencia: string
          data_retorno: string | null
          descricao: string
          dias_debitados: number | null
          dias_perdidos: number | null
          empresa_id: string
          gravidade: string
          hora_ocorrencia: string | null
          id: string
          inspecao_id: string | null
          local_ocorrencia: string | null
          observacoes: string | null
          pgr_id: string | null
          projeto_id: string
          pt_id: string | null
          responsavel_registro_id: string | null
          site_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          apr_id?: string | null
          area_id?: string | null
          cat_emitida?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_afastamento?: string | null
          data_ocorrencia?: string
          data_retorno?: string | null
          descricao: string
          dias_debitados?: number | null
          dias_perdidos?: number | null
          empresa_id: string
          gravidade?: string
          hora_ocorrencia?: string | null
          id?: string
          inspecao_id?: string | null
          local_ocorrencia?: string | null
          observacoes?: string | null
          pgr_id?: string | null
          projeto_id: string
          pt_id?: string | null
          responsavel_registro_id?: string | null
          site_id?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apr_id?: string | null
          area_id?: string | null
          cat_emitida?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_afastamento?: string | null
          data_ocorrencia?: string
          data_retorno?: string | null
          descricao?: string
          dias_debitados?: number | null
          dias_perdidos?: number | null
          empresa_id?: string
          gravidade?: string
          hora_ocorrencia?: string | null
          id?: string
          inspecao_id?: string | null
          local_ocorrencia?: string | null
          observacoes?: string | null
          pgr_id?: string | null
          projeto_id?: string
          pt_id?: string | null
          responsavel_registro_id?: string | null
          site_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_incidentes_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_inspecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_responsavel_registro_id_fkey"
            columns: ["responsavel_registro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_incidentes_acoes: {
        Row: {
          created_at: string
          data_conclusao: string | null
          descricao: string
          empresa_id: string
          id: string
          incidente_id: string
          observacao: string | null
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          descricao: string
          empresa_id: string
          id?: string
          incidente_id: string
          observacao?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          incidente_id?: string
          observacao?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_incidentes_acoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_acoes_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "sgsst_incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_acoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_incidentes_envolvidos: {
        Row: {
          colaborador_dados_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          funcao_id: string | null
          id: string
          incidente_id: string
          observacoes: string | null
          tipo_envolvimento: string
        }
        Insert: {
          colaborador_dados_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          funcao_id?: string | null
          id?: string
          incidente_id: string
          observacoes?: string | null
          tipo_envolvimento: string
        }
        Update: {
          colaborador_dados_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          funcao_id?: string | null
          id?: string
          incidente_id?: string
          observacoes?: string | null
          tipo_envolvimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_incidentes_envolvidos_colaborador_dados_id_fkey"
            columns: ["colaborador_dados_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_envolvidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_envolvidos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_envolvidos_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "sgsst_incidentes"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_incidentes_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          incidente_id: string
          novo_status: string
          observacao: string | null
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          incidente_id: string
          novo_status: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          incidente_id?: string
          novo_status?: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_incidentes_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_historico_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "sgsst_incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_incidentes_investigacao: {
        Row: {
          causas_basicas: string | null
          causas_imediatas: string | null
          causas_raiz: string | null
          conclusao: string | null
          created_at: string
          data_investigacao: string | null
          descricao_investigacao: string
          empresa_id: string
          fatores_contribuintes: string | null
          fatos_observados: string | null
          id: string
          incidente_id: string
          responsavel_id: string | null
          risco_catalogo_id: string | null
          updated_at: string
        }
        Insert: {
          causas_basicas?: string | null
          causas_imediatas?: string | null
          causas_raiz?: string | null
          conclusao?: string | null
          created_at?: string
          data_investigacao?: string | null
          descricao_investigacao: string
          empresa_id: string
          fatores_contribuintes?: string | null
          fatos_observados?: string | null
          id?: string
          incidente_id: string
          responsavel_id?: string | null
          risco_catalogo_id?: string | null
          updated_at?: string
        }
        Update: {
          causas_basicas?: string | null
          causas_imediatas?: string | null
          causas_raiz?: string | null
          conclusao?: string | null
          created_at?: string
          data_investigacao?: string | null
          descricao_investigacao?: string
          empresa_id?: string
          fatores_contribuintes?: string | null
          fatos_observados?: string | null
          id?: string
          incidente_id?: string
          responsavel_id?: string | null
          risco_catalogo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_incidentes_investigacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_investigacao_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "sgsst_incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_investigacao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_incidentes_investigacao_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_inspecoes: {
        Row: {
          apr_id: string | null
          area_id: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          data_execucao: string | null
          data_planejada: string
          empresa_id: string
          id: string
          observacoes: string | null
          pgr_id: string | null
          projeto_id: string
          pt_id: string | null
          responsavel_id: string | null
          site_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          apr_id?: string | null
          area_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_execucao?: string | null
          data_planejada?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          pgr_id?: string | null
          projeto_id: string
          pt_id?: string | null
          responsavel_id?: string | null
          site_id?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apr_id?: string | null
          area_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_execucao?: string | null
          data_planejada?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          pgr_id?: string | null
          projeto_id?: string
          pt_id?: string | null
          responsavel_id?: string | null
          site_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_inspecoes_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_inspecoes_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          inspecao_id: string
          novo_status: string
          observacao: string | null
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          inspecao_id: string
          novo_status: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          inspecao_id?: string
          novo_status?: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_inspecoes_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_historico_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_inspecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_inspecoes_itens: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          inspecao_id: string
          obrigatorio: boolean | null
          observacao: string | null
          ordem: number
          resposta: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          inspecao_id: string
          obrigatorio?: boolean | null
          observacao?: string | null
          ordem?: number
          resposta?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          inspecao_id?: string
          obrigatorio?: boolean | null
          observacao?: string | null
          ordem?: number
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_inspecoes_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_itens_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_inspecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_inspecoes_nao_conformidades: {
        Row: {
          created_at: string
          criticidade: string
          descricao: string
          empresa_id: string
          evidencia: string | null
          id: string
          inspecao_id: string
          item_id: string | null
          observacao: string | null
          prazo: string | null
          responsavel_id: string | null
          risco_catalogo_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criticidade?: string
          descricao: string
          empresa_id: string
          evidencia?: string | null
          id?: string
          inspecao_id: string
          item_id?: string | null
          observacao?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          risco_catalogo_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criticidade?: string
          descricao?: string
          empresa_id?: string
          evidencia?: string | null
          id?: string
          inspecao_id?: string
          item_id?: string | null
          observacao?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          risco_catalogo_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_inspecoes_nao_conformidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_nao_conformidades_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_inspecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_nao_conformidades_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sgsst_inspecoes_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_nao_conformidades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_inspecoes_nao_conformidades_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_nao_conformidades: {
        Row: {
          area_id: string | null
          causa: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          criticidade: string
          data_identificacao: string
          data_verificacao: string | null
          descricao: string
          empresa_id: string
          id: string
          observacao_verificacao: string | null
          observacoes: string | null
          origem_id: string | null
          origem_tipo: string
          prazo: string | null
          projeto_id: string
          responsavel_id: string | null
          resultado_verificacao: string | null
          site_id: string | null
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
          verificador_id: string | null
        }
        Insert: {
          area_id?: string | null
          causa?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          data_identificacao?: string
          data_verificacao?: string | null
          descricao: string
          empresa_id: string
          id?: string
          observacao_verificacao?: string | null
          observacoes?: string | null
          origem_id?: string | null
          origem_tipo?: string
          prazo?: string | null
          projeto_id: string
          responsavel_id?: string | null
          resultado_verificacao?: string | null
          site_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
          verificador_id?: string | null
        }
        Update: {
          area_id?: string | null
          causa?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          data_identificacao?: string
          data_verificacao?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          observacao_verificacao?: string | null
          observacoes?: string | null
          origem_id?: string | null
          origem_tipo?: string
          prazo?: string | null
          projeto_id?: string
          responsavel_id?: string | null
          resultado_verificacao?: string | null
          site_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          verificador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_nao_conformidades_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_verificador_id_fkey"
            columns: ["verificador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_nao_conformidades_acoes: {
        Row: {
          created_at: string
          data_conclusao: string | null
          descricao: string
          empresa_id: string
          evidencia: string | null
          id: string
          nao_conformidade_id: string
          observacao: string | null
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          descricao: string
          empresa_id: string
          evidencia?: string | null
          id?: string
          nao_conformidade_id: string
          observacao?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          descricao?: string
          empresa_id?: string
          evidencia?: string | null
          id?: string
          nao_conformidade_id?: string
          observacao?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_nao_conformidades_acoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_acoes_nao_conformidade_id_fkey"
            columns: ["nao_conformidade_id"]
            isOneToOne: false
            referencedRelation: "sgsst_nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_acoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_nao_conformidades_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nao_conformidade_id: string
          novo_status: string
          observacao: string | null
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nao_conformidade_id: string
          novo_status: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nao_conformidade_id?: string
          novo_status?: string
          observacao?: string | null
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_nao_conformidades_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_historico_nao_conformidade_id_fkey"
            columns: ["nao_conformidade_id"]
            isOneToOne: false
            referencedRelation: "sgsst_nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_nao_conformidades_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pcmso: {
        Row: {
          agravos_saude: string | null
          ano_referencia: number | null
          codigo: string | null
          created_at: string
          created_by: string | null
          criterios_conduta: string | null
          crm_medico: string | null
          data_inicio: string
          data_revisao: string | null
          empresa_id: string
          id: string
          medico_responsavel: string | null
          objetivo: string | null
          observacoes: string | null
          projeto_id: string | null
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agravos_saude?: string | null
          ano_referencia?: number | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          criterios_conduta?: string | null
          crm_medico?: string | null
          data_inicio?: string
          data_revisao?: string | null
          empresa_id: string
          id?: string
          medico_responsavel?: string | null
          objetivo?: string | null
          observacoes?: string | null
          projeto_id?: string | null
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agravos_saude?: string | null
          ano_referencia?: number | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          criterios_conduta?: string | null
          crm_medico?: string | null
          data_inicio?: string
          data_revisao?: string | null
          empresa_id?: string
          id?: string
          medico_responsavel?: string | null
          objetivo?: string | null
          observacoes?: string | null
          projeto_id?: string | null
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pcmso_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pcmso_exames: {
        Row: {
          base_legal: string | null
          created_at: string
          empresa_id: string
          faixa_etaria: string | null
          funcao_id: string | null
          grupo_risco: string | null
          id: string
          justificativa_tecnica: string | null
          nome_exame: string
          observacoes: string | null
          pcmso_id: string
          periodicidade_meses: number | null
          risco_catalogo_id: string | null
          tipo_exame: string
        }
        Insert: {
          base_legal?: string | null
          created_at?: string
          empresa_id: string
          faixa_etaria?: string | null
          funcao_id?: string | null
          grupo_risco?: string | null
          id?: string
          justificativa_tecnica?: string | null
          nome_exame: string
          observacoes?: string | null
          pcmso_id: string
          periodicidade_meses?: number | null
          risco_catalogo_id?: string | null
          tipo_exame: string
        }
        Update: {
          base_legal?: string | null
          created_at?: string
          empresa_id?: string
          faixa_etaria?: string | null
          funcao_id?: string | null
          grupo_risco?: string | null
          id?: string
          justificativa_tecnica?: string | null
          nome_exame?: string
          observacoes?: string | null
          pcmso_id?: string
          periodicidade_meses?: number | null
          risco_catalogo_id?: string | null
          tipo_exame?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pcmso_exames_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_exames_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_exames_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pcmso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_exames_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pcmso_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          novo_status: string
          observacao: string | null
          pcmso_id: string
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          novo_status: string
          observacao?: string | null
          pcmso_id: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          novo_status?: string
          observacao?: string | null
          pcmso_id?: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pcmso_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_historico_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pcmso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pcmso_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pgr: {
        Row: {
          codigo: string | null
          created_at: string
          created_by: string | null
          data_inicio: string
          data_revisao: string | null
          empresa_cnpj: string | null
          empresa_id: string
          empresa_nome: string | null
          id: string
          metodologia: string | null
          objetivo: string | null
          observacoes: string | null
          periodicidade_revisao_meses: number
          projeto_id: string
          registro_responsavel: string | null
          responsavel_id: string | null
          responsavel_tecnico: string | null
          site_id: string | null
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          data_revisao?: string | null
          empresa_cnpj?: string | null
          empresa_id: string
          empresa_nome?: string | null
          id?: string
          metodologia?: string | null
          objetivo?: string | null
          observacoes?: string | null
          periodicidade_revisao_meses?: number
          projeto_id: string
          registro_responsavel?: string | null
          responsavel_id?: string | null
          responsavel_tecnico?: string | null
          site_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          data_revisao?: string | null
          empresa_cnpj?: string | null
          empresa_id?: string
          empresa_nome?: string | null
          id?: string
          metodologia?: string | null
          objetivo?: string | null
          observacoes?: string | null
          periodicidade_revisao_meses?: number
          projeto_id?: string
          registro_responsavel?: string | null
          responsavel_id?: string | null
          responsavel_tecnico?: string | null
          site_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pgr_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_pgr_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pgr_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          observacao: string | null
          operacao: string
          pgr_id: string
          status_anterior: string | null
          status_novo: string | null
          usuario_id: string | null
          versao: number | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          operacao: string
          pgr_id: string
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
          versao?: number | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          operacao?: string
          pgr_id?: string
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pgr_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_historico_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pgr_inventario: {
        Row: {
          area_id: string | null
          atividade: string
          classificacao: string | null
          consequencia: string | null
          created_at: string
          created_by: string | null
          data_medicao: string | null
          descricao_local: string | null
          empresa_id: string
          fonte_geradora: string | null
          grupos_expostos: string | null
          id: string
          intensidade_medida: number | null
          limite_tolerancia_aplicado: number | null
          medidas_existentes: string | null
          medidas_necessarias: string | null
          metodologia_medicao: string | null
          nivel_risco: number | null
          perigo: string
          pgr_id: string
          prazo: string | null
          probabilidade: number
          responsavel_id: string | null
          resultado_avaliacao: string | null
          risco_catalogo_id: string | null
          severidade: number
          status: string
          tecnica_avaliacao: string | null
          tempo_exposicao: string | null
          tipo_exposicao: string | null
          trabalhadores_expostos: number | null
          unidade_medida: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id?: string | null
          atividade: string
          classificacao?: string | null
          consequencia?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao?: string | null
          descricao_local?: string | null
          empresa_id: string
          fonte_geradora?: string | null
          grupos_expostos?: string | null
          id?: string
          intensidade_medida?: number | null
          limite_tolerancia_aplicado?: number | null
          medidas_existentes?: string | null
          medidas_necessarias?: string | null
          metodologia_medicao?: string | null
          nivel_risco?: number | null
          perigo: string
          pgr_id: string
          prazo?: string | null
          probabilidade: number
          responsavel_id?: string | null
          resultado_avaliacao?: string | null
          risco_catalogo_id?: string | null
          severidade: number
          status?: string
          tecnica_avaliacao?: string | null
          tempo_exposicao?: string | null
          tipo_exposicao?: string | null
          trabalhadores_expostos?: number | null
          unidade_medida?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string | null
          atividade?: string
          classificacao?: string | null
          consequencia?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao?: string | null
          descricao_local?: string | null
          empresa_id?: string
          fonte_geradora?: string | null
          grupos_expostos?: string | null
          id?: string
          intensidade_medida?: number | null
          limite_tolerancia_aplicado?: number | null
          medidas_existentes?: string | null
          medidas_necessarias?: string | null
          metodologia_medicao?: string | null
          nivel_risco?: number | null
          perigo?: string
          pgr_id?: string
          prazo?: string | null
          probabilidade?: number
          responsavel_id?: string | null
          resultado_avaliacao?: string | null
          risco_catalogo_id?: string | null
          severidade?: number
          status?: string
          tecnica_avaliacao?: string | null
          tempo_exposicao?: string | null
          tipo_exposicao?: string | null
          trabalhadores_expostos?: number | null
          unidade_medida?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pgr_inventario_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pgr_inventario_funcoes: {
        Row: {
          created_at: string
          empresa_id: string
          funcao_id: string
          id: string
          inventario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          funcao_id: string
          id?: string
          inventario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          funcao_id?: string
          id?: string
          inventario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pgr_inventario_funcoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_funcoes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_inventario_funcoes_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pgr_inventario"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pgr_medidas_controle: {
        Row: {
          created_at: string
          created_by: string | null
          data_implementacao: string | null
          data_verificacao: string | null
          descricao: string
          empresa_id: string
          forma_acompanhamento: string | null
          id: string
          inventario_id: string
          observacao: string | null
          observacao_verificacao: string | null
          prazo: string | null
          responsavel_id: string | null
          resultado_verificacao: string | null
          status: string
          tipo: string
          updated_at: string
          updated_by: string | null
          verificador_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_implementacao?: string | null
          data_verificacao?: string | null
          descricao: string
          empresa_id: string
          forma_acompanhamento?: string | null
          id?: string
          inventario_id: string
          observacao?: string | null
          observacao_verificacao?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          resultado_verificacao?: string | null
          status?: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
          verificador_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_implementacao?: string | null
          data_verificacao?: string | null
          descricao?: string
          empresa_id?: string
          forma_acompanhamento?: string | null
          id?: string
          inventario_id?: string
          observacao?: string | null
          observacao_verificacao?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          resultado_verificacao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          verificador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pgr_medidas_controle_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_medidas_controle_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_medidas_controle_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pgr_inventario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_medidas_controle_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_medidas_controle_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pgr_medidas_controle_verificador_id_fkey"
            columns: ["verificador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt: {
        Row: {
          apr_id: string | null
          area_id: string | null
          atividade: string
          bloqueio_energias: boolean | null
          codigo: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          empresa_id: string
          id: string
          local_execucao: string | null
          observacoes: string | null
          plano_resgate: string | null
          projeto_id: string
          responsavel_id: string | null
          site_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          updated_by: string | null
          validade_fim: string | null
          ventilacao_adotada: string | null
        }
        Insert: {
          apr_id?: string | null
          area_id?: string | null
          atividade: string
          bloqueio_energias?: boolean | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          empresa_id: string
          id?: string
          local_execucao?: string | null
          observacoes?: string | null
          plano_resgate?: string | null
          projeto_id: string
          responsavel_id?: string | null
          site_id?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
          validade_fim?: string | null
          ventilacao_adotada?: string | null
        }
        Update: {
          apr_id?: string | null
          area_id?: string | null
          atividade?: string
          bloqueio_energias?: boolean | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          empresa_id?: string
          id?: string
          local_execucao?: string | null
          observacoes?: string | null
          plano_resgate?: string | null
          projeto_id?: string
          responsavel_id?: string | null
          site_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          validade_fim?: string | null
          ventilacao_adotada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "sgsst_apr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_pt_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_pt_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt_checklist: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          item: string
          obrigatorio: boolean | null
          observacao: string | null
          pt_id: string
          resposta: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          item: string
          obrigatorio?: boolean | null
          observacao?: string | null
          pt_id: string
          resposta?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          item?: string
          obrigatorio?: boolean | null
          observacao?: string | null
          pt_id?: string
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_checklist_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_checklist_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          novo_status: string
          observacao: string | null
          pt_id: string
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          novo_status: string
          observacao?: string | null
          pt_id: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          novo_status?: string
          observacao?: string | null
          pt_id?: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_historico_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt_medicoes_atmosfera: {
        Row: {
          calibracao_validade: string | null
          causa_variacao_conhecida: boolean
          contaminante_limite: number | null
          contaminante_nome: string | null
          contaminante_unidade: string | null
          contaminante_valor: number | null
          created_at: string
          created_by: string | null
          empresa_id: string
          equipamento: string | null
          id: string
          inflamaveis_percentual_lie: number | null
          medido_em: string
          medido_por_id: string | null
          medido_por_nome: string | null
          momento: string
          numero_serie: string | null
          observacoes: string | null
          oxigenio_percentual: number | null
          pt_id: string
          updated_at: string
        }
        Insert: {
          calibracao_validade?: string | null
          causa_variacao_conhecida?: boolean
          contaminante_limite?: number | null
          contaminante_nome?: string | null
          contaminante_unidade?: string | null
          contaminante_valor?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          equipamento?: string | null
          id?: string
          inflamaveis_percentual_lie?: number | null
          medido_em?: string
          medido_por_id?: string | null
          medido_por_nome?: string | null
          momento?: string
          numero_serie?: string | null
          observacoes?: string | null
          oxigenio_percentual?: number | null
          pt_id: string
          updated_at?: string
        }
        Update: {
          calibracao_validade?: string | null
          causa_variacao_conhecida?: boolean
          contaminante_limite?: number | null
          contaminante_nome?: string | null
          contaminante_unidade?: string | null
          contaminante_valor?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          equipamento?: string | null
          id?: string
          inflamaveis_percentual_lie?: number | null
          medido_em?: string
          medido_por_id?: string | null
          medido_por_nome?: string | null
          momento?: string
          numero_serie?: string | null
          observacoes?: string | null
          oxigenio_percentual?: number | null
          pt_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_medicoes_atmosfera_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_medicoes_atmosfera_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_medicoes_atmosfera_medido_por_id_fkey"
            columns: ["medido_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_medicoes_atmosfera_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt_medidas: {
        Row: {
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          pt_risco_id: string
          responsavel_id: string | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          pt_risco_id: string
          responsavel_id?: string | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          pt_risco_id?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_medidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_medidas_pt_risco_id_fkey"
            columns: ["pt_risco_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt_riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_medidas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt_participantes: {
        Row: {
          colaborador_dados_id: string | null
          confirmacao: boolean | null
          created_at: string
          empresa_id: string
          funcao_id: string | null
          id: string
          pt_id: string
          responsabilidade: string | null
        }
        Insert: {
          colaborador_dados_id?: string | null
          confirmacao?: boolean | null
          created_at?: string
          empresa_id: string
          funcao_id?: string | null
          id?: string
          pt_id: string
          responsabilidade?: string | null
        }
        Update: {
          colaborador_dados_id?: string | null
          confirmacao?: boolean | null
          created_at?: string
          empresa_id?: string
          funcao_id?: string | null
          id?: string
          pt_id?: string
          responsabilidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_participantes_colaborador_dados_id_fkey"
            columns: ["colaborador_dados_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_participantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_participantes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_participantes_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_pt_riscos: {
        Row: {
          classificacao: string | null
          consequencia: string | null
          created_at: string
          empresa_id: string
          id: string
          nivel_risco: number | null
          perigo: string
          probabilidade: number
          pt_id: string
          risco: string
          risco_catalogo_id: string | null
          severidade: number
        }
        Insert: {
          classificacao?: string | null
          consequencia?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nivel_risco?: number | null
          perigo: string
          probabilidade: number
          pt_id: string
          risco: string
          risco_catalogo_id?: string | null
          severidade: number
        }
        Update: {
          classificacao?: string | null
          consequencia?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nivel_risco?: number | null
          perigo?: string
          probabilidade?: number
          pt_id?: string
          risco?: string
          risco_catalogo_id?: string | null
          severidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_pt_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_riscos_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "sgsst_pt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_pt_riscos_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "sgsst_riscos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_riscos_catalogo: {
        Row: {
          agente: string | null
          base_legal: string | null
          categoria: string
          codigo: string | null
          consequencia: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          fonte_geradora: string | null
          id: string
          limite_tolerancia: number | null
          nome: string
          status: string
          tecnica_avaliacao: string | null
          unidade_medida: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agente?: string | null
          base_legal?: string | null
          categoria: string
          codigo?: string | null
          consequencia?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          fonte_geradora?: string | null
          id?: string
          limite_tolerancia?: number | null
          nome: string
          status?: string
          tecnica_avaliacao?: string | null
          unidade_medida?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agente?: string | null
          base_legal?: string | null
          categoria?: string
          codigo?: string | null
          consequencia?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          fonte_geradora?: string | null
          id?: string
          limite_tolerancia?: number | null
          nome?: string
          status?: string
          tecnica_avaliacao?: string | null
          unidade_medida?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_riscos_catalogo_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_riscos_catalogo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_riscos_catalogo_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_treinamentos: {
        Row: {
          area_id: string | null
          base_legal: string | null
          carga_horaria: number
          categoria: string
          codigo: string | null
          conteudo_programatico: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          funcao_id: string | null
          id: string
          nome: string
          obrigatorio: boolean
          observacoes: string | null
          projeto_id: string | null
          site_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          validade_meses: number | null
        }
        Insert: {
          area_id?: string | null
          base_legal?: string | null
          carga_horaria?: number
          categoria: string
          codigo?: string | null
          conteudo_programatico?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          funcao_id?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean
          observacoes?: string | null
          projeto_id?: string | null
          site_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          validade_meses?: number | null
        }
        Update: {
          area_id?: string | null
          base_legal?: string | null
          carga_horaria?: number
          categoria?: string
          codigo?: string | null
          conteudo_programatico?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          funcao_id?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean
          observacoes?: string | null
          projeto_id?: string | null
          site_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          validade_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_treinamentos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "sgsst_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_treinamentos_historico: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          observacao: string | null
          operacao: string
          treinamento_id: string | null
          turma_id: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          operacao: string
          treinamento_id?: string | null
          turma_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          operacao?: string
          treinamento_id?: string | null
          turma_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_treinamentos_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_historico_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "sgsst_treinamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_historico_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "sgsst_treinamentos_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_treinamentos_participantes: {
        Row: {
          aprovacao: boolean | null
          certificado: string | null
          colaborador_id: string
          created_at: string
          data_conclusao: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          percentual_presenca: number | null
          presenca: boolean
          resultado: string
          turma_id: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          aprovacao?: boolean | null
          certificado?: string | null
          colaborador_id: string
          created_at?: string
          data_conclusao?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          percentual_presenca?: number | null
          presenca?: boolean
          resultado?: string
          turma_id: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          aprovacao?: boolean | null
          certificado?: string | null
          colaborador_id?: string
          created_at?: string
          data_conclusao?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          percentual_presenca?: number | null
          presenca?: boolean
          resultado?: string
          turma_id?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_treinamentos_participantes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "sgsst_colaborador_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_participantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_participantes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "sgsst_treinamentos_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      sgsst_treinamentos_turmas: {
        Row: {
          capacidade: number | null
          carga_horaria: number | null
          codigo_turma: string | null
          created_at: string
          data_final: string | null
          data_inicial: string
          empresa_cnpj: string | null
          empresa_id: string
          empresa_nome: string | null
          id: string
          instrutor: string | null
          instrutor_qualificacao: string | null
          local: string | null
          modalidade: string
          observacoes: string | null
          registro_responsavel: string | null
          responsavel_tecnico: string | null
          status: string
          tipo_treinamento: string
          treinamento_id: string
          updated_at: string
        }
        Insert: {
          capacidade?: number | null
          carga_horaria?: number | null
          codigo_turma?: string | null
          created_at?: string
          data_final?: string | null
          data_inicial?: string
          empresa_cnpj?: string | null
          empresa_id: string
          empresa_nome?: string | null
          id?: string
          instrutor?: string | null
          instrutor_qualificacao?: string | null
          local?: string | null
          modalidade?: string
          observacoes?: string | null
          registro_responsavel?: string | null
          responsavel_tecnico?: string | null
          status?: string
          tipo_treinamento?: string
          treinamento_id: string
          updated_at?: string
        }
        Update: {
          capacidade?: number | null
          carga_horaria?: number | null
          codigo_turma?: string | null
          created_at?: string
          data_final?: string | null
          data_inicial?: string
          empresa_cnpj?: string | null
          empresa_id?: string
          empresa_nome?: string | null
          id?: string
          instrutor?: string | null
          instrutor_qualificacao?: string | null
          local?: string | null
          modalidade?: string
          observacoes?: string | null
          registro_responsavel?: string | null
          responsavel_tecnico?: string | null
          status?: string
          tipo_treinamento?: string
          treinamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgsst_treinamentos_turmas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgsst_treinamentos_turmas_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "sgsst_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          codigo: string
          created_at: string
          id: string
          municipio: string | null
          nome: string
          projeto_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          municipio?: string | null
          nome: string
          projeto_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          municipio?: string | null
          nome?: string
          projeto_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          pode_editar: boolean
          pode_visualizar: boolean
          tela: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pode_editar?: boolean
          pode_visualizar?: boolean
          tela: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pode_editar?: boolean
          pode_visualizar?: boolean
          tela?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          user_id: string
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sites: {
        Row: {
          created_at: string | null
          id: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
    }
    Views: {
      view_bi_analise_obras: {
        Row: {
          "% Gerência Orç.": number | null
          "% Gerência Real": number | null
          "% Impostos": number | null
          "% MB Orç.": number | null
          "% MB Real": number | null
          Ano: number | null
          Área: string | null
          Cliente: string | null
          "Custo Direto Orçado": number | null
          "Custo Direto Real": number | null
          "Custo Total Orçado": number | null
          "Custo Total Real": number | null
          Direto: number | null
          "Gerência Orçada": number | null
          "Gerência Real": number | null
          "ID Projeto": string | null
          "Mat.": number | null
          "MB Orç. (R$)": number | null
          "MB Real (R$)": number | null
          "Mês Num": number | null
          MO: number | null
          "Produção (POC)": number | null
          Projeto: string | null
          "Receita Líquida": number | null
          Referência: string | null
          "Resultado Direto": number | null
          "Resultado Gerência": number | null
          "Resultado Total": number | null
          "Transp.": number | null
        }
        Relationships: []
      }
      view_bi_contratos: {
        Row: {
          condicoes_pagamento: string | null
          contrato_pai_id: string | null
          empresa_id: string | null
          escopo: string | null
          id: string | null
          numero_contrato: string | null
          prazo_fim: string | null
          prazo_inicio: string | null
          status_prazo: string | null
          status_processamento: string | null
          total_custos_realizados: number | null
          total_projetos: number | null
          valor_total: number | null
        }
        Insert: {
          condicoes_pagamento?: string | null
          contrato_pai_id?: string | null
          empresa_id?: string | null
          escopo?: string | null
          id?: string | null
          numero_contrato?: string | null
          prazo_fim?: string | null
          prazo_inicio?: string | null
          status_prazo?: never
          status_processamento?: string | null
          total_custos_realizados?: never
          total_projetos?: never
          valor_total?: number | null
        }
        Update: {
          condicoes_pagamento?: string | null
          contrato_pai_id?: string | null
          empresa_id?: string | null
          escopo?: string | null
          id?: string | null
          numero_contrato?: string | null
          prazo_fim?: string | null
          prazo_inicio?: string | null
          status_prazo?: never
          status_processamento?: string | null
          total_custos_realizados?: never
          total_projetos?: never
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "view_bi_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "view_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_bi_dim_categoria: {
        Row: {
          ativo: boolean | null
          categoria_erp: string | null
          categoria_interna: string | null
          id: string | null
        }
        Relationships: []
      }
      view_bi_dim_tempo: {
        Row: {
          ano: number | null
          ano_mes: string | null
          data: string | null
          dia: number | null
          dia_semana: number | null
          mes: number | null
          nome_mes: string | null
          trimestre: number | null
        }
        Relationships: []
      }
      view_bi_financeiro: {
        Row: {
          ano: number | null
          area_id: string | null
          area_nome: string | null
          categoria_erp: string | null
          categoria_interna: string | null
          centro_custo: string | null
          data_competencia: string | null
          data_pagamento: string | null
          descricao: string | null
          id: string | null
          mes: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          site_codigo: string | null
          site_id: string | null
          site_nome: string | null
          status_erp: string | null
          trimestre: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "projetos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_bi_producao: {
        Row: {
          ano: number | null
          area_id: string | null
          area_nome: string | null
          clima: string | null
          custo_total_orcado: number | null
          custo_unitario_orcado: number | null
          data_producao: string | null
          id: string | null
          item_codigo: string | null
          item_descricao: string | null
          item_lpu_id: string | null
          mes: number | null
          municipio: string | null
          origem: string | null
          preco_unitario_congelado: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          quantidade: number | null
          site_codigo: string | null
          site_id: string | null
          site_nome: string | null
          uf: string | null
          unidade: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "projetos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_contratos: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          escopo: string | null
          id: string | null
          numero_contrato: string | null
          percentual_prazo: number | null
          prazo_fim: string | null
          prazo_inicio: string | null
          status: string | null
          total_projetos: number | null
          valor_projetos: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          escopo?: string | null
          id?: string | null
          numero_contrato?: string | null
          percentual_prazo?: never
          prazo_fim?: string | null
          prazo_inicio?: string | null
          status?: string | null
          total_projetos?: never
          valor_projetos?: never
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          escopo?: string | null
          id?: string | null
          numero_contrato?: string | null
          percentual_prazo?: never
          prazo_fim?: string | null
          prazo_inicio?: string | null
          status?: string | null
          total_projetos?: never
          valor_projetos?: never
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_financeiro: {
        Row: {
          ano: number | null
          categoria: string | null
          categoria_erp: string | null
          centro_custo: string | null
          data_competencia: string | null
          data_pagamento: string | null
          descricao: string | null
          empresa_id: string | null
          id: string | null
          mes: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          site_codigo: string | null
          site_id: string | null
          site_nome: string | null
          status: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_flash_transactions: {
        Row: {
          categoria_mapeada: string | null
          category: string | null
          comments: string | null
          cost_center: string | null
          cost_center_id: string | null
          data: string | null
          description: string | null
          empresa_id: string | null
          enviado_ao_conta_azul: boolean | null
          external_id: string | null
          id: string | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          status_normalizacao: string | null
          type: string | null
          usuario: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flash_transactions_raw_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_producao: {
        Row: {
          ano: number | null
          area_id: string | null
          area_nome: string | null
          clima: string | null
          data_producao: string | null
          id: string | null
          item_codigo: string | null
          item_descricao: string | null
          item_lpu_id: string | null
          mes: number | null
          municipio: string | null
          origem: string | null
          preco_unitario_congelado: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          quantidade: number | null
          site_codigo: string | null
          site_id: string | null
          site_nome: string | null
          uf: string | null
          unidade: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "projetos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_producao_diario: {
        Row: {
          ano: number | null
          data_producao: string | null
          empresa_id: string | null
          id: string | null
          item_codigo: string | null
          item_descricao: string | null
          item_lpu_id: string | null
          item_unidade: string | null
          mes: number | null
          origem: string | null
          preco_unitario: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          quantidade: number | null
          site_codigo: string | null
          site_id: string | null
          site_nome: string | null
          valor_produzido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diarios_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_financeiro_site_item"
            referencedColumns: ["site_id"]
          },
        ]
      }
      view_public_forecast: {
        Row: {
          area_nome: string | null
          cliente_nome: string | null
          forecast_data: Json | null
          producao_mensal: Json | null
          projeto_id: string | null
          projeto_nome: string | null
          projeto_status: string | null
          total_produzido: number | null
          valor_contrato: number | null
        }
        Relationships: []
      }
      view_public_forecast_flat: {
        Row: {
          area_nome: string | null
          cliente_nome: string | null
          forecast_data: Json | null
          mes_chave: string | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          projeto_status: string | null
          total_produzido: number | null
          valor_contrato: number | null
          valor_forecast: number | null
          valor_real: number | null
          valor_total_mes: number | null
        }
        Relationships: []
      }
      view_quadro_geral_bi: {
        Row: {
          "% Evolução": number | null
          Área: string | null
          Cliente: string | null
          "Projeto Código": string | null
          "Projeto Nome": string | null
          "Saldo Contrato": number | null
          "Site Código": string | null
          "Site Nome": string | null
          "Status Projeto": string | null
          "Valor Contrato": number | null
          "Valor Executado": number | null
          "Valor Faturado": number | null
          "Valor Não Faturado": number | null
        }
        Relationships: []
      }
      vw_pedidos_resumo: {
        Row: {
          atraso_dias: number | null
          created_at: string | null
          criado_por: string | null
          data_emissao: string | null
          data_entrega_real: string | null
          data_prevista_entrega: string | null
          empresa_id: string | null
          fornecedor_nome: string | null
          fornecedor_score: number | null
          id: string | null
          numero: string | null
          projeto_id: string | null
          requisicao_numero: string | null
          status: Database["public"]["Enums"]["pedido_status"] | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "requisicoes_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      vw_resumo_financeiro_site_item: {
        Row: {
          item_codigo: string | null
          item_descricao: string | null
          item_lpu_id: string | null
          item_preco_unitario: number | null
          item_unidade: string | null
          projeto_id: string | null
          qtd_faturada: number | null
          qtd_medida: number | null
          qtd_produzida: number | null
          site_id: string | null
          valor_faturado: number | null
          valor_medido: number | null
          valor_produzido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_flash_transactions"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "sites_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_public_forecast_flat"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
    }
    Functions: {
      calcular_score_fornecedor: {
        Args: { p_fornecedor_id: string }
        Returns: number
      }
      count_fotos_periodo: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_site_ids: string[]
        }
        Returns: number
      }
      fetch_public_forecast: {
        Args: never
        Returns: {
          area_nome: string | null
          cliente_nome: string | null
          forecast_data: Json | null
          producao_mensal: Json | null
          projeto_id: string | null
          projeto_nome: string | null
          projeto_status: string | null
          total_produzido: number | null
          valor_contrato: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "view_public_forecast"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      first_of_month:
        | {
            Args: { d: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.first_of_month(d => date), public.first_of_month(d => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { d: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.first_of_month(d => date), public.first_of_month(d => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      fn_get_bdi: {
        Args: { p_competencia: string; p_projeto_id: string }
        Returns: number
      }
      gerar_proximo_numero_sc: {
        Args: { p_empresa_id: string; p_prefixo: string }
        Returns: string
      }
      get_bi_analise_obras: {
        Args: never
        Returns: {
          "% Gerência Orç.": number
          "% Gerência Real": number
          "% Impostos": number
          "% MB Orç.": number
          "% MB Real": number
          Ano: number
          Área: string
          Cliente: string
          "Custo Direto Orçado": number
          "Custo Direto Real": number
          "Custo Total Orçado": number
          "Custo Total Real": number
          Direto: number
          "Gerência Orçada": number
          "Gerência Real": number
          "ID Projeto": string
          "Mat.": number
          "MB Orç. (R$)": number
          "MB Real (R$)": number
          "Mês Num": number
          MO: number
          "Produção (POC)": number
          Projeto: string
          "Receita Líquida": number
          Referência: string
          "Resultado Direto": number
          "Resultado Gerência": number
          "Resultado Total": number
          "Transp.": number
        }[]
      }
      get_employee_cc_map: {
        Args: { employee_ids: string[] }
        Returns: {
          cc_id: string
          cc_name: string
          employee_id: string
        }[]
      }
      get_my_profile_pii: {
        Args: never
        Returns: {
          cpf: string
          data_nascimento: string
          sexo: string
        }[]
      }
      get_quadro_geral_bi: {
        Args: never
        Returns: {
          "% Evolução": number
          Área: string
          Cliente: string
          "Projeto Código": string
          "Projeto Nome": string
          "Saldo Contrato": number
          "Site Código": string
          "Site Nome": string
          "Status Projeto": string
          "Valor Contrato": number
          "Valor Executado": number
          "Valor Faturado": number
          "Valor Não Faturado": number
        }[]
      }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      join_empresa_by_cnpj: { Args: { _cnpj: string }; Returns: string }
      resumo_rdo_periodo: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_site_ids: string[]
        }
        Returns: Json
      }
      setup_empresa: {
        Args: { _cnpj?: string; _nome: string }
        Returns: string
      }
      sgsst_dashboard_alertas: {
        Args: {
          p_data_final?: string
          p_data_inicial?: string
          p_empresa_id: string
          p_projeto_id?: string
        }
        Returns: Json
      }
      sgsst_dashboard_metrics: {
        Args: {
          p_data_final?: string
          p_data_inicial?: string
          p_empresa_id: string
          p_projeto_id?: string
        }
        Returns: Json
      }
      sum_producao_periodo: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_site_ids: string[]
        }
        Returns: number
      }
      sum_producao_por_item: {
        Args: { p_projeto_ids: string[] }
        Returns: {
          item_lpu_id: string
          site_id: string
          total_quantidade: number
          total_valor: number
        }[]
      }
      url_encode: { Args: { "": string }; Returns: string }
      user_can_access_diario: {
        Args: { _diario_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_projeto: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "interno" | "cliente"
      pedido_status:
        | "rascunho"
        | "emitido"
        | "confirmado"
        | "entrega_parcial"
        | "entregue"
        | "cancelado"
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
      app_role: ["admin", "interno", "cliente"],
      pedido_status: [
        "rascunho",
        "emitido",
        "confirmado",
        "entrega_parcial",
        "entregue",
        "cancelado",
      ],
    },
  },
} as const
