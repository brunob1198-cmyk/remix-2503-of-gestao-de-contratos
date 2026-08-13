import { useState, useRef, useMemo, useEffect } from "react";
import { useScItens } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { DataTable, DataTableColumnHeader, DataTableColumnFilter, multiSelectFilter } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

export function ItensTab() {
  const { itens, isLoading, create, update, remove, bulkCreate, bulkRemove } = useScItens();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ codigo: "", descricao: "", unidade: "UN", categoria: "", especificacao: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetForm = () => { setForm({ codigo: "", descricao: "", unidade: "UN", categoria: "", especificacao: "" }); setEditing(null); };

  const handleSave = () => {
    if (editing) {
      update.mutate({ id: editing.id, ...form }, { onSuccess: () => { setOpen(false); resetForm(); } });
    } else {
      create.mutate(form, { onSuccess: () => { setOpen(false); resetForm(); } });
    }
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    setForm({ codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, categoria: item.categoria || "", especificacao: item.especificacao || "" });
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
          toast({ title: "Planilha vazia", description: "Nenhuma linha encontrada.", variant: "destructive" });
          return;
        }

        const colMap: Record<string, string> = {};
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        for (const k of keys) {
          const kl = k.toLowerCase().trim();
          if (kl.includes("codigo") || kl.includes("código") || kl === "cod") colMap.codigo = k;
          else if (kl.includes("descri")) colMap.descricao = k;
          else if (kl.includes("unid")) colMap.unidade = k;
          else if (kl.includes("categ")) colMap.categoria = k;
          else if (kl.includes("espec")) colMap.especificacao = k;
        }

        if (!colMap.codigo || !colMap.descricao) {
          toast({ title: "Colunas obrigatórias não encontradas", description: "A planilha precisa ter colunas 'Código' e 'Descrição'.", variant: "destructive" });
          return;
        }

        const items = rows
          .filter(r => r[colMap.codigo] && r[colMap.descricao])
          .map(r => ({
            codigo: String(r[colMap.codigo]).trim(),
            descricao: String(r[colMap.descricao]).trim(),
            unidade: colMap.unidade ? String(r[colMap.unidade] || "UN").trim() : "UN",
            categoria: colMap.categoria ? String(r[colMap.categoria] || "").trim() : "",
            especificacao: colMap.especificacao ? String(r[colMap.especificacao] || "").trim() : "",
          }));

        if (items.length === 0) {
          toast({ title: "Nenhum item válido", description: "Verifique se as colunas Código e Descrição estão preenchidas.", variant: "destructive" });
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
      { Código: "MAT-001", Descrição: "Cabo de cobre 10mm²", Unidade: "M", Categoria: "Cabos", Especificação: "NBR 5410" },
      { Código: "MAT-002", Descrição: "Poste de concreto 12m", Unidade: "UN", Categoria: "Postes", Especificação: "" },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);
    ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Itens");
    XLSX.writeFile(wb, "modelo_itens_suprimentos.xlsx");
  };

  const columns: ColumnDef<any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Selecionar todos"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "codigo",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader column={column} title="Código" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtrar Código" 
            options={Array.from(new Set(itens.map((i: any) => i.codigo).filter(Boolean))).sort().map(v => ({ label: String(v), value: String(v) }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => <span className="font-mono">{row.getValue("codigo")}</span>,
    },
    {
      accessorKey: "descricao",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader column={column} title="Descrição" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtrar Descrição" 
            options={Array.from(new Set(itens.map((i: any) => i.descricao).filter(Boolean))).sort().map(v => ({ label: String(v), value: String(v) }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
    },
    {
      accessorKey: "unidade",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader column={column} title="Unidade" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtrar Unidade" 
            options={Array.from(new Set(itens.map((i: any) => i.unidade).filter(Boolean))).sort().map(v => ({ label: String(v), value: String(v) }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
    },
    {
      accessorKey: "categoria",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader column={column} title="Categoria" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtrar Categoria" 
            options={Array.from(new Set(itens.map((i: any) => i.categoria).filter(Boolean))).sort().map(c => ({ label: String(c), value: String(c) }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const cat = row.getValue("categoria") as string;
        return cat ? <Badge variant="outline">{cat}</Badge> : "—";
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Ação</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => remove.mutate(row.original.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];


  const processedItems = useMemo(() => itens, [itens]);

  const handleBulkDelete = () => {
    const selectedIds = Object.keys(rowSelection).filter(key => rowSelection[key]);
    if (selectedIds.length === 0) return;
    
    if (confirm(`Deseja excluir ${selectedIds.length} itens selecionados?`)) {
      bulkRemove.mutate(selectedIds, {
        onSuccess: () => {
          setRowSelection({});
        }
      });
    }
  };

  const selectedCount = Object.keys(rowSelection).filter(key => rowSelection[key]).length;


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Itens de Suprimentos</CardTitle>
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
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Item</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} /></div>
                  <div><Label>Unidade *</Label><Input value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} /></div>
                </div>
                <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
                <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></div>
                <div><Label>Especificação</Label><Input value={form.especificacao} onChange={e => setForm(p => ({ ...p, especificacao: e.target.value }))} /></div>
                <Button onClick={handleSave} disabled={!form.codigo || !form.descricao}>
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
        ) : (
          <DataTable 
            columns={columns} 
            data={processedItems} 
            searchKey="descricao"
            searchPlaceholder="Buscar itens..."
            persistKey="sc_itens"
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            bulkActions={
              selectedCount > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  disabled={bulkRemove.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir ({selectedCount})
                </Button>
              )
            }
          />

        )}
      </CardContent>
    </Card>
  );
}
