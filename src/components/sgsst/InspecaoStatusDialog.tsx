import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusInspecao } from "@/hooks/sgsst/useSgsstInspecoes";
import { SearchCheck, CheckCircle2, Lock, PlayCircle, XCircle } from "lucide-react";

interface InspecaoStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusAnterior: StatusInspecao;
  novoStatus: StatusInspecao;
  onConfirm: (observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function InspecaoStatusDialog({
  open,
  onOpenChange,
  statusAnterior,
  novoStatus,
  onConfirm,
  isLoading = false,
}: InspecaoStatusDialogProps) {
  const [observacao, setObservacao] = useState("");

  const getStatusIcon = (s: StatusInspecao) => {
    switch (s) {
      case "EM_EXECUCAO":
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      case "CONCLUIDA":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "CANCELADA":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <SearchCheck className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusTitle = (s: StatusInspecao) => {
    switch (s) {
      case "EM_EXECUCAO":
        return "Iniciar Execução da Inspeção";
      case "CONCLUIDA":
        return "Concluir Inspeção de Segurança";
      case "CANCELADA":
        return "Cancelar Inspeção";
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
            Esta transição será gravada no histórico de auditoria da inspeção.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="text-xs bg-muted/40 p-3 rounded border flex justify-between">
            <span>Status Atual: <strong>{statusAnterior}</strong></span>
            <span>Novo Status: <strong className="text-primary">{novoStatus}</strong></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-xs">
              Observação / Parecer do Inspetor {novoStatus === "CANCELADA" ? "*" : ""}
            </Label>
            <Textarea
              id="obs"
              placeholder={
                novoStatus === "CONCLUIDA"
                  ? "Resumo das constatações finais e status do canteiro..."
                  : novoStatus === "CANCELADA"
                  ? "Informe o motivo do cancelamento da inspeção..."
                  : "Insira notas de auditoria..."
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
