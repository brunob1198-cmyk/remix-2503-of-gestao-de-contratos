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
          categoria_erp: string
          categoria_interna: string
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
          categoria_erp?: string
          categoria_interna?: string
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
          categoria_erp?: string
          categoria_interna?: string
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "diarios_campo_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            foreignKeyName: "escopo_itens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            foreignKeyName: "faturamento_itens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
        ]
      }
      faturamentos_conta_azul: {
        Row: {
          centro_custo: string | null
          cliente_nome: string | null
          created_at: string | null
          data_emissao: string
          descricao: string | null
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          empresa_id: string
          endereco: string | null
          id: string
          observacoes: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          avaliacao?: number | null
          categoria?: string | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empresa_id: string
          endereco?: string | null
          id?: string
          observacoes?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          avaliacao?: number | null
          categoria?: string | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empresa_id?: string
          endereco?: string | null
          id?: string
          observacoes?: string | null
          razao_social?: string
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "frentes_obra_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "lancamentos_faturamento_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_medicao: {
        Row: {
          capa_url: string | null
          created_at: string
          data_medicao: string
          data_resposta: string | null
          id: string
          item_lpu_id: string
          logo_empresa_url: string | null
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
          capa_url?: string | null
          created_at?: string
          data_medicao: string
          data_resposta?: string | null
          id?: string
          item_lpu_id: string
          logo_empresa_url?: string | null
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
          capa_url?: string | null
          created_at?: string
          data_medicao?: string
          data_resposta?: string | null
          id?: string
          item_lpu_id?: string
          logo_empresa_url?: string | null
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
            foreignKeyName: "lancamentos_medicao_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            foreignKeyName: "lancamentos_producao_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
          perc_impostos: number
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
          perc_impostos?: number
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
          perc_impostos?: number
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
          perc_dara: number
          perc_icms: number
          perc_inss: number
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
          perc_dara?: number
          perc_icms?: number
          perc_inss?: number
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
          perc_dara?: number
          perc_icms?: number
          perc_inss?: number
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
        ]
      }
      projetos: {
        Row: {
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
          id: string
          nome: string
          status: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
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
          id?: string
          nome: string
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "sc_locais_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
        ]
      }
      timeline_eventos: {
        Row: {
          created_at: string
          data: string
          equipe_id: string | null
          geo_confianca: string | null
          geo_descricao: string | null
          geo_metodo: string | null
          geo_validado: boolean
          id: string
          imagem_thumb_600_url: string | null
          imagem_thumb_url: string | null
          imagem_url: string | null
          item: string | null
          latitude: number | null
          longitude: number | null
          observacao: string | null
          projeto_id: string
          quantidade: number | null
          status: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          equipe_id?: string | null
          geo_confianca?: string | null
          geo_descricao?: string | null
          geo_metodo?: string | null
          geo_validado?: boolean
          id?: string
          imagem_thumb_600_url?: string | null
          imagem_thumb_url?: string | null
          imagem_url?: string | null
          item?: string | null
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          projeto_id: string
          quantidade?: number | null
          status?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          equipe_id?: string | null
          geo_confianca?: string | null
          geo_descricao?: string | null
          geo_metodo?: string | null
          geo_validado?: boolean
          id?: string
          imagem_thumb_600_url?: string | null
          imagem_thumb_url?: string | null
          imagem_url?: string | null
          item?: string | null
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          projeto_id?: string
          quantidade?: number | null
          status?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_eventos_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "timeline_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_bi_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "timeline_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "timeline_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "view_producao_diario"
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
        ]
      }
    }
    Views: {
      view_bi_analise_obras: {
        Row: {
          ano: number | null
          ano_mes: string | null
          area_id: string | null
          area_nome: string | null
          categoria_erp: string | null
          categoria_interna: string | null
          cliente_cnpj: string | null
          cliente_id: string | null
          cliente_razao_social: string | null
          custo_equipamentos: number | null
          custo_erp_total: number | null
          custo_financeiros: number | null
          custo_indiretos: number | null
          custo_mao_de_obra: number | null
          custo_materiais: number | null
          custo_outros: number | null
          custo_transporte: number | null
          dias_com_diario: number | null
          empresa_id: string | null
          empresa_nome: string | null
          faturamento_bruto: number | null
          faturamento_liquido: number | null
          margem_bruta: number | null
          margem_bruta_percent: number | null
          mes: string | null
          mes_numero: number | null
          producao_quantidade: number | null
          producao_valor: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          projeto_status: string | null
          projeto_valor_total: number | null
          qtd_faturas: number | null
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
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
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
            referencedRelation: "view_bi_analise_obras"
            referencedColumns: ["projeto_id"]
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
            foreignKeyName: "custo_real_erp_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
        ]
      }
    }
    Functions: {
      count_fotos_periodo: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_site_ids: string[]
        }
        Returns: number
      }
      first_of_month: { Args: { d: string }; Returns: string }
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
    },
  },
} as const
