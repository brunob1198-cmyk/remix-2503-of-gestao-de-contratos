export interface Cliente {
  id: string;
  empresa_id: string;
  razao_social: string;
  cnpj?: string;
  cep?: string;
  endereco_completo?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string;
  created_at: string;
  updated_at: string;
}

export interface Projeto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  coordenador?: string;
  cliente?: string;
  status: string;
  empresa_id?: string;
  cliente_id?: string;
  contrato_id?: string;
  contrato_ids?: string[];
  area_id?: string;
  valor_total?: number;
  clienteObj?: Cliente;
  contratoObj?: Contrato;
  areaObj?: Area;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  empresa_id: string;
  arquivo_url?: string;
  status_processamento?: string;
  cliente_ids?: string[];
  valor_total?: number;
  prazo_inicio?: string;
  prazo_fim?: string;
  escopo?: string;
  condicoes_pagamento?: string;
  garantias?: string;
  liberacao_garantias?: string;
  medicoes?: string;
  multas?: string;
  reajuste?: string;
  observacoes?: string;
  numero_contrato?: string;
  contrato_pai_id?: string;
  created_at: string;
  updated_at: string;
  aditivos?: Contrato[]; // Field for populated hierarchical structure in UI
}

export interface Site {
  id: string;
  projeto_id: string;
  codigo: string;
  nome: string;
  municipio?: string;
  uf?: string;
  cliente_id?: string;
  clienteObj?: Cliente;
  created_at: string;
  updated_at: string;
  projeto?: Projeto;
}

export interface ItemLpu {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  bdi: number;
  categoria?: string;
  ativo: boolean;
  projeto_id?: string;
  projeto?: Projeto;
  created_at: string;
  updated_at: string;
}

export interface LancamentoProducao {
  id: string;
  site_id: string;
  item_lpu_id: string;
  data_producao: string;
  quantidade: number;
  empresa_executora?: string;
  uf?: string;
  municipio?: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
  site?: Site;
  item_lpu?: ItemLpu;
}

export interface LancamentoMedicao {
  id: string;
  site_id: string;
  item_lpu_id: string;
  data_medicao: string;
  quantidade: number;
  numero_medicao?: string;
  status: string;
  numero_po?: string;
  observacao_acompanhamento?: string;
  observacao?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  data_resposta?: string;
  quantidade_aprovada?: number;
  quantidade_rejeitada?: number;
  created_at: string;
  updated_at: string;
  site?: Site;
  item_lpu?: ItemLpu;
}

export interface LancamentoFaturamento {
  id: string;
  site_id: string;
  item_lpu_id: string;
  data_faturamento: string;
  quantidade: number;
  numero_nf?: string;
  numero_po?: string;
  valor_faturado?: number;
  observacao?: string;
  created_at: string;
  updated_at: string;
  site?: Site;
  item_lpu?: ItemLpu;
}

export interface ResumoItem {
  item_lpu_id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  site_codigo?: string;
  site_nome?: string;
  projeto_codigo?: string;
  projeto_nome?: string;
  qtd_produzida: number;
  qtd_medida: number;
  qtd_faturada: number;
  qtd_a_medir: number;
  qtd_a_faturar: number;
  valor_produzido: number;
  valor_medido: number;
  valor_faturado: number;
}

export interface ResumoProjeto {
  projeto_id: string;
  codigo: string;
  nome: string;
  total_produzido: number;
  total_medido: number;
  total_faturado: number;
  total_a_medir: number;
  total_a_faturar: number;
}

export interface ResumoSite {
  site_id: string;
  codigo: string;
  nome: string;
  projeto_codigo: string;
  total_produzido: number;
  total_medido: number;
  total_faturado: number;
}

export interface MedicaoAgrupada {
  id: string;
  site_id: string;
  site_codigo: string;
  site_nome: string;
  projeto_codigo: string;
  projeto_nome: string;
  uf: string;
  data_medicao: string;
  numero_medicao: string;
  total_valor: number;
  status: string;
  numero_po?: string;
  observacao_acompanhamento?: string;
}

export interface EscopoItem {
  id?: string;
  site_id: string;
  item_lpu_id?: string;
  nome: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
  created_at?: string;
  updated_at?: string;
}

export interface EscopoHistorico {
  id: string;
  site_id: string;
  snapshot: any;
  created_at: string;
}
