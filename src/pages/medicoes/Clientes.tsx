import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Upload, Trash2, Edit } from "lucide-react";
import { useClientes } from "@/hooks/useClientes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTableFilters } from "@/hooks/useTableFilters";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";

const columns = ["razao_social", "cnpj", "endereco_completo"] as const;
type ColKey = typeof columns[number];

export default function ClientesPage() {
  const { clientes, isLoading, createCliente, updateCliente, deleteCliente } = useClientes();
  const [busca, setBusca] = useState("");
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getColValue = (c: any, col: ColKey): string => c[col] || "-";
  const { sortColumn, sortDir, searchTexts, selectedFilters, handleSort, setSearchText, toggleValue, selectAll, clearAll, clearAllFilters, hasActiveFilters, processedItems, uniqueValues, paginatedItems, currentPage, setCurrentPage, totalPages, itemsPerPage, setItemsPerPage } = useTableFilters(clientes, columns, getColValue);

  const columnLabels: Record<ColKey, string> = { razao_social: "Razão Social", cnpj: "CNPJ", endereco_completo: "Município/Endereço" };


  const resetForm = () => {
    setEditingId(null);
    setRazaoSocial("");
    setCnpj("");
    setCep("");
    setEndereco("");
    setLogoUrl("");
  };

  const handleOpenNew = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleEdit = (cliente: any) => {
    setEditingId(cliente.id);
    setRazaoSocial(cliente.razao_social);
    setCnpj(cliente.cnpj || "");
    setCep(cliente.cep || "");
    setEndereco(cliente.endereco_completo || "");
    setLogoUrl(cliente.logo_url || "");
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!razaoSocial) {
      toast.error("A Razão Social é obrigatória!");
      return;
    }

    const payload = {
      razao_social: razaoSocial,
      cnpj,
      cep,
      endereco_completo: endereco,
      logo_url: logoUrl
    };

    try {
      if (editingId) {
        await updateCliente.mutateAsync({ id: editingId, ...payload });
      } else {
        await createCliente.mutateAsync(payload);
      }
      setIsOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    try {
      await deleteCliente.mutateAsync(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
      
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      
      if (data.publicUrl) {
        setLogoUrl(data.publicUrl);
        toast.success("Logo carregada com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao fazer upload da logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 8) value = value.slice(0, 8);
    
    // Mask: XX.XXX-XXX
    let masked = value;
    if (value.length >= 6) {
      masked = `${value.slice(0, 2)}.${value.slice(2, 5)}-${value.slice(5)}`;
    } else if (value.length >= 3) {
      masked = `${value.slice(0, 2)}.${value.slice(2)}`;
    }
    setCep(masked);

    if (value.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const data = await response.json();
        
        if (data.erro) {
          toast.error("CEP não encontrado.");
        } else {
          setEndereco(`${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`);
          toast.success("Endereço preenchido automaticamente.");
        }
      } catch (err) {
        toast.error("Erro ao buscar o CEP.");
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Lista de Clientes</h2>
          <p className="text-sm text-muted-foreground">Adicione os clientes que farão parte dos projetos e sites.</p>
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearAllFilters}>Limpar Filtros</Button>
          )}
          <Button onClick={handleOpenNew}>Adicionar Cliente</Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Logo</TableHead>
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
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : processedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.logo_url ? (
                      <div className="h-8 w-8 rounded overflow-hidden bg-white border flex items-center justify-center">
                        <img src={c.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {c.razao_social.substring(0,2).toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{c.razao_social}</TableCell>
                  <TableCell>{c.cnpj || "-"}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[200px]">{c.endereco_completo || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh]">
            <div className="space-y-4 p-1">
              <div className="space-y-2">
                <Label>Logo do Cliente (opcional)</Label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div className="relative h-20 w-32 bg-white border-2 border-primary/20 rounded-lg overflow-hidden flex items-center justify-center group shadow-sm">
                      <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 backdrop-blur-[1px]">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="h-8 px-3" 
                          onClick={() => setLogoUrl("")}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleUploadClick} 
                      disabled={isUploading} 
                      className="h-20 w-32 border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1 rounded-lg"
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-primary/60" />
                          <span className="text-[11px] font-medium text-primary/70">Upload Logo</span>
                        </>
                      )}
                    </Button>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/svg+xml" onChange={handleFileChange} />
                </div>
                <p className="text-[10px] text-muted-foreground italic">Arquivos PNG, JPG ou SVG de até 5MB.</p>
              </div>

              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Empresa XYZ" />
              </div>
              
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>CEP</Label>
                  {isLoadingCep && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <Input value={cep} onChange={handleCepChange} placeholder="00.000-000" maxLength={10} />
              </div>

              <div className="space-y-2">
                <Label>Endereço Completo</Label>
                <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Número, Bairro, Cidade - UF" />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createCliente.isPending || updateCliente.isPending || isUploading}>
                  {(createCliente.isPending || updateCliente.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
