/**
 * Indicadores de SST — taxas da NBR 14280 e percentuais de conformidade.
 *
 * O módulo tinha contagens ("12 incidentes") mas não os indicadores que a área
 * de fato usa e reporta.
 *
 *   Taxa de frequência = (acidentes com afastamento × 1.000.000) / HHT
 *   Taxa de gravidade  = ((dias perdidos + dias debitados) × 1.000.000) / HHT
 *
 * A regra que atravessa este arquivo: **sem denominador, devolve `null`** — nunca
 * zero. Zero é uma resposta ("não houve acidente"); a ausência de HHT não é
 * resposta nenhuma, e um zero ali seria lido como desempenho perfeito.
 */

/** Constante da NBR 14280: as taxas são por milhão de homens-hora. */
export const BASE_HHT = 1_000_000;

/**
 * Taxa de frequência.
 *
 * `null` quando não há HHT: a taxa não existe, e mostrar 0 diria "nenhum
 * acidente por milhão de horas", que é o oposto de "não sei".
 */
export function taxaFrequencia(
  acidentes: number,
  hht: number | null | undefined
): number | null {
  if (!hht || hht <= 0) return null;
  return (acidentes * BASE_HHT) / hht;
}

/**
 * Taxa de gravidade.
 *
 * Soma dias perdidos e debitados — a NBR 14280 atribui dias fixos a cada perda
 * permanente, e ignorá-los faria um acidente com óbito pesar menos que um
 * afastamento de 30 dias.
 */
export function taxaGravidade(
  diasPerdidos: number,
  diasDebitados: number,
  hht: number | null | undefined
): number | null {
  if (!hht || hht <= 0) return null;
  return ((diasPerdidos + diasDebitados) * BASE_HHT) / hht;
}

/**
 * Percentual de conformidade.
 *
 * `null` quando não há item aplicável — dividir por zero daria NaN, e 100%
 * diria "tudo conforme" sobre uma inspeção que não avaliou nada.
 *
 * Itens `NAO_APLICAVEL` e `PENDENTE` ficam fora do denominador: item pendente
 * ainda não foi avaliado, e contá-lo como não conforme puniria inspeção em
 * andamento.
 */
export function percentualConformidade(
  conformes: number,
  naoConformes: number
): number | null {
  const avaliados = conformes + naoConformes;
  if (avaliados === 0) return null;
  return (conformes / avaliados) * 100;
}

/** Variação percentual entre dois períodos. `null` quando não é calculável. */
export function variacaoPercentual(
  atual: number | null,
  anterior: number | null
): number | null {
  if (atual === null || anterior === null) return null;
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}

/** Formata a taxa com duas casas, ou travessão quando não existe. */
export function formatarTaxa(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toFixed(2).replace(".", ",");
}

/** Formata percentual com uma casa, ou travessão. */
export function formatarPercentual(valor: number | null): string {
  if (valor === null) return "—";
  return `${valor.toFixed(1).replace(".", ",")}%`;
}

export type TipoIncidente =
  | "Incidente"
  | "Acidente"
  | "Quase Acidente"
  | "Acidente com Afastamento"
  | "Acidente sem Afastamento"
  | "Ocorrência Ambiental"
  | "Outros";

/** Só o que os indicadores precisam ler de um incidente. */
export interface IncidenteIndicador {
  tipo: string;
  data_ocorrencia: string;
  dias_perdidos?: number | null;
  dias_debitados?: number | null;
  cat_emitida?: boolean | null;
  projeto_id?: string | null;
}

/**
 * O acidente afastou o trabalhador?
 *
 * Aceita as duas evidências: o tipo declarado, ou dias perdidos registrados.
 * Um acidente lançado como "Acidente" genérico mas com 15 dias perdidos É com
 * afastamento — deixar de contá-lo subestimaria a taxa de frequência, que é o
 * erro que faz o indicador mentir para melhor.
 */
export function comAfastamento(incidente: IncidenteIndicador): boolean {
  if (incidente.tipo === "Acidente com Afastamento") return true;
  return (incidente.dias_perdidos ?? 0) > 0;
}

/** Acidente de trabalho, com ou sem afastamento. Quase-acidente não é. */
export function eAcidente(incidente: IncidenteIndicador): boolean {
  return (
    incidente.tipo === "Acidente" ||
    incidente.tipo === "Acidente com Afastamento" ||
    incidente.tipo === "Acidente sem Afastamento"
  );
}

export interface ResumoIndicadores {
  hht: number | null;
  /** De onde veio o HHT, para a tela poder qualificar a taxa. */
  origemHht: string | null;

  acidentesComAfastamento: number;
  acidentesSemAfastamento: number;
  quaseAcidentes: number;
  diasPerdidos: number;
  diasDebitados: number;

  taxaFrequencia: number | null;
  /** Inclui acidentes sem afastamento. Usada junto da outra, não em vez dela. */
  taxaFrequenciaTotal: number | null;
  taxaGravidade: number | null;

  /**
   * Acidentes com afastamento sem CAT emitida. Não é lacuna de cadastro: a
   * emissão da CAT é obrigação legal.
   */
  afastamentosSemCat: number;

  /**
   * Quase-acidentes por acidente. Quanto maior, melhor: significa que a empresa
   * registra o evento antes de ele virar lesão. Razão baixa quase sempre é
   * subnotificação de quase-acidente, não excelência.
   */
  razaoQuaseAcidente: number | null;
}

/**
 * Consolida os indicadores de um período.
 *
 * Recebe já filtrado por período e obra: o recorte é decisão de quem chama, e
 * embutir filtro aqui esconderia o que está sendo contado.
 */
export function consolidarIndicadores(params: {
  incidentes: readonly IncidenteIndicador[];
  hht: number | null;
  origemHht?: string | null;
}): ResumoIndicadores {
  const { incidentes, hht, origemHht } = params;

  const acidentes = incidentes.filter(eAcidente);
  const comAfast = acidentes.filter(comAfastamento);
  const semAfast = acidentes.filter((i) => !comAfastamento(i));
  const quaseAcidentes = incidentes.filter((i) => i.tipo === "Quase Acidente");

  const diasPerdidos = incidentes.reduce((s, i) => s + (i.dias_perdidos ?? 0), 0);
  const diasDebitados = incidentes.reduce((s, i) => s + (i.dias_debitados ?? 0), 0);

  return {
    hht: hht && hht > 0 ? hht : null,
    origemHht: origemHht ?? null,

    acidentesComAfastamento: comAfast.length,
    acidentesSemAfastamento: semAfast.length,
    quaseAcidentes: quaseAcidentes.length,
    diasPerdidos,
    diasDebitados,

    taxaFrequencia: taxaFrequencia(comAfast.length, hht),
    taxaFrequenciaTotal: taxaFrequencia(acidentes.length, hht),
    taxaGravidade: taxaGravidade(diasPerdidos, diasDebitados, hht),

    afastamentosSemCat: comAfast.filter((i) => !i.cat_emitida).length,

    // Sem acidente a razão não é calculável — e não é "infinitamente boa".
    razaoQuaseAcidente: acidentes.length === 0 ? null : quaseAcidentes.length / acidentes.length,
  };
}

/** Item de inspeção, no mínimo que o indicador precisa. */
export interface ItemInspecaoIndicador {
  resposta: string;
}

export interface ResumoInspecoes {
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
  pendentes: number;
  /** Percentual sobre os itens efetivamente avaliados. */
  conformidade: number | null;
}

export function consolidarInspecoes(
  itens: readonly ItemInspecaoIndicador[]
): ResumoInspecoes {
  const conformes = itens.filter((i) => i.resposta === "CONFORME").length;
  const naoConformes = itens.filter((i) => i.resposta === "NAO_CONFORME").length;

  return {
    conformes,
    naoConformes,
    naoAplicaveis: itens.filter((i) => i.resposta === "NAO_APLICAVEL").length,
    pendentes: itens.filter((i) => i.resposta === "PENDENTE").length,
    conformidade: percentualConformidade(conformes, naoConformes),
  };
}

/** Medida do plano de ação, no mínimo necessário. */
export interface MedidaIndicador {
  status: string;
  prazo?: string | null;
  data_implementacao?: string | null;
  resultado_verificacao?: string | null;
}

export interface ResumoPlanoAcao {
  total: number;
  implementadas: number;
  /** Implementadas até o prazo. */
  noPrazo: number;
  /** Ainda abertas com prazo já vencido. */
  atrasadas: number;
  /** Implementadas sem aferição de resultado (NR-01 1.5.5.2). */
  semAfericao: number;
  ineficazes: number;
  percentualImplementado: number | null;
}

/**
 * Panorama do plano de ação.
 *
 * "Atrasada" conta só o que continua aberto com prazo vencido. Medida entregue
 * com atraso já foi entregue; misturar as duas coisas num só número tiraria a
 * utilidade do indicador para cobrança.
 */
export function consolidarPlanoAcao(
  medidas: readonly MedidaIndicador[],
  hoje: Date
): ResumoPlanoAcao {
  const hojeIso = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0"),
  ].join("-");

  const implementadas = medidas.filter((m) => m.status === "implementado");

  const noPrazo = implementadas.filter((m) => {
    if (!m.prazo) return true; // Sem prazo não há atraso a apontar.
    if (!m.data_implementacao) return false;
    return m.data_implementacao <= m.prazo;
  });

  const atrasadas = medidas.filter(
    (m) =>
      m.status !== "implementado" &&
      m.status !== "cancelado" &&
      !!m.prazo &&
      m.prazo < hojeIso
  );

  const consideradas = medidas.filter((m) => m.status !== "cancelado");

  return {
    total: medidas.length,
    implementadas: implementadas.length,
    noPrazo: noPrazo.length,
    atrasadas: atrasadas.length,
    semAfericao: implementadas.filter((m) => !m.resultado_verificacao).length,
    ineficazes: implementadas.filter((m) => m.resultado_verificacao === "INEFICAZ").length,
    percentualImplementado:
      consideradas.length === 0
        ? null
        : (implementadas.length / consideradas.length) * 100,
  };
}
