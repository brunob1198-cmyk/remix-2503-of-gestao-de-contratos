export interface PedidoData {
  numero: string | null;
  numero_projeto: string | null;
  nome_site: string | null;
  data: string | null;
  condicao_pagamento: string | null;
  valor_total: string | null;
  data_entrega: string | null;
}

export interface FornecedorData {
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade_estado: string | null;
  contato: string | null;
}

export interface CompradorData {
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
}

export interface ItemData {
  codigo: string | null;
  descricao: string;
  quantidade: string | null;
  unidade: string | null;
  preco_unitario: string | null;
  valor_total: string | null;
}

export interface ExtractedData {
  pedido: PedidoData;
  fornecedor: FornecedorData;
  comprador: CompradorData;
  itens: ItemData[];
}

export interface ExtractionResult {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  data?: ExtractedData;
  error?: string;
}
