import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SgsstConfirmDeleteProps {
  /** O que será excluído, já legível. Ex.: 'a ação "Trocar guarda-corpo"'. */
  alvo: string;
  /** Consequência concreta da exclusão, para o usuário decidir com informação. */
  consequencia?: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Rótulo do botão-gatilho; omitido, renderiza só o ícone de lixeira. */
  triggerLabel?: string;
  /** Substitui o gatilho padrão. */
  trigger?: ReactNode;
  title?: string;
}

/**
 * Confirmação de exclusão para itens-filho das telas de detalhe.
 *
 * Estas listas (ações corretivas, envolvidos, investigação, itens de checklist,
 * participantes, exames) excluíam no primeiro clique, sem confirmação — um
 * clique errado apagava registro que sustenta a rastreabilidade legal do SGSST.
 * As telas de PGR e APR já confirmavam; este componente uniformiza o padrão.
 */
export function SgsstConfirmDelete({
  alvo,
  consequencia,
  onConfirm,
  disabled,
  triggerLabel,
  trigger,
  title,
}: SgsstConfirmDeleteProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size={triggerLabel ? "sm" : "icon"}
            disabled={disabled}
            className="text-destructive hover:text-destructive"
            title={`Excluir ${alvo}`}
            aria-label={`Excluir ${alvo}`}
          >
            <Trash2 className="h-4 w-4" />
            {triggerLabel && <span className="ml-1.5">{triggerLabel}</span>}
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? `Excluir ${alvo}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {consequencia ??
              "Esta ação é permanente e o registro deixa de constar no histórico de auditoria."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
