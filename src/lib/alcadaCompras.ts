/**
 * Alçada de aprovação de compra: quem pode aprovar quanto, e de que tipo.
 *
 * Antes disto, a autorização era um booleano por usuário
 * (`profiles.pode_aprovar_compra`). Quem tinha a marcação aprovava qualquer valor —
 * a requisição de R$ 200 em parafusos e a de R$ 400 mil em concreto passavam pela
 * mesma checagem.
 *
 * A DECISÃO QUE GOVERNA ESTE MÓDULO
 *
 * "Sem regra" e "regra que não autoriza" são estados DIFERENTES, e confundi-los é o
 * jeito mais fácil de errar aqui:
 *
 * - Tratar tabela vazia como "ninguém aprova" travaria toda compra no instante em
 *   que a migration rodasse, inclusive as em andamento.
 * - Tratar "valor fora de todas as faixas" como "pode aprovar" transformaria a
 *   ausência de uma faixa cadastrada em permissão implícita — e a faixa que
 *   costuma faltar é a dos valores altos.
 *
 * Então são dois estados distintos e a tela diz qual é: com a tabela vazia, vale a
 * regra antiga e isso fica escrito; com pelo menos uma alçada, a regra vale
 * estritamente e valor sem faixa é recusado.
 */

export type TipoCompra =
  | "MATERIAL"
  | "SERVICO"
  | "LOCACAO"
  | "EQUIPAMENTO"
  | "EPI"
  | "OUTROS";

export const TIPOS_COMPRA: readonly TipoCompra[] = [
  "MATERIAL",
  "SERVICO",
  "LOCACAO",
  "EQUIPAMENTO",
  "EPI",
  "OUTROS",
];

export const TIPO_COMPRA_LABEL: Record<TipoCompra, string> = {
  MATERIAL: "Material",
  SERVICO: "Serviço",
  LOCACAO: "Locação",
  EQUIPAMENTO: "Equipamento",
  EPI: "EPI",
  OUTROS: "Outros",
};

export const TIPO_COMPRA_AJUDA: Record<TipoCompra, string> = {
  MATERIAL: "Insumo que entra na obra: cimento, aço, cabo, tinta.",
  SERVICO: "Mão de obra ou serviço contratado de terceiro.",
  LOCACAO: "Aluguel de equipamento, veículo ou estrutura.",
  EQUIPAMENTO: "Compra de bem que fica com a empresa: ferramenta, máquina.",
  EPI: "Equipamento de proteção individual.",
  OUTROS: "O que não cabe nas categorias acima.",
};

export function rotuloTipoCompra(tipo?: string | null): string {
  if (!tipo) return "Não classificada";
  return TIPO_COMPRA_LABEL[tipo as TipoCompra] ?? tipo;
}

export interface Alcada {
  id: string;
  nome: string;
  valor_minimo: number;
  /** Nulo = sem teto. É a alçada mais alta. */
  valor_maximo: number | null;
  /** Nulo = vale para qualquer tipo de compra. */
  tipo_compra: TipoCompra | null;
  ativo: boolean;
  observacoes?: string | null;
  /** Ids dos usuários que aprovam nesta alçada. */
  aprovadores: readonly string[];
}

export type SituacaoAlcada =
  /** Nenhuma alçada cadastrada. Vale a regra antiga, e a tela diz isso. */
  | "SEM_REGRAS"
  /** Há alçadas, mas nenhuma cobre este valor e tipo. Ninguém pode aprovar. */
  | "SEM_FAIXA_PARA_O_VALOR"
  /** Existe faixa, e o usuário não é aprovador dela. */
  | "FORA_DA_ALCADA"
  /** Existe faixa, e o usuário aprova nela. */
  | "AUTORIZADO"
  /** Não há valor a conferir — sem cotação vencedora, não há o que aprovar. */
  | "SEM_VALOR";

export interface ResultadoAlcada {
  situacao: SituacaoAlcada;
  /** Verdadeiro só quando a aprovação pode acontecer. */
  podeAprovar: boolean;
  /** Frase para a tela, dizendo o que está acontecendo e o que fazer. */
  mensagem: string;
  /** As alçadas que cobrem o valor, para a tela mostrar quem pode aprovar. */
  alcadasDaFaixa: readonly Alcada[];
  /** O valor conferido. */
  valor: number;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Alçadas que cobrem um valor e um tipo.
 *
 * A alçada específica de um tipo tem precedência sobre a genérica: se a empresa
 * cadastrou "Serviço acima de 50 mil" e também "Qualquer coisa acima de 50 mil", a
 * primeira é a que decide para serviço. Sem essa precedência, cadastrar uma regra
 * específica não teria efeito nenhum — a genérica sempre autorizaria em paralelo.
 */
export function alcadasQueCobrem(
  alcadas: readonly Alcada[],
  valor: number,
  tipo?: string | null
): Alcada[] {
  const ativas = alcadas.filter((a) => a.ativo);

  const naFaixa = ativas.filter(
    (a) => valor >= a.valor_minimo && (a.valor_maximo === null || valor <= a.valor_maximo)
  );

  const especificas = naFaixa.filter((a) => !!a.tipo_compra && a.tipo_compra === tipo);
  if (especificas.length > 0) return especificas;

  return naFaixa.filter((a) => a.tipo_compra === null);
}

/**
 * Se o usuário pode aprovar aquele valor, e por quê.
 *
 * `podeAprovarPelaRegraAntiga` é o booleano `profiles.pode_aprovar_compra`. Ele
 * continua sendo consultado quando não há alçada cadastrada — e continua sendo
 * necessário mesmo quando há: estar numa alçada não substitui ter a permissão de
 * aprovar compra.
 */
export function avaliarAlcada(params: {
  alcadas: readonly Alcada[];
  valor: number;
  tipoCompra?: string | null;
  usuarioId?: string | null;
  podeAprovarPelaRegraAntiga: boolean;
}): ResultadoAlcada {
  const { alcadas, valor, tipoCompra, usuarioId, podeAprovarPelaRegraAntiga } = params;

  const ativas = alcadas.filter((a) => a.ativo);

  // Tabela vazia: a regra antiga vale, e a tela diz que está assim em vez de
  // deixar o usuário achar que existe controle de valor onde não existe.
  if (ativas.length === 0) {
    return {
      situacao: "SEM_REGRAS",
      podeAprovar: podeAprovarPelaRegraAntiga,
      mensagem: podeAprovarPelaRegraAntiga
        ? "Nenhuma alçada cadastrada: qualquer aprovador de compra pode aprovar qualquer valor."
        : "Você não tem permissão para aprovar compras.",
      alcadasDaFaixa: [],
      valor,
    };
  }

  if (!(valor > 0)) {
    return {
      situacao: "SEM_VALOR",
      podeAprovar: false,
      mensagem:
        "Não há cotação vencedora com valor nesta requisição. A alçada precisa de um valor para conferir.",
      alcadasDaFaixa: [],
      valor,
    };
  }

  const daFaixa = alcadasQueCobrem(ativas, valor, tipoCompra);

  if (daFaixa.length === 0) {
    // A faixa que costuma faltar é a dos valores altos, e é justamente onde tratar
    // ausência como permissão faria mais estrago.
    return {
      situacao: "SEM_FAIXA_PARA_O_VALOR",
      podeAprovar: false,
      mensagem: `Nenhuma alçada cobre ${brl(valor)} para ${rotuloTipoCompra(
        tipoCompra
      ).toLowerCase()}. Cadastre uma alçada para esta faixa antes de aprovar.`,
      alcadasDaFaixa: [],
      valor,
    };
  }

  const autorizado =
    !!usuarioId && daFaixa.some((a) => a.aprovadores.includes(usuarioId));

  if (!autorizado) {
    return {
      situacao: "FORA_DA_ALCADA",
      podeAprovar: false,
      mensagem: `${brl(valor)} está acima da sua alçada. Encaminhe a aprovação a quem tem alçada para esta faixa.`,
      alcadasDaFaixa: daFaixa,
      valor,
    };
  }

  // Estar na alçada não dispensa a permissão de aprovar compra: são duas perguntas
  // diferentes — "pode aprovar compra?" e "pode aprovar ESTE valor?".
  if (!podeAprovarPelaRegraAntiga) {
    return {
      situacao: "FORA_DA_ALCADA",
      podeAprovar: false,
      mensagem:
        "Você está na alçada desta faixa, mas não tem a permissão de aprovar compras no seu perfil.",
      alcadasDaFaixa: daFaixa,
      valor,
    };
  }

  return {
    situacao: "AUTORIZADO",
    podeAprovar: true,
    mensagem: `${brl(valor)} está dentro da sua alçada.`,
    alcadasDaFaixa: daFaixa,
    valor,
  };
}

/** Como a faixa de uma alçada se lê. */
export function textoDaFaixa(a: Pick<Alcada, "valor_minimo" | "valor_maximo">): string {
  if (a.valor_maximo === null) {
    return a.valor_minimo > 0 ? `Acima de ${brl(a.valor_minimo)}` : "Qualquer valor";
  }
  if (a.valor_minimo <= 0) return `Até ${brl(a.valor_maximo)}`;
  return `${brl(a.valor_minimo)} a ${brl(a.valor_maximo)}`;
}

export type ProblemaDeCobertura =
  | "SEM_TETO_AUSENTE"
  | "SEM_APROVADOR"
  | "BURACO_NA_FAIXA"
  | "FAIXA_SOBREPOSTA";

export interface AvisoDeCobertura {
  problema: ProblemaDeCobertura;
  mensagem: string;
}

/**
 * Problemas no conjunto de alçadas cadastradas.
 *
 * Existe porque alçada malcadastrada não dá erro — ela simplesmente deixa de
 * autorizar, e o efeito só aparece no dia em que alguém precisa aprovar. Estes
 * avisos aparecem na tela de cadastro, antes disso.
 */
export function avisosDeCobertura(alcadas: readonly Alcada[]): AvisoDeCobertura[] {
  const ativas = alcadas.filter((a) => a.ativo);
  if (ativas.length === 0) return [];

  const avisos: AvisoDeCobertura[] = [];

  // Sem alçada de teto aberto, compra acima do maior teto não tem quem aprove.
  const genericas = ativas.filter((a) => a.tipo_compra === null);
  if (!genericas.some((a) => a.valor_maximo === null)) {
    const maiorTeto = genericas.reduce(
      (max, a) => Math.max(max, a.valor_maximo ?? 0),
      0
    );
    avisos.push({
      problema: "SEM_TETO_AUSENTE",
      mensagem: `Nenhuma alçada sem teto: compra acima de ${brl(
        maiorTeto
      )} não terá aprovador possível. Cadastre uma alçada deixando o teto em branco.`,
    });
  }

  // Alçada sem aprovador é uma faixa que ninguém pode aprovar — pior que não
  // existir, porque parece configurada.
  for (const a of ativas) {
    if (a.aprovadores.length === 0) {
      avisos.push({
        problema: "SEM_APROVADOR",
        mensagem: `A alçada "${a.nome}" não tem nenhum aprovador. Nada nessa faixa poderá ser aprovado.`,
      });
    }
  }

  // Buraco entre faixas genéricas: valor que cai no vão fica sem alçada.
  const ordenadas = [...genericas].sort((x, y) => x.valor_minimo - y.valor_minimo);
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const atual = ordenadas[i];
    const proxima = ordenadas[i + 1];
    if (atual.valor_maximo === null) break;

    if (proxima.valor_minimo > atual.valor_maximo) {
      avisos.push({
        problema: "BURACO_NA_FAIXA",
        mensagem: `Nenhuma alçada cobre valores entre ${brl(atual.valor_maximo)} e ${brl(
          proxima.valor_minimo
        )}.`,
      });
    } else if (proxima.valor_minimo < atual.valor_maximo) {
      // Sobreposição não impede aprovar; só torna difícil prever quem aprova.
      avisos.push({
        problema: "FAIXA_SOBREPOSTA",
        mensagem: `"${atual.nome}" e "${proxima.nome}" se sobrepõem entre ${brl(
          proxima.valor_minimo
        )} e ${brl(atual.valor_maximo)}. Quem estiver em qualquer uma das duas poderá aprovar nessa faixa.`,
      });
    }
  }

  return avisos;
}
