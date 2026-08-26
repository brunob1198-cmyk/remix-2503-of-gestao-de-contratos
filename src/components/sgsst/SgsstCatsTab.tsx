import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Siren, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { gerarPdfCat, pendenciasCat } from "@/lib/catDocumento";
import { fotosDoRegistroParaDocumento } from "@/hooks/sgsst/useSgsstEvidencias";
import { format, parseISO } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermissions } from "@/hooks/usePermissions";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { CatFormDialog } from "@/components/sgsst/CatFormDialog";
import {
  useSgsstCats,
  TIPO_CAT_LABEL,
  type SgsstCat,
  type TipoCat,
} from "@/hooks/sgsst/useSgsstCats";

/**
 * Registro de CAT — Comunicação de Acidente de Trabalho.
 *
 * Alimenta a alínea "e" do relatório analítico (NR-07 7.6.2). Era o único dos seis
 * itens obrigatórios do relatório sem lugar no sistema.
 */
export function SgsstCatsTab() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pcmso");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [filterTipo, setFilterTipo] = useState("todos");

  const { cats, total, isLoading, error, refetch, createCat, updateCat, removeCat } =
    useSgsstCats({ page, pageSize, search: debouncedSearch, tipo: filterTipo });

  const { profile } = useAuth();
  const { empresa } = useEmpresaAtual();
  const [emitindoId, setEmitindoId] = useState<string | null>(null);

  /**
   * Emite a CAT em PDF.
   *
   * As pendências saem como aviso e não como bloqueio: a comunicação existe e
   * precisa poder ser impressa mesmo incompleta — o PDF marca cada campo
   * faltante em vez de omitir. Impedir a emissão só esconderia o problema.
   */
  const emitir = async (cat: SgsstCat) => {
    setEmitindoId(cat.id);
    try {
      const dados = { cat, empresa, geradoPor: profile?.nome ?? null };
      const pendencias = pendenciasCat(dados);

      // As fotos do incidente vinculado. O incidente nao tem documento proprio, e
      // este registro interno e o unico lugar onde elas saem impressas.
      const fotosDoIncidente = await fotosDoRegistroParaDocumento(
        "INCIDENTE",
        cat.incidente_id
      );

      await gerarPdfCat({ ...dados, fotosDoIncidente });

      if (pendencias.length > 0) {
        toast.warning(
          `CAT emitida com ${pendencias.length} pendência(s): ${pendencias.join(" · ")}`,
          { duration: 10000 }
        );
      } else {
        toast.success("CAT emitida.");
      }
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao emitir a CAT: ${detalhe}`);
    } finally {
      setEmitindoId(null);
    }
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<SgsstCat | null>(null);

  const totalPages = Math.ceil(total / pageSize) || 1;

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterTipo]);

  const temFiltroAtivo = searchTerm.trim().length > 0 || filterTipo !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setFilterTipo("todos");
  };

  const dataBr = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return format(parseISO(iso), "dd/MM/yyyy");
    } catch {
      return iso;
    }
  };

  const nomeTrabalhador = (c: SgsstCat) =>
    c.colaborador?.profile?.nome || c.colaborador?.recurso?.nome || c.colaborador?.nome || "Não informado";

  const handleSave = async (data: Parameters<typeof createCat.mutateAsync>[0]) => {
    if (editingCat) {
      await updateCat.mutateAsync({ id: editingCat.id, ...data });
    } else {
      await createCat.mutateAsync(data);
    }
  };

  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: cats.length === 0,
    modulo: "CATs",
    onRetry: refetch,
    emptyTitulo: "Nenhuma CAT registrada",
    emptyDescricao:
      "A Comunicação de Acidente de Trabalho alimenta a alínea (e) do relatório analítico do PCMSO. Nenhuma CAT é um bom sinal — registre apenas quando houver acidente.",
    emptyAction: allowEdit ? (
      <Button
        size="sm"
        className="gap-2"
        onClick={() => {
          setEditingCat(null);
          setIsFormOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> Registrar CAT
      </Button>
    ) : undefined,
    filtrado: temFiltroAtivo,
    onLimparFiltros: limparFiltros,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Siren className="h-5 w-5 text-destructive" />
            Comunicações de Acidente de Trabalho
          </h2>
          <p className="text-sm text-muted-foreground">
            Base da alínea (e) do relatório analítico anual do PCMSO.
          </p>
        </div>

        {allowEdit && (
          <Button
            onClick={() => {
              setEditingCat(null);
              setIsFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Registrar CAT
          </Button>
        )}
      </div>

      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por número da CAT, CID ou descrição..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={
          filterTipo !== "todos"
            ? [
                {
                  label: "Tipo",
                  value: TIPO_CAT_LABEL[filterTipo as TipoCat] ?? filterTipo,
                  onClear: () => setFilterTipo("todos"),
                },
              ]
            : []
        }
      >
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por tipo de CAT">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.keys(TIPO_CAT_LABEL) as TipoCat[]).map((k) => (
              <SelectItem key={k} value={k}>
                {TIPO_CAT_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SgsstFilterBar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº da CAT</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Trabalhador</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Data do acidente</TableHead>
                <TableHead>CID</TableHead>
                <TableHead className="text-right">Afast.</TableHead>
                <TableHead>Óbito</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="p-0">
                    {tableState}
                  </TableCell>
                </TableRow>
              ) : (
                cats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numero_cat || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.tipo_cat === "COMUNICACAO_OBITO"
                            ? "text-xs bg-red-100 text-red-800 border-red-300"
                            : "text-xs"
                        }
                      >
                        {TIPO_CAT_LABEL[c.tipo_cat]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{nomeTrabalhador(c)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.area?.nome || c.colaborador?.funcao?.nome || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{dataBr(c.data_acidente)}</TableCell>
                    <TableCell className="text-xs font-mono">{c.cid || "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {c.dias_afastamento ?? 0}
                    </TableCell>
                    <TableCell>
                      {c.houve_obito ? (
                        <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-300">
                          Sim
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Emitir fica fora do bloco de edicao: imprimir a
                            comunicacao para apresentar a cliente ou seguradora
                            nao e edicao. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => emitir(c)}
                          disabled={emitindoId === c.id}
                          title="Emitir CAT em PDF"
                        >
                          {emitindoId === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4" />
                          )}
                        </Button>

                        {allowEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCat(c);
                                setIsFormOpen(true);
                              }}
                              title="Editar CAT"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <SgsstConfirmDelete
                              alvo={`a CAT ${c.numero_cat || "sem número"}`}
                              consequencia="O registro sai do relatório analítico do PCMSO, incluindo os dias de afastamento e a estatística por setor. A comunicação ao INSS não é afetada."
                              onConfirm={() => removeCat.mutate(c.id)}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={page + 1}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p - 1)}
            itemsPerPage={pageSize}
            onItemsPerPageChange={(v) => {
              setPageSize(v);
              setPage(0);
            }}
            totalItems={total}
          />
        </CardContent>
      </Card>

      <CatFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        cat={editingCat}
        onSave={handleSave}
        isLoading={createCat.isPending || updateCat.isPending}
      />
    </div>
  );
}
