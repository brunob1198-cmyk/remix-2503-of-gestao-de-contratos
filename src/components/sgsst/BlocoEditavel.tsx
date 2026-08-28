import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Bloco de texto longo editável na própria tela de detalhe.
 *
 * Existe pelo mesmo motivo do `CelulaEditavel`: corrigir o objetivo do programa
 * obrigava a abrir o formulário de "Editar Dados", passar pelos campos de
 * vigência e médico responsável e voltar. Para um ajuste de redação, é caminho
 * demais — e formulário longo aberto por um motivo pequeno é onde se altera um
 * campo por engano.
 *
 * Grava no `onBlur` e desfaz no Escape. Não grava no `onChange`: seriam dezenas
 * de UPDATE por parágrafo digitado.
 */

interface BlocoEditavelProps {
  rotulo: string;
  valor: string | null | undefined;
  /** Chamado só quando o texto mudou de fato. */
  onSalvar: (texto: string) => void;
  /** Mostrado quando está vazio e não é editável. */
  textoSeVazio?: string;
  placeholder?: string;
  linhas?: number;
  /** Sem permissão, ou documento fechado: mostra sem editar. */
  somenteLeitura?: boolean;
}

export function BlocoEditavel({
  rotulo,
  valor,
  onSalvar,
  textoSeVazio = "Não informado.",
  placeholder,
  linhas = 4,
  somenteLeitura = false,
}: BlocoEditavelProps) {
  const original = valor ?? "";
  const [rascunho, setRascunho] = useState(original);
  const editando = useRef(false);

  // Acompanha o valor que voltou do banco — mas não enquanto o campo está sob o
  // cursor, ou uma revalidação em segundo plano apagaria o que se digita.
  useEffect(() => {
    if (!editando.current) setRascunho(original);
  }, [original]);

  if (somenteLeitura) {
    return (
      <div className="space-y-1.5">
        <Label className="font-semibold">{rotulo}</Label>
        <div className="min-h-[60px] whitespace-pre-wrap rounded border bg-muted/40 p-3 text-xs">
          {original || textoSeVazio}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="font-semibold">{rotulo}</Label>
      <Textarea
        value={rascunho}
        placeholder={placeholder}
        rows={linhas}
        className="text-xs"
        onChange={(e) => setRascunho(e.target.value)}
        onFocus={() => {
          editando.current = true;
        }}
        onBlur={() => {
          editando.current = false;
          // Sem mudança não gera gravação: evita UPDATE a cada clique que passa
          // pelo campo.
          if (rascunho.trim() === original.trim()) return;
          onSalvar(rascunho.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setRascunho(original);
            editando.current = false;
            e.currentTarget.blur();
          }
        }}
      />
      <p className="text-[11px] leading-tight text-muted-foreground">
        Salva ao sair do campo. Esc desfaz.
      </p>
    </div>
  );
}
