import { ExtractionResult } from '@/types/extraction';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DataPreviewProps {
  results: ExtractionResult[];
}

export function DataPreview({ results }: DataPreviewProps) {
  const successfulResults = results.filter(r => r.status === 'success' && r.data);

  if (successfulResults.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum dado extraído ainda.</p>
        <p className="text-sm mt-1">Faça upload de PDFs e processe para ver os resultados.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="pedidos" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="pedidos">Pedidos ({successfulResults.length})</TabsTrigger>
        <TabsTrigger value="itens">
          Itens ({successfulResults.reduce((acc, r) => acc + (r.data?.itens.length || 0), 0)})
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="pedidos">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Arquivo</TableHead>
                <TableHead className="min-w-[100px]">Nº Pedido</TableHead>
                <TableHead className="min-w-[150px]">Site</TableHead>
                <TableHead className="min-w-[100px]">Data</TableHead>
                <TableHead className="min-w-[120px]">Valor Total</TableHead>
                <TableHead className="min-w-[200px]">Fornecedor</TableHead>
                <TableHead className="min-w-[150px]">CNPJ Fornecedor</TableHead>
                <TableHead className="min-w-[150px]">Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {successfulResults.map((result) => {
                const d = result.data!;
                return (
                  <TableRow key={result.fileName}>
                    <TableCell className="font-medium">
                      <Badge variant="outline" className="font-normal">
                        {result.fileName}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.pedido.numero || '-'}</TableCell>
                    <TableCell>{d.pedido.nome_site || '-'}</TableCell>
                    <TableCell>{d.pedido.data || '-'}</TableCell>
                    <TableCell className="font-medium">{d.pedido.valor_total || '-'}</TableCell>
                    <TableCell>{d.fornecedor.razao_social || '-'}</TableCell>
                    <TableCell>{d.fornecedor.cnpj || '-'}</TableCell>
                    <TableCell>{d.pedido.condicao_pagamento || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TabsContent>
      
      <TabsContent value="itens">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Arquivo</TableHead>
                <TableHead className="min-w-[100px]">Nº Pedido</TableHead>
                <TableHead className="min-w-[100px]">Código</TableHead>
                <TableHead className="min-w-[250px]">Descrição</TableHead>
                <TableHead className="min-w-[80px]">Qtd</TableHead>
                <TableHead className="min-w-[80px]">Unidade</TableHead>
                <TableHead className="min-w-[100px]">Preço Unit.</TableHead>
                <TableHead className="min-w-[100px]">Valor Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {successfulResults.flatMap((result) => {
                const d = result.data!;
                return d.itens.map((item, idx) => (
                  <TableRow key={`${result.fileName}-${idx}`}>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {result.fileName}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.pedido.numero || '-'}</TableCell>
                    <TableCell>{item.codigo || '-'}</TableCell>
                    <TableCell>{item.descricao || '-'}</TableCell>
                    <TableCell>{item.quantidade || '-'}</TableCell>
                    <TableCell>{item.unidade || '-'}</TableCell>
                    <TableCell>{item.preco_unitario || '-'}</TableCell>
                    <TableCell className="font-medium">{item.valor_total || '-'}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
