/**
 * Guia de encaminhamento para exame ocupacional.
 *
 * O DOCUMENTO QUE FALTAVA
 *
 * O ASO é a resposta do médico: ele atesta que o exame aconteceu e qual foi a
 * conclusão de aptidão. Por isso só pode ser emitido depois — e o botão de ASO
 * exigir status REALIZADO está certo.
 *
 * O que não existia era o documento da PERGUNTA: o papel que o empregador entrega
 * ao trabalhador para ele ir até o médico. Sem ele, a única forma de tirar uma
 * impressão do sistema era marcar como REALIZADO um exame que não aconteceu e
 * classificar um resultado que só o médico pode dar. Ou seja: para obter um
 * documento, falsificar dois campos de um registro de conformidade.
 *
 * A REGRA QUE ESTE MÓDULO NÃO NEGOCIA
 *
 * A guia é um PEDIDO. Ela nunca carrega resultado, achado clínico nem conclusão
 * de aptidão — nem em branco "para preencher à mão", porque campo de aptidão num
 * documento emitido pelo empregador é exatamente o que não pode existir. O que a
 * guia leva é o que o médico precisa para decidir o escopo do exame: a ocasião, os
 * exames pedidos e, principalmente, os RISCOS a que o trabalhador está exposto
 * (NR-07 7.4.2 e 7.5.1 — o exame se planeja a partir do risco).
 */

export type StatusExameParaGuia = "PENDENTE" | "AGENDADO" | "REALIZADO" | "CANCELADO";

/**
 * O que cada status significa, para a tela poder explicar em vez de só exibir a
 * sigla. Foi a dúvida que originou este módulo.
 */
export const SIGNIFICADO_DO_STATUS: Record<StatusExameParaGuia, string> = {
  PENDENTE:
    "Exame solicitado pela empresa. O trabalhador ainda não foi encaminhado ou " +
    "ainda não há data marcada.",
  AGENDADO: "Data marcada na clínica. O exame ainda não aconteceu.",
  REALIZADO:
    "O exame aconteceu. Só a partir daqui existe resultado, e só aqui o ASO pode " +
    "ser emitido.",
  CANCELADO: "A solicitação foi cancelada e não deve ser cumprida.",
};

export type PodeEmitirGuia =
  | { pode: true }
  | { pode: false; motivo: string };

/**
 * A guia pode ser emitida para este exame?
 *
 * Só antes de o exame acontecer. Depois de REALIZADO o documento que vale é o ASO,
 * e emitir uma guia de encaminhamento para um exame já feito confundiria o
 * histórico — pareceria que há um segundo exame pendente.
 */
export function podeEmitirGuia(status: StatusExameParaGuia): PodeEmitirGuia {
  if (status === "REALIZADO") {
    return {
      pode: false,
      motivo: "O exame já foi realizado. O documento desta etapa é o ASO.",
    };
  }
  if (status === "CANCELADO") {
    return { pode: false, motivo: "A solicitação está cancelada." };
  }
  return { pode: true };
}

export interface ExameParaGuia {
  id: string;
  colaborador_id: string;
  nome_exame: string;
  /** Ocasião: Admissional, Periódico, Demissional... */
  tipo: string;
  /** CLINICO = a consulta; COMPLEMENTAR = exame de apoio. */
  natureza?: string | null;
  status: StatusExameParaGuia;
  data_solicitacao?: string | null;
  data_agendada?: string | null;
  hora_agendada?: string | null;
  clinica_id?: string | null;
  observacoes?: string | null;
}

export interface GrupoDaGuia {
  colaboradorId: string;
  /** Ocasião predominante, para o título do documento. */
  ocasiao: string;
  /** Todos os exames pendentes do trabalhador, clínico primeiro. */
  exames: ExameParaGuia[];
  /** Quando todos apontam para a mesma clínica; nulo se divergem ou não têm. */
  clinicaId: string | null;
}

/** O exame clínico vem antes: é a consulta que orienta os complementares. */
function ordemDaNatureza(e: ExameParaGuia): number {
  return e.natureza === "CLINICO" ? 0 : 1;
}

/**
 * Reúne, para um trabalhador, TODOS os exames que ainda vão acontecer.
 *
 * Uma guia por exame seria fiel ao banco e errada na prática: o trabalhador vai à
 * clínica uma vez e faz a consulta e os complementares na mesma ida. Três papéis
 * para a mesma ida é como um deles se perde.
 *
 * `clinicaId` só vem preenchido quando TODOS concordam. Divergindo, o documento
 * não afirma clínica nenhuma — mandar o trabalhador ao endereço errado é pior que
 * não informar endereço.
 */
export function grupoDaGuia(
  exames: readonly ExameParaGuia[],
  colaboradorId: string
): GrupoDaGuia | null {
  const doTrabalhador = exames
    .filter((e) => e.colaborador_id === colaboradorId && podeEmitirGuia(e.status).pode)
    .sort(
      (a, b) =>
        ordemDaNatureza(a) - ordemDaNatureza(b) ||
        a.nome_exame.localeCompare(b.nome_exame, "pt-BR")
    );

  if (doTrabalhador.length === 0) return null;

  const clinicas = new Set(doTrabalhador.map((e) => e.clinica_id ?? "").filter(Boolean));
  const clinicaId = clinicas.size === 1 ? [...clinicas][0] : null;

  // A ocasião do exame clínico manda; sem ele, a do primeiro da lista. Misturar
  // admissional com periódico na mesma ida é raro e, quando ocorre, o documento
  // lista a ocasião de cada exame na tabela.
  const ocasiao = doTrabalhador[0].tipo;

  return { colaboradorId, ocasiao, exames: doTrabalhador, clinicaId };
}

/** Ocasiões distintas presentes no grupo, para o documento avisar quando há mais de uma. */
export function ocasioesDoGrupo(grupo: GrupoDaGuia): string[] {
  return [...new Set(grupo.exames.map((e) => e.tipo))];
}

/**
 * Pendências da guia: o que falta para ela ser útil a quem vai atender.
 *
 * Nenhuma delas impede a emissão. Guia sem clínica definida ainda serve — o
 * trabalhador pode ser encaminhado a uma clínica escolhida depois. O que não
 * serve é guia sem risco declarado, e é por isso que essa é a primeira da lista.
 */
export function pendenciasDaGuia(params: {
  grupo: GrupoDaGuia;
  /** `null` = não foi consultado. `[]` = consultado e a função não tem risco. */
  riscosDaFuncao: readonly unknown[] | null;
  temFuncao: boolean;
  temClinica: boolean;
  temMedicoCoordenador: boolean;
}): string[] {
  const p: string[] = [];

  if (!params.temFuncao) {
    p.push(
      "Trabalhador sem função cadastrada — sem ela não há risco a informar ao médico."
    );
  } else if (params.riscosDaFuncao && params.riscosDaFuncao.length === 0) {
    p.push(
      "A função não tem risco vinculado. O médico precisa dos riscos para definir o " +
        "escopo do exame (NR-07 7.4.2)."
    );
  }

  if (!params.temClinica) {
    p.push("Clínica de destino não definida — a guia sai sem endereço para o trabalhador.");
  }

  if (!params.temMedicoCoordenador) {
    p.push("PCMSO sem médico coordenador: é ele quem responde pela solicitação.");
  }

  if (ocasioesDoGrupo(params.grupo).length > 1) {
    p.push(
      "Há mais de uma ocasião de exame nesta guia. Confira se todos devem ser feitos " +
        "na mesma ida."
    );
  }

  return p;
}
