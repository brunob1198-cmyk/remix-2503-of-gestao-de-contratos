import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageCheck } from "lucide-react";
import { usePedidoRecebimentos } from "@/hooks/useSupplyChain";

export function RecebimentoModal({ pedido, onRecebido }: { pedido: any; onRecebido?: () => void }) {
  const [open, setOpen] = useState(false);
  const [observacao, setObservacao] = useState("");
  // Qtd state format: { [item_id]: quantidade_para_receber }
  const [qtdRecebimento, setQtdRecebimento] = useState<Record<string, number>>({});
  const { create } = usePedidoRecebimentos();

  const openModal = () => {
    const initQtds: Record<string, number> = {};
    pedido.itens?.forEach((it: any) => {
      const pendente = it.quantidade_pedida - (it.quantidade_recebida || 0);
      if (pendente > 0) initQtds[it.id] = pendente;
    });
    setQtdRecebimento(initQtds);
    setObservacao("");
    setOpen(true);
  };

  const handleSave = () => {
    const itensToReceive = Object.keys(qtdRecebimento)
      .filter(id => qtdRecebimento[id] > 0)
      .map(id => ({
        pedido_item_id: id,
        quantidade_recebida: qtdRecebimento[id]
      }));

    if (itensToReceive.length === 0) return;

    create.mutate({
      pedido_id: pedido.id,
      observacao,
      itens: itensToReceive
    }, {
      onSuccess: () => {
        setOpen(false);
        if (onRecebido) onRecebido();
      }
    });
  };

  // Se todos os itens já foram recebidos, o botão não precisa ser exibido (ou pode ser desabilitado)
  const todosRecebidos = pedido.itens?.every((it: any) => (it.quantidade_recebida || 0) >= it.quantidade_pedida);

  if (todosRecebidos) return null;

  return (
    <Dialog open={open} onOpenChange={v => v ? openModal() : setOpen(false)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200">
          <PackageCheck className="h-4 w-4" />
          Registrar Recebimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Registrar Recebimento - {pedido.numero}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-24 text-right">Pedida</TableHead>
                <TableHead className="w-24 text-right">Falta</TableHead>
                <TableHead className="w-32 text-right">Qtd Recebida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedido.itens?.map((it: any) => {
                const pendente = it.quantidade_pedida - (it.quantidade_recebida || 0);
                if (pendente <= 0) return null;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">{it.descricao}</TableCell>
                    <TableCell className="text-right">{it.quantidade_pedida} {it.unidade}</TableCell>
                    <TableCell className="text-right font-medium text-orange-600">{pendente}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.01" 
                        className="text-right h-8"
                        value={qtdRecebimento[it.id] === undefined ? "" : qtdRecebimento[it.id]} 
                        onChange={e => setQtdRecebimento(p => ({ ...p, [it.id]: Number(e.target.value) }))}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div>
            <Label>Observação (Opcional)</Label>
            <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Nº Nota Fiscal, quem entregou, etc..." />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={create.isPending}>
            Confirmar Recebimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
