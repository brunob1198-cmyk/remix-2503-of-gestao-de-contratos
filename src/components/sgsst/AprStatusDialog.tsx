import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusApr } from "@/hooks/sgsst/useSgsstApr";
import { ShieldCheck, XCircle, AlertCircle, Lock, RefreshCw } from "lucide-react";

interface AprStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusAnterior: StatusApr;
  novoStatus: StatusApr;
  onConfirm: (observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function AprStatusDialog({
  open,
  onOpenChange,
  statusAnterior,
  novoStatus,
  onConfirm,
  isLoading = false,
}: AprStatusDialogProps) {
  const [observacao, setObservacao] = useState("");

  const getStatusIcon = (s: StatusApr) => {
    switch (s) {
      case "EM_ANALISE":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "APROVADA":
        return <ShieldCheck className="h-5 w-5 text-emerald-500" />;
      case "REJEITADA":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "CANCELADA":
      case "ENCERRADA":
        return <Lock className="h-5 w-5 text-gray-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusTitle = (s: StatusApr) => {
    switch (s) {
      case "EM_ANALISE":
        return "Submeter APR para Análise Técnica";
      case "APROVADA":
        return "Aprovar APR";
      case "REJEITADA":
        return "Rejeitar APR";
      case "CANCELADA":
        return "Cancelar APR";
      case "ENCERRADA":
        return "Encerrar APR";
      case "RASCUNHO":
        return "Retornar APR para Rascunho";
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
            Esta ação registrará o novo status no histórico de aprovações do SGSST.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="text-xs bg-muted/40 p-3 rounded border flex justify-between">
            <span>Status Atual: <strong>{statusAnterior}</strong></span>
            <span>Novo Status: <strong className="text-primary">{novoStatus}</strong></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-xs">
              Observação / Justificativa {novoStatus === "REJEITADA" ? "*" : ""}
            </Label>
            <Textarea
              id="obs"
              placeholder={
                novoStatus === "REJEITADA"
                  ? "Informe os motivos da rejeição e adequações necessárias..."
                  : "Insira observações relevantes para o parecer de aprovação/mudança..."
              }
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required={novoStatus === "REJEITADA"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={novoStatus === "REJEITADA" || novoStatus === "CANCELADA" ? "destructive" : "default"}
              disabled={isLoading || (novoStatus === "REJEITADA" && !observacao.trim())}
            >
              {isLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
