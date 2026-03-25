import { useState, useMemo } from "react";
import { useProjetos } from "@/hooks/useProjetos";
import { useClientes } from "@/hooks/useClientes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, FolderKanban, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SortField = "codigo" | "nome" | "cliente" | "coordenador" | "status";
type SortDir = "asc" | "desc" | null;

function useColumnFilter(projetos: any[], field: SortField) {
  const uniqueValues = useMemo(() => {
    const vals = projetos.map((p: any) => p[field] || "-").filter(Boolean);
    return [...new Set(vals)].sort();
  }, [projetos, field]);
  return uniqueValues;
}

export default function ProjetosPage() {
  const { projetos, isLoading, createProjeto, updateProjeto, deleteProjeto } = useProjetos();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [coordenador, setCoordenador] = useState("");
  const [clienteId, setClienteId] = useState("");
  const { clientes } = useClientes();

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Filters (text search per column)
  const [filters, setFilters] = useState<Record<string, string>>({});
  // Dropdown selection filters
  const [dropdownFilters, setDropdownFilters] = useState<Record<string, string>>({});

  const resetForm = () => {
    setCodigo("");
    setNome("");
    setDescricao("");
    setCoordenador("");
    setClienteId("");
    setEditingId(null);
  };

  const handleEdit = (projeto: any) => {
    setEditingId(projeto.id);
    setCodigo(projeto.codigo);
    setNome(projeto.nome);
    setDescricao(projeto.descricao || "");
    setCoordenador(projeto.coordenador || "");
    setClienteId(projeto.cliente_id || "");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clienteObj = clientes.find(c => c.id === clienteId);
    const data = { 
      codigo, 
      nome, 
      descricao, 
      coordenador, 
      cliente: clienteObj ? clienteObj.razao_social : "", 
      cliente_id: clienteId === "none" || !clienteId ? undefined : clienteId 
    };

    if (editingId) {
      updateProjeto.mutate({ id: editingId, ...data }, {
        onSuccess: () => { setIsOpen(false); resetForm(); }
      });
    } else {
      createProjeto.mutate(data, {
        onSuccess: () => { setIsOpen(false); resetForm(); }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este projeto?")) {
      deleteProjeto.mutate(id);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const setFilter = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const setDropdownFilter = (field: string, value: string) => {
    setDropdownFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearAllFilters = () => {
    setFilters({});
    setDropdownFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v) || Object.values(dropdownFilters).some(v => v);

  // Apply filters then sort
  const filteredSorted = useMemo(() => {
    let result = [...projetos];

    // Text filters
    for (const [field, value] of Object.entries(filters)) {
      if (value) {
        result = result.filter((p: any) =>
          (p[field] || "").toString().toLowerCase().includes(value.toLowerCase())
        );
      }
    }

    // Dropdown filters
    for (const [field, value] of Object.entries(dropdownFilters)) {
      if (value) {
        result = result.filter((p: any) => {
          const cellVal = (p[field] || "-").toString();
          return cellVal === value;
        });
      }
    }

    // Sort
    if (sortField && sortDir) {
      result.sort((a: any, b: any) => {
        const va = (a[sortField] || "").toString().toLowerCase();
        const vb = (b[sortField] || "").toString().toLowerCase();
        const cmp = va.localeCompare(vb);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [projetos, filters, dropdownFilters, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: { field: SortField; label: string }[] = [
    { field: "codigo", label: "Código" },
    { field: "nome", label: "Nome" },
    { field: "cliente", label: "Cliente" },
    { field: "coordenador", label: "Coordenador" },
    { field: "status", label: "Status" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Projetos</h2>
          <p className="text-sm text-muted-foreground">Gerencie os projetos e suas obras</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: R038.24" required />
                </div>
                <div className="space-y-2">
                  <Label>Cliente (Opcional)</Label>
                  <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do projeto" required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do projeto" />
              </div>
              <div className="space-y-2">
                <Label>Coordenador</Label>
                <Input value={coordenador} onChange={(e) => setCoordenador(e.target.value)} placeholder="Nome do coordenador" />
              </div>
              <Button type="submit" className="w-full" disabled={createProjeto.isPending || updateProjeto.isPending}>
                {(createProjeto.isPending || updateProjeto.isPending) ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editingId ? "Salvando..." : "Criando..."}</>
                ) : (
                  editingId ? "Salvar Alterações" : "Criar Projeto"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              Lista de Projetos ({filteredSorted.length})
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {projetos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum projeto cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <ColumnHeader
                      key={col.field}
                      field={col.field}
                      label={col.label}
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                      filterText={filters[col.field] || ""}
                      onFilterText={(v) => setFilter(col.field, v)}
                      dropdownValue={dropdownFilters[col.field] || ""}
                      onDropdownChange={(v) => setDropdownFilter(col.field, v)}
                      options={[...new Set(projetos.map((p: any) => (p[col.field] || "-").toString()))].sort()}
                    />
                  ))}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum projeto encontrado com os filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSorted.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-semibold">{p.codigo}</TableCell>
                      <TableCell>{p.nome}</TableCell>
                      <TableCell>{p.clienteObj?.razao_social || p.cliente || "-"}</TableCell>
                      <TableCell>{p.coordenador || "-"}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          {p.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ColumnHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  filterText,
  onFilterText,
  dropdownValue,
  onDropdownChange,
  options,
}: {
  field: SortField;
  label: string;
  sortField: SortField | null;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  filterText: string;
  onFilterText: (v: string) => void;
  dropdownValue: string;
  onDropdownChange: (v: string) => void;
  options: string[];
}) {
  const isActive = sortField === field;
  const SortIcon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const hasFilter = !!filterText || !!dropdownValue;

  return (
    <TableHead className="p-0">
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSort(field)}
            className="flex items-center gap-1 hover:text-foreground transition-colors text-xs font-medium uppercase tracking-wide"
          >
            {label}
            <SortIcon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className={`ml-auto p-0.5 rounded hover:bg-accent transition-colors ${hasFilter ? "text-primary" : "text-muted-foreground/50"}`}>
                <Filter className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3 space-y-2" align="start">
              <p className="text-xs font-medium text-muted-foreground">Pesquisar</p>
              <Input
                placeholder={`Buscar ${label.toLowerCase()}...`}
                value={filterText}
                onChange={(e) => { onFilterText(e.target.value); onDropdownChange(""); }}
                className="h-8 text-sm"
              />
              <p className="text-xs font-medium text-muted-foreground pt-1">Ou selecionar</p>
              <Select value={dropdownValue} onValueChange={(v) => { onDropdownChange(v === "__all__" ? "" : v); onFilterText(""); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilter && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { onFilterText(""); onDropdownChange(""); }}>
                  Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </TableHead>
  );
}
