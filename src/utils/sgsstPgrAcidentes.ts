import {
  comAfastamento,
  eAcidente,
  taxaFrequencia,
  taxaGravidade,
  type IncidenteIndicador,
} from "@/utils/sgsstIndicadores";

/**
 * Acidentes e doenças do período, para dentro do PGR.
 *
 * A NR-01 1.5.5.5 manda a análise de acidentes e doenças alimentar o
 * gerenciamento de riscos. O registro de incidente já aponta para o PGR que
 * previa aquele risco — foi construído para responder "o risco estava previsto e
 * ocorreu, logo a medida falhou". O documento do PGR não usava esse dado, e era a
 * metade que fechava o ciclo: o inventário diz o que pode acontecer, e isto diz o
 * que aconteceu.
 *
 * A regra que atravessa o arquivo: **não concluir mais do que o vínculo diz.**
 * Acidente sem vínculo a este PGR pode ser risco fora do inventário ou apenas
 * cadastro que ninguém ligou. Afirmar a primeira leitura seria acusar uma falha
 * de inventário que talvez não exista — o documento aponta o fato e deixa a
 * conclusão para quem analisa.
 */

export interface IncidenteDoPgr extends IncidenteIndicador {
  id: string;
  titulo: string;
  gravidade?: string | null;
  local_ocorrencia?: string | null;
  cat_emitida?: boolean | null;
  /** Preenchido quando alguém ligou a ocorrência a um PGR. */
  pgr_id?: string | null;
}

export interface PeriodoPgr {
  /** ISO "YYYY-MM-DD". */
  de: string;
  ate: string;
}

/**
 * O período que o PGR cobre.
 *
 * Começa na data de início declarada e termina na data de apuração — que é a
 * emissão. Não usa a próxima revisão como fim: ela é futuro, e o documento não
 * pode listar acidente que ainda não aconteceu como se o período já tivesse
 * fechado.
 */
export function periodoDoPgr(dataInicio: string, apuradoEm: string): PeriodoPgr {
  return { de: dataInicio.slice(0, 10), ate: apuradoEm.slice(0, 10) };
}

/** Ocorreu dentro do período? Comparação de string ISO, sem passar por Date. */
export function dentroDoPeriodo(dataOcorrencia: string, periodo: PeriodoPgr): boolean {
  const d = dataOcorrencia.slice(0, 10);
  return d >= periodo.de && d <= periodo.ate;
}

export interface ResumoAcidentesPgr {
  /** Tudo que ocorreu no período, acidente ou não. */
  total: number;
  acidentes: number;
  comAfastamento: number;
  semAfastamento: number;
  /** Quase-acidente conta separado: é aviso, não perda. */
  quaseAcidentes: number;
  diasPerdidos: number;
  diasDebitados: number;
  /** Acidentes ligados a ESTE PGR — o risco estava previsto e ocorreu. */
  comRiscoPrevisto: number;
  /** Acidentes sem vínculo a este PGR. Fato, não diagnóstico. */
  semVinculo: number;
  /** Acidente com afastamento e sem CAT é irregularidade. */
  semCat: number;
  taxaFrequencia: number | null;
  taxaGravidade: number | null;
  /** True quando não há HHT: as taxas ficam nulas em vez de zero. */
  semHht: boolean;
}

export function resumoAcidentesPgr(params: {
  incidentes: readonly IncidenteDoPgr[];
  pgrId: string;
  /** Horas-homem trabalhadas do período. Nulo quando não informado. */
  hht?: number | null;
}): ResumoAcidentesPgr {
  const { incidentes, pgrId, hht } = params;

  const acidentes = incidentes.filter(eAcidente);
  const comAfast = acidentes.filter(comAfastamento);

  const diasPerdidos = incidentes.reduce((s, i) => s + (i.dias_perdidos ?? 0), 0);
  const diasDebitados = incidentes.reduce((s, i) => s + (i.dias_debitados ?? 0), 0);

  return {
    total: incidentes.length,
    acidentes: acidentes.length,
    comAfastamento: comAfast.length,
    semAfastamento: acidentes.length - comAfast.length,
    quaseAcidentes: incidentes.filter((i) => i.tipo === "Quase Acidente").length,
    diasPerdidos,
    diasDebitados,
    comRiscoPrevisto: acidentes.filter((i) => i.pgr_id === pgrId).length,
    semVinculo: acidentes.filter((i) => i.pgr_id !== pgrId).length,
    // Só cobra CAT de quem afastou: acidente sem afastamento não exige.
    semCat: comAfast.filter((i) => !i.cat_emitida).length,
    taxaFrequencia: taxaFrequencia(comAfast.length, hht),
    taxaGravidade: taxaGravidade(diasPerdidos, diasDebitados, hht),
    semHht: !hht || hht <= 0,
  };
}

/**
 * As leituras que o resumo autoriza, cada uma com o motivo.
 *
 * Devolve frases para o documento. Só entra o que o dado sustenta: nada aqui
 * conclui que falta risco no inventário, porque o vínculo ausente não prova isso.
 */
export function achadosDosAcidentes(r: ResumoAcidentesPgr): string[] {
  const achados: string[] = [];

  if (r.total === 0) return achados;

  if (r.comRiscoPrevisto > 0) {
    achados.push(
      `${r.comRiscoPrevisto} ocorrência(s) estavam ligadas a risco previsto neste PGR: ` +
        `o risco foi identificado, a medida existia e o evento aconteceu. ` +
        `São as que pedem revisão da medida de controle, e não do inventário.`
    );
  }

  if (r.semVinculo > 0) {
    achados.push(
      `${r.semVinculo} acidente(s) sem vínculo a este PGR. Pode ser risco fora do ` +
        `inventário, ou vínculo que ninguém registrou — vale conferir um a um antes de ` +
        `concluir qual dos dois.`
    );
  }

  if (r.semCat > 0) {
    achados.push(
      `${r.semCat} acidente(s) com afastamento sem CAT registrada. A comunicação ao ` +
        `INSS é obrigatória e a falta dela é irregularidade autônoma.`
    );
  }

  if (r.quaseAcidentes > 0) {
    achados.push(
      `${r.quaseAcidentes} quase-acidente(s) no período. Não entram nas taxas, e são o ` +
        `aviso mais barato que o sistema dá antes do acidente.`
    );
  }

  if (r.semHht) {
    achados.push(
      `Sem horas-homem trabalhadas informadas no período, as taxas de frequência e ` +
        `gravidade não podem ser calculadas — ficam em branco em vez de zero, porque ` +
        `zero afirmaria ausência de acidente.`
    );
  }

  return achados;
}

export interface RegistroHht {
  projeto_id?: string | null;
  ano: number;
  mes: number;
  horas: number;
}

export interface HhtDoPeriodo {
  horas: number | null;
  /** Meses somados, em "MM/AAAA", para o documento poder mostrar a base. */
  meses: string[];
}

/**
 * Horas-homem trabalhadas do período, somadas por MÊS CHEIO.
 *
 * O HHT é coletado por mês; um período que começa no dia 15 não tem meio mês de
 * HHT para somar. Então a soma vai do mês de início ao mês de fim, inteiros — e a
 * função devolve quais meses entraram, para o documento declarar a base em vez de
 * apresentar uma taxa como se o recorte fosse exato.
 *
 * A direção do erro é conhecida: mês de ponta inteiro pode superestimar as horas,
 * o que SUBESTIMA a taxa. Por isso a base fica à vista — taxa sem base declarada
 * é número que ninguém pode conferir.
 *
 * Devolve `horas: null` quando não há registro nenhum, e não zero: zero dividiria
 * e produziria taxa infinita, ou pior, uma taxa que parece calculada.
 */
export function hhtDoPeriodo(
  registros: readonly RegistroHht[],
  periodo: PeriodoPgr,
  projetoId: string
): HhtDoPeriodo {
  const chave = (ano: number, mes: number) => ano * 100 + mes;
  const de = chave(Number(periodo.de.slice(0, 4)), Number(periodo.de.slice(5, 7)));
  const ate = chave(Number(periodo.ate.slice(0, 4)), Number(periodo.ate.slice(5, 7)));

  const doPeriodo = registros.filter(
    (r) => r.projeto_id === projetoId && chave(r.ano, r.mes) >= de && chave(r.ano, r.mes) <= ate
  );

  if (doPeriodo.length === 0) return { horas: null, meses: [] };

  return {
    horas: doPeriodo.reduce((s, r) => s + (r.horas ?? 0), 0),
    meses: [...doPeriodo]
      .sort((a, b) => chave(a.ano, a.mes) - chave(b.ano, b.mes))
      .map((r) => `${String(r.mes).padStart(2, "0")}/${r.ano}`),
  };
}
