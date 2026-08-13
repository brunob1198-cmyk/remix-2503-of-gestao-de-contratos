import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusNC } from "@/hooks/sgsst/useSgsstNaoConformidades";
import { AlertOctagon, CheckCircle2, PlayCircle, XCircle, Search, FileText, ShieldCheck } from "lucide-react";

interface NcStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusAnterior: StatusNC;
  novoStatus: StatusNC;
  onConfirm: (observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function NcStatusDialog({
  open,
  onOpenChange,
  statusAnterior,
  novoStatus,
  onConfirm,
  isLoading = false,
}: NcStatusDialogProps) {
  const [observacao, setObservacao] = useState("");

  const getStatusIcon = (s: StatusNC) => {
    switch (s) {
      case "EM_ANALISE":
        return <Search className="h-5 w-5 text-blue-500" />;
      case "PLANO_ACAO":
        return <FileText className="h-5 w-5 text-purple-500" />;
      case "EM_TRATAMENTO":
        return <PlayCircle className="h-5 w-5 text-amber-500" />;
      case "AGUARDANDO_VERIFICACAO":
        return <ShieldCheck className="h-5 w-5 text-indigo-500" />;
      case "CONCLUIDA":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "CANCELADA":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertOctagon className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusTitle = (s: StatusNC) => {
    switch (s) {
      case "EM_ANALISE":
        return "Submeter para Análise de Causa";
      case "PLANO_ACAO":
        return "Elaborar Plano de Ação";
      case "EM_TRATAMENTO":
        return "Iniciar Execução do Tratamento";
      case "AGUARDANDO_VERIFICACAO":
        return "Solicitar Verificação de Eficácia";
      case "CONCLUIDA":
        return "Concluir Não Conformidade";
      case "CANCELADA":
        return "Cancelar Não Conformidade";
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
              Observação / Parecer {novoStatus === "CANCELADA" ? "*" : ""}
            </Label>
            <Textarea
              id="obs"
              placeholder={
                novoStatus === "CANCELADA"
                  ? "Informe a justificativa do cancelamento..."
                  : "Insira parecer ou instruções..."
              }
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required={novoStatus === "CANCELADA"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={novoStatus === "CANCELADA" ? "destructive" : "default"}
              disabled={isLoading || (novoStatus === "CANCELADA" && !observacao.trim())}
            >
              {isLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
