import type { FaixaEtariaPcmso } from "@/hooks/sgsst/useSgsstPcmso";

/**
 * Cálculo de quem precisa ser convocado para exame.
 *
 * É a razão pela qual a faixa etária entrou na Fase 1: a NR-07 7.5.4.2 faz a
 * periodicidade do exame clínico depender da idade — anual até 18 e acima de 45
 * anos, bienal entre 18 e 45. Sem isso não há como saber a data do próximo exame.
 *
 * Fica em utils, separado do hook, porque é aritmética de calendário: dá para
 * testar sem banco, e é onde um erro silencioso deixaria trabalhador sem exame.
 */

export type SituacaoConvocacao = "VENCIDO" | "VENCE_ESTE_MES" | "A_VENCER" | "EM_DIA" | "SEM_BASE";

export const SITUACAO_LABEL: Record<SituacaoConvocacao, string> = {
  VENCIDO: "Vencido",
  VENCE_ESTE_MES: "Vence este mês",
  A_VENCER: "A vencer",
  EM_DIA: "Em dia",
  SEM_BASE: "Sem base de cálculo",
};

/** Dias de antecedência para o exame entrar na lista de "a vencer". */
export const JANELA_AVISO_DIAS = 60;

/** Idade em anos completos numa data de referência. */
export function idadeEm(nascimento: string | null | undefined, referencia: Date): number | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(n.getTime())) return null;

  let idade = referencia.getFullYear() - n.getFullYear();
  const mes = referencia.getMonth() - n.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < n.getDate())) {
    idade -= 1;
  }
  return idade >= 0 ? idade : null;
}

/**
 * A faixa do exame previsto se aplica a esta idade?
 *
 * Sem data de nascimento a faixa específica não pode ser confirmada — e nesse
 * caso é melhor convocar do que presumir que não se aplica. Deixar de convocar
 * por falta de cadastro é o erro mais caro dos dois.
 */
export function faixaSeAplica(
  faixa: FaixaEtariaPcmso | null | undefined,
  idade: number | null
): boolean {
  if (!faixa || faixa === "TODAS") return true;
  if (idade === null) return true;

  switch (faixa) {
    case "MENOR_18":
      return idade < 18;
    case "ENTRE_18_45":
      return idade >= 18 && idade <= 45;
    case "MAIOR_45":
      return idade > 45;
    default:
      return true;
  }
}

/** Soma meses preservando o fim de mês: 31/01 + 1 mês = 28/02, não 03/03. */
export function somarMeses(base: Date, meses: number): Date {
  const diaOriginal = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDiaDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDiaDoMes));
  return d;
}

function diffDias(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const na = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const nb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((na - nb) / ms);
}

export interface CalculoConvocacao {
  /** Data em que o próximo exame vence. Null quando não há base. */
  proximoVencimento: Date | null;
  situacao: SituacaoConvocacao;
  /** Dias até vencer. Negativo = já venceu. Null quando não há base. */
  diasRestantes: number | null;
}

/**
 * Situação de um exame previsto para um trabalhador.
 *
 * `ultimaRealizacao` nulo significa que o exame nunca foi feito: isso é tratado
 * como VENCIDO, não como "sem base". Quem nunca fez o exame é justamente quem
 * mais precisa aparecer na convocação.
 *
 * SEM_BASE fica reservado para o caso em que a periodicidade não foi informada —
 * aí realmente não há como calcular data.
 */
export function calcularConvocacao(params: {
  ultimaRealizacao: string | null | undefined;
  periodicidadeMeses: number | null | undefined;
  hoje?: Date;
}): CalculoConvocacao {
  const hoje = params.hoje ?? new Date();
  const periodicidade = params.periodicidadeMeses;

  if (!periodicidade || periodicidade <= 0) {
    return { proximoVencimento: null, situacao: "SEM_BASE", diasRestantes: null };
  }

  if (!params.ultimaRealizacao) {
    // Nunca realizado: vencido por definição, sem data de referência.
    return { proximoVencimento: null, situacao: "VENCIDO", diasRestantes: null };
  }

  const ultima = new Date(`${params.ultimaRealizacao.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(ultima.getTime())) {
    return { proximoVencimento: null, situacao: "SEM_BASE", diasRestantes: null };
  }

  const vencimento = somarMeses(ultima, periodicidade);
  const dias = diffDias(vencimento, hoje);

  let situacao: SituacaoConvocacao;
  if (dias < 0) {
    situacao = "VENCIDO";
  } else if (
    vencimento.getFullYear() === hoje.getFullYear() &&
    vencimento.getMonth() === hoje.getMonth()
  ) {
    situacao = "VENCE_ESTE_MES";
  } else if (dias <= JANELA_AVISO_DIAS) {
    situacao = "A_VENCER";
  } else {
    situacao = "EM_DIA";
  }

  return { proximoVencimento: vencimento, situacao, diasRestantes: dias };
}

/** Ordem de urgência, para a lista de convocação abrir pelo que importa. */
export const ORDEM_SITUACAO: Record<SituacaoConvocacao, number> = {
  VENCIDO: 0,
  VENCE_ESTE_MES: 1,
  A_VENCER: 2,
  SEM_BASE: 3,
  EM_DIA: 4,
};

export function ordenarPorUrgencia<T extends { situacao: SituacaoConvocacao; diasRestantes: number | null }>(
  itens: T[]
): T[] {
  return [...itens].sort((a, b) => {
    const oa = ORDEM_SITUACAO[a.situacao];
    const ob = ORDEM_SITUACAO[b.situacao];
    if (oa !== ob) return oa - ob;
    // Dentro da mesma situação, o mais atrasado primeiro.
    const da = a.diasRestantes ?? Number.NEGATIVE_INFINITY;
    const db = b.diasRestantes ?? Number.NEGATIVE_INFINITY;
    return da - db;
  });
}

/**
 * Por que a fila de convocação está vazia.
 *
 * A mensagem genérica — "precisa de um PCMSO ativo com exames previstos e de
 * colaboradores cadastrados" — lista as três condições e não diz qual falhou. Com
 * dois PCMSOs e um colaborador na base, quem lê conclui que já cumpriu tudo e que
 * a tela está com defeito.
 *
 * O caso que motivou isto: os dois programas estavam em RASCUNHO. A fila ignorá-los
 * está CORRETO — programa em elaboração não define o que é exigido hoje —, mas a
 * tela precisava dizer isso em vez de deixar o usuário procurar o erro.
 */
export function diagnosticoDaFilaVazia(params: {
  colaboradoresAtivos: number;
  /** Exames previstos em qualquer PCMSO, independente do status. */
  previstosTotal: number;
  /** Exames previstos que estão num PCMSO ATIVO. */
  previstosAtivos: number;
}): string {
  if (params.colaboradoresAtivos === 0) {
    return (
      "Nenhum colaborador ativo cadastrado. A convocação é montada por trabalhador, " +
      "então sem colaborador não há quem chamar."
    );
  }

  if (params.previstosTotal === 0) {
    return (
      "Nenhum exame previsto em nenhum PCMSO. É o quadro de exames do programa que " +
      "define o que cada função precisa fazer e de quanto em quanto tempo."
    );
  }

  if (params.previstosAtivos === 0) {
    return (
      `Há ${params.previstosTotal} exame(s) previsto(s), mas nenhum em PCMSO com ` +
      "status ATIVO. Programa em RASCUNHO ou ENCERRADO não define o que é exigido " +
      "hoje — mude o status do PCMSO para ATIVO e a fila passa a considerá-lo."
    );
  }

  return (
    "Há exames previstos em PCMSO ativo, mas nenhum alcança os colaboradores " +
    "cadastrados. Confira se o exame está vinculado à função certa e se a faixa " +
    "etária dele bate com a idade dos trabalhadores."
  );
}
