import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CondicaoDevolucaoEpi, useSgsstEpiEntregas } from "@/hooks/sgsst/useSgsstEpis";
import { RotateCcw } from "lucide-react";

interface DevolucaoEpiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntregaId?: string | null;
  onSave: (data: {
    entregaId: string;
    quantidadeDevolvida: number;
    dataDevolucao: string;
    condicaoEpi: CondicaoDevolucaoEpi;
    motivo?: string;
    observacao?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function DevolucaoEpiFormDialog({
  open,
  onOpenChange,
  initialEntregaId,
  onSave,
  isLoading = false,
}: DevolucaoEpiFormDialogProps) {
  const { entregas } = useSgsstEpiEntregas();

  const [entregaId, setEntregaId] = useState("");
  const [quantidadeDevolvida, setQuantidadeDevolvida] = useState(1);
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [condicaoEpi, setCondicaoEpi] = useState<CondicaoDevolucaoEpi>("BOM");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    setEntregaId(initialEntregaId || "");
    setQuantidadeDevolvida(1);
    setDataDevolucao(new Date().toISOString().split("T")[0]);
    setCondicaoEpi("BOM");
    setMotivo("");
    setObservacao("");
  }, [initialEntregaId, open]);

  const selectedEntrega = entregas.find((e) => e.id === entregaId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entregaId) return;

    await onSave({
      entregaId,
      quantidadeDevolvida: Number(quantidadeDevolvida) || 1,
      dataDevolucao: dataDevolucao || new Date().toISOString().split("T")[0],
      condicaoEpi,
      motivo: motivo.trim() || undefined,
      observacao: observacao.trim() || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Registrar Devolução de EPI pelo Colaborador
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="ent">Entrega de Origem *</Label>
            <Select value={entregaId} onValueChange={setEntregaId}>
              <SelectTrigger id="ent">
                <SelectValue placeholder="Selecione a entrega de origem..." />
              </SelectTrigger>
              <SelectContent>
                {entregas.map((e) => {
                  const colabNome = e.colaborador?.profile?.nome || e.colaborador?.recurso?.nome || e.colaborador?.nome || "Sem Nome";
                  return (
                    <SelectItem key={e.id} value={e.id}>
                      [{colabNome}] {e.epi?.nome} ({e.quantidade} un - {e.data_entrega})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtdDev">Qtd Devolvida *</Label>
              <Input
                id="qtdDev"
                type="number"
                min={1}
                max={selectedEntrega?.quantidade || 100}
                value={quantidadeDevolvida}
                onChange={(e) => setQuantidadeDevolvida(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataDev">Data Devolução *</Label>
              <Input
                id="dataDev"
                type="date"
                value={dataDevolucao}
                onChange={(e) => setDataDevolucao(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condicao">Condição do EPI *</Label>
              <Select value={condicaoEpi} onValueChange={(val: CondicaoDevolucaoEpi) => setCondicaoEpi(val)}>
                <SelectTrigger id="condicao">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOM" className="text-emerald-700 font-semibold">BOM (Retorna ao estoque)</SelectItem>
                  <SelectItem value="DANIFICADO" className="text-amber-700">DANIFICADO</SelectItem>
                  <SelectItem value="INUTILIZADO" className="text-red-700">INUTILIZADO / DESCARTE</SelectItem>
                  <SelectItem value="VENCIDO" className="text-purple-700">VENCIDO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo da Devolução</Label>
            <Input
              id="motivo"
              placeholder="Ex: Desligamento do funcionário, troca de tamanho..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações / Vistoria</Label>
            <Textarea
              id="obs"
              placeholder="Parecer técnico sobre o estado do equipamento..."
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !entregaId}>
              {isLoading ? "Salvando..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
