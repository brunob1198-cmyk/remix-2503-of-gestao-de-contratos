import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPt } from "@/hooks/sgsst/useSgsstPt";
import { ShieldCheck, XCircle, AlertCircle, PlayCircle, PauseCircle, Lock, RefreshCw } from "lucide-react";

interface PtStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusAnterior: StatusPt;
  novoStatus: StatusPt;
  onConfirm: (observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function PtStatusDialog({
  open,
  onOpenChange,
  statusAnterior,
  novoStatus,
  onConfirm,
  isLoading = false,
}: PtStatusDialogProps) {
  const [observacao, setObservacao] = useState("");

  const getStatusIcon = (s: StatusPt) => {
    switch (s) {
      case "EM_ANALISE":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "APROVADA":
        return <ShieldCheck className="h-5 w-5 text-emerald-500" />;
      case "EM_EXECUCAO":
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      case "SUSPENSA":
        return <PauseCircle className="h-5 w-5 text-orange-500" />;
      case "REJEITADA":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "ENCERRADA":
      case "CANCELADA":
        return <Lock className="h-5 w-5 text-slate-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusTitle = (s: StatusPt) => {
    switch (s) {
      case "EM_ANALISE":
        return "Submeter PT para Análise Técnica";
      case "APROVADA":
        return "Aprovar Permissão de Trabalho (PT)";
      case "EM_EXECUCAO":
        return "Liberar & Iniciar Execução de Campo";
      case "SUSPENSA":
        return "Suspender Permissão de Trabalho";
      case "REJEITADA":
        return "Rejeitar Permissão de Trabalho";
      case "ENCERRADA":
        return "Encerrar Permissão de Trabalho";
      case "CANCELADA":
        return "Cancelar Permissão de Trabalho";
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

  const isMandatoryObs = novoStatus === "REJEITADA" || novoStatus === "SUSPENSA" || novoStatus === "CANCELADA";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getStatusIcon(novoStatus)}
            <DialogTitle>{getStatusTitle(novoStatus)}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            A transição de status será registrada auditada no histórico do SGSST.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="text-xs bg-muted/40 p-3 rounded border flex justify-between">
            <span>Status Atual: <strong>{statusAnterior}</strong></span>
            <span>Novo Status: <strong className="text-primary">{novoStatus}</strong></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-xs">
              Observação / Parecer / Motivo {isMandatoryObs ? "*" : ""}
            </Label>
            <Textarea
              id="obs"
              placeholder={
                novoStatus === "SUSPENSA"
                  ? "Descreva o motivo da suspensão (ex: chuva torrencial, vazamento, incidente)..."
                  : novoStatus === "ENCERRADA"
                  ? "Condições finais da área após término dos trabalhos..."
                  : "Insira parecer técnico ou orientações adicionais..."
              }
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required={isMandatoryObs}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={novoStatus === "REJEITADA" || novoStatus === "SUSPENSA" || novoStatus === "CANCELADA" ? "destructive" : "default"}
              disabled={isLoading || (isMandatoryObs && !observacao.trim())}
            >
              {isLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
