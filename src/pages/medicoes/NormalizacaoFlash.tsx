import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Eye,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFlashNormalizacao,
  type FlashTransactionRow,
  type ContaAzulOption,
} from "@/hooks/useFlashNormalizacao";
import { exportNormalizacaoFlashToExcel } from "@/lib/flashNormalizacaoExport";

const formatCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

const statusBadge = (status: string | undefined) => {
  switch (status) {
    case "normalizado":
      return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20">Normalizado</Badge>;
    case "enviado":
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">Enviado</Badge>;
    default:
      return <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-300">Pendente</Badge>;
  }
};

interface OptionSelectProps {
  options: ContaAzulOption[];
  value: string | null | undefined;
  onChange: (id: string, name: string) => void;
  placeholder: string;
  disabled?: boolean;
}

function OptionSelect({ options, value, onChange, placeholder, disabled }: OptionSelectProps) {
  return (
    <Select
      value={value || ""}
      onValueChange={(v) => {
        const opt = options.find((o) => o.id === v);
        onChange(v, opt?.name || "");
      }}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">Nenhuma opção</div>
        )}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function NormalizacaoFlashPage() {
  const {
    loading,
    savingId,
    sending,
    transactions,
    categorias,
    contas,
    mappings,
    mappingByType,
    loadingMetadata,
    metadataError,
    refresh,
    refreshMetadata,
    saveNormalization,
    applyMappingToAllPending,
    bulkApplyToPending,
    reopenEnviado,
    sendToContaAzul,
  } = useFlashNormalizacao();

  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"lancamentos" | "pendentes" | "mapeamentos">("lancamentos");

  // Dialogs
  const [payloadDialogRow, setPayloadDialogRow] = useState<FlashTransactionRow | null>(null);
  const [motivoDialogRow, setMotivoDialogRow] = useState<FlashTransactionRow | null>(null);
  const [confirmReopenRow, setConfirmReopenRow] = useState<FlashTransactionRow | null>(null);

  // Bulk pendentes
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [bulkCat, setBulkCat] = useState<{ id: string; name: string } | null>(null);
  const [bulkAcc, setBulkAcc] = useState<{ id: string; name: string } | null>(null);
  const [bulkTipo, setBulkTipo] = useState<"receita" | "despesa">("despesa");
  const [bulkSaveMapping, setBulkSaveMapping] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== "todos" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.descricao.toLowerCase().includes(q) &&
          !t.usuario.toLowerCase().includes(q) &&
          !t.flash_type.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [transactions, statusFilter, search]);

  const pendentes = useMemo(
    () => transactions.filter((t) => t.status === "pendente"),
    [transactions]
  );

  const counts = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        acc.total += 1;
        if (t.status === "normalizado") acc.normalizado += 1;
        else if (t.status === "enviado") acc.enviado += 1;
        else acc.pendente += 1;
        return acc;
      },
      { total: 0, pendente: 0, normalizado: 0, enviado: 0 }
    );
  }, [transactions]);

  const handleApplyMapping = async (row: FlashTransactionRow) => {
    const m = mappingByType.get(row.flash_type);
    if (!m) return;
    await saveNormalization(row, {
      conta_azul_category_id: m.conta_azul_category_id,
      conta_azul_category_name: m.conta_azul_category_name,
      conta_azul_account_id: m.conta_azul_account_id,
      conta_azul_account_name: m.conta_azul_account_name,
      tipo_operacao: m.tipo_operacao,
      status: "normalizado",
    });
  };

  const handleExport = () => {
    try {
      exportNormalizacaoFlashToExcel(filtered.length ? filtered : transactions);
      toast.success("Planilha exportada com sucesso");
    } catch (e: any) {
      toast.error("Falha ao exportar", { description: e.message });
    }
  };

  const togglePendingSelect = (id: string, checked: boolean) => {
    setSelectedPendingIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
    );
  };

  const allPendingSelected =
    pendentes.length > 0 && selectedPendingIds.length === pendentes.length;

  const togglePendingAll = (checked: boolean) => {
    setSelectedPendingIds(checked ? pendentes.map((p) => p.id) : []);
  };

  const handleBulkApply = async () => {
    if (!bulkCat || !bulkAcc) {
      toast.error("Selecione categoria e conta financeira");
      return;
    }
    if (!selectedPendingIds.length) {
      toast.error("Selecione ao menos um lançamento pendente");
      return;
    }
    setBulkApplying(true);
    try {
      await bulkApplyToPending(selectedPendingIds, {
        conta_azul_category_id: bulkCat.id,
        conta_azul_category_name: bulkCat.name,
        conta_azul_account_id: bulkAcc.id,
        conta_azul_account_name: bulkAcc.name,
        tipo_operacao: bulkTipo,
        saveMappingPerType: bulkSaveMapping,
      });
      setSelectedPendingIds([]);
    } finally {
      setBulkApplying(false);
    }
  };

  const renderActionButtons = (row: FlashTransactionRow) => {
    const hasMapping = mappingByType.has(row.flash_type);
    const isSaving = savingId === row.id;
    const isEnviado = row.status === "enviado";
    return (
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setMotivoDialogRow(row)}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver motivo da normalização</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPayloadDialogRow(row)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver payload pronto</TooltipContent>
        </Tooltip>
        {hasMapping && row.status === "pendente" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleApplyMapping(row)}
                disabled={isSaving}
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aplicar mapeamento salvo</TooltipContent>
          </Tooltip>
        )}
        {row.status === "normalizado" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600"
                disabled={sending}
                onClick={() => sendToContaAzul([row.id])}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar ao Conta Azul</TooltipContent>
          </Tooltip>
        )}
        {isEnviado ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-amber-600"
                onClick={() => setConfirmReopenRow(row)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reabrir para correção</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={
                  isSaving ||
                  !row.conta_azul_category_id ||
                  !row.conta_azul_account_id
                }
                onClick={() =>
                  saveNormalization(
                    row,
                    { status: "normalizado" },
                    { saveMapping: true }
                  )
                }
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salvar e criar mapeamento</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Normalização Flash</h1>
          <p className="text-sm text-muted-foreground">
            Associe os lançamentos da Flash com categorias e contas do Conta Azul antes do envio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || transactions.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={refreshMetadata} disabled={loadingMetadata}>
            {loadingMetadata ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar Conta Azul
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Recarregar
          </Button>
          <Button size="sm" onClick={applyMappingToAllPending} disabled={mappings.length === 0}>
            <Wand2 className="h-4 w-4 mr-2" />
            Aplicar mapeamentos aos pendentes
          </Button>
        </div>
      </div>

      {metadataError && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-300">
            ⚠ {metadataError}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{counts.pendente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Normalizados</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{counts.normalizado}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Enviados</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{counts.enviado}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="pendentes">Revisar Pendentes ({counts.pendente})</TabsTrigger>
          <TabsTrigger value="mapeamentos">Mapeamentos salvos ({mappings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Lançamentos Flash</CardTitle>
                <div className="ml-auto flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="pl-8 h-9 w-[200px]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="normalizado">Normalizado</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum lançamento encontrado. Sincronize dados na tela "Integração Flash".
                </div>
              ) : (
                <TooltipProvider delayDuration={200}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[90px]">Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[110px] text-right">Valor</TableHead>
                          <TableHead className="w-[120px]">Usuário</TableHead>
                          <TableHead className="w-[120px]">Tipo Flash</TableHead>
                          <TableHead className="w-[110px]">Operação</TableHead>
                          <TableHead className="w-[200px]">Categoria CA</TableHead>
                          <TableHead className="w-[200px]">Conta financeira CA</TableHead>
                          <TableHead className="w-[110px]">Status</TableHead>
                          <TableHead className="w-[160px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((row) => {
                          const hasMapping = mappingByType.has(row.flash_type);
                          const isEnviado = row.status === "enviado";
                          const fieldsDisabled = isEnviado || loadingMetadata;
                          return (
                            <TableRow key={row.id} className={isEnviado ? "opacity-80" : undefined}>
                              <TableCell className="text-xs">{formatDate(row.data)}</TableCell>
                              <TableCell className="max-w-[300px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate text-xs">{row.descricao}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs break-words">{row.descricao}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium tabular-nums">
                                {formatCurrency(row.valor)}
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-[120px]">{row.usuario}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {row.flash_type}
                                  </Badge>
                                  {hasMapping && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Sparkles className="h-3 w-3 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>Mapeamento disponível</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={row.tipo_operacao || "despesa"}
                                  onValueChange={(v) =>
                                    saveNormalization(row, { tipo_operacao: v as "receita" | "despesa" })
                                  }
                                  disabled={fieldsDisabled}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="despesa" className="text-xs">Despesa</SelectItem>
                                    <SelectItem value="receita" className="text-xs">Receita</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <OptionSelect
                                  options={categorias}
                                  value={row.conta_azul_category_id}
                                  onChange={(id, name) =>
                                    saveNormalization(row, {
                                      conta_azul_category_id: id,
                                      conta_azul_category_name: name,
                                    })
                                  }
                                  placeholder="Selecionar categoria..."
                                  disabled={fieldsDisabled}
                                />
                              </TableCell>
                              <TableCell>
                                <OptionSelect
                                  options={contas}
                                  value={row.conta_azul_account_id}
                                  onChange={(id, name) =>
                                    saveNormalization(row, {
                                      conta_azul_account_id: id,
                                      conta_azul_account_name: name,
                                    })
                                  }
                                  placeholder="Selecionar conta..."
                                  disabled={fieldsDisabled}
                                />
                              </TableCell>
                              <TableCell>{statusBadge(row.status)}</TableCell>
                              <TableCell className="text-right">{renderActionButtons(row)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendentes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revisão em lote — Pendentes</CardTitle>
              <p className="text-xs text-muted-foreground">
                Selecione lançamentos pendentes e aplique categoria, conta e operação a todos de uma vez.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Categoria CA</label>
                  <OptionSelect
                    options={categorias}
                    value={bulkCat?.id || null}
                    onChange={(id, name) => setBulkCat({ id, name })}
                    placeholder="Selecionar..."
                    disabled={loadingMetadata}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Conta financeira CA</label>
                  <OptionSelect
                    options={contas}
                    value={bulkAcc?.id || null}
                    onChange={(id, name) => setBulkAcc({ id, name })}
                    placeholder="Selecionar..."
                    disabled={loadingMetadata}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Operação</label>
                  <Select value={bulkTipo} onValueChange={(v) => setBulkTipo(v as "receita" | "despesa")}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa" className="text-xs">Despesa</SelectItem>
                      <SelectItem value="receita" className="text-xs">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={bulkSaveMapping}
                      onCheckedChange={(c) => setBulkSaveMapping(!!c)}
                    />
                    Salvar mapeamento por tipo
                  </label>
                  <Button
                    size="sm"
                    onClick={handleBulkApply}
                    disabled={
                      bulkApplying ||
                      !bulkCat ||
                      !bulkAcc ||
                      selectedPendingIds.length === 0
                    }
                  >
                    {bulkApplying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Aplicar a {selectedPendingIds.length} selecionado(s)
                  </Button>
                </div>
              </div>

              {pendentes.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum lançamento pendente. ✨
                </div>
              ) : (
                <TooltipProvider delayDuration={200}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={allPendingSelected}
                              onCheckedChange={(c) => togglePendingAll(!!c)}
                            />
                          </TableHead>
                          <TableHead className="w-[90px]">Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[110px] text-right">Valor</TableHead>
                          <TableHead className="w-[120px]">Tipo Flash</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead className="w-[80px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendentes.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPendingIds.includes(row.id)}
                                onCheckedChange={(c) => togglePendingSelect(row.id, !!c)}
                              />
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(row.data)}</TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate">
                              {row.descricao}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {formatCurrency(row.valor)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {row.flash_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground max-w-[300px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate">{row.motivo || "—"}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs break-words">{row.motivo || "Sem motivo registrado."}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setMotivoDialogRow(row)}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapeamentos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mapeamentos automáticos por tipo Flash</CardTitle>
              <p className="text-xs text-muted-foreground">
                Estes mapeamentos preenchem automaticamente novos lançamentos do mesmo tipo.
              </p>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum mapeamento salvo ainda. Salve uma normalização na tabela acima para criar um.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo Flash</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Categoria Conta Azul</TableHead>
                      <TableHead>Conta financeira Conta Azul</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {m.flash_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{m.tipo_operacao}</TableCell>
                        <TableCell className="text-xs">{m.conta_azul_category_name || "—"}</TableCell>
                        <TableCell className="text-xs">{m.conta_azul_account_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Payload pronto */}
      <Dialog open={!!payloadDialogRow} onOpenChange={(o) => !o && setPayloadDialogRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload pronto para o Conta Azul</DialogTitle>
            <DialogDescription>
              Visualização exata do JSON que será enviado quando esta transação for sincronizada. Nada é enviado agora.
            </DialogDescription>
          </DialogHeader>
          {payloadDialogRow && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  {statusBadge(payloadDialogRow.status)}
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo Flash: </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {payloadDialogRow.flash_type}
                  </Badge>
                </div>
              </div>
              {payloadDialogRow.conta_azul_payload ? (
                <pre className="bg-muted rounded-md p-3 text-[11px] overflow-auto max-h-[400px] font-mono">
{JSON.stringify(payloadDialogRow.conta_azul_payload, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground bg-amber-500/5 border border-amber-500/30 rounded p-3">
                  ⚠ Payload ainda não disponível — defina categoria e conta financeira para gerar.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayloadDialogRow(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Motivo da normalização */}
      <Dialog open={!!motivoDialogRow} onOpenChange={(o) => !o && setMotivoDialogRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da normalização</DialogTitle>
            <DialogDescription>
              Por que esta transação está {statusBadge(motivoDialogRow?.status)}?
            </DialogDescription>
          </DialogHeader>
          {motivoDialogRow && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tipo Flash detectado</p>
                <Badge variant="secondary" className="text-xs">
                  {motivoDialogRow.flash_type_detectado || motivoDialogRow.flash_type}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mapping usado</p>
                <p className="text-xs">
                  {motivoDialogRow.mapping_id_usado ? (
                    <span className="font-mono break-all">{motivoDialogRow.mapping_id_usado}</span>
                  ) : (
                    <span className="text-muted-foreground">Nenhum mapping aplicado</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p className="text-sm bg-muted rounded p-3 whitespace-pre-wrap">
                  {motivoDialogRow.motivo || "Sem motivo registrado."}
                </p>
              </div>
              {motivoDialogRow.enviado_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Enviado em</p>
                  <p className="text-xs">{new Date(motivoDialogRow.enviado_at).toLocaleString("pt-BR")}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMotivoDialogRow(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm reabrir enviado */}
      <AlertDialog open={!!confirmReopenRow} onOpenChange={(o) => !o && setConfirmReopenRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir lançamento enviado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta transação está marcada como <strong>Enviado</strong>. Reabrir vai mudar o status para
              "Normalizado" e permitir alterações em categoria, conta e operação. Use isto para
              correções posteriores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmReopenRow) {
                  await reopenEnviado(confirmReopenRow);
                  setConfirmReopenRow(null);
                }
              }}
            >
              Reabrir para correção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
