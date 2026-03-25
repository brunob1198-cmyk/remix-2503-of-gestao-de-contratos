import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Check, X } from "lucide-react";
import { useItensLpu } from "@/hooks/useItensLpu";
import { useProjetos } from "@/hooks/useProjetos";

interface ParsedItem {
  codigo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  bdi: number;
  categoria?: string;
  projeto_id?: string;
}

export function LpuImporter() {
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("");
  const { importItensLpu } = useItensLpu();
  const { projetos } = useProjetos();

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
          (cell.toLowerCase().includes('codigo') || cell.toLowerCase().includes('código'))
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

      const codigoIdx = findColumnIndex(['codigo', 'cod', 'item']);
      const descricaoIdx = findColumnIndex(['descricao', 'desc', 'nome', 'servico']);
      const unidadeIdx = findColumnIndex(['unidade', 'un', 'und']);
      const precoIdx = findColumnIndex(['preco', 'valor', 'unitario', 'pu']);
      const categoriaIdx = findColumnIndex(['categoria', 'tipo', 'classe']);
      const bdiIdx = findColumnIndex(['bdi']);

      const items: ParsedItem[] = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const codigo = String(row[codigoIdx] || '').trim();
        const descricao = String(row[descricaoIdx] || '').trim();
        
        if (!codigo || !descricao) continue;

        let precoStr = String(row[precoIdx] || '0');
        precoStr = precoStr.replace(/[^\d.,]/g, '').replace(',', '.');
        const preco = parseFloat(precoStr) || 0;

        let bdiValue = 1.0;
        if (bdiIdx >= 0) {
          let bdiStr = String(row[bdiIdx] || '1');
          bdiStr = bdiStr.replace(/[^\d.,]/g, '').replace(',', '.');
          bdiValue = parseFloat(bdiStr) || 1.0;
        }

        items.push({
          codigo,
          descricao,
          unidade: String(row[unidadeIdx] || 'UNIT').trim().toUpperCase(),
          preco_unitario: preco,
          bdi: bdiValue,
          categoria: categoriaIdx >= 0 ? String(row[categoriaIdx] || '').trim() : undefined,
        });
      }

      setParsedItems(items);
      setFileName(file.name);
    };
    reader.readAsBinaryString(file);
  }, []);

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
    if (parsedItems.length > 0) {
      const itemsWithProject = parsedItems.map(item => ({
        ...item,
        projeto_id: selectedProjetoId || undefined,
      }));
      
      importItensLpu.mutate(itemsWithProject, {
        onSuccess: () => {
          setParsedItems([]);
          setFileName("");
          setSelectedProjetoId("");
        },
      });
    }
  };

  const handleCancel = () => {
    setParsedItems([]);
    setFileName("");
    setSelectedProjetoId("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {parsedItems.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Lista de Preços Unitária
            </CardTitle>
            <CardDescription>
              Arraste um arquivo Excel (.xlsx, .xls) ou CSV contendo a LPU com colunas: Código, Descrição, Unidade, Preço Unitário, BDI (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Vincular ao Projeto (opcional)</Label>
              <Select value={selectedProjetoId || "none"} onValueChange={(v) => setSelectedProjetoId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Selecione um projeto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo (LPU geral)</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} - {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                <Button size="sm" onClick={handleImport} disabled={importItensLpu.isPending}>
                  <Check className="h-4 w-4 mr-1" />
                  {importItensLpu.isPending ? "Importando..." : `Importar ${parsedItems.length} itens`}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Vincular ao Projeto</Label>
              <Select value={selectedProjetoId || "none"} onValueChange={(v) => setSelectedProjetoId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Selecione um projeto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo (LPU geral)</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} - {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Preço Unitário</TableHead>
                    <TableHead className="text-right">BDI</TableHead>
                    <TableHead>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.slice(0, 50).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell className="max-w-md truncate">{item.descricao}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                      <TableCell className="text-right font-mono">{item.bdi.toFixed(2)}</TableCell>
                      <TableCell>{item.categoria || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedItems.length > 50 && (
                <p className="text-center text-muted-foreground mt-4">
                  Mostrando 50 de {parsedItems.length} itens
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
