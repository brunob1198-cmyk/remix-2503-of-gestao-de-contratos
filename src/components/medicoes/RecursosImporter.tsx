import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ParsedRecurso {
  nome: string;
  tipo: "pessoa" | "equipamento" | "veiculo";
  unidade: "hora" | "dia";
  custo_unitario: number;
  cargo?: string;
  placa?: string;
  valid: boolean;
  errors: string[];
}

interface RecursosImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPO_MAP: Record<string, "pessoa" | "equipamento" | "veiculo"> = {
  pessoa: "pessoa",
  equipamento: "equipamento",
  veiculo: "veiculo",
  veículo: "veiculo",
  "veiculos": "veiculo",
  "veículos": "veiculo",
  pessoas: "pessoa",
  equipamentos: "equipamento",
};

const UNIDADE_MAP: Record<string, "hora" | "dia"> = {
  hora: "hora",
  h: "hora",
  dia: "dia",
  d: "dia",
  diaria: "dia",
  diária: "dia",
};

function normalizeString(s: string): string {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseRows(rows: any[]): ParsedRecurso[] {
  return rows.map((row) => {
    const errors: string[] = [];
    const nome = row.nome?.toString().trim() || row.Nome?.toString().trim() || row.NOME?.toString().trim() || "";
    if (!nome) errors.push("Nome obrigatório");

    const tipoRaw = normalizeString(row.tipo || row.Tipo || row.TIPO || "");
    const tipo = TIPO_MAP[tipoRaw];
    if (!tipo) errors.push(`Tipo inválido: "${row.tipo || row.Tipo || row.TIPO || ""}"`);

    const unidadeRaw = normalizeString(row.unidade || row.Unidade || row.UNIDADE || "hora");
    const unidade = UNIDADE_MAP[unidadeRaw] || "hora";

    const custoRaw = row.custo_unitario ?? row.custo ?? row.Custo ?? row["Custo Unitário"] ?? row["custo unitario"] ?? row.CUSTO ?? 0;
    const custo_unitario = parseFloat(String(custoRaw).replace(",", ".")) || 0;
    if (custo_unitario <= 0) errors.push("Custo deve ser > 0");

    const cargo = row.cargo?.toString().trim() || row.Cargo?.toString().trim() || row["Cargo/Função"]?.toString().trim() || undefined;
    const placa = row.placa?.toString().trim() || row.Placa?.toString().trim() || row.PLACA?.toString().trim() || undefined;

    return {
      nome,
      tipo: tipo || "pessoa",
      unidade,
      custo_unitario,
      cargo: tipo === "pessoa" ? cargo : undefined,
      placa: tipo === "veiculo" ? placa : undefined,
      valid: errors.length === 0,
      errors,
    };
  });
}

export function RecursosImporter({ open, onOpenChange }: RecursosImporterProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRecurso[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const validCount = parsed.filter((p) => p.valid).length;
  const invalidCount = parsed.filter((p) => !p.valid).length;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (rows.length === 0) {
          toast.error("Planilha vazia ou sem dados válidos.");
          return;
        }
        setParsed(parseRows(rows));
      } catch {
        toast.error("Erro ao ler o arquivo. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    const validItems = parsed.filter((p) => p.valid);
    if (validItems.length === 0) return;

    setImporting(true);
    let successCount = 0;
    const today = new Date().toISOString().split("T")[0];

    try {
      for (const item of validItems) {
        const insertData: any = { nome: item.nome, tipo: item.tipo, unidade: item.unidade };
        if (item.cargo) insertData.cargo = item.cargo;
        if (item.placa) insertData.placa = item.placa;

        const { data: recurso, error: rErr } = await supabase
          .from("recursos")
          .insert(insertData)
          .select()
          .single();

        if (rErr) {
          console.error("Erro ao inserir recurso:", rErr);
          continue;
        }

        const { error: cErr } = await supabase.from("recurso_custos").insert({
          recurso_id: recurso.id,
          custo_unitario: item.custo_unitario,
          data_inicio: today,
        });

        if (cErr) {
          console.error("Erro ao inserir custo:", cErr);
          continue;
        }

        successCount++;
      }

      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      queryClient.invalidateQueries({ queryKey: ["recurso_custos"] });
      toast.success(`${successCount} recurso(s) importado(s) com sucesso!`);
      setParsed([]);
      setFileName("");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro durante a importação.");
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    const template = [
      { nome: "João Silva", tipo: "pessoa", unidade: "hora", custo_unitario: 45, cargo: "Pedreiro", placa: "" },
      { nome: "Escavadeira CAT 320", tipo: "equipamento", unidade: "hora", custo_unitario: 250, cargo: "", placa: "" },
      { nome: "Caminhão Munck", tipo: "veiculo", unidade: "dia", custo_unitario: 800, cargo: "", placa: "ABC-1D23" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recursos");
    XLSX.writeFile(wb, "modelo_recursos.xlsx");
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setParsed([]);
      setFileName("");
    }
    onOpenChange(isOpen);
  }

  const tipoLabel: Record<string, string> = { pessoa: "Pessoa", equipamento: "Equipamento", veiculo: "Veículo" };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Recursos via Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {parsed.length === 0 ? (
            <>
              <Alert>
                <AlertDescription className="text-sm">
                  A planilha deve conter as colunas: <strong>nome</strong>, <strong>tipo</strong> (pessoa/equipamento/veiculo),{" "}
                  <strong>unidade</strong> (hora/dia), <strong>custo_unitario</strong>. Opcionais: <strong>cargo</strong> (para pessoas),{" "}
                  <strong>placa</strong> (para veículos).
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed rounded-lg">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Selecione um arquivo .xlsx ou .xls</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                  <Button variant="ghost" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {validCount > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {validCount} válido(s)
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {invalidCount} com erro(s)
                    </Badge>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[45vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead>Cargo/Placa</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((p, i) => (
                      <TableRow key={i} className={!p.valid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.nome || "—"}</TableCell>
                        <TableCell>{tipoLabel[p.tipo] || p.tipo}</TableCell>
                        <TableCell>{p.unidade}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          R$ {p.custo_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{p.cargo || p.placa || "—"}</TableCell>
                        <TableCell>
                          {p.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <span className="text-xs text-destructive">{p.errors.join("; ")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => { setParsed([]); setFileName(""); }}>
                  Alterar arquivo
                </Button>
                <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                  {importing ? "Importando..." : `Importar ${validCount} recurso(s)`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
