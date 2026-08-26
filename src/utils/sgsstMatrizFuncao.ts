import { somarMeses } from "@/utils/sgsstConvocacao";

/**
 * Matriz de conformidade por função.
 *
 * Responde a pergunta que ninguém conseguia responder antes da função ter
 * vínculos: dado que a função exige estes treinamentos e estes EPIs, quem que
 * exerce a função ainda não tem o quê.
 *
 * A regra que atravessa tudo aqui: **na dúvida, acusa a pendência.** Deixar de
 * apontar uma falta por falha de cadastro é o erro caro — o trabalhador vai a
 * campo sem treinamento e o sistema diz que está tudo bem.
 */

export type SituacaoItem = "OK" | "NUNCA_FEITO" | "VENCIDO" | "SEM_FUNCAO";

export const SITUACAO_ITEM_LABEL: Record<SituacaoItem, string> = {
  OK: "Em dia",
  NUNCA_FEITO: "Nunca realizado",
  VENCIDO: "Vencido",
  SEM_FUNCAO: "Função não definida",
};

/** Participação em turma de treinamento, já achatada. */
export interface ParticipacaoTreinamento {
  colaboradorId: string;
  treinamentoId: string;
  resultado: string;
  /** Data ISO (YYYY-MM-DD) ou nulo quando o treinamento não vence. */
  validade?: string | null;
  dataConclusao?: string | null;
}

/** Entrega de EPI, já achatada. */
export interface EntregaEpi {
  colaboradorId: string;
  epiId: string;
  /** Data ISO (YYYY-MM-DD). */
  dataEntrega: string;
}

export interface ExigenciaTreinamento {
  treinamentoId: string;
  nome: string;
  obrigatorio: boolean;
}

export interface ExigenciaEpi {
  epiId: string;
  nome: string;
  obrigatorio: boolean;
  periodicidadeTrocaMeses?: number | null;
}

export interface ColaboradorMatriz {
  id: string;
  nome: string;
  funcaoId?: string | null;
  funcaoNome?: string | null;
  obra?: string | null;
}

export interface PendenciaItem {
  /** Chave estável para o React, sem depender do índice da lista. */
  chave: string;
  colaboradorId: string;
  colaborador: string;
  /**
   * Id da função, e não só o nome.
   *
   * Filtrar por nome parece funcionar e erra em silêncio: dois cargos parecidos
   * ("Montador" e "Montador de Estruturas") se confundem, e renomear a função
   * desliga o filtro sem nenhum aviso. Nulo quando o colaborador está sem
   * função — que é a própria pendência.
   */
  funcaoId?: string | null;
  funcaoNome?: string | null;
  obra?: string | null;
  tipo: "TREINAMENTO" | "EPI";
  itemId: string;
  itemNome: string;
  situacao: SituacaoItem;
  /** Data de vencimento, quando houve realização anterior. */
  vencimento?: string | null;
}

/** Converte "YYYY-MM-DD" em Date local, sem o deslocamento de fuso do ISO puro. */
function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * Formata como "YYYY-MM-DD" pelo calendário local.
 *
 * Não usar `toISOString()`: ele converte para UTC, e uma data local à meia-noite
 * em fuso positivo (UTC+2, por exemplo) volta como o dia ANTERIOR. A data de
 * vencimento sairia um dia errada dependendo de onde o navegador está.
 */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Um treinamento conta como feito?
 *
 * Só `APROVADO` vale — presença sem aprovação não capacita. `validade` nula
 * significa treinamento que não expira, então uma aprovação basta para sempre.
 */
export function situacaoTreinamento(
  participacoes: readonly ParticipacaoTreinamento[],
  treinamentoId: string,
  hoje: Date
): { situacao: Exclude<SituacaoItem, "SEM_FUNCAO">; vencimento: string | null } {
  const aprovadas = participacoes.filter(
    (p) => p.treinamentoId === treinamentoId && p.resultado === "APROVADO"
  );

  if (aprovadas.length === 0) return { situacao: "NUNCA_FEITO", vencimento: null };

  // Sem validade = não expira. Se qualquer aprovação for perpétua, está em dia.
  if (aprovadas.some((p) => !p.validade)) return { situacao: "OK", vencimento: null };

  // Entre as que vencem, a que vence mais tarde é a que manda.
  const maisRecente = aprovadas
    .map((p) => p.validade as string)
    .sort()
    .at(-1) as string;

  const vencida = comoData(maisRecente) < hoje;
  return { situacao: vencida ? "VENCIDO" : "OK", vencimento: maisRecente };
}

/**
 * Um EPI conta como entregue?
 *
 * `periodicidadeTrocaMeses` nula significa sem troca programada — uma entrega
 * basta. Com periodicidade, uma entrega de três anos atrás não pode continuar
 * valendo para sempre.
 */
export function situacaoEpi(
  entregas: readonly EntregaEpi[],
  epiId: string,
  periodicidadeTrocaMeses: number | null | undefined,
  hoje: Date
): { situacao: Exclude<SituacaoItem, "SEM_FUNCAO">; vencimento: string | null } {
  const doEpi = entregas.filter((e) => e.epiId === epiId);
  if (doEpi.length === 0) return { situacao: "NUNCA_FEITO", vencimento: null };

  const ultima = doEpi.map((e) => e.dataEntrega).sort().at(-1) as string;

  if (!periodicidadeTrocaMeses || periodicidadeTrocaMeses <= 0) {
    return { situacao: "OK", vencimento: null };
  }

  const proximaTroca = somarMeses(comoData(ultima), periodicidadeTrocaMeses);
  const vencida = proximaTroca < hoje;

  return {
    situacao: vencida ? "VENCIDO" : "OK",
    vencimento: comoIso(proximaTroca),
  };
}

export interface ResumoMatriz {
  colaboradoresAvaliados: number;
  semFuncao: number;
  emDia: number;
  comPendencia: number;
  pendenciasTreinamento: number;
  pendenciasEpi: number;
}

/**
 * O mesmo resumo, recortado por função.
 *
 * Permite a uma tela de função responder "quem exerce isto está regular?" sem
 * varrer a lista inteira de pendências no cliente — e sem depender do nome da
 * função para agrupar.
 */
export interface ResumoDaFuncao {
  colaboradores: number;
  emDia: number;
  comPendencia: number;
  pendenciasTreinamento: number;
  pendenciasEpi: number;
}

export const RESUMO_DA_FUNCAO_VAZIO: ResumoDaFuncao = {
  colaboradores: 0,
  emDia: 0,
  comPendencia: 0,
  pendenciasTreinamento: 0,
  pendenciasEpi: 0,
};

export interface ResultadoMatriz {
  pendencias: PendenciaItem[];
  resumo: ResumoMatriz;
  /**
   * Indexado por id de função. Função sem ninguém não aparece aqui — quem
   * consome trata a ausência como zero, mas só depois de saber que o cálculo
   * terminou: ausência durante o carregamento não é zero.
   */
  porFuncao: Record<string, ResumoDaFuncao>;
}

/**
 * Cruza colaboradores com as exigências da função de cada um.
 *
 * Só itens marcados como obrigatórios geram pendência: recomendação que aparece
 * como falta viraria ruído e o usuário passaria a ignorar a lista inteira.
 */
export function calcularMatriz(params: {
  colaboradores: readonly ColaboradorMatriz[];
  treinamentosPorFuncao: Readonly<Record<string, readonly ExigenciaTreinamento[]>>;
  episPorFuncao: Readonly<Record<string, readonly ExigenciaEpi[]>>;
  participacoes: readonly ParticipacaoTreinamento[];
  entregas: readonly EntregaEpi[];
  hoje: Date;
}): ResultadoMatriz {
  const { colaboradores, treinamentosPorFuncao, episPorFuncao, participacoes, entregas, hoje } =
    params;

  const pendencias: PendenciaItem[] = [];
  const porFuncao: Record<string, ResumoDaFuncao> = {};
  let semFuncao = 0;
  let emDia = 0;

  const daFuncao = (funcaoId: string): ResumoDaFuncao =>
    (porFuncao[funcaoId] ??= { ...RESUMO_DA_FUNCAO_VAZIO });

  for (const colaborador of colaboradores) {
    // Sem função não há como saber o que é exigido. Isto é uma pendência de
    // cadastro, não um "está tudo certo" — por isso entra na lista.
    if (!colaborador.funcaoId) {
      semFuncao += 1;
      pendencias.push({
        chave: `${colaborador.id}:sem-funcao`,
        colaboradorId: colaborador.id,
        colaborador: colaborador.nome,
        funcaoId: null,
        funcaoNome: null,
        obra: colaborador.obra,
        tipo: "TREINAMENTO",
        itemId: "",
        itemNome: "Função não definida no cadastro",
        situacao: "SEM_FUNCAO",
        vencimento: null,
      });
      continue;
    }

    const resumoFuncao = daFuncao(colaborador.funcaoId);
    resumoFuncao.colaboradores += 1;

    const minhasParticipacoes = participacoes.filter(
      (p) => p.colaboradorId === colaborador.id
    );
    const minhasEntregas = entregas.filter((e) => e.colaboradorId === colaborador.id);

    const exigenciasTr = (treinamentosPorFuncao[colaborador.funcaoId] ?? []).filter(
      (t) => t.obrigatorio
    );
    const exigenciasEpi = (episPorFuncao[colaborador.funcaoId] ?? []).filter(
      (e) => e.obrigatorio
    );

    let temPendencia = false;

    for (const exigencia of exigenciasTr) {
      const { situacao, vencimento } = situacaoTreinamento(
        minhasParticipacoes,
        exigencia.treinamentoId,
        hoje
      );
      if (situacao === "OK") continue;

      temPendencia = true;
      resumoFuncao.pendenciasTreinamento += 1;
      pendencias.push({
        chave: `${colaborador.id}:tr:${exigencia.treinamentoId}`,
        colaboradorId: colaborador.id,
        colaborador: colaborador.nome,
        funcaoId: colaborador.funcaoId,
        funcaoNome: colaborador.funcaoNome,
        obra: colaborador.obra,
        tipo: "TREINAMENTO",
        itemId: exigencia.treinamentoId,
        itemNome: exigencia.nome,
        situacao,
        vencimento,
      });
    }

    for (const exigencia of exigenciasEpi) {
      const { situacao, vencimento } = situacaoEpi(
        minhasEntregas,
        exigencia.epiId,
        exigencia.periodicidadeTrocaMeses,
        hoje
      );
      if (situacao === "OK") continue;

      temPendencia = true;
      resumoFuncao.pendenciasEpi += 1;
      pendencias.push({
        chave: `${colaborador.id}:epi:${exigencia.epiId}`,
        colaboradorId: colaborador.id,
        colaborador: colaborador.nome,
        funcaoId: colaborador.funcaoId,
        funcaoNome: colaborador.funcaoNome,
        obra: colaborador.obra,
        tipo: "EPI",
        itemId: exigencia.epiId,
        itemNome: exigencia.nome,
        situacao,
        vencimento,
      });
    }

    if (temPendencia) {
      resumoFuncao.comPendencia += 1;
    } else {
      emDia += 1;
      resumoFuncao.emDia += 1;
    }
  }

  return {
    pendencias: ordenarPendencias(pendencias),
    resumo: {
      colaboradoresAvaliados: colaboradores.length,
      semFuncao,
      emDia,
      comPendencia: new Set(
        pendencias.filter((p) => p.situacao !== "SEM_FUNCAO").map((p) => p.colaboradorId)
      ).size,
      pendenciasTreinamento: pendencias.filter(
        (p) => p.tipo === "TREINAMENTO" && p.situacao !== "SEM_FUNCAO"
      ).length,
      pendenciasEpi: pendencias.filter((p) => p.tipo === "EPI").length,
    },
    porFuncao,
  };
}

/** Nunca feito primeiro: é mais grave que vencido, que ao menos já foi feito. */
const ORDEM_SITUACAO: Record<SituacaoItem, number> = {
  NUNCA_FEITO: 0,
  VENCIDO: 1,
  SEM_FUNCAO: 2,
  OK: 3,
};

export function ordenarPendencias<T extends { situacao: SituacaoItem; colaborador: string }>(
  itens: readonly T[]
): T[] {
  return [...itens].sort((a, b) => {
    const porSituacao = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao];
    if (porSituacao !== 0) return porSituacao;
    return a.colaborador.localeCompare(b.colaborador, "pt-BR");
  });
}

/**
 * O que a tela deve mostrar na contagem de quem exerce uma função.
 *
 * Existe como função pura porque a ORDEM dos casos é a regra, e regra em JSX não
 * se testa: se "sem colaborador" for avaliado antes de "calculando", a tela
 * afirma que ninguém exerce a função enquanto a consulta ainda está em curso —
 * e ausência de resultado não é resultado zero.
 */
export type EstadoContagemFuncao =
  | { tipo: "CALCULANDO" }
  | { tipo: "ERRO" }
  | { tipo: "SEM_COLABORADOR" }
  | { tipo: "CONTAGEM"; resumo: ResumoDaFuncao };

export function estadoDaContagem(params: {
  isLoading: boolean;
  temErro: boolean;
  /** Recorte da função, ou `undefined` quando ela não está no mapa. */
  resumo: ResumoDaFuncao | undefined;
}): EstadoContagemFuncao {
  // Carregando vem primeiro: durante a consulta não se sabe nada ainda.
  if (params.isLoading) return { tipo: "CALCULANDO" };
  // Erro antes de zero: falhar em contar não é contar zero.
  if (params.temErro) return { tipo: "ERRO" };
  if (!params.resumo) return { tipo: "SEM_COLABORADOR" };
  return { tipo: "CONTAGEM", resumo: params.resumo };
}
