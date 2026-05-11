import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface RevisaoParcialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  medicao: any;
  onSave: (data: {
    removedIds: Set<string>;
    items: Record<string, number>;
    newItems: Array<{ tempId: string; item_lpu_id: string; quantidade: number; aprovado: number }>;
  }) => Promise<void>;
  formatCurrency: (val: number) => string;
}

export function RevisaoParcialDialog({
  isOpen,
  onClose,
  medicao,
  onSave,
  formatCurrency
}: RevisaoParcialDialogProps) {
  const queryClient = useQueryClient();
  const [partialApprovalItems, setPartialApprovalItems] = useState<Record<string, number>>({});
  const [reviewRemovedIds, setReviewRemovedIds] = useState<Set<string>>(new Set());
  const [reviewNewItems, setReviewNewItems] = useState<Array<{ tempId: string; item_lpu_id: string; quantidade: number; aprovado: number }>>([]);
  const [reviewAddItemId, setReviewAddItemId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Get data from cache
  const lancamentos = queryClient.getQueryData<any[]>(["lancamentos_medicao", undefined]) || [];
  const allItensLpu = queryClient.getQueryData<any[]>(["itens_lpu", undefined]) || [];

  const medLancamentos = useMemo(() => 
    medicao ? lancamentos.filter(l => medicao.lancamentoIds.includes(l.id)) : [],
    [medicao, lancamentos]
  );

  useEffect(() => {
    if (isOpen && medicao) {
      const initial: Record<string, number> = {};
      medLancamentos.forEach(l => {
        initial[l.id] = Number(l.quantidade_aprovada || l.quantidade);
      });
      setPartialApprovalItems(initial);
      setReviewRemovedIds(new Set());
      setReviewNewItems([]);
      setReviewAddItemId("");
    }
  }, [isOpen, medicao, medLancamentos]);

  if (!medicao) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        removedIds: reviewRemovedIds,
        items: partialApprovalItems,
        newItems: reviewNewItems
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisão de Medição: {medicao.site_codigo} - {medicao.numero_medicao}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md flex gap-2 border border-yellow-200 dark:border-yellow-900">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Ao realizar a aprovação parcial ou rejeição, a medição atual será movida para "Enviada" e os itens rejeitados/pendentes ficarão disponíveis para uma nova medição.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd. Original</TableHead>
                <TableHead className="text-right">Qtd. Aprovada</TableHead>
                <TableHead className="text-right">Valor Aprov.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medLancamentos.map(l => {
                const isRemoved = reviewRemovedIds.has(l.id);
                const qtdAprovada = partialApprovalItems[l.id] || 0;
                const preco = Number(l.item_lpu?.preco_unitario || 0);
                
                return (
                  <TableRow key={l.id} className={isRemoved ? "opacity-40 grayscale bg-muted" : ""}>
                    <TableCell>
                      <p className="font-medium">{l.item_lpu?.codigo}</p>
                      <p className="text-xs text-muted-foreground">{l.item_lpu?.descricao}</p>
                    </TableCell>
                    <TableCell className="text-right">{l.quantidade} {l.item_lpu?.unidade}</TableCell>
                    <TableCell className="text-right">
                      <Input 
                        type="number" 
                        disabled={isRemoved}
                        value={qtdAprovada} 
                        onChange={(e) => setPartialApprovalItems(prev => ({ ...prev, [l.id]: Number(e.target.value) }))}
                        className="w-24 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(qtdAprovada * preco)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setReviewRemovedIds(prev => {
                            const next = new Set(prev);
                            next.has(l.id) ? next.delete(l.id) : next.add(l.id);
                            return next;
                          });
                        }}
                      >
                        <Trash2 className={`h-4 w-4 ${isRemoved ? "text-primary" : "text-destructive"}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {reviewNewItems.map((ni, idx) => {
                const itemLpu = allItensLpu.find(i => i.id === ni.item_lpu_id);
                const preco = Number(itemLpu?.preco_unitario || 0);
                return (
                  <TableRow key={ni.tempId} className="bg-green-50/30">
                    <TableCell>
                      <Badge variant="outline" className="mb-1 text-[10px] h-4 uppercase bg-green-100 text-green-700 border-green-200">Novo</Badge>
                      <p className="font-medium">{itemLpu?.codigo}</p>
                      <p className="text-xs text-muted-foreground">{itemLpu?.descricao}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input 
                        type="number" 
                        value={ni.quantidade} 
                        onChange={(e) => {
                          const next = [...reviewNewItems];
                          next[idx].quantidade = Number(e.target.value);
                          setReviewNewItems(next);
                        }}
                        className="w-24 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input 
                        type="number" 
                        value={ni.aprovado} 
                        onChange={(e) => {
                          const next = [...reviewNewItems];
                          next[idx].aprovado = Number(e.target.value);
                          setReviewNewItems(next);
                        }}
                        className="w-24 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(ni.aprovado * preco)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setReviewNewItems(prev => prev.filter(x => x.tempId !== ni.tempId))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-end gap-2 pt-4 border-t">
            <div className="flex-1 space-y-2">
              <Label>Adicionar item extra na revisão</Label>
              <Select value={reviewAddItemId} onValueChange={setReviewAddItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um item..." />
                </SelectTrigger>
                <SelectContent>
                  {allItensLpu.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.codigo} - {i.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => {
              if (!reviewAddItemId) return;
              setReviewNewItems(prev => [...prev, { tempId: Math.random().toString(), item_lpu_id: reviewAddItemId, quantidade: 1, aprovado: 1 }]);
              setReviewAddItemId("");
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            Confirmar Revisão Parcial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
