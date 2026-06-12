import { useState, useEffect, useMemo, useRef } from "react";
import { usePedidosCompra } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Trash2, Star, Send, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { RecebimentoModal } from "./RecebimentoModal";
import { AvaliacaoFornecedorModal } from "./AvaliacaoFornecedorModal";
import { DataTable, DataTableColumnHeader, DataTableColumnFilter, multiSelectFilter } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

const STATUS_LIST = [
  { value: "rascunho", label: "Rascunho", className: "bg-gray-200 text-gray-800 hover:bg-gray-200" },
  { value: "emitido", label: "Emitido", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  { value: "confirmado", label: "Confirmado", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  { value: "entrega_parcial", label: "Entrega Parcial", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
  { value: "entregue", label: "Entregue", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  { value: "cancelado", label: "Cancelado", className: "bg-red-100 text-red-800 hover:bg-red-100" },
];

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => (d ? parseLocalDate(d).toLocaleDateString("pt-BR") : "—");

export function PedidosTab({ filter }: { filter?: string }) {
  const { pedidos: allPedidos, isLoading, updateStatus, remove } = usePedidosCompra();
  const isUuid = !!filter && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filter);
  const highlightId = isUuid ? filter : undefined;

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [pedidoToAvaliar, setPedidoToAvaliar] = useState<any>(null);
  const [emitDialog, setEmitDialog] = useState<{ open: boolean; pedido: any | null; obs: string }>({ open: false, pedido: null, obs: "" });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; pedido: any | null; motivo: string }>({ open: false, pedido: null, motivo: "" });
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const pedidos = useMemo(() => {
    let list = allPedidos as any[];
    if (filter === "OPEN") {
      list = list.filter((p) => ["emitido", "confirmado", "entrega_parcial"].includes(p.status));
    }
    if (statusFilter !== "ALL") {
      list = list.filter((p) => p.status === statusFilter);
    }
    return list;
  }, [allPedidos, filter, statusFilter]);

  useEffect(() => {
    if (highlightId && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, pedidos.length]);

  const statusBadge = (status: string) => {
    const s = STATUS_LIST.find((x) => x.value === status);
    return <Badge className={s?.className || ""}>{s?.label || status}</Badge>;
  };

  const isOverdue = (p: any) =>
    p.data_prevista_entrega && p.data_prevista_entrega < today && p.status !== "entregue" && p.status !== "cancelado";

  const handleEmit = () => {
    const p = emitDialog.pedido;
    if (!p) return;
    updateStatus.mutate(
      {
        id: p.id,
        status: "emitido",
        data_emissao: today,
        observacoes: emitDialog.obs || undefined,
        requisicao_id: p.requisicao_id,
        requisicao_status_after: "pedido_emitido",
      },
      { onSuccess: () => setEmitDialog({ open: false, pedido: null, obs: "" }) }
    );
  };

  const handleCancel = () => {
    const p = cancelDialog.pedido;
    if (!p || !cancelDialog.motivo.trim()) return;
    updateStatus.mutate(
      {
        id: p.id,
        status: "cancelado",
        motivo_cancelamento: cancelDialog.motivo,
        requisicao_id: p.requisicao_id,
        requisicao_status_after: "em_cotacao",
      },
      { onSuccess: () => setCancelDialog({ open: false, pedido: null, motivo: "" }) }
    );
  };

  const buildTimeline = (p: any) => {
    const items: { label: string; date?: string | null }[] = [];
    items.push({ label: "Rascunho criado", date: p.created_at });
    if (p.data_emissao) items.push({ label: "Pedido emitido", date: p.data_emissao });
    (p.recebimentos || [])
      .slice()
      .sort((a: any, b: any) => (a.data_recebimento || "").localeCompare(b.data_recebimento || ""))
      .forEach((r: any) => items.push({ label: `Recebimento registrado${r.observacao ? ` — ${r.observacao}` : ""}`, date: r.data_recebimento }));
    if (p.data_entrega_real) items.push({ label: "Entrega concluída", date: p.data_entrega_real });
    if (p.status === "cancelado") items.push({ label: `Cancelado${p.motivo_cancelamento ? ` — ${p.motivo_cancelamento}` : ""}`, date: p.updated_at });
    return items;
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "numero",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <button
            className="hover:underline text-left font-mono text-primary"
            onClick={() => setSelectedPedido(p)}
          >
            {p.numero}
          </button>
        );
      },
    },
    {
      accessorKey: "fornecedor",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fornecedor" />,
      accessorFn: (row) => row.fornecedor?.razao_social || "—",
      cell: ({ row }) => row.getValue("fornecedor"),
    },
    {
      accessorKey: "projeto",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Projeto" />,
      accessorFn: (row) => row.projeto ? `${row.projeto.codigo} ${row.projeto.nome}` : "—",
      cell: ({ row }) => {
        const p = row.original;
        return p.projeto ? (
          <span className="text-sm">
            <span className="font-mono text-muted-foreground">{p.projeto.codigo}</span> {p.projeto.nome}
          </span>
        ) : "—";
      },
    },
    {
      accessorKey: "valor_total",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Valor Total" />,
      cell: ({ row }) => <div className="text-right">{fmt(row.getValue("valor_total") || 0)}</div>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <div className="flex items-center">
          <DataTableColumnHeader column={column} title="Status" />
          <DataTableColumnFilter 
            column={column} 
            title="Filtro" 
            options={STATUS_LIST.map(s => ({ label: s.label, value: s.value }))} 
          />
        </div>
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => statusBadge(row.getValue("status")),
    },
    {
      accessorKey: "data_prevista_entrega",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Entrega Prevista" />,
      cell: ({ row }) => {
        const p = row.original;
        const overdue = isOverdue(p);
        return (
          <div className="flex items-center gap-1">
            {overdue && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            <span className={overdue ? "text-orange-600 font-medium" : ""}>
              {fmtDate(p.data_prevista_entrega)}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Ações</div>,
      cell: ({ row }) => {
        const p = row.original;
        const canReceive = ["confirmado", "entrega_parcial"].includes(p.status);
        return (
          <div className="flex justify-end gap-2 items-center flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setSelectedPedido(p)}>
              <Eye className="h-4 w-4" />
            </Button>

            {p.status === "rascunho" && (
              <>
                <Button size="sm" onClick={() => setEmitDialog({ open: true, pedido: p, obs: "" })}>
                  <Send className="h-4 w-4 mr-1" /> Emitir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}

            {p.status === "emitido" && (
              <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "confirmado" })}>
                Confirmar Recebimento Fornecedor
              </Button>
            )}

            {canReceive && <RecebimentoModal pedido={p} />}

            {p.status === "entregue" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                onClick={() => setPedidoToAvaliar(p)}
              >
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> Avaliar
              </Button>
            )}

            {(p.status === "rascunho" || p.status === "emitido") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setCancelDialog({ open: true, pedido: p, motivo: "" })}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos e Recebimentos</CardTitle>
        <div className="flex flex-wrap gap-2 pt-3">
          <Badge
            onClick={() => setStatusFilter("ALL")}
            className={`cursor-pointer ${statusFilter === "ALL" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Todos ({allPedidos.length})
          </Badge>
          {STATUS_LIST.map((s) => {
            const count = (allPedidos as any[]).filter((p) => p.status === s.value).length;
            const active = statusFilter === s.value;
            return (
              <Badge
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`cursor-pointer ${active ? "ring-2 ring-primary " : ""}${s.className}`}
              >
                {s.label} ({count})
              </Badge>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum pedido</p>
        ) : (
          <div className="space-y-4">
            <DataTable columns={columns} data={pedidos} searchKey="numero" searchPlaceholder="Buscar por número do pedido..." />
          </div>
        )}
      </CardContent>

      {/* Detalhe do pedido (Sheet) */}
      <Sheet open={!!selectedPedido} onOpenChange={(v) => !v && setSelectedPedido(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedPedido && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  Pedido {selectedPedido.numero} {statusBadge(selectedPedido.status)}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Fornecedor</div>
                    <div className="font-medium">{selectedPedido.fornecedor?.razao_social || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">RC Origem</div>
                    <div className="font-mono">{selectedPedido.requisicao?.numero || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Projeto</div>
                    <div>{selectedPedido.projeto ? `${selectedPedido.projeto.codigo} — ${selectedPedido.projeto.nome}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Condição de Pagamento</div>
                    <div>{selectedPedido.condicao_pagamento || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Data Emissão</div>
                    <div>{fmtDate(selectedPedido.data_emissao)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Entrega Prevista</div>
                    <div>{fmtDate(selectedPedido.data_prevista_entrega)}</div>
                  </div>
                  {selectedPedido.nf_numero && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Nota Fiscal</div>
                      <div>
                        {selectedPedido.nf_numero}
                        {selectedPedido.nf_arquivo_url && (
                          <a href={selectedPedido.nf_arquivo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-2">
                            (ver arquivo)
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Itens</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd Pedida</TableHead>
                        <TableHead className="text-right">Qtd Recebida</TableHead>
                        <TableHead className="text-right">Vlr Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedPedido.itens || []).map((it: any) => (
                        <TableRow key={it.id}>
                          <TableCell className="text-sm">{it.descricao}</TableCell>
                          <TableCell className="text-right">{it.quantidade_pedida} {it.unidade}</TableCell>
                          <TableCell className="text-right">{it.quantidade_recebida || 0}</TableCell>
                          <TableCell className="text-right">{fmt(it.valor_unitario)}</TableCell>
                          <TableCell className="text-right">{fmt(it.valor_total || it.valor_unitario * it.quantidade_pedida)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{fmt((selectedPedido.valor_total || 0) - (selectedPedido.frete || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span>{fmt(selectedPedido.frete || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span>{fmt(selectedPedido.valor_total || 0)}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Histórico</h4>
                  <ol className="space-y-2 text-sm border-l-2 border-muted pl-4">
                    {buildTimeline(selectedPedido).map((e, i) => (
                      <li key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                        <div className="font-medium">{e.label}</div>
                        <div className="text-muted-foreground text-xs">
                          {e.date ? new Date(e.date).toLocaleString("pt-BR") : "—"}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {selectedPedido.observacoes && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">Observações</div>
                    <div className="whitespace-pre-wrap">{selectedPedido.observacoes}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Emitir pedido */}
      <Dialog open={emitDialog.open} onOpenChange={(v) => !v && setEmitDialog({ open: false, pedido: null, obs: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir Pedido {emitDialog.pedido?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirmar emissão deste pedido ao fornecedor <strong>{emitDialog.pedido?.fornecedor?.razao_social}</strong>?
            </p>
            <div>
              <Label>Observações ao fornecedor (opcional)</Label>
              <Textarea value={emitDialog.obs} onChange={(e) => setEmitDialog((s) => ({ ...s, obs: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmitDialog({ open: false, pedido: null, obs: "" })}>Cancelar</Button>
            <Button onClick={handleEmit} disabled={updateStatus.isPending}>
              <Send className="h-4 w-4 mr-1" /> Emitir Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar pedido */}
      <Dialog open={cancelDialog.open} onOpenChange={(v) => !v && setCancelDialog({ open: false, pedido: null, motivo: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pedido {cancelDialog.pedido?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo do cancelamento *</Label>
              <Textarea
                value={cancelDialog.motivo}
                onChange={(e) => setCancelDialog((s) => ({ ...s, motivo: e.target.value }))}
                placeholder="Informe o motivo..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A requisição vinculada voltará para "em cotação" para nova negociação.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, pedido: null, motivo: "" })}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelDialog.motivo.trim() || updateStatus.isPending}>
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pedidoToAvaliar && (
        <AvaliacaoFornecedorModal
          pedido={pedidoToAvaliar}
          open={!!pedidoToAvaliar}
          onOpenChange={(v) => !v && setPedidoToAvaliar(null)}
        />
      )}
    </Card>
  );
}
