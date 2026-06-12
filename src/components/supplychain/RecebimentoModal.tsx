import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageCheck, Loader2 } from "lucide-react";
import { usePedidoRecebimentos } from "@/hooks/useSupplyChain";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function RecebimentoModal({ pedido, onRecebido, trigger }: { pedido: any; onRecebido?: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split("T")[0]);
  const [nfNumero, setNfNumero] = useState("");
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
    setNfNumero(pedido.nf_numero || "");
    setNfFile(null);
    setDataRecebimento(new Date().toISOString().split("T")[0]);
    setOpen(true);
  };

  const handleSave = async () => {
    const itensToReceive = Object.keys(qtdRecebimento)
      .filter(id => qtdRecebimento[id] > 0)
      .map(id => ({
        pedido_item_id: id,
        quantidade_recebida: qtdRecebimento[id]
      }));

    if (itensToReceive.length === 0) {
      toast.error("Informe ao menos uma quantidade recebida");
      return;
    }

    let nfArquivoUrl: string | undefined;
    if (nfFile) {
      setUploading(true);
      try {
        const ext = nfFile.name.split(".").pop();
        const path = `pedidos-nf/${pedido.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("contratos").upload(path, nfFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("contratos").getPublicUrl(path);
        nfArquivoUrl = pub.publicUrl;
      } catch (e: any) {
        toast.error("Falha ao enviar NF: " + e.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    create.mutate({
      pedido_id: pedido.id,
      data_recebimento: dataRecebimento,
      observacao,
      nf_numero: nfNumero || undefined,
      nf_arquivo_url: nfArquivoUrl,
      itens: itensToReceive
    }, {
      onSuccess: () => {
        setOpen(false);
        if (onRecebido) onRecebido();
      }
    });
  };

  const todosRecebidos = pedido.itens?.every((it: any) => (it.quantidade_recebida || 0) >= it.quantidade_pedida);
  if (todosRecebidos) return null;

  return (
    <Dialog open={open} onOpenChange={v => v ? openModal() : setOpen(false)}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1">
            <PackageCheck className="h-4 w-4" />
            Registrar Recebimento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar Recebimento — {pedido.numero}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do Recebimento</Label>
              <Input type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} />
            </div>
            <div>
              <Label>Nº Nota Fiscal</Label>
              <Input value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="Ex: 12345" />
            </div>
          </div>

          <div>
            <Label>Arquivo da NF (PDF)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={e => setNfFile(e.target.files?.[0] || null)} />
          </div>

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
                        min="0"
                        max={pendente}
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
            <Label>Observações</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Observações sobre a entrega..." />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={create.isPending || uploading}>
            {(create.isPending || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Recebimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
