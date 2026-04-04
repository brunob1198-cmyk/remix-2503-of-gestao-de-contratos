import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2, Download, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface Projeto {
  id: string;
  codigo: string;
  nome: string;
}

interface ImportRow {
  codigo: string;
  nome: string;
  municipio?: string;
  uf?: string;
  status?: "pending" | "success" | "error";
  error?: string;
}

interface SitesImporterProps {
  projetos: Projeto[];
}

export function SitesImporter({ projetos }: SitesImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projetoId, setProjetoId] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const parsed: ImportRow[] = jsonData.map((row) => {
        const codigo = String(row["codigo"] || row["Codigo"] || row["Código"] || row["CODIGO"] || "").trim();
        const nome = String(row["nome"] || row["Nome"] || row["NOME"] || "").trim();
        const municipio = String(row["municipio"] || row["Municipio"] || row["Município"] || row["MUNICIPIO"] || "").trim() || undefined;
        const uf = String(row["uf"] || row["UF"] || row["Uf"] || "").trim() || undefined;
        return { codigo, nome, municipio, uf, status: "pending" as const };
      }).filter(r => r.codigo && r.nome);

      setRows(parsed);
      setImported(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!projetoId) {
      toast({ title: "Selecione um projeto", variant: "destructive" });
      return;
    }
    if (rows.length === 0) {
      toast({ title: "Nenhum dado para importar", variant: "destructive" });
      return;
    }

    setImporting(true);
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      const { error } = await supabase.from("sites").insert({
        projeto_id: projetoId,
        codigo: r.codigo,
        nome: r.nome,
        municipio: r.municipio || null,
        uf: r.uf || null,
      });

      if (error) {
        updated[i] = { ...r, status: "error", error: error.message };
      } else {
        updated[i] = { ...r, status: "success" };
      }
      setRows([...updated]);
    }

    setImporting(false);
    setImported(true);
    queryClient.invalidateQueries({ queryKey: ["sites"] });

    const successCount = updated.filter(r => r.status === "success").length;
    const errorCount = updated.filter(r => r.status === "error").length;
    toast({
      title: `Importação concluída`,
      description: `${successCount} sites criados${errorCount > 0 ? `, ${errorCount} erros` : ""}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["codigo", "nome", "municipio", "uf"],
      ["SITE-001", "Site Exemplo 1", "São Paulo", "SP"],
      ["SITE-002", "Site Exemplo 2", "Rio de Janeiro", "RJ"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sites");
    XLSX.writeFile(wb, "modelo_importacao_sites.xlsx");
  };

  const reset = () => {
    setRows([]);
    setProjetoId("");
    setImported(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Importar Planilha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Sites por Planilha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Projeto de destino *</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                <SelectContent>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo Excel</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>
          </div>

          <Button variant="link" size="sm" className="p-0 h-auto" onClick={downloadTemplate}>
            <Download className="h-3 w-3 mr-1" />Baixar modelo de planilha
          </Button>

          {rows.length > 0 && (
            <>
              <div className="border rounded-md max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>UF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                          {r.status === "pending" && <span className="text-xs text-muted-foreground">Pendente</span>}
                        </TableCell>
                        <TableCell className="font-mono">{r.codigo}</TableCell>
                        <TableCell>{r.nome}</TableCell>
                        <TableCell>{r.municipio || "-"}</TableCell>
                        <TableCell>{r.uf || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{rows.length} registros encontrados</span>
                <Button onClick={handleImport} disabled={importing || imported}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {imported ? "Importação concluída" : "Importar Sites"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
