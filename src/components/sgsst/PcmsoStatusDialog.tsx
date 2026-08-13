import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import { HeartPulse, CheckCircle2, Lock, RefreshCw, XCircle } from "lucide-react";

interface PcmsoStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusAnterior: StatusPcmso;
  novoStatus: StatusPcmso;
  onConfirm: (observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function PcmsoStatusDialog({
  open,
  onOpenChange,
  statusAnterior,
  novoStatus,
  onConfirm,
  isLoading = false,
}: PcmsoStatusDialogProps) {
  const [observacao, setObservacao] = useState("");

  const getStatusIcon = (s: StatusPcmso) => {
    switch (s) {
      case "ATIVO":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "EM_REVISAO":
        return <RefreshCw className="h-5 w-5 text-amber-500" />;
      case "ENCERRADO":
        return <Lock className="h-5 w-5 text-slate-500" />;
      case "CANCELADO":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <HeartPulse className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusTitle = (s: StatusPcmso) => {
    switch (s) {
      case "ATIVO":
        return "Ativar PCMSO (Vigência em Campo)";
      case "EM_REVISAO":
        return "Submeter PCMSO para Revisão Anual";
      case "ENCERRADO":
        return "Encerrar Ciclo do PCMSO";
      case "CANCELADO":
        return "Cancelar PCMSO";
      default:
        return `Alterar Status para ${s}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(observacao.trim());
    setObservacao("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getStatusIcon(novoStatus)}
            <DialogTitle>{getStatusTitle(novoStatus)}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            A alteração de status do PCMSO será registrada no histórico de auditoria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="text-xs bg-muted/40 p-3 rounded border flex justify-between">
            <span>Status Atual: <strong>{statusAnterior}</strong></span>
            <span>Novo Status: <strong className="text-primary">{novoStatus}</strong></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-xs">
              Observação / Justificativa {novoStatus === "CANCELADO" || novoStatus === "EM_REVISAO" ? "*" : ""}
            </Label>
            <Textarea
              id="obs"
              placeholder={
                novoStatus === "EM_REVISAO"
                  ? "Informe as atualizações de exames ou periodicidade na revisão..."
                  : novoStatus === "CANCELADO"
                  ? "Informe a justificativa do cancelamento..."
                  : "Insira observações da transição..."
              }
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required={novoStatus === "CANCELADO" || novoStatus === "EM_REVISAO"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={novoStatus === "CANCELADO" ? "destructive" : "default"}
              disabled={isLoading || ((novoStatus === "CANCELADO" || novoStatus === "EM_REVISAO") && !observacao.trim())}
            >
              {isLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
