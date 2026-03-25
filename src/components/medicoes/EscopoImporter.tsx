import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, X, AlertCircle } from "lucide-react";
import { ItemLpu, EscopoItem } from "@/types/medicoes";

interface EscopoImporterProps {
  itensLpu: ItemLpu[];
  onImport: (items: EscopoItem[]) => void;
  siteId: string;
}

interface ParsedEscopoItem {
  codigo: string;
  quantidade: number;
}

interface MatchedItem extends EscopoItem {
  matched: boolean;
  originalCodigo: string;
}

export function EscopoImporter({ itensLpu, onImport, siteId }: EscopoImporterProps) {
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (row && row.some((cell: any) => 
          typeof cell === 'string' && 
          (cell.toLowerCase().includes('codigo') || cell.toLowerCase().includes('código') || cell.toLowerCase().includes('desc'))
        )) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = jsonData[headerRowIndex]?.map((h: any) => 
        String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      ) || [];

      const findColumnIndex = (names: string[]) => {
        return headers.findIndex((h: string) => names.some(n => h.includes(n)));
      };

      const codigoIdx = findColumnIndex(['codigo', 'cod', 'item', 'desc']);
      const qtdIdx = findColumnIndex(['quantidade', 'qtd', 'quant']);

      const parsed: ParsedEscopoItem[] = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const codigo = String(row[codigoIdx] || '').trim();
        if (!codigo) continue;

        let qtdStr = String(row[qtdIdx] || '0');
        qtdStr = qtdStr.replace(/[^\d.,]/g, '').replace(',', '.');
        const quantidade = parseFloat(qtdStr) || 0;

        parsed.push({ codigo, quantidade });
      }

      // Match with LPU
      const matched: MatchedItem[] = parsed.map(p => {
        // Try strict match first
        let lpuItem = itensLpu.find(l => l.codigo.toLowerCase() === p.codigo.toLowerCase());
        // Try loose match by description if code not found
        if (!lpuItem) {
          lpuItem = itensLpu.find(l => l.descricao.toLowerCase().includes(p.codigo.toLowerCase()));
        }

        if (lpuItem) {
          return {
            id: `temp-${Date.now()}-${Math.random()}`,
            site_id: siteId,
            item_lpu_id: lpuItem.id,
            nome: `${lpuItem.codigo} - ${lpuItem.descricao}`,
            unidade: lpuItem.unidade,
            quantidade: p.quantidade,
            valor_unitario: Number(lpuItem.preco_unitario),
            custo_unitario: Number(lpuItem.preco_unitario) / Number(lpuItem.bdi || 1),
            matched: true,
            originalCodigo: p.codigo
          };
        } else {
          return {
            id: `temp-${Date.now()}-${Math.random()}`,
            site_id: siteId,
            nome: `Não encontrado: ${p.codigo}`,
            unidade: "-",
            quantidade: p.quantidade,
            valor_unitario: 0,
            custo_unitario: 0,
            matched: false,
            originalCodigo: p.codigo
          };
        }
      });

      setMatchedItems(matched);
      setFileName(file.name);
    };
    reader.readAsBinaryString(file);
  }, [itensLpu, siteId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      parseExcel(acceptedFiles[0]);
    }
  }, [parseExcel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleImport = () => {
    const validItems = matchedItems.filter(m => m.matched);
    // remove the "matched" and "originalCodigo" properties to match EscopoItem
    const cleanItems = validItems.map(({ matched, originalCodigo, ...rest }) => rest);
    onImport(cleanItems);
    setMatchedItems([]);
    setFileName("");
  };

  const handleCancel = () => {
    setMatchedItems([]);
    setFileName("");
  };

  const validCount = matchedItems.filter(m => m.matched).length;

  return (
    <div className="space-y-4">
      {matchedItems.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Itens de Escopo
            </CardTitle>
            <CardDescription>
              Arraste um arquivo Excel (.xlsx, .xls) ou CSV contendo as colunas: Código (ou Descrição) e Quantidade.
              Os itens serão cruzados com a LPU do projeto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg">Solte o arquivo aqui...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">Arraste e solte um arquivo Excel aqui</p>
                  <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pré-visualização: {fileName}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleImport} disabled={validCount === 0}>
                  <Check className="h-4 w-4 mr-1" />
                  Importar {validCount} Válidos
                </Button>
              </div>
            </CardTitle>
            {matchedItems.length > validCount && (
              <CardDescription className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {matchedItems.length - validCount} itens não encontrados na LPU e serão ignorados.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Código Lido</TableHead>
                    <TableHead>Item Encontrado (LPU)</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor Un.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedItems.map((item, index) => (
                    <TableRow key={index} className={item.matched ? "" : "bg-destructive/10"}>
                      <TableCell>
                        {item.matched ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{item.originalCodigo}</TableCell>
                      <TableCell className="max-w-md truncate">{item.nome}</TableCell>
                      <TableCell className="text-right font-medium">{item.quantidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
