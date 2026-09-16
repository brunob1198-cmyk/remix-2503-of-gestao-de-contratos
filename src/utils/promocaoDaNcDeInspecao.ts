/**
 * Levar o achado da inspeção para o módulo de NC do SGSST.
 *
 * O QUE ESTAVA PELA METADE
 *
 * A inspeção registra não conformidades numa tabela própria. O módulo de NC do
 * SGSST é outro: tem plano de ação, verificação de eficácia, prazo, indicadores.
 * São coisas diferentes de propósito — nem todo achado de inspeção merece o
 * ciclo completo, e obrigar isso encheria o módulo de item de checklist.
 *
 * O que faltava era a ponte. E metade dela já existia:
 *
 *   - o banco aceita `origem_tipo = 'INSPECAO'` desde sempre, tem `origem_id` e
 *     índice em (empresa_id, origem_tipo, origem_id);
 *   - a tela de detalhe da NC já renderiza um botão "voltar para a inspeção de
 *     origem", condicionado a esses dois campos.
 *
 * Nenhum caminho do aplicativo gravava uma NC com origem INSPECAO. O formulário
 * manual tem seletor para `origem_tipo` e nenhum campo para `origem_id` — grava
 * a etiqueta sem o vínculo. Aquele botão nunca podia aparecer.
 *
 * ESTE MÓDULO É SÓ O MAPEAMENTO
 *
 * A gravação fica no hook. Aqui mora a decisão do que vai em cada campo, que é
 * o que erra em silêncio e o que vale testar.
 */

export interface NcDeInspecao {
  id: string;
  descricao: string;
  evidencia?: string | null;
  criticidade: string;
  responsavel_id?: string | null;
  prazo?: string | null;
  observacao?: string | null;
  /** Preenchido quando o achado já foi promovido. */
  nc_sgsst_id?: string | null;
}

export interface InspecaoDeOrigem {
  id: string;
  codigo?: string | null;
  titulo: string;
  projeto_id: string;
  area_id?: string | null;
  data_execucao?: string | null;
  data_planejada?: string | null;
}

export type ImpedimentoDaPromocao = "JA_PROMOVIDA" | "SEM_DESCRICAO";

/**
 * O que impede promover este achado, se algo impede.
 *
 * Promover duas vezes criaria duas NCs idênticas, e o módulo passaria a contar o
 * mesmo desvio duas vezes — exatamente onde os indicadores de segurança são
 * lidos. O bloqueio é por dado (`nc_sgsst_id`), não por botão desabilitado: dois
 * cliques rápidos passam por qualquer trava que viva só na tela.
 */
export function impedimentoDaPromocao(nc: NcDeInspecao): ImpedimentoDaPromocao | null {
  if (nc.nc_sgsst_id) return "JA_PROMOVIDA";
  if (!nc.descricao?.trim()) return "SEM_DESCRICAO";
  return null;
}

export const MENSAGEM_DO_IMPEDIMENTO: Record<ImpedimentoDaPromocao, string> = {
  JA_PROMOVIDA:
    "Este achado já foi promovido. Abra a não conformidade existente em vez de criar outra — duas NCs para o mesmo desvio contam duas vezes nos indicadores.",
  SEM_DESCRICAO:
    "O achado não tem descrição, e a descrição é o que a não conformidade precisa para ser tratada.",
};

/** Limite do título da NC. O texto inteiro vai na descrição, sem corte. */
const LIMITE_TITULO = 90;

/**
 * Título curto a partir da descrição.
 *
 * Corta em espaço, não no meio da palavra, e só quando realmente passa do
 * limite — truncar "Guarda-corpo ausente" em "Guarda-corpo ausen…" seria pior
 * que o texto completo.
 */
export function tituloDoAchado(descricao: string): string {
  const texto = descricao.trim().replace(/\s+/g, " ");
  if (texto.length <= LIMITE_TITULO) return texto;

  const corte = texto.slice(0, LIMITE_TITULO);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > 40 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`;
}

export interface PayloadDaNc {
  projeto_id: string;
  area_id: string | null;
  titulo: string;
  descricao: string;
  origem_tipo: "INSPECAO";
  origem_id: string;
  criticidade: string;
  responsavel_id: string | null;
  prazo: string | null;
  data_identificacao: string;
}

/**
 * Monta a NC do SGSST a partir do achado e da inspeção.
 *
 * `data_identificacao` é a data em que o desvio foi VISTO — a execução da
 * inspeção —, e não a data de hoje. Promover um achado de três semanas atrás
 * com a data de hoje apagaria três semanas de atraso do indicador.
 */
export function payloadDaPromocao(params: {
  nc: NcDeInspecao;
  inspecao: InspecaoDeOrigem;
  hojeIso: string;
}): PayloadDaNc {
  const { nc, inspecao, hojeIso } = params;

  const identificacao = inspecao.titulo.trim() || inspecao.codigo?.trim() || "inspeção";

  const descricao = [
    nc.descricao.trim(),
    nc.evidencia?.trim() ? `Evidência: ${nc.evidencia.trim()}` : "",
    nc.observacao?.trim() ? `Observação: ${nc.observacao.trim()}` : "",
    `Origem: ${identificacao}${inspecao.codigo ? ` [${inspecao.codigo}]` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    projeto_id: inspecao.projeto_id,
    area_id: inspecao.area_id ?? null,
    titulo: tituloDoAchado(nc.descricao),
    descricao,
    origem_tipo: "INSPECAO",
    origem_id: inspecao.id,
    // Os dois módulos usam o mesmo vocabulário (BAIXA/MEDIA/ALTA/CRITICA), então
    // a criticidade atravessa sem tradução. Se um dos dois mudar, o CHECK do
    // banco recusa — é melhor falhar na gravação do que mapear no escuro.
    criticidade: nc.criticidade,
    responsavel_id: nc.responsavel_id ?? null,
    prazo: nc.prazo ?? null,
    data_identificacao: (inspecao.data_execucao ?? inspecao.data_planejada ?? hojeIso).slice(0, 10),
  };
}
