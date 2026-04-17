import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSites } from "@/hooks/useSites";
import { useEscopos } from "@/hooks/useEscopos";
import { useItensLpu } from "@/hooks/useItensLpu";
import { EscopoItem } from "@/types/medicoes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, SaveAll, Plus, Trash2, Loader2, FileSpreadsheet, FilterX } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { EscopoImporter } from "@/components/medicoes/EscopoImporter";
import { useTableFilters } from "@/hooks/useTableFilters";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";

const columns = ["nome", "unidade", "quantidade", "valor_unitario", "bdi", "custo_unitario", "valor_total", "custo_total"] as const;
type ColKey = typeof columns[number];
export default function EscopoPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { sites } = useSites();
  const site = sites.find(s => s.id === siteId);

  const { itens: dbItens, isLoading: isLoadingEscopo, saveEscopo } = useEscopos(siteId || "");
  const { itensLpu } = useItensLpu(site?.projeto_id);

  const [localItens, setLocalItens] = useState<EscopoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleImportedItens = (imported: EscopoItem[]) => {
    setLocalItens((prev) => [...prev, ...imported]);
    setIsImportOpen(false);
  };

  useEffect(() => {
    if (dbItens && dbItens.length > 0) {
      setLocalItens(dbItens);
    }
  }, [dbItens]);

  if (!siteId) return <div>Site não encontrado</div>;

  // Available LPU items for selection (exclude already added)
  const usedItemIds = new Set(localItens.map(i => i.item_lpu_id).filter(Boolean));
  const availableLpuItems = itensLpu.filter(i => i.ativo && !usedItemIds.has(i.id));

  const handleAddItem = (itemLpuId: string) => {
    const lpuItem = itensLpu.find(i => i.id === itemLpuId);
    if (!lpuItem) return;

    setLocalItens([
      ...localItens,
      {
        id: `temp-${Date.now()}-${Math.random()}`,
        site_id: siteId,
        item_lpu_id: lpuItem.id,
        nome: `${lpuItem.codigo} - ${lpuItem.descricao}`,
        unidade: lpuItem.unidade,
        quantidade: 0,
        valor_unitario: Number(lpuItem.preco_unitario),
        custo_unitario: Number(lpuItem.preco_unitario) / Number(lpuItem.bdi || 1),
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setLocalItens(prev => prev.filter(item => item.id !== id));
  };

  const handleQuantidadeChange = (id: string, value: string) => {
    setLocalItens(prev => prev.map(item => 
      item.id === id ? { ...item, quantidade: parseFloat(value) || 0 } : item
    ));
  };

  const getColValue = (item: EscopoItem, col: ColKey): string => {
    if (col === "valor_total") return (item.quantidade * item.valor_unitario).toString();
    if (col === "custo_total") return (item.quantidade * item.custo_unitario).toString();
    if (col === "bdi") {
      const lpuItem = itensLpu.find(i => i.id === item.item_lpu_id);
      return (Number(lpuItem?.bdi) || 1).toString();
    }
    return String(item[col] || "");
  };

  const { sortColumn, sortDir, searchTexts, selectedFilters, handleSort, setSearchText, toggleValue, selectAll, clearAll, clearAllFilters, hasActiveFilters, processedItems, uniqueValues, paginatedItems, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages } = useTableFilters(localItens, columns, getColValue);
  const columnLabels: Record<ColKey, string> = { nome: "Item LPU", unidade: "Unidade", quantidade: "Quantidade", valor_unitario: "Preço Unit.", bdi: "BDI", custo_unitario: "Custo Unit.", valor_total: "Valor Total", custo_total: "Custo Total" };


  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveEscopo.mutateAsync(localItens);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalReceita = localItens.reduce((acc, curr) => acc + curr.quantidade * curr.valor_unitario, 0);
  const totalCusto = localItens.reduce((acc, curr) => acc + curr.quantidade * curr.custo_unitario, 0);
  const totalMargem = totalReceita - totalCusto;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/medicoes/cadastros?tab=sites")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Escopo da Obra</h1>
            <p className="text-muted-foreground">
              {site ? `${site.codigo} - ${site.nome}` : "Carregando site..."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar Planilha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <EscopoImporter itensLpu={itensLpu} siteId={siteId!} onImport={handleImportedItens} />
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SaveAll className="h-4 w-4 mr-2" />}
            Salvar Escopo
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Receita Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalReceita)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Custo Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalCusto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Margem</p>
            <p className={`text-2xl font-bold ${totalMargem >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totalMargem)} ({totalReceita > 0 ? ((totalMargem / totalReceita) * 100).toFixed(1) : 0}%)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Itens do Escopo (LPU do Projeto)</CardTitle>
              <CardDescription>
                Selecione itens da LPU cadastrada para o projeto e informe as quantidades. Valores e custos são calculados automaticamente.
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <FilterX className="h-4 w-4 mr-1" /> Limpar filtros de coluna
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead key={col} className={col === "nome" ? "min-w-[300px]" : ["valor_unitario", "bdi", "custo_unitario", "valor_total", "custo_total"].includes(col) ? "w-[130px] text-right" : "w-[120px]"}>
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
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingEscopo ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                      Nenhum item adicionado ou encontrado no filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => {
                    const valorTotal = item.quantidade * item.valor_unitario;
                    const custoTotal = item.quantidade * item.custo_unitario;
                    const lpuItem = itensLpu.find(i => i.id === item.item_lpu_id);
                    const bdi = lpuItem ? Number(lpuItem.bdi || 1) : 1;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.nome}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade || ""}
                            onChange={(e) => handleQuantidadeChange(item.id!, e.target.value)}
                            placeholder="0"
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.valor_unitario)}</TableCell>
                        <TableCell className="text-right font-mono">{bdi.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.custo_unitario)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(valorTotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(custoTotal)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(item.id!)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {localItens.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="font-semibold text-right">Totais:</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalReceita)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalCusto)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {/* Add item selector */}
          <div className="mt-4">
            {availableLpuItems.length > 0 ? (
              <Select onValueChange={handleAddItem}>
                <SelectTrigger className="w-full border-dashed">
                  <SelectValue placeholder="➕ Adicionar item da LPU ao escopo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLpuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.codigo} - {item.descricao} ({item.unidade}) - {formatCurrency(Number(item.preco_unitario))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {itensLpu.length === 0
                  ? "Nenhum item de LPU cadastrado para este projeto. Cadastre itens na tela de LPU primeiro."
                  : "Todos os itens da LPU já foram adicionados ao escopo."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
