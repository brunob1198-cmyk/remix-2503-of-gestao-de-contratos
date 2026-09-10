/**
 * Quando uma inspeção está atrasada.
 *
 * O DEFEITO QUE ISTO CORRIGE
 *
 * Uma inspeção planejada para ontem e não executada aparecia como qualquer outra
 * planejada. A palavra "atrasada" não existia em nenhum lugar do módulo — nem na
 * lista, nem no painel, nem no banco. Inspeção existe para ser feita numa data; sem
 * marcar quem passou da data, o painel diz que está tudo em ordem enquanto a
 * auditoria de campo não aconteceu.
 *
 * O sistema já sabia fazer isso para não conformidade (`naoConformidadesVencidas`).
 * Inspeção só tinha ficado de fora.
 *
 * POR QUE NÃO É SÓ "data < hoje"
 *
 * Três situações diferentes cabem debaixo de "passou da data", e tratá-las igual
 * apaga a informação que decide o que fazer:
 *
 * - PLANEJADA e a data passou: ninguém começou. É o atraso de verdade.
 * - EM_EXECUCAO e a data passou: alguém está fazendo, só demorou mais que o
 *   previsto. Chamar isso de "atrasada" junto com o caso acima faria o gestor
 *   cobrar quem já está trabalhando, e esconderia quem não começou.
 * - Sem data planejada: não há como julgar. Não é atraso nem pontualidade — é falta
 *   de plano, e some se for chamado de qualquer um dos dois.
 */

export type StatusDaInspecao =
  | "PLANEJADA"
  | "EM_EXECUCAO"
  | "CONCLUIDA"
  | "CANCELADA";

export type SituacaoDoPrazo =
  /** Planejada, a data passou, ninguém começou. */
  | "ATRASADA"
  /** Planejada para hoje ou para frente. */
  | "NO_PRAZO"
  /** Em execução dentro do previsto. */
  | "EM_EXECUCAO"
  /** Em execução, mas já passou da data planejada. */
  | "EM_EXECUCAO_ALEM_DO_PRAZO"
  /** Encerrada: concluída ou cancelada. Prazo não se aplica mais. */
  | "ENCERRADA"
  /** Sem data planejada — não dá para julgar prazo. */
  | "SEM_DATA";

/** Só a parte de data, em ISO (`YYYY-MM-DD`), sem fuso para não deslocar o dia. */
function soODia(valor: string): string {
  return (valor ?? "").trim().slice(0, 10);
}

/**
 * Em que situação de prazo a inspeção está.
 *
 * `hoje` entra por parâmetro para o teste não depender do relógio, e a comparação é
 * de texto ISO em vez de `Date`: criar `Date` a partir de `YYYY-MM-DD` interpreta em
 * UTC, e no fuso do Brasil isso volta um dia — uma inspeção planejada para hoje
 * apareceria como atrasada logo de manhã.
 */
export function situacaoDoPrazo(params: {
  status: StatusDaInspecao | string;
  dataPlanejada?: string | null;
  /** Hoje em ISO (`YYYY-MM-DD`). */
  hoje: string;
}): SituacaoDoPrazo {
  const status = (params.status ?? "").toUpperCase();

  if (status === "CONCLUIDA" || status === "CANCELADA") return "ENCERRADA";

  const planejada = soODia(params.dataPlanejada ?? "");
  if (!planejada) return "SEM_DATA";

  const passou = planejada < soODia(params.hoje);

  if (status === "EM_EXECUCAO") {
    return passou ? "EM_EXECUCAO_ALEM_DO_PRAZO" : "EM_EXECUCAO";
  }

  // PLANEJADA, e qualquer status desconhecido: o que importa é que não começou.
  return passou ? "ATRASADA" : "NO_PRAZO";
}

/** Verdadeiro para o que exige ação de alguém por causa do prazo. */
export function exigeAtencao(situacao: SituacaoDoPrazo): boolean {
  return situacao === "ATRASADA" || situacao === "EM_EXECUCAO_ALEM_DO_PRAZO";
}

/**
 * Quantos dias de atraso, para a mensagem dizer o tamanho do problema.
 *
 * "Atrasada" e "atrasada há 40 dias" pedem providências diferentes. Devolve 0
 * quando não há atraso, para quem chama não precisar tratar nulo.
 */
export function diasDeAtraso(params: {
  dataPlanejada?: string | null;
  hoje: string;
}): number {
  const planejada = soODia(params.dataPlanejada ?? "");
  const hoje = soODia(params.hoje);
  if (!planejada || !hoje || planejada >= hoje) return 0;

  const MS_POR_DIA = 86_400_000;
  const diff = Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${planejada}T00:00:00Z`);
  return Math.max(0, Math.round(diff / MS_POR_DIA));
}

export interface ResumoDoPrazo {
  atrasadas: number;
  emExecucaoAlemDoPrazo: number;
  noPrazo: number;
  semData: number;
  /** Maior atraso do conjunto, para o painel dizer o pior caso. */
  maiorAtrasoEmDias: number;
}

/**
 * Conta as situações de um conjunto de inspeções.
 *
 * `semData` é contado separado em vez de somado ao "no prazo": inspeção sem data
 * planejada é uma falha de planejamento, e escondê-la entre as pontuais faria o
 * painel afirmar pontualidade que ninguém verificou.
 */
export function resumoDoPrazo(
  inspecoes: readonly { status: string; data_planejada?: string | null }[],
  hoje: string
): ResumoDoPrazo {
  const resumo: ResumoDoPrazo = {
    atrasadas: 0,
    emExecucaoAlemDoPrazo: 0,
    noPrazo: 0,
    semData: 0,
    maiorAtrasoEmDias: 0,
  };

  for (const i of inspecoes) {
    const situacao = situacaoDoPrazo({
      status: i.status,
      dataPlanejada: i.data_planejada,
      hoje,
    });

    if (situacao === "ATRASADA") resumo.atrasadas++;
    else if (situacao === "EM_EXECUCAO_ALEM_DO_PRAZO") resumo.emExecucaoAlemDoPrazo++;
    else if (situacao === "NO_PRAZO" || situacao === "EM_EXECUCAO") resumo.noPrazo++;
    else if (situacao === "SEM_DATA") resumo.semData++;

    if (exigeAtencao(situacao)) {
      const dias = diasDeAtraso({ dataPlanejada: i.data_planejada, hoje });
      if (dias > resumo.maiorAtrasoEmDias) resumo.maiorAtrasoEmDias = dias;
    }
  }

  return resumo;
}
