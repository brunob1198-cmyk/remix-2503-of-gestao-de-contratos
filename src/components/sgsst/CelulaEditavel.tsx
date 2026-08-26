import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Campo que se edita na própria linha da tabela.
 *
 * Existe porque vincular errado obrigava a desvincular e lançar de novo: os
 * dados do vínculo (tempo de exposição, quantidade, periodicidade de troca)
 * eram gravados na inclusão e depois só apareciam como texto. Excluir e refazer
 * não é equivalente a corrigir — perde a data de criação e o autor do registro.
 *
 * Grava no `onBlur` e no Enter, nunca no `onChange`: gravar a cada tecla
 * dispararia um UPDATE por caractere digitado.
 */

interface CelulaEditavelProps {
  /** Valor gravado hoje, já em forma de texto. */
  valor: string;
  /** Chamado só quando o texto é válido e diferente do que estava gravado. */
  onSalvar: (texto: string) => void;
  /** Mensagem de erro, ou `null` quando o texto serve. */
  validar?: (texto: string) => string | null;
  placeholder?: string;
  ariaLabel: string;
  inputMode?: "text" | "numeric";
  className?: string;
}

export function CelulaEditavel({
  valor,
  onSalvar,
  validar,
  placeholder,
  ariaLabel,
  inputMode = "text",
  className,
}: CelulaEditavelProps) {
  const [rascunho, setRascunho] = useState(valor);
  const [erro, setErro] = useState<string | null>(null);
  const editando = useRef(false);

  // Acompanha o valor que voltou do banco — mas não enquanto o campo está sob
  // o cursor, ou uma revalidação em segundo plano apagaria o que está sendo
  // digitado.
  useEffect(() => {
    if (!editando.current) {
      setRascunho(valor);
      setErro(null);
    }
  }, [valor]);

  const tentarSalvar = () => {
    const texto = rascunho.trim();
    if (texto === valor.trim()) {
      setErro(null);
      return;
    }

    const problema = validar?.(texto) ?? null;
    if (problema) {
      // Mantém o texto digitado à vista. Reverter em silêncio esconderia o erro
      // e jogaria fora o que a pessoa escreveu.
      setErro(problema);
      return;
    }

    setErro(null);
    onSalvar(texto);
  };

  return (
    <div className="space-y-1">
      <Input
        value={rascunho}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-label={ariaLabel}
        aria-invalid={!!erro}
        className={`h-7 text-xs ${erro ? "border-destructive" : ""} ${className ?? ""}`}
        onChange={(e) => setRascunho(e.target.value)}
        onFocus={() => {
          editando.current = true;
        }}
        onBlur={() => {
          editando.current = false;
          tentarSalvar();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setRascunho(valor);
            setErro(null);
            editando.current = false;
            e.currentTarget.blur();
          }
        }}
      />
      {erro && <p className="text-[10px] leading-tight text-destructive">{erro}</p>}
    </div>
  );
}
