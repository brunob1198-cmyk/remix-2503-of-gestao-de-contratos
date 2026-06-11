import { useState, useRef, useEffect } from "react";
import { useFornecedores } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export function FornecedoresTab() {
  const { fornecedores, isLoading, create, update, remove, bulkCreate } = useFornecedores();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ razao_social: "", cnpj: "", contato_nome: "", contato_email: "", contato_telefone: "", endereco: "", cep: "", complemento: "", categoria: "geral", observacoes: "", municipio: "", uf: "", score: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setForm({ razao_social: "", cnpj: "", contato_nome: "", contato_email: "", contato_telefone: "", endereco: "", cep: "", complemento: "", categoria: "geral", observacoes: "", municipio: "", uf: "", score: 0 });
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) {
      update.mutate({ id: editing.id, ...form }, { onSuccess: () => { setOpen(false); resetForm(); } });
    } else {
      create.mutate(form, { onSuccess: () => { setOpen(false); resetForm(); } });
    }
  };

  const handleEdit = (f: any) => {
    setEditing(f);
    setForm({ 
      razao_social: f.razao_social, 
      cnpj: f.cnpj || "", 
      contato_nome: f.contato_nome || "", 
      contato_email: f.contato_email || "", 
      contato_telefone: f.contato_telefone || "", 
      endereco: f.endereco || "", 
      cep: f.cep || "",
      complemento: f.complemento || "",
      categoria: f.categoria || "geral", 
      observacoes: f.observacoes || "",
      municipio: f.municipio || "",
      uf: f.uf || "",
      score: f.score || 0
    });
    setOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (rows.length === 0) {
          toast({ title: "Planilha vazia", variant: "destructive" });
          return;
        }

        const colMap: Record<string, string> = {};
        const keys = Object.keys(rows[0]);
        for (const k of keys) {
          const kl = k.toLowerCase().trim();
          if (kl.includes("raz") || kl.includes("social") || kl === "nome" || kl === "fornecedor") colMap.razao_social = k;
          else if (kl.includes("cnpj")) colMap.cnpj = k;
          else if (kl.includes("contato") && !kl.includes("email") && !kl.includes("tel")) colMap.contato_nome = k;
          else if (kl.includes("email") || kl.includes("e-mail")) colMap.contato_email = k;
          else if (kl.includes("telef") || kl.includes("fone") || kl.includes("cel")) colMap.contato_telefone = k;
          else if (kl.includes("ender")) colMap.endereco = k;
          else if (kl.includes("cep")) colMap.cep = k;
          else if (kl.includes("complem")) colMap.complemento = k;
          else if (kl.includes("categ")) colMap.categoria = k;
          else if (kl.includes("municip") || kl.includes("cidade")) colMap.municipio = k;
          else if (kl === "uf" || kl === "estado") colMap.uf = k;
          else if (kl.includes("score") || kl.includes("pontua")) colMap.score = k;
          else if (kl.includes("obs")) colMap.observacoes = k;
        }

        if (!colMap.razao_social) {
          toast({ title: "Coluna obrigatória não encontrada", description: "A planilha precisa ter uma coluna 'Razão Social' ou 'Nome'.", variant: "destructive" });
          return;
        }

        const items = rows
          .filter(r => r[colMap.razao_social])
          .map(r => ({
            razao_social: String(r[colMap.razao_social]).trim(),
            cnpj: colMap.cnpj ? String(r[colMap.cnpj] || "").trim() || undefined : undefined,
            contato_nome: colMap.contato_nome ? String(r[colMap.contato_nome] || "").trim() || undefined : undefined,
            contato_email: colMap.contato_email ? String(r[colMap.contato_email] || "").trim() || undefined : undefined,
            contato_telefone: colMap.contato_telefone ? String(r[colMap.contato_telefone] || "").trim() || undefined : undefined,
            endereco: colMap.endereco ? String(r[colMap.endereco] || "").trim() || undefined : undefined,
            cep: colMap.cep ? String(r[colMap.cep] || "").trim() || undefined : undefined,
            complemento: colMap.complemento ? String(r[colMap.complemento] || "").trim() || undefined : undefined,
            categoria: colMap.categoria ? String(r[colMap.categoria] || "geral").trim() : "geral",
            municipio: colMap.municipio ? String(r[colMap.municipio] || "").trim() || undefined : undefined,
            uf: colMap.uf ? String(r[colMap.uf] || "").trim() || undefined : undefined,
            score: colMap.score ? Number(r[colMap.score]) || 0 : 0,
            observacoes: colMap.observacoes ? String(r[colMap.observacoes] || "").trim() || undefined : undefined,
          }));

        if (items.length === 0) {
          toast({ title: "Nenhum fornecedor válido", variant: "destructive" });
          return;
        }

        bulkCreate.mutate(items);
      } catch {
        toast({ title: "Erro ao ler planilha", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    const template = [
      { "Razão Social": "Fornecedor Exemplo Ltda", "CNPJ": "12.345.678/0001-90", "Contato": "João Silva", "E-mail": "joao@exemplo.com", "Telefone": "(11) 99999-0000", "Endereço": "Rua Exemplo, 100", "Município": "São Paulo", "UF": "SP", "Score": 85, "Categoria": "materiais", "Observações": "" },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
    XLSX.writeFile(wb, "modelo_fornecedores.xlsx");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fornecedores</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Modelo
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={bulkCreate.isPending}>
            <Upload className="h-4 w-4 mr-1" /> {bulkCreate.isPending ? "Importando..." : "Importar Planilha"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Fornecedor</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Razão Social *</Label><Input value={form.razao_social} onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} /></div>
                  <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contato</Label><Input value={form.contato_nome} onChange={e => setForm(p => ({ ...p, contato_nome: e.target.value }))} /></div>
                  <div><Label>Telefone</Label><Input value={form.contato_telefone} onChange={e => setForm(p => ({ ...p, contato_telefone: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(p => ({ ...p, municipio: e.target.value }))} /></div>
                  <div><Label>UF</Label><Input value={form.uf} onChange={e => setForm(p => ({ ...p, uf: e.target.value }))} maxLength={2} /></div>
                  <div><Label>Score</Label><Input type="number" value={form.score} onChange={e => setForm(p => ({ ...p, score: Number(e.target.value) }))} /></div>
                </div>
                <div><Label>E-mail</Label><Input value={form.contato_email} onChange={e => setForm(p => ({ ...p, contato_email: e.target.value }))} /></div>
                <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} /></div>
                <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
                <Button onClick={handleSave} disabled={!form.razao_social || create.isPending || update.isPending}>
                  {editing ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : fornecedores.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum fornecedor cadastrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                 <TableHead>Categoria</TableHead>
                <TableHead>Município</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fornecedores.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.razao_social}</TableCell>
                  <TableCell>{f.cnpj || "—"}</TableCell>
                  <TableCell>{f.contato_nome || "—"}</TableCell>
                   <TableCell><Badge variant="outline">{f.categoria}</Badge></TableCell>
                  <TableCell>{f.municipio || "—"}</TableCell>
                  <TableCell>{f.uf || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.score >= 70 ? "default" : f.score >= 40 ? "secondary" : "destructive"}>
                      {f.score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
