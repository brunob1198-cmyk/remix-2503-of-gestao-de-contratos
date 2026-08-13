import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusIncidente } from "@/hooks/sgsst/useSgsstIncidentes";
import { Siren, CheckCircle2, Lock, PlayCircle, XCircle, Search, FileText } from "lucide-react";

interface IncidenteStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusAnterior: StatusIncidente;
  novoStatus: StatusIncidente;
  onConfirm: (observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function IncidenteStatusDialog({
  open,
  onOpenChange,
  statusAnterior,
  novoStatus,
  onConfirm,
  isLoading = false,
}: IncidenteStatusDialogProps) {
  const [observacao, setObservacao] = useState("");

  const getStatusIcon = (s: StatusIncidente) => {
    switch (s) {
      case "EM_INVESTIGACAO":
        return <Search className="h-5 w-5 text-blue-500" />;
      case "PLANO_ACAO":
        return <FileText className="h-5 w-5 text-purple-500" />;
      case "EM_TRATAMENTO":
        return <PlayCircle className="h-5 w-5 text-amber-500" />;
      case "ENCERRADO":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "CANCELADO":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Siren className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusTitle = (s: StatusIncidente) => {
    switch (s) {
      case "EM_INVESTIGACAO":
        return "Iniciar Investigação do Incidente";
      case "PLANO_ACAO":
        return "Elaborar Plano de Ação";
      case "EM_TRATAMENTO":
        return "Iniciar Tratamento / Execução das Ações";
      case "ENCERRADO":
        return "Encerrar Ocorrência de Segurança";
      case "CANCELADO":
        return "Cancelar Ocorrência";
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
            Esta mudança de status será auditada no histórico do SGSST.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="text-xs bg-muted/40 p-3 rounded border flex justify-between">
            <span>Status Atual: <strong>{statusAnterior}</strong></span>
            <span>Novo Status: <strong className="text-primary">{novoStatus}</strong></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-xs">
              Observação / Parecer {novoStatus === "CANCELADO" || novoStatus === "ENCERRADO" ? "*" : ""}
            </Label>
            <Textarea
              id="obs"
              placeholder={
                novoStatus === "ENCERRADO"
                  ? "Parecer conclusivo demonstrando a eficácia do tratamento das causas raiz..."
                  : novoStatus === "CANCELADO"
                  ? "Informe a justificativa do cancelamento do registro..."
                  : "Insira notas sobre o andamento..."
              }
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required={novoStatus === "CANCELADO" || novoStatus === "ENCERRADO"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={novoStatus === "CANCELADO" ? "destructive" : "default"}
              disabled={isLoading || ((novoStatus === "CANCELADO" || novoStatus === "ENCERRADO") && !observacao.trim())}
            >
              {isLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
