import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { SgsstEvidenciasPanel } from "@/components/sgsst/SgsstEvidenciasPanel";
import {
  ENTIDADE_EVIDENCIA_LABEL,
  type EntidadeEvidencia,
} from "@/hooks/sgsst/useSgsstEvidencias";

/**
 * O painel de evidências dentro de um diálogo.
 *
 * Existe para os registros que vivem em LINHA DE TABELA — entrega de EPI,
 * devolução, higienização, medição atmosférica. Nesses casos não há tela de
 * detalhe onde encaixar o painel, e abrir uma só para anexar foto seria mais
 * navegação do que a tarefa merece.
 */

interface SgsstEvidenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidade: EntidadeEvidencia;
  entidadeId?: string;
  permiteEditar?: boolean;
  /** Identifica o registro no título, para não abrir dúvida sobre qual linha é. */
  subtitulo?: string;
  ajuda?: string;
}

export function SgsstEvidenciasDialog({
  open,
  onOpenChange,
  entidade,
  entidadeId,
  permiteEditar = true,
  subtitulo,
  ajuda,
}: SgsstEvidenciasDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Fotos — {ENTIDADE_EVIDENCIA_LABEL[entidade]}
          </DialogTitle>
          {subtitulo && (
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          )}
        </DialogHeader>

        <SgsstEvidenciasPanel
          entidade={entidade}
          entidadeId={entidadeId}
          permiteEditar={permiteEditar}
          ajuda={ajuda}
          semCartao
        />

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
