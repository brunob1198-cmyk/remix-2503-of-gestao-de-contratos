import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResultadoVerificacao } from "@/hooks/sgsst/useSgsstNaoConformidades";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

interface NcVerificacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { resultado: ResultadoVerificacao; observacao: string }) => Promise<void>;
  isLoading?: boolean;
}

export function NcVerificacaoDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: NcVerificacaoDialogProps) {
  const [resultado, setResultado] = useState<ResultadoVerificacao>("ACEITA");
  const [observacao, setObservacao] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({ resultado, observacao: observacao.trim() });
    setObservacao("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Verificação de Eficácia da Não Conformidade</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Avaliação formal se as ações executadas sanaram o desvio de segurança apontado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="resultado">Resultado da Verificação *</Label>
            <Select value={resultado} onValueChange={(val: ResultadoVerificacao) => setResultado(val)}>
              <SelectTrigger id="resultado">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACEITA">ACEITA — Ações eficazes, concluir Não Conformidade</SelectItem>
                <SelectItem value="REJEITADA">REJEITADA — Ações ineficazes, retornar para Em Tratamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obsVerificacao">
              Parecer do Verificador / Evidências da Eficácia {resultado === "REJEITADA" ? "*" : ""}
            </Label>
            <Textarea
              id="obsVerificacao"
              placeholder={
                resultado === "ACEITA"
                  ? "Descreva o parecer de auditoria constatando a eliminação da causa..."
                  : "Descreva o motivo da rejeição da verificação de eficácia..."
              }
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required={resultado === "REJEITADA"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={resultado === "REJEITADA" ? "destructive" : "default"}
              disabled={isLoading || (resultado === "REJEITADA" && !observacao.trim())}
            >
              {isLoading ? "Gravando..." : resultado === "ACEITA" ? "Aprovar & Concluir NC" : "Rejeitar & Reverter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
