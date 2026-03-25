import * as XLSX from 'xlsx';
import { ExtractionResult } from '@/types/extraction';

export function exportToExcel(results: ExtractionResult[]) {
  const successfulResults = results.filter(r => r.status === 'success' && r.data);
  
  if (successfulResults.length === 0) {
    throw new Error('Nenhum dado extraído com sucesso para exportar');
  }

  // Create main sheet with order data
  const mainData = successfulResults.map(result => {
    const d = result.data!;
    return {
      'Arquivo': result.fileName,
      'Nº Pedido': d.pedido.numero || '',
      'Nº Projeto': d.pedido.numero_projeto || '',
      'Nome Site': d.pedido.nome_site || '',
      'Data Pedido': d.pedido.data || '',
      'Condição Pagamento': d.pedido.condicao_pagamento || '',
      'Valor Total Pedido': d.pedido.valor_total || '',
      'Data Entrega': d.pedido.data_entrega || '',
      'Fornecedor - Razão Social': d.fornecedor.razao_social || '',
      'Fornecedor - CNPJ': d.fornecedor.cnpj || '',
      'Fornecedor - Endereço': d.fornecedor.endereco || '',
      'Fornecedor - Cidade/Estado': d.fornecedor.cidade_estado || '',
      'Fornecedor - Contato': d.fornecedor.contato || '',
      'Comprador - Razão Social': d.comprador.razao_social || '',
      'Comprador - CNPJ': d.comprador.cnpj || '',
      'Comprador - Endereço': d.comprador.endereco || '',
    };
  });

  // Create items sheet
  const itemsData: Record<string, string>[] = [];
  successfulResults.forEach(result => {
    const d = result.data!;
    d.itens.forEach((item, index) => {
      itemsData.push({
        'Arquivo': result.fileName,
        'Nº Pedido': d.pedido.numero || '',
        'Nº Projeto': d.pedido.numero_projeto || '',
        'Nome Site': d.pedido.nome_site || '',
        'Item #': String(index + 1),
        'Código': item.codigo || '',
        'Descrição': item.descricao || '',
        'Quantidade': item.quantidade || '',
        'Unidade': item.unidade || '',
        'Preço Unitário': item.preco_unitario || '',
        'Valor Total Item': item.valor_total || '',
      });
    });
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Add main sheet
  const wsMain = XLSX.utils.json_to_sheet(mainData);
  XLSX.utils.book_append_sheet(wb, wsMain, 'Pedidos');
  
  // Add items sheet
  if (itemsData.length > 0) {
    const wsItems = XLSX.utils.json_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(wb, wsItems, 'Itens');
  }

  // Generate file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `extracao_pedidos_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
