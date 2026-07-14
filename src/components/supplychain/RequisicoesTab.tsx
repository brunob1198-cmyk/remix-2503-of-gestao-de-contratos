import { useState } from "react";
import { useRequisicoes, useScItens } from "@/hooks/useSupplyChain";
import { useProjetos } from "@/hooks/useProjetos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, Check, X, PackageCheck, History } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { RequisitionTimeline } from "./RequisitionTimeline";
import { DataTable, DataTableColumnHeader, DataTableColumnFilter, multiSelectFilter } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { WORKFLOW_STATUS_MAP, getStatusLabel, getStatusVariant } from "@/lib/requisicaoStatus";

const PRIORIDADE_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  baixa: { label: "Baixa", variant: "secondary" },
  normal: { label: "Normal", variant: "outline" },
  alta: { label: "Alta", variant: "default" },
  urgente: { label: "Urgente", variant: "destructive" },
};

export function RequisicoesTab({ filter }: { filter?: string }) {
  const { requisicoes: allRequisicoes, isLoading, create, updateStatus, remove } = useRequisicoes();
  const { projetos } = useProjetos();
  const [scItensSearch, setScItensSearch] = useState("");
  const { itens: scItens } = useScItens({ search: scItensSearch });
  const { hasActionPermission } = usePermissions();

  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const [form, setForm] = useState({
    projeto_id: "",
    prioridade: "normal",
    data_necessidade: "",
    justificativa: "",
  });

  const [itemRows, setItemRows] = useState<{
    sc_item_id: string;
    descricao_livre: string;
    quantidade: number;
    unidade: string;
  }[]>([
    { sc_item_id: "", descricao_livre: "", quantidade: 1, unidade: "UN" }
  ]);

  const requisicoes = filter === "PENDING_APPROVAL" 
    ? allRequisicoes.filter((r: any) => r.workflow_status === "PENDING_APPROVAL" || r.workflow_status === "SUBMITTED")
    : allRequisicoes;

  const resetForm = () => {
    setForm({ projeto_id: "", prioridade: "normal", data_necessidade: "", justificativa: "" });
    setItemRows([{ sc_item_id: "", descricao_livre: "", quantidade: 1, unidade: "UN" }]);
  };

  const handleSave = () => {
    create.mutate({
      ...form,
      data_necessidade: form.data_necessidade || null,
      itens: itemRows.filter(r => r.descricao_livre || r.sc_item_id)
    }, {
      onSuccess: () => { setOpen(false); resetForm(); }
    });
  };

  const addItemRow = () => setItemRows(p => [...p, { sc_item_id: "", descricao_livre: "", quantidade: 1, unidade: "UN" }]);

  const updateItemRow = (idx: number, field: string, value: any) => {
    setItemRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === "sc_item_id" && value) {
        const found = scItens.find((it: any) => it.id === value);
        if (found) {
          updated.descricao_livre = found.descricao;
          updated.unidade = found.unidade;
        }
      }
      return updated;
    }));
  };

  const removeItemRow = (idx: number) => setItemRows(p => p.filter((_, i) => i !== idx));

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "numero",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
      cell: ({ row }) => <span className="font-mono text-primary cursor-pointer hover:underline" onClick={() => { setSelected(row.original); setDetailOpen(true); }}>{row.getValue("numero")}</span>,
    },
    {
      accessorKey: "projeto",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Projeto" />,
      accessorFn: (row) => row.projeto?.codigo || "—",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{r.projeto?.codigo || "—"}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{r.projeto?.nome || ""}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "prioridade",
      header: ({ column }) => (
        <div className="flex items-center">
          <DataTableColumnHeader column={column} title="Prioridade" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtro" 
            options={Object.keys(PRIORIDADE_MAP).map(k => ({ label: PRIORIDADE_MAP[k].label, value: k }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const pr = PRIORIDADE_MAP[row.getValue("prioridade") as string] || { label: row.getValue("prioridade"), variant: "outline" as const };
        return <Badge variant={pr.variant}>{pr.label}</Badge>;
      },
    },
    {
      accessorKey: "data_necessidade",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Data Necessidade" />,
      cell: ({ row }) => {
        const val = row.getValue("data_necessidade") as string;
        return val ? parseLocalDate(val).toLocaleDateString("pt-BR") : "—";
      },
    },
    {
      id: "itens_count",
      header: "Itens",
      accessorFn: (row) => row.itens?.length || 0,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <PackageCheck className="h-3 w-3" />
          {row.getValue("itens_count")} itens
        </div>
      ),
    },
    {
      accessorKey: "workflow_status",
      header: ({ column }) => (
        <div className="flex items-center">
          <DataTableColumnHeader column={column} title="Status" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtro" 
            options={Object.keys(WORKFLOW_STATUS_MAP).map(k => ({ label: WORKFLOW_STATUS_MAP[k].label, value: k }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const st = WORKFLOW_STATUS_MAP[row.getValue("workflow_status") as string] || { label: row.getValue("workflow_status"), variant: "outline" as const };
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Ação</div>,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Ver Detalhes" onClick={() => { setSelected(r); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
            
            {r.workflow_status === "DRAFT" && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => updateStatus.mutate({ id: r.id, workflow_status: "SUBMITTED", observacoes: "Requisição enviada para o setor de compras." })}
              >
                Enviar
              </Button>
            )}

            {r.workflow_status === "SUBMITTED" && hasActionPermission("pode_aprovar_compra") && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => updateStatus.mutate({ id: r.id, workflow_status: "QUOTING", observacoes: "Requisição aprovada para iniciar cotações." })}
              >
                <Check className="h-4 w-4 mr-1" /> Aprovar
              </Button>
            )}

            {r.workflow_status === "PENDING_APPROVAL" && hasActionPermission("pode_aprovar_compra") && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => updateStatus.mutate({ id: r.id, workflow_status: "APPROVED", observacoes: "Cotações aprovadas pelo gestor." })}
              >
                <Check className="h-4 w-4 mr-1" /> Aprovar
              </Button>
            )}

            {(r.workflow_status === "PENDING_APPROVAL" || r.workflow_status === "SUBMITTED") && hasActionPermission("pode_rejeitar_compra") && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-destructive border-red-200 hover:bg-red-50"
                onClick={() => updateStatus.mutate({ id: r.id, workflow_status: "REJECTED", observacoes: "Requisição rejeitada pelo gestor." })}
              >
                <X className="h-4 w-4 mr-1" /> Rejeitar
              </Button>
            )}

            {(r.workflow_status === "PURCHASED" || r.workflow_status === "PARTIALLY_RECEIVED") && hasActionPermission("pode_receber_compra") && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => updateStatus.mutate({ id: r.id, workflow_status: "RECEIVED", observacoes: "Itens recebidos e conferidos no almoxarifado." })}
              >
                <PackageCheck className="h-4 w-4 mr-1" /> Receber
              </Button>
            )}

            {r.workflow_status === "DRAFT" && (
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Requisições de Compra</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Requisição</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Requisição de Compra</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Projeto</Label>
                  <Select value={form.projeto_id} onValueChange={v => setForm(p => ({ ...p, projeto_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Data de Necessidade</Label>
                <Input type="date" value={form.data_necessidade} onChange={e => setForm(p => ({ ...p, data_necessidade: e.target.value }))} />
              </div>
              <div><Label>Justificativa</Label><Textarea value={form.justificativa} onChange={e => setForm(p => ({ ...p, justificativa: e.target.value }))} /></div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-base font-semibold">Itens</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Buscar item por código/descrição..."
                      value={scItensSearch}
                      onChange={(e) => setScItensSearch(e.target.value)}
                      className="h-8 w-64"
                    />
                    <Button variant="outline" size="sm" onClick={addItemRow}><Plus className="h-3 w-3 mr-1" /> Adicionar Item</Button>
                  </div>
                </div>
                {itemRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Item Padrão</Label>
                      <Select value={row.sc_item_id} onValueChange={v => updateItemRow(idx, "sc_item_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Livre ou selecione" /></SelectTrigger>
                        <SelectContent>
                          {scItens.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.codigo} - {it.descricao}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={row.descricao_livre} onChange={e => updateItemRow(idx, "descricao_livre", e.target.value)} />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qtd</Label>
                      <Input type="number" value={row.quantidade} onChange={e => updateItemRow(idx, "quantidade", Number(e.target.value))} />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Unid</Label>
                      <Input value={row.unidade} onChange={e => updateItemRow(idx, "unidade", e.target.value)} />
                    </div>
                    {itemRows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItemRow(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleSave} disabled={create.isPending || itemRows.every(i => !i.descricao_livre && !i.sc_item_id)}>
                Criar Requisição
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : requisicoes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma requisição encontrada.</p>
        ) : (
          <DataTable columns={columns} data={requisicoes} searchKey="numero" searchPlaceholder="Buscar por número..." />
        )}
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Requisição {selected?.numero}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded-lg border">
                <div><span className="text-muted-foreground block text-xs uppercase font-semibold">Projeto</span> {selected.projeto?.codigo} - {selected.projeto?.nome || "—"}</div>
                <div><span className="text-muted-foreground block text-xs uppercase font-semibold">Status</span> <Badge variant={WORKFLOW_STATUS_MAP[selected.workflow_status]?.variant || "outline"}>{WORKFLOW_STATUS_MAP[selected.workflow_status]?.label || selected.workflow_status}</Badge></div>
                <div><span className="text-muted-foreground block text-xs uppercase font-semibold">Prioridade</span> <Badge variant={PRIORIDADE_MAP[selected.prioridade]?.variant || "outline"}>{PRIORIDADE_MAP[selected.prioridade]?.label || selected.prioridade}</Badge></div>
                <div><span className="text-muted-foreground block text-xs uppercase font-semibold">Data Necessidade</span> {selected.data_necessidade ? parseLocalDate(selected.data_necessidade).toLocaleDateString("pt-BR") : "—"}</div>
              </div>
              
              {selected.justificativa && (
                <div className="text-sm border p-3 rounded-lg bg-yellow-50/30">
                  <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Justificativa</span>
                  <p className="whitespace-pre-wrap">{selected.justificativa}</p>
                </div>
              )}

              {selected.observacoes && (
                <div className="text-sm border p-3 rounded-lg">
                  <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Observações</span>
                  <p className="whitespace-pre-wrap">{selected.observacoes}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4" /> 
                  Itens Solicitados ({selected.itens?.length || 0})
                </h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Item / Descrição</TableHead>
                        <TableHead className="text-center w-20">Qtd</TableHead>
                        <TableHead className="w-20">Unid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selected.itens && selected.itens.length > 0) ? (
                        selected.itens.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{item.sc_item?.codigo || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">
                              {item.sc_item?.descricao || item.descricao_livre || "—"}
                              {item.sc_item?.descricao && item.descricao_livre && item.descricao_livre !== item.sc_item.descricao && (
                                <span className="block text-xs text-muted-foreground font-normal italic mt-0.5">{item.descricao_livre}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-bold">{item.quantidade}</TableCell>
                            <TableCell>{item.unidade}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground italic">Nenhum item encontrado.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Timeline da Requisição (Auditoria)
                </h4>
                <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <RequisitionTimeline requisicaoId={selected.id} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
