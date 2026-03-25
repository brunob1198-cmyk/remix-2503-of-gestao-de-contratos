import { useState, useMemo } from "react";
import { useSites } from "@/hooks/useSites";
import { useProjetos } from "@/hooks/useProjetos";
import { useClientes } from "@/hooks/useClientes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, MapPin, Loader2, ClipboardList, ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { useTableFilters } from "@/hooks/useTableFilters";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";

const columns = ["projeto", "codigo", "nome", "cliente", "municipio", "uf"] as const;
type ColKey = typeof columns[number];

export default function SitesPage() {
  const { sites, isLoading, createSite, updateSite, deleteSite } = useSites();
  const { projetos } = useProjetos();
  const { clientes } = useClientes();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterProjetoId, setFilterProjetoId] = useState<string>("");

  const [projetoId, setProjetoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");

  const getColValue = (s: any, col: ColKey): string => {
    if (col === "projeto") return (s.projeto as any)?.codigo || "-";
    if (col === "cliente") return s.clienteObj?.razao_social || "-";
    return s[col] || "-";
  };

  const preFilteredSites = filterProjetoId ? sites.filter(s => s.projeto_id === filterProjetoId) : sites;

  const {
    sortColumn, sortDir, searchTexts, selectedFilters, handleSort, setSearchText, toggleValue,
    selectAll, clearAll, clearAllFilters, hasActiveFilters, processedItems, uniqueValues, paginatedItems,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages
  } = useTableFilters(preFilteredSites, columns, getColValue);

  const resetForm = () => { setProjetoId(""); setClienteId(""); setCodigo(""); setNome(""); setMunicipio(""); setUf(""); setEditingId(null); };

  const handleEdit = (site: any) => {
    setEditingId(site.id); setProjetoId(site.projeto_id); setClienteId(site.cliente_id || ""); setCodigo(site.codigo); setNome(site.nome); setMunicipio(site.municipio || ""); setUf(site.uf || ""); setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { 
      projeto_id: projetoId, 
      cliente_id: clienteId === "none" || !clienteId ? undefined : clienteId, 
      codigo, 
      nome, 
      municipio, 
      uf 
    };
    if (editingId) {
      updateSite.mutate({ id: editingId, ...data }, { onSuccess: () => { setIsOpen(false); resetForm(); } });
    } else {
      createSite.mutate(data, { onSuccess: () => { setIsOpen(false); resetForm(); } });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este site?")) deleteSite.mutate(id);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const columnLabels: Record<ColKey, string> = { projeto: "Projeto", codigo: "Código", nome: "Nome", cliente: "Cliente", municipio: "Município", uf: "UF" };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Sites</h2>
          <p className="text-sm text-muted-foreground">Gerencie os sites/trechos de cada projeto</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterProjetoId || "all"} onValueChange={(v) => setFilterProjetoId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Site</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar Site" : "Novo Site"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Projeto *</Label>
                    <Select value={projetoId} onValueChange={setProjetoId} required>
                      <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                      <SelectContent>{projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente (Opcional)</Label>
                    <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: CEPUU01" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do site/trecho" required />
                  </div>
                </div>
                
                <UfMunicipioSelector
                  uf={uf}
                  municipio={municipio}
                  onUfChange={setUf}
                  onMunicipioChange={setMunicipio}
                />

                <Button type="submit" className="w-full">{editingId ? "Salvar Alterações" : "Criar Site"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Lista de Sites ({processedItems.length})</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {processedItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum site encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead key={col}>
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
                {paginatedItems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{(s.projeto as any)?.codigo || "-"}</TableCell>
                    <TableCell className="font-mono font-semibold">{s.codigo}</TableCell>
                    <TableCell>{s.nome}</TableCell>
                    <TableCell>{s.clienteObj?.razao_social || "-"}</TableCell>
                    <TableCell>{s.municipio || "-"}</TableCell>
                    <TableCell>{s.uf || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/medicoes/sites/${s.id}/escopo`)} title="Escopo da Obra"><ClipboardList className="h-4 w-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </div>
  );
}
