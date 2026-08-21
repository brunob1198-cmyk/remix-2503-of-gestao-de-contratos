/**
 * Panorama de treinamentos: as duas metades da mesma pergunta, juntas.
 *
 * O módulo respondia a pergunta pela metade, em duas telas que não se falavam:
 *
 *  - Funções → Pendências dizia quem NUNCA FEZ o treinamento que a função exige,
 *    mas só enxergava treinamento vinculado a uma função, e só sinalizava o que
 *    já estava vencido.
 *  - Treinamentos → Vencimentos dizia o que ESTÁ VENCENDO, para qualquer
 *    treinamento, mas não sabia dizer quem nunca fez — sem matrícula não há
 *    linha nenhuma para vencer.
 *
 * Quem monta o cronograma de capacitação precisa das duas ao mesmo tempo: a
 * turma que vai ser aberta atende os dois grupos na mesma data. Ver metade da
 * lista significa abrir turma duas vezes, ou esquecer um grupo.
 *
 * O cruzamento é puro de propósito — a regra de "o que está pendente" é a parte
 * que precisa de teste, e teste dela não deve depender de banco.
 */

export type SituacaoPanorama = "NUNCA_FEITO" | "VENCIDO" | "A_VENCER";

export const SITUACAO_PANORAMA_LABEL: Record<SituacaoPanorama, string> = {
  NUNCA_FEITO: "Nunca realizado",
  VENCIDO: "Vencido",
  A_VENCER: "A vencer",
};

/** Janela padrão de antecedência. Mesma da aba de Vencimentos. */
export const JANELA_PANORAMA_DIAS = 90;

/** Pendência vinda da matriz de função (quem nunca fez, ou já venceu). */
export interface PendenciaDaFuncao {
  colaboradorId: string;
  colaborador: string;
  funcaoNome?: string | null;
  obra?: string | null;
  treinamentoId: string;
  treinamentoNome: string;
  situacao: "NUNCA_FEITO" | "VENCIDO";
  vencimento?: string | null;
}

/** Matrícula já registrada, com a validade que dela resultou. */
export interface MatriculaPanorama {
  colaboradorId: string;
  colaborador: string;
  funcaoNome?: string | null;
  obra?: string | null;
  treinamentoId?: string | null;
  treinamentoNome: string;
  /** Só APROVADO conta como treinamento feito. */
  resultado: string;
  validade?: string | null;
}

export interface LinhaPanorama {
  chave: string;
  colaboradorId: string;
  colaborador: string;
  funcaoNome?: string | null;
  obra?: string | null;
  treinamentoId?: string | null;
  treinamentoNome: string;
  situacao: SituacaoPanorama;
  vencimento?: string | null;
  /** Dias até vencer; negativo quando já venceu; nulo quando nunca foi feito. */
  diasParaVencer: number | null;
  /**
   * Verdadeiro quando a função do colaborador exige este treinamento. Falso
   * quando a linha veio só da matrícula — o treinamento foi feito, vence, mas
   * nenhuma função o exige formalmente.
   */
  exigidoPelaFuncao: boolean;
}

/** Converte "YYYY-MM-DD" em Date local — o ISO puro desloca o fuso. */
function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Diferença em dias inteiros pelo calendário, sem hora. */
export function diasEntre(de: Date, ate: Date): number {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * A chave que identifica o par. Duas fontes descrevendo o mesmo par não podem
 * gerar duas linhas.
 *
 * Quando a matrícula não sabe de qual treinamento é (turma apagada), cai no nome
 * — pior que o id, mas melhor que juntar treinamentos diferentes sob a chave
 * vazia.
 */
function chaveDoPar(
  colaboradorId: string,
  treinamentoId?: string | null,
  treinamentoNome?: string
): string {
  return `${colaboradorId}::${treinamentoId || `nome:${treinamentoNome ?? ""}`}`;
}

/** Nunca feito é mais grave que vencido, que é mais grave que a vencer. */
const ORDEM_SITUACAO: Record<SituacaoPanorama, number> = {
  NUNCA_FEITO: 0,
  VENCIDO: 1,
  A_VENCER: 2,
};

export interface ResumoPanorama {
  nuncaFeito: number;
  vencido: number;
  aVencer: number;
  /** Pessoas distintas com ao menos uma linha. Conta gente, não itens. */
  colaboradoresAfetados: number;
  /** Treinamentos distintos a programar. É quantas turmas, no mínimo, abrir. */
  treinamentosAProgramar: number;
}

export interface ResultadoPanorama {
  linhas: LinhaPanorama[];
  resumo: ResumoPanorama;
}

/**
 * Junta as duas fontes numa lista só.
 *
 * A pendência da função sempre vence o empate: ela é a leitura mais severa do
 * mesmo par. Uma matrícula "a vencer" e uma pendência "nunca feito" para o mesmo
 * colaborador e treinamento acontecem quando houve matrícula sem aprovação — e
 * nesse caso o que importa é que o treinamento não foi concluído.
 */
export function montarPanorama(params: {
  pendencias: readonly PendenciaDaFuncao[];
  matriculas: readonly MatriculaPanorama[];
  hoje: Date;
  janelaDias?: number;
}): ResultadoPanorama {
  const { pendencias, matriculas, hoje } = params;
  const janela = params.janelaDias ?? JANELA_PANORAMA_DIAS;

  const porChave = new Map<string, LinhaPanorama>();

  for (const p of pendencias) {
    const chave = chaveDoPar(p.colaboradorId, p.treinamentoId, p.treinamentoNome);
    porChave.set(chave, {
      chave,
      colaboradorId: p.colaboradorId,
      colaborador: p.colaborador,
      funcaoNome: p.funcaoNome ?? null,
      obra: p.obra ?? null,
      treinamentoId: p.treinamentoId,
      treinamentoNome: p.treinamentoNome,
      situacao: p.situacao,
      vencimento: p.vencimento ?? null,
      diasParaVencer: p.vencimento ? diasEntre(hoje, comoData(p.vencimento)) : null,
      exigidoPelaFuncao: true,
    });
  }

  for (const m of matriculas) {
    // Sem aprovação não houve capacitação: a linha não descreve um vencimento, e
    // quem cobra "nunca fez" é a matriz da função.
    if (m.resultado !== "APROVADO") continue;

    // Treinamento sem validade não expira — não há nada a programar.
    if (!m.validade) continue;

    const dias = diasEntre(hoje, comoData(m.validade));
    if (dias > janela) continue;

    const chave = chaveDoPar(m.colaboradorId, m.treinamentoId, m.treinamentoNome);
    // Já descrito pela matriz, que é a leitura mais severa do mesmo par.
    if (porChave.has(chave)) continue;

    porChave.set(chave, {
      chave,
      colaboradorId: m.colaboradorId,
      colaborador: m.colaborador,
      funcaoNome: m.funcaoNome ?? null,
      obra: m.obra ?? null,
      treinamentoId: m.treinamentoId ?? null,
      treinamentoNome: m.treinamentoNome,
      situacao: dias < 0 ? "VENCIDO" : "A_VENCER",
      vencimento: m.validade,
      diasParaVencer: dias,
      exigidoPelaFuncao: false,
    });
  }

  const linhas = [...porChave.values()].sort((a, b) => {
    const porSituacao = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao];
    if (porSituacao !== 0) return porSituacao;

    // Dentro da mesma situação, o mais urgente primeiro: quem venceu há mais
    // tempo, e depois quem vence mais cedo.
    const diasA = a.diasParaVencer;
    const diasB = b.diasParaVencer;
    if (diasA !== null && diasB !== null && diasA !== diasB) return diasA - diasB;

    return a.colaborador.localeCompare(b.colaborador, "pt-BR");
  });

  return {
    linhas,
    resumo: {
      nuncaFeito: linhas.filter((l) => l.situacao === "NUNCA_FEITO").length,
      vencido: linhas.filter((l) => l.situacao === "VENCIDO").length,
      aVencer: linhas.filter((l) => l.situacao === "A_VENCER").length,
      colaboradoresAfetados: new Set(linhas.map((l) => l.colaboradorId)).size,
      treinamentosAProgramar: new Set(
        linhas.map((l) => l.treinamentoId || `nome:${l.treinamentoNome}`)
      ).size,
    },
  };
}

/**
 * Agrupa por treinamento — a visão de quem vai abrir turma.
 *
 * A lista por pessoa responde "quem está pendente"; esta responde "qual turma
 * abrir e para quantos", que é a decisão que de fato se toma.
 */
export interface GrupoPorTreinamento {
  treinamentoId?: string | null;
  treinamentoNome: string;
  total: number;
  nuncaFeito: number;
  vencido: number;
  aVencer: number;
  /** O vencimento mais próximo do grupo — define a urgência da turma. */
  prazoMaisCurto: number | null;
}

export function agruparPorTreinamento(
  linhas: readonly LinhaPanorama[]
): GrupoPorTreinamento[] {
  const porTreinamento = new Map<string, GrupoPorTreinamento>();

  for (const l of linhas) {
    const chave = l.treinamentoId || `nome:${l.treinamentoNome}`;
    const grupo =
      porTreinamento.get(chave) ??
      {
        treinamentoId: l.treinamentoId ?? null,
        treinamentoNome: l.treinamentoNome,
        total: 0,
        nuncaFeito: 0,
        vencido: 0,
        aVencer: 0,
        prazoMaisCurto: null,
      };

    grupo.total += 1;
    if (l.situacao === "NUNCA_FEITO") grupo.nuncaFeito += 1;
    if (l.situacao === "VENCIDO") grupo.vencido += 1;
    if (l.situacao === "A_VENCER") grupo.aVencer += 1;

    if (l.diasParaVencer !== null) {
      grupo.prazoMaisCurto =
        grupo.prazoMaisCurto === null
          ? l.diasParaVencer
          : Math.min(grupo.prazoMaisCurto, l.diasParaVencer);
    }

    porTreinamento.set(chave, grupo);
  }

  // Mais gente pendente primeiro: é a turma que resolve mais de uma vez.
  return [...porTreinamento.values()].sort((a, b) => b.total - a.total);
}
