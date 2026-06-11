import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { useAvaliacoesFornecedor } from "@/hooks/useSupplyChain";

export function AvaliacaoFornecedorModal({ pedido, open, onOpenChange }: { pedido: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [notaPrazo, setNotaPrazo] = useState(5);
  const [notaQualidade, setNotaQualidade] = useState(5);
  const [notaPreco, setNotaPreco] = useState(5);
  const [notaResponsividade, setNotaResponsividade] = useState(5);
  const [observacao, setObservacao] = useState("");
  const { create } = useAvaliacoesFornecedor();

  const handleSave = () => {
    create.mutate({
      pedido_id: pedido.id,
      fornecedor_id: pedido.fornecedor_id,
      nota_prazo: notaPrazo,
      nota_qualidade: notaQualidade,
      nota_preco: notaPreco,
      nota_responsividade: notaResponsividade,
      observacao,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <Star 
          key={star} 
          className={`h-6 w-6 cursor-pointer ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
          onClick={() => onChange(star)} 
        />
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Avaliar Fornecedor - {pedido.fornecedor?.razao_social}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">O pedido <strong>{pedido.numero}</strong> foi concluído. Avalie o fornecedor para atualizar o seu Score.</p>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Prazo de Entrega</Label>
              <StarRating value={notaPrazo} onChange={setNotaPrazo} />
            </div>
            <div className="flex justify-between items-center">
              <Label>Qualidade do Material/Serviço</Label>
              <StarRating value={notaQualidade} onChange={setNotaQualidade} />
            </div>
            <div className="flex justify-between items-center">
              <Label>Preço e Condições</Label>
              <StarRating value={notaPreco} onChange={setNotaPreco} />
            </div>
            <div className="flex justify-between items-center">
              <Label>Responsividade / Atendimento</Label>
              <StarRating value={notaResponsividade} onChange={setNotaResponsividade} />
            </div>
          </div>

          <div>
            <Label>Observação Adicional</Label>
            <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Comentários sobre a entrega..." />
          </div>

          <Button onClick={handleSave} className="w-full mt-4" disabled={create.isPending}>
            Salvar Avaliação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
