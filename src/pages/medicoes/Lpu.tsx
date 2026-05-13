import { useState } from "react";
import { useItensLpu } from "@/hooks/useItensLpu";
import { useProjetos } from "@/hooks/useProjetos";
import { LpuImporter } from "@/components/medicoes/LpuImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileSpreadsheet, Trash2, Loader2, Pencil, Check, X, FilterX, Download } from "lucide-react";
import { toast } from "sonner";
import { useTableFilters } from "@/hooks/useTableFilters";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { ConfirmDeleteDialog } from "@/components/medicoes/ConfirmDeleteDialog";
import XLSX from "xlsx-js-style";

const columns = ["codigo", "descricao", "unidade", "preco_unitario", "bdi", "categoria", "projeto"] as const;
type ColKey = typeof columns[number];

export default function LpuPage() {
  const [projetoFilter, setProjetoFilter] = useState<string>("");
  const { itensLpu, isLoading, deleteItemLpu, updateItemLpu } = useItensLpu();
  const { projetos } = useProjetos();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBdi, setEditBdi] = useState<string>("");
  const [editPreco, setEditPreco] = useState<string>("");
  const [editCodigo, setEditCodigo] = useState<string>("");
  const [editDescricao, setEditDescricao] = useState<string>("");
  const [editUnidade, setEditUnidade] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteItemLpu.mutate(deletingId, {
        onSuccess: () => {
          setSelectedIds((prev) => { const n = new Set(prev); n.delete(deletingId); return n; });
          setDeletingId(null);
        }
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    selectedIds.forEach((id) => deleteItemLpu.mutate(id));
    toast.success(`${selectedIds.size} item(ns) excluído(s)`);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditBdi(String(item.bdi ?? 1));
    setEditPreco(String(item.preco_unitario ?? 0));
    setEditCodigo(item.codigo || "");
    setEditDescricao(item.descricao || "");
    setEditUnidade(item.unidade || "");
  };

  const handleSaveEdit = (id: string) => {
    updateItemLpu.mutate({ 
      id, 
      bdi: parseFloat(editBdi) || 1, 
      preco_unitario: parseFloat(editPreco) || 0,
      codigo: editCodigo,
      descricao: editDescricao,
      unidade: editUnidade
    });
    setEditingId(null);
  };

  const handleCancelEdit = () => setEditingId(null);

  const filteredItems = projetoFilter === "geral"
    ? itensLpu.filter(i => !i.projeto_id)
    : projetoFilter
      ? itensLpu.filter(i => i.projeto_id === projetoFilter)
      : itensLpu;

  const getProjetoNome = (projetoId?: string) => {
    if (!projetoId) return "Geral";
    const projeto = projetos.find(p => p.id === projetoId);
    return projeto ? `${projeto.codigo} - ${projeto.nome}` : "Desconhecido";
  };

  const getColValue = (item: any, col: ColKey): string => {
    if (col === "projeto") return getProjetoNome(item.projeto_id);
    if (col === "preco_unitario") return Number(item.preco_unitario || 0).toFixed(2);
    if (col === "bdi") return Number(item.bdi || 1).toFixed(2);
    return item[col] || "-";
  };

  const { sortColumn, sortDir, searchTexts, selectedFilters, handleSort, setSearchText, toggleValue, selectAll, clearAll, clearAllFilters, hasActiveFilters, processedItems, uniqueValues, paginatedItems, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages } = useTableFilters(filteredItems, columns, getColValue);

  const allSelected = processedItems.length > 0 && processedItems.every((i) => selectedIds.has(i.id));
  const someSelected = processedItems.some((i) => selectedIds.has(i.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedItems.map((i) => i.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const columnLabels: Record<ColKey, string> = { codigo: "Código", descricao: "Descrição", unidade: "Unidade", preco_unitario: "Preço Unitário", bdi: "BDI", categoria: "Categoria", projeto: "Projeto" };

  const exportToExcel = () => {
    if (processedItems.length === 0) {
      toast.error("Não há itens para exportar");
      return;
    }

    const header = [
      "Código",
      "Descrição",
      "Unidade",
      "Preço Unitário",
      "BDI",
      "Categoria",
      "Projeto"
    ];

    const rows = processedItems.map(item => [
      item.codigo || "",
      item.descricao || "",
      item.unidade || "",
      item.preco_unitario || 0,
      item.bdi || 1,
      item.categoria || "",
      getProjetoNome(item.projeto_id)
    ]);

    const worksheetData = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Estilo do cabeçalho
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F46E5" } }, // Indigo 600
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    };

    // Aplicar estilos às células do cabeçalho
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      ws[address].s = headerStyle;
    }

    // Filtros e larguras automáticas
    ws["!autofilter"] = { ref: ws["!ref"] || "" };

    const colWidths = header.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(row => {
        const val = String(row[i] || "");
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws["!cols"] = colWidths;

    // Criar aba de resumo
    const summaryData = [
      ["Resumo da Lista de Preços Unitária"],
      [""],
      ["Data de Geração", new Date().toLocaleString("pt-BR")],
      ["Total de Itens", processedItems.length],
      ["Projeto Filtrado", projetoFilter ? getProjetoNome(projetoFilter === "geral" ? undefined : projetoFilter) : "Todos"],
      [""],
      ["Média de Preço Unitário", rows.reduce((acc, curr) => acc + (Number(curr[3]) || 0), 0) / rows.length],
      ["Média de BDI", rows.reduce((acc, curr) => acc + (Number(curr[4]) || 0), 0) / rows.length]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Estilo do título do resumo
    wsSummary["A1"].s = { font: { bold: true, size: 14 } };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Itens LPU");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

    const fileName = `LPU_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Excel gerado com sucesso!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Lista de Preços Unitária (LPU)</h2>
        <p className="text-sm text-muted-foreground">Importe ou gerencie os itens da tabela de preços por projeto</p>
      </div>

      <LpuImporter />

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Itens Cadastrados ({processedItems.length})
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToExcel}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <FilterX className="h-4 w-4 mr-1" /> Limpar filtros de coluna
                </Button>
              )}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selecionado(s)</span>
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionados
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Filtrar por Projeto</Label>
              <Select value={projetoFilter || "all"} onValueChange={(v) => setProjetoFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Todos os projetos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  <SelectItem value="geral">Itens Gerais (sem projeto)</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum item cadastrado. Importe uma planilha Excel acima.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Selecionar todos"
                        {...(someSelected && !allSelected ? { "data-state": "indeterminate" as const } : {})}
                      />
                    </TableHead>
                    {columns.map(col => (
                      <TableHead key={col} className={col === "preco_unitario" || col === "bdi" ? "text-right" : ""}>
                        <ColumnHeader
                          label={columnLabels[col]}
                          sortDir={sortColumn === col ? sortDir : null}
                          onSort={() => handleSort(col)}
                          searchText={searchTexts[col]}
                          onSearchChange={(v) => setSearchText(col, v)}
                          uniqueValues={uniqueValues[col]}
                          selectedValues={selectedFilters[col]}
                          onToggleValue={(v) => toggleValue(col, v)}
                          onSelectAll={() => selectAll(col, uniqueValues[col])}
                          onClearAll={() => clearAll(col)}
                        />
                      </TableHead>
                    ))}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-accent/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleOne(item.id)}
                          aria-label={`Selecionar ${item.codigo}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">
                        {editingId === item.id ? (
                          <Input type="text" value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} className="w-24 font-mono text-sm" />
                        ) : (
                          item.codigo
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {editingId === item.id ? (
                          <Input type="text" value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} className="w-full min-w-[200px]" />
                        ) : (
                          <span className="truncate block">{item.descricao}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <Input type="text" value={editUnidade} onChange={(e) => setEditUnidade(e.target.value)} className="w-20 uppercase" />
                        ) : (
                          item.unidade
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {editingId === item.id ? (
                          <Input type="number" step="0.01" value={editPreco} onChange={(e) => setEditPreco(e.target.value)} className="w-28 text-right" />
                        ) : (
                          formatCurrency(Number(item.preco_unitario))
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === item.id ? (
                          <Input type="number" step="0.01" value={editBdi} onChange={(e) => setEditBdi(e.target.value)} className="w-20 text-right" />
                        ) : (
                          <span className="font-mono">{Number(item.bdi ?? 1).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>{item.categoria || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {item.projeto_id ? getProjetoNome(item.projeto_id) : <span className="text-muted-foreground">Geral</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingId === item.id ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleSaveEdit(item.id)}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleStartEdit(item)}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!isLoading && processedItems.length > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={processedItems.length}
            />
          )}
        </CardContent>
      </Card>
      <ConfirmDeleteDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={confirmDelete}
        itemName={itensLpu.find(i => i.id === deletingId)?.codigo || "este item"}
        loading={deleteItemLpu.isPending}
      />

      <ConfirmDeleteDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={confirmBulkDelete}
        title="Excluir Vários Itens"
        description={`Tem certeza que deseja excluir ${selectedIds.size} itens selecionados? Esta ação não pode ser desfeita.`}
        loading={deleteItemLpu.isPending}
      />
    </div>
  );
}
