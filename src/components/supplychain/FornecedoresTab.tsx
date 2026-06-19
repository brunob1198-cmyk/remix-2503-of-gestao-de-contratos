import { useState, useRef, useEffect, useMemo } from "react";
import { useFornecedores } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Upload, Download, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const SCORE_WEIGHTS = {
  prazo: 0.4,
  preco: 0.3,
  qualidade: 0.2,
  responsividade: 0.1
};

export function FornecedoresTab() {
  const { fornecedores, isLoading, create, update, remove, bulkCreate, bulkRemove } = useFornecedores();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ 
    razao_social: "", 
    cnpj: "", 
    contato_nome: "", 
    contato_email: "", 
    contato_telefone: "", 
    endereco: "", 
    cep: "", 
    complemento: "", 
    categoria: "geral", 
    observacoes: "", 
    municipio: "", 
    uf: "", 
    score: 0,
    score_prazo: 0,
    score_preco: 0,
    score_qualidade: 0,
    score_responsividade: 0
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  
  const maskCNPJ = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  const handleCEPChange = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    setForm(p => ({ ...p, cep: cleanCEP }));
    
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setForm(p => ({
            ...p,
            endereco: data.logradouro,
            municipio: data.localidade,
            uf: data.uf
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  const resetForm = () => {
    setForm({ 
      razao_social: "", 
      cnpj: "", 
      contato_nome: "", 
      contato_email: "", 
      contato_telefone: "", 
      endereco: "", 
      cep: "", 
      complemento: "", 
      categoria: "geral", 
      observacoes: "", 
      municipio: "", 
      uf: "", 
      score: 0,
      score_prazo: 0,
      score_preco: 0,
      score_qualidade: 0,
      score_responsividade: 0
    });
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
      score: f.score || 0,
      score_prazo: f.score_prazo || 0,
      score_preco: f.score_preco || 0,
      score_qualidade: f.score_qualidade || 0,
      score_responsividade: f.score_responsividade || 0
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
        const norm = (s: string) =>
          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        for (const k of keys) {
          const kl = norm(k);
          if (kl.includes("municip") || kl === "cidade" || kl.startsWith("cidade")) colMap.municipio = k;
          else if (kl === "uf" || kl === "estado" || kl.startsWith("uf ")) colMap.uf = k;
          else if (kl.includes("raz") || kl.includes("social") || kl === "nome" || kl === "fornecedor") colMap.razao_social = k;
          else if (kl.includes("cnpj")) colMap.cnpj = k;
          else if (kl.includes("contato") && !kl.includes("email") && !kl.includes("tel")) colMap.contato_nome = k;
          else if (kl.includes("email") || kl.includes("e-mail")) colMap.contato_email = k;
          else if (kl.includes("telef") || kl.includes("fone") || kl.includes("cel")) colMap.contato_telefone = k;
          else if (kl.includes("complem")) colMap.complemento = k;
          else if (kl.includes("ender")) colMap.endereco = k;
          else if (kl.includes("cep")) colMap.cep = k;
          else if (kl.includes("categ")) colMap.categoria = k;
          else if (kl.includes("prazo")) colMap.score_prazo = k;
          else if (kl.includes("preco") || kl.includes("preço")) colMap.score_preco = k;
          else if (kl.includes("qualidade")) colMap.score_qualidade = k;
          else if (kl.includes("responsi")) colMap.score_responsividade = k;
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
            score_prazo: colMap.score_prazo ? Number(r[colMap.score_prazo]) || 0 : 0,
            score_preco: colMap.score_preco ? Number(r[colMap.score_preco]) || 0 : 0,
            score_qualidade: colMap.score_qualidade ? Number(r[colMap.score_qualidade]) || 0 : 0,
            score_responsividade: colMap.score_responsividade ? Number(r[colMap.score_responsividade]) || 0 : 0,

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
      { "Razão Social": "FORNECEDOR EXEMPLO LTDA", "CNPJ": "12.345.678/0001-90", "Contato": "João Silva", "E-mail": "joao@exemplo.com", "Telefone": "(11) 99999-0000", "CEP": "01001-000", "Endereço": "Rua Direita", "Complemento": "Loja 1", "Município": "São Paulo", "UF": "SP", "Score": 85, "Categoria": "materiais", "Observações": "" },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 5 }, { wch: 8 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
    XLSX.writeFile(wb, "modelo_fornecedores.xlsx");
  };

  const calculatedScore = useMemo(() => {
    return (
      (form.score_prazo * SCORE_WEIGHTS.prazo) +
      (form.score_preco * SCORE_WEIGHTS.preco) +
      (form.score_qualidade * SCORE_WEIGHTS.qualidade) +
      (form.score_responsividade * SCORE_WEIGHTS.responsividade)
    ).toFixed(1);
  }, [form.score_prazo, form.score_preco, form.score_qualidade, form.score_responsividade]);

  const chartData = useMemo(() => [
    { name: "Prazo", value: form.score_prazo, color: "#ef4444" },
    { name: "Preço", value: form.score_preco, color: "#3b82f6" },
    { name: "Qualidade", value: form.score_qualidade, color: "#10b981" },
    { name: "Resp.", value: form.score_responsividade, color: "#f59e0b" },
  ], [form.score_prazo, form.score_preco, form.score_qualidade, form.score_responsividade]);

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
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <Label>Razão Social *</Label>
                    <Input 
                      value={form.razao_social} 
                      onChange={e => setForm(p => ({ ...p, razao_social: e.target.value.toUpperCase() }))} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CNPJ</Label>
                      <Input 
                        value={form.cnpj} 
                        onChange={e => setForm(p => ({ ...p, cnpj: maskCNPJ(e.target.value) }))} 
                      />
                    </div>
                    <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Contato</Label><Input value={form.contato_nome} onChange={e => setForm(p => ({ ...p, contato_nome: e.target.value }))} /></div>
                    <div><Label>Telefone</Label><Input value={form.contato_telefone} onChange={e => setForm(p => ({ ...p, contato_telefone: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CEP</Label>
                      <Input 
                        value={form.cep} 
                        onChange={e => handleCEPChange(e.target.value)}
                        maxLength={8}
                      />
                    </div>
                    <div>
                      <Label>Município</Label>
                      <Input value={form.municipio} onChange={e => setForm(p => ({ ...p, municipio: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <Label>UF</Label>
                      <Input value={form.uf} onChange={e => setForm(p => ({ ...p, uf: e.target.value.toUpperCase() }))} maxLength={2} />
                    </div>
                    <div className="col-span-3">
                      <Label>E-mail</Label>
                      <Input value={form.contato_email} onChange={e => setForm(p => ({ ...p, contato_email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-1">
                      <Label>Endereço (Rua)</Label>
                      <Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} />
                    </div>
                    <div className="col-span-1">
                      <Label>Complemento</Label>
                      <Input value={form.complemento} onChange={e => setForm(p => ({ ...p, complemento: e.target.value }))} />
                    </div>
                  </div>
                  <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} /></div>
                </div>

                <div className="space-y-4 border-l pl-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-1">Cálculo de Score</h3>
                      <div className="text-3xl font-bold text-primary">{calculatedScore}</div>
                    </div>
                    <Badge variant={Number(calculatedScore) >= 70 ? "default" : Number(calculatedScore) >= 40 ? "secondary" : "destructive"}>
                      {Number(calculatedScore) >= 70 ? "Excelente" : Number(calculatedScore) >= 40 ? "Regular" : "Crítico"}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs">Prazo (40%) - 0 a 100</Label>
                      </div>
                      <Input 
                        type="number" min={0} max={100}
                        value={form.score_prazo} 
                        onChange={e => setForm(p => ({ ...p, score_prazo: Math.min(100, Math.max(0, Number(e.target.value))) }))} 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs">Preço (30%) - 0 a 100</Label>
                      </div>
                      <Input 
                        type="number" min={0} max={100}
                        value={form.score_preco} 
                        onChange={e => setForm(p => ({ ...p, score_preco: Math.min(100, Math.max(0, Number(e.target.value))) }))} 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs">Qualidade (20%) - 0 a 100</Label>
                      </div>
                      <Input 
                        type="number" min={0} max={100}
                        value={form.score_qualidade} 
                        onChange={e => setForm(p => ({ ...p, score_qualidade: Math.min(100, Math.max(0, Number(e.target.value))) }))} 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs">Responsividade (10%) - 0 a 100</Label>
                      </div>
                      <Input 
                        type="number" min={0} max={100}
                        value={form.score_responsividade} 
                        onChange={e => setForm(p => ({ ...p, score_responsividade: Math.min(100, Math.max(0, Number(e.target.value))) }))} 
                      />
                    </div>
                  </div>

                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 10 }}>
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis dataKey="name" type="category" scale="band" tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <Button onClick={handleSave} className="w-full" disabled={!form.razao_social || create.isPending || update.isPending}>
                    {editing ? "Salvar Alterações" : "Cadastrar Fornecedor"}
                  </Button>
                </div>
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
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Badge 
                          className="cursor-help"
                          variant={f.score >= 70 ? "default" : f.score >= 40 ? "secondary" : "destructive"}
                        >
                          {Number(f.score || 0).toFixed(1)}
                        </Badge>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-60">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Detalhamento do Score</h4>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-muted-foreground">Prazo (40%) - 0 a 100:</span>
                            <span className="text-right font-medium">{f.score_prazo || 0}</span>
                            <span className="text-muted-foreground">Preço (30%) - 0 a 100:</span>
                            <span className="text-right font-medium">{f.score_preco || 0}</span>
                            <span className="text-muted-foreground">Qualidade (20%) - 0 a 100:</span>
                            <span className="text-right font-medium">{f.score_qualidade || 0}</span>
                            <span className="text-muted-foreground">Resp. (10%) - 0 a 100:</span>
                            <span className="text-right font-medium">{f.score_responsividade || 0}</span>
                          </div>
                          <div className="h-20 w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                { subject: 'P', A: f.score_prazo || 0 },
                                { subject: 'V', A: f.score_preco || 0 },
                                { subject: 'Q', A: f.score_qualidade || 0 },
                                { subject: 'R', A: f.score_responsividade || 0 },
                              ]}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                <Radar dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
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
