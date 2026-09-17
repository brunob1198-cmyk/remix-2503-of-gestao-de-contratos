import type { SituacaoDaFila } from "@/utils/assinaturaFila";

/**
 * Fila fechada e documento que não existe.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * A Central mostra "Concluída" quando todos os signatários assinaram — e essa
 * conta é feita sobre os SIGNATÁRIOS, não sobre o arquivo. O documento assinado
 * é montado num passo separado, logo depois da última assinatura, e esse passo
 * pode falhar: ele junta o original com a folha, carimba os nomes e ENVIA o
 * arquivo para o armazenamento.
 *
 * O envio exige sessão do Supabase. Quem assina por link público não tem sessão
 * nenhuma — e é exatamente o caso que a fila existe para atender. Quando o
 * ÚLTIMO da fila é alguém de fora, a montagem falha no envio, o erro vai para o
 * console e a tela segue dizendo "Concluída".
 *
 * Relatado assim: dois assinaram, a fila fechou, e o botão de baixar o documento
 * assinado nunca apareceu — sem nenhuma explicação na tela.
 *
 * O QUE ESTE MÓDULO DECIDE
 *
 * Quando a Central deve parar de fingir que está tudo certo e oferecer o reparo.
 * O reparo refaz a montagem a partir de uma sessão que EXISTE — a de quem está
 * olhando a tela.
 *
 * POR QUE NÃO CONSERTAR SOZINHO AO ABRIR A TELA
 *
 * Refazer em silêncio esconderia o problema de novo, e o dono nunca saberia que
 * a assinatura externa não fecha o documento por conta própria. O botão é a
 * diferença entre um remendo e um aviso com saída.
 */

export interface SolicitacaoParaReparo {
  situacao: SituacaoDaFila;
  /** O arquivo final, quando existe. */
  arquivoAssinado?: string | null;
  /** O documento que foi para a fila. Sem ele não há o que montar. */
  arquivoOriginal?: string | null;
  /** Os tokens da fila. O reparo usa um deles para chamar o fechamento. */
  tokens: readonly (string | null | undefined)[];
}

export type EstadoDoDocumento =
  | { tipo: "PRONTO" }
  | { tipo: "NAO_SE_APLICA" }
  | { tipo: "REPARAVEL"; token: string; aviso: string }
  | { tipo: "SEM_REPARO"; aviso: string };

const AVISO_FALTANDO =
  "Todos assinaram, mas o documento assinado não chegou a ser montado — " +
  "quem assinou por último não tinha sessão aberta no sistema.";

export function estadoDoDocumento(s: SolicitacaoParaReparo): EstadoDoDocumento {
  // Fila que não fechou não tem documento a cobrar, e recusada nunca terá.
  if (s.situacao !== "CONCLUIDA") return { tipo: "NAO_SE_APLICA" };

  if ((s.arquivoAssinado ?? "").trim()) return { tipo: "PRONTO" };

  if (!(s.arquivoOriginal ?? "").trim()) {
    return {
      tipo: "SEM_REPARO",
      aviso:
        `${AVISO_FALTANDO} O documento original também não está acessível, ` +
        "então não há o que remontar — refaça a solicitação.",
    };
  }

  const token = s.tokens.map((t) => (t ?? "").trim()).find(Boolean);

  if (!token) {
    return {
      tipo: "SEM_REPARO",
      aviso: `${AVISO_FALTANDO} Sem o link de nenhum signatário, o fechamento não pode ser refeito.`,
    };
  }

  return {
    tipo: "REPARAVEL",
    token,
    aviso: `${AVISO_FALTANDO} Gere agora — as assinaturas já estão registradas e não se perdem.`,
  };
}
