/**
 * A máquina de estados do fluxo de compras.
 *
 * Antes deste módulo, as transições viviam soltas dentro do JSX de cada aba, e o
 * vocabulário de status era reinventado em cada lugar que o tocava. O resultado
 * auditado:
 *
 * - A emissão do pedido gravava `pedido_emitido` na requisição — minúsculo, fora do
 *   mapa de rótulos. A tela passava a exibir a string crua, e o botão "Receber",
 *   que exigia `PURCHASED`, nunca aparecia: a requisição não tinha como ser
 *   concluída.
 * - `PENDING_APPROVAL` era lido em quatro lugares e escrito em nenhum, então o
 *   estágio "Em aprovação" do funil era estruturalmente sempre zero.
 * - A cotação perdedora recebia `perdida`, o mapa esperava `rejeitada`, e uma
 *   consulta procurava `aberta` — valor que nunca existiu.
 * - O rótulo do aviso em tempo real dizia `entregue_parcial`; o código gravava
 *   `entrega_parcial`.
 *
 * Nenhum desses defeitos é difícil de corrigir isolado. O que os produz é a
 * ausência de um lugar único que responda "quais são os estados" e "o que pode ir
 * para onde" — e é isso que este módulo é.
 *
 * TRÊS REGRAS QUE ELE IMPÕE
 *
 * 1. **Um código canônico por conceito.** Os apelidos existem porque o banco já tem
 *    dados gravados com eles; `normalizar*` traduz na leitura e a migration reescreve
 *    o que está armazenado. Apelido novo não deve ser criado — ele é dívida, não
 *    recurso.
 *
 * 2. **Transição não declarada é recusada.** `updateStatus` valida contra estas
 *    tabelas em vez de aceitar qualquer string. Antes, `DRAFT → RECEIVED` num clique
 *    programático passava.
 *
 * 3. **Todo estado declarado é alcançável e tem saída** — exceto os terminais, que
 *    são terminais de propósito. O teste de alcançabilidade percorre o grafo e falha
 *    se algum estado ficar órfão, que é como os cinco estados fantasma nasceram.
 *
 * Os CÓDIGOS ficam como já estão no banco (maiúsculas em inglês na requisição,
 * minúsculas em português na cotação e no pedido). Traduzir os códigos obrigaria a
 * reescrever todas as linhas existentes sem ganho nenhum para quem usa: o que o
 * usuário lê são os RÓTULOS, e esses estão todos em português aqui.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Requisição de compra
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoRequisicao =
  | "DRAFT"
  | "SUBMITTED"
  | "QUOTING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PURCHASED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

export const ESTADOS_REQUISICAO: readonly EstadoRequisicao[] = [
  "DRAFT",
  "SUBMITTED",
  "QUOTING",
  "PENDING_APPROVAL",
  "APPROVED",
  "PURCHASED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "REJECTED",
  "CANCELLED",
];

export const ESTADO_REQUISICAO_LABEL: Record<EstadoRequisicao, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Aguardando liberação",
  QUOTING: "Em cotação",
  PENDING_APPROVAL: "Em aprovação",
  APPROVED: "Aprovada",
  PURCHASED: "Pedido emitido",
  PARTIALLY_RECEIVED: "Recebimento parcial",
  RECEIVED: "Recebida",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};

/** Uma linha de ajuda por estado: o que ele significa e de quem é a bola. */
export const ESTADO_REQUISICAO_AJUDA: Record<EstadoRequisicao, string> = {
  DRAFT: "Só o solicitante vê. Nada acontece até ele enviar.",
  SUBMITTED: "Aguardando quem libera decidir se a compra vai ser cotada.",
  QUOTING: "O comprador está registrando as respostas dos fornecedores.",
  PENDING_APPROVAL: "As cotações estão prontas e aguardam a escolha do vencedor.",
  APPROVED: "Vencedor escolhido. O pedido foi gerado como rascunho.",
  PURCHASED: "Pedido emitido ao fornecedor. Aguardando a entrega.",
  PARTIALLY_RECEIVED: "Parte dos itens chegou. Falta o restante.",
  RECEIVED: "Todos os itens chegaram e foram conferidos. Ciclo encerrado.",
  REJECTED: "Recusada por quem libera. Pode ser corrigida e reenviada.",
  CANCELLED: "Encerrada sem compra.",
};

export type VarianteBadge = "default" | "secondary" | "destructive" | "outline";

export const ESTADO_REQUISICAO_VARIANTE: Record<EstadoRequisicao, VarianteBadge> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  QUOTING: "outline",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  PURCHASED: "outline",
  PARTIALLY_RECEIVED: "secondary",
  RECEIVED: "default",
  REJECTED: "destructive",
  CANCELLED: "destructive",
};

/**
 * Valores que o banco já contém e que precisam ser lidos como um canônico.
 *
 * `pedido_emitido` e `em_cotacao` eram gravados pela aba de Pedidos; os três em
 * maiúsculas eram sinônimos declarados no mapa antigo e nunca escritos por código
 * nenhum — mas podem existir em base antiga, então continuam sendo traduzidos.
 */
const APELIDOS_REQUISICAO: Record<string, EstadoRequisicao> = {
  pedido_emitido: "PURCHASED",
  PEDIDO_EMITIDO: "PURCHASED",
  PURCHASE_ORDER_CREATED: "PURCHASED",
  em_cotacao: "QUOTING",
  EM_COTACAO: "QUOTING",
  QUOTE_COMPLETED: "PENDING_APPROVAL",
  CLOSED: "RECEIVED",
  recebido: "RECEIVED",
  aprovada: "APPROVED",
  rejeitada: "REJECTED",
  cancelada: "CANCELLED",
  rascunho: "DRAFT",
};

/**
 * Transições permitidas na requisição.
 *
 * Duas escolhas que valem explicação:
 *
 * - `QUOTING → APPROVED` **não** existe. A aprovação passa obrigatoriamente por
 *   `PENDING_APPROVAL`, que é o estado que a aba de Aprovação e o funil já exibiam
 *   e que ninguém alimentava. Sem essa parada, não há onde aplicar alçada por valor.
 *
 * - `PURCHASED → QUOTING` existe porque cancelar o pedido tem de devolver a
 *   requisição para cotação, e não deixá-la presa num estado de compra que não
 *   aconteceu.
 */
export const TRANSICOES_REQUISICAO: Record<EstadoRequisicao, readonly EstadoRequisicao[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["QUOTING", "REJECTED", "CANCELLED"],
  QUOTING: ["PENDING_APPROVAL", "REJECTED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "QUOTING", "REJECTED", "CANCELLED"],
  APPROVED: ["PURCHASED", "QUOTING", "CANCELLED"],
  PURCHASED: ["PARTIALLY_RECEIVED", "RECEIVED", "QUOTING", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "PARTIALLY_RECEIVED", "CANCELLED"],
  RECEIVED: [],
  // Recusada pode ser corrigida e reenviada: exigir abrir outra requisição
  // perderia o histórico do que foi pedido e por que foi recusado.
  REJECTED: ["DRAFT", "CANCELLED"],
  CANCELLED: [],
};

/** Estados em que a requisição não anda mais. */
export const ESTADOS_REQUISICAO_TERMINAIS: readonly EstadoRequisicao[] = ["RECEIVED", "CANCELLED"];

// ─────────────────────────────────────────────────────────────────────────────
// Cotação
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nesta etapa do produto, é o COMPRADOR quem registra a resposta do fornecedor —
 * por telefone, e-mail ou WhatsApp. Daí a distinção entre os dois primeiros
 * estados:
 *
 * - `pendente`: a cotação foi aberta para aquele fornecedor e ainda não há preço.
 * - `recebida`: o comprador já lançou os preços que o fornecedor passou.
 *
 * Sem essa separação, uma cotação sem preço nenhum entra no comparativo valendo
 * zero e ganha de todas as outras.
 */
export type EstadoCotacao = "pendente" | "recebida" | "aprovada" | "perdida" | "cancelada";

export const ESTADOS_COTACAO: readonly EstadoCotacao[] = [
  "pendente",
  "recebida",
  "aprovada",
  "perdida",
  "cancelada",
];

export const ESTADO_COTACAO_LABEL: Record<EstadoCotacao, string> = {
  pendente: "Aguardando resposta",
  recebida: "Resposta registrada",
  aprovada: "Vencedora",
  perdida: "Perdida",
  cancelada: "Cancelada",
};

export const ESTADO_COTACAO_AJUDA: Record<EstadoCotacao, string> = {
  pendente: "Fornecedor consultado. Falta lançar os preços que ele passou.",
  recebida: "Preços lançados. Já entra no comparativo.",
  aprovada: "Escolhida como vencedora. Gerou o pedido de compra.",
  perdida: "Outro fornecedor foi escolhido para esta requisição.",
  cancelada: "Descartada — fornecedor não atendeu ou desistiu.",
};

export const ESTADO_COTACAO_VARIANTE: Record<EstadoCotacao, VarianteBadge> = {
  pendente: "secondary",
  recebida: "outline",
  aprovada: "default",
  perdida: "destructive",
  cancelada: "destructive",
};

const APELIDOS_COTACAO: Record<string, EstadoCotacao> = {
  // `aberta` era procurado pelo card "Para Aprovar" e nunca gravado por ninguém.
  aberta: "pendente",
  ABERTA: "pendente",
  // `rejeitada` era o rótulo esperado; `perdida` era o valor gravado.
  rejeitada: "perdida",
  vencedora: "aprovada",
  PENDENTE: "pendente",
  RECEBIDA: "recebida",
  APROVADA: "aprovada",
  PERDIDA: "perdida",
};

export const TRANSICOES_COTACAO: Record<EstadoCotacao, readonly EstadoCotacao[]> = {
  pendente: ["recebida", "cancelada"],
  recebida: ["aprovada", "perdida", "recebida", "cancelada"],
  aprovada: ["perdida"],
  perdida: ["aprovada"],
  cancelada: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pedido de compra
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoPedido =
  | "rascunho"
  | "emitido"
  | "confirmado"
  | "entrega_parcial"
  | "entregue"
  | "cancelado";

export const ESTADOS_PEDIDO: readonly EstadoPedido[] = [
  "rascunho",
  "emitido",
  "confirmado",
  "entrega_parcial",
  "entregue",
  "cancelado",
];

export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  rascunho: "Rascunho",
  emitido: "Emitido",
  confirmado: "Confirmado pelo fornecedor",
  entrega_parcial: "Entrega parcial",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const ESTADO_PEDIDO_AJUDA: Record<EstadoPedido, string> = {
  rascunho: "Gerado pela aprovação. Ainda não foi enviado ao fornecedor.",
  emitido: "Enviado ao fornecedor. É o ato que compromete o dinheiro.",
  confirmado: "O fornecedor confirmou prazo e quantidade.",
  entrega_parcial: "Parte dos itens chegou. O saldo continua pendente.",
  entregue: "Todos os itens chegaram na quantidade pedida.",
  cancelado: "Encerrado sem entrega. A requisição volta para cotação.",
};

const APELIDOS_PEDIDO: Record<string, EstadoPedido> = {
  // Grafia que só existia no rótulo do aviso em tempo real.
  entregue_parcial: "entrega_parcial",
  parcial: "entrega_parcial",
  // Estados de transporte que tinham rótulo e nenhuma escrita. Enquanto não houver
  // integração de transporte que os alimente, leem-se como confirmado.
  em_transito: "confirmado",
  saiu_para_entrega: "confirmado",
};

export const TRANSICOES_PEDIDO: Record<EstadoPedido, readonly EstadoPedido[]> = {
  rascunho: ["emitido", "cancelado"],
  emitido: ["confirmado", "entrega_parcial", "entregue", "cancelado"],
  confirmado: ["entrega_parcial", "entregue", "cancelado"],
  entrega_parcial: ["entrega_parcial", "entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};

/** Estados em que o pedido está valendo com o fornecedor. */
export const ESTADOS_PEDIDO_EM_ABERTO: readonly EstadoPedido[] = [
  "emitido",
  "confirmado",
  "entrega_parcial",
];

// ─────────────────────────────────────────────────────────────────────────────
// Normalização
// ─────────────────────────────────────────────────────────────────────────────

function normalizar<T extends string>(
  valor: string | null | undefined,
  canonicos: readonly T[],
  apelidos: Record<string, T>
): T | null {
  if (!valor) return null;

  const bruto = valor.trim();
  if ((canonicos as readonly string[]).includes(bruto)) return bruto as T;

  const porApelido = apelidos[bruto];
  if (porApelido) return porApelido;

  // Última tentativa pela caixa: base antiga pode ter gravado em caixa diferente.
  const alvo = canonicos.find((c) => c.toLowerCase() === bruto.toLowerCase());
  if (alvo) return alvo;

  const apelidoCaixa = Object.keys(apelidos).find(
    (k) => k.toLowerCase() === bruto.toLowerCase()
  );
  return apelidoCaixa ? apelidos[apelidoCaixa] : null;
}

/**
 * Traduz o que está no banco para o código canônico.
 *
 * Devolve `null` para valor desconhecido em vez de inventar um estado. Quem exibe
 * mostra o valor cru marcado como desconhecido — que é informação verdadeira e
 * bem mais útil que encaixá-lo no estado mais parecido.
 */
export function normalizarEstadoRequisicao(v?: string | null): EstadoRequisicao | null {
  return normalizar(v, ESTADOS_REQUISICAO, APELIDOS_REQUISICAO);
}

export function normalizarEstadoCotacao(v?: string | null): EstadoCotacao | null {
  return normalizar(v, ESTADOS_COTACAO, APELIDOS_COTACAO);
}

export function normalizarEstadoPedido(v?: string | null): EstadoPedido | null {
  return normalizar(v, ESTADOS_PEDIDO, APELIDOS_PEDIDO);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rótulos para a tela
// ─────────────────────────────────────────────────────────────────────────────

export interface RotuloEstado {
  label: string;
  variante: VarianteBadge;
  ajuda: string;
  /** Verdadeiro quando o valor gravado não corresponde a estado conhecido. */
  desconhecido: boolean;
}

const ROTULO_VAZIO: RotuloEstado = {
  label: "—",
  variante: "outline",
  ajuda: "Sem status registrado.",
  desconhecido: false,
};

function rotuloDesconhecido(bruto: string): RotuloEstado {
  return {
    label: bruto,
    variante: "destructive",
    ajuda:
      "Status não reconhecido pelo fluxo de compras. O valor gravado aparece como está — " +
      "encaixá-lo no estado mais parecido esconderia o problema.",
    desconhecido: true,
  };
}

export function rotuloRequisicao(v?: string | null): RotuloEstado {
  if (!v) return ROTULO_VAZIO;
  const e = normalizarEstadoRequisicao(v);
  if (!e) return rotuloDesconhecido(v);
  return {
    label: ESTADO_REQUISICAO_LABEL[e],
    variante: ESTADO_REQUISICAO_VARIANTE[e],
    ajuda: ESTADO_REQUISICAO_AJUDA[e],
    desconhecido: false,
  };
}

export function rotuloCotacao(v?: string | null): RotuloEstado {
  if (!v) return ROTULO_VAZIO;
  const e = normalizarEstadoCotacao(v);
  if (!e) return rotuloDesconhecido(v);
  return {
    label: ESTADO_COTACAO_LABEL[e],
    variante: ESTADO_COTACAO_VARIANTE[e],
    ajuda: ESTADO_COTACAO_AJUDA[e],
    desconhecido: false,
  };
}

export function rotuloPedido(v?: string | null): RotuloEstado {
  if (!v) return ROTULO_VAZIO;
  const e = normalizarEstadoPedido(v);
  if (!e) return rotuloDesconhecido(v);
  return {
    label: ESTADO_PEDIDO_LABEL[e],
    variante: e === "cancelado" ? "destructive" : e === "entregue" ? "default" : "outline",
    ajuda: ESTADO_PEDIDO_AJUDA[e],
    desconhecido: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação de transição
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoTransicao {
  permitida: boolean;
  /** Mensagem para o usuário quando não é permitida. */
  motivo?: string;
  de?: string | null;
  para?: string | null;
}

function validar<T extends string>(
  deBruto: string | null | undefined,
  paraBruto: string,
  canonicos: readonly T[],
  apelidos: Record<string, T>,
  transicoes: Record<T, readonly T[]>,
  labels: Record<T, string>,
  entidade: string
): ResultadoTransicao {
  const para = normalizar(paraBruto, canonicos, apelidos);
  if (!para) {
    return {
      permitida: false,
      motivo: `"${paraBruto}" não é um status de ${entidade} reconhecido pelo fluxo de compras.`,
    };
  }

  const de = normalizar(deBruto, canonicos, apelidos);

  // Sem estado de origem conhecido não há como validar o salto. Deixar passar é o
  // certo: é o caso do registro antigo, gravado antes deste módulo existir, e
  // travá-lo deixaria o usuário sem conseguir mexer no que já está no sistema.
  if (!de) return { permitida: true, de: deBruto ?? null, para };

  if (de === para) return { permitida: true, de, para };

  if (!transicoes[de].includes(para)) {
    const saidas = transicoes[de];
    const opcoes = saidas.length
      ? saidas.map((s) => labels[s]).join(", ")
      : "nenhuma — é um estado final";
    return {
      permitida: false,
      motivo: `${labels[de]} não vai para ${labels[para]}. Saídas possíveis: ${opcoes}.`,
      de,
      para,
    };
  }

  return { permitida: true, de, para };
}

export function validarTransicaoRequisicao(
  de: string | null | undefined,
  para: string
): ResultadoTransicao {
  return validar(
    de,
    para,
    ESTADOS_REQUISICAO,
    APELIDOS_REQUISICAO,
    TRANSICOES_REQUISICAO,
    ESTADO_REQUISICAO_LABEL,
    "requisição"
  );
}

export function validarTransicaoCotacao(
  de: string | null | undefined,
  para: string
): ResultadoTransicao {
  return validar(
    de,
    para,
    ESTADOS_COTACAO,
    APELIDOS_COTACAO,
    TRANSICOES_COTACAO,
    ESTADO_COTACAO_LABEL,
    "cotação"
  );
}

export function validarTransicaoPedido(
  de: string | null | undefined,
  para: string
): ResultadoTransicao {
  return validar(
    de,
    para,
    ESTADOS_PEDIDO,
    APELIDOS_PEDIDO,
    TRANSICOES_PEDIDO,
    ESTADO_PEDIDO_LABEL,
    "pedido"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alcançabilidade — a checagem que faltava
// ─────────────────────────────────────────────────────────────────────────────

/** Estados alcançáveis a partir de um inicial, seguindo as transições. */
export function alcancaveis<T extends string>(
  inicial: T,
  transicoes: Record<T, readonly T[]>
): Set<T> {
  const vistos = new Set<T>([inicial]);
  const fila: T[] = [inicial];

  while (fila.length > 0) {
    const atual = fila.shift() as T;
    for (const proximo of transicoes[atual] ?? []) {
      if (!vistos.has(proximo)) {
        vistos.add(proximo);
        fila.push(proximo);
      }
    }
  }

  return vistos;
}

/**
 * O caminho mais curto entre dois estados, ou nulo se não houver caminho.
 *
 * É com isto que o teste prova que dá para sair do rascunho e chegar ao recebimento
 * — a travessia que estava rompida e que ninguém verificava.
 */
export function caminho<T extends string>(
  de: T,
  para: T,
  transicoes: Record<T, readonly T[]>
): T[] | null {
  if (de === para) return [de];

  const anterior = new Map<T, T>();
  const vistos = new Set<T>([de]);
  const fila: T[] = [de];

  while (fila.length > 0) {
    const atual = fila.shift() as T;
    for (const proximo of transicoes[atual] ?? []) {
      if (vistos.has(proximo)) continue;
      vistos.add(proximo);
      anterior.set(proximo, atual);

      if (proximo === para) {
        const rota: T[] = [para];
        let passo: T | undefined = atual;
        while (passo !== undefined) {
          rota.unshift(passo);
          passo = anterior.get(passo);
        }
        return rota;
      }
      fila.push(proximo);
    }
  }

  return null;
}

/**
 * Todas as grafias que o banco pode conter para um estado canônico.
 *
 * O filtro do PostgREST acontece no servidor, onde `normalizar*` não roda — então
 * uma consulta `.eq("workflow_status", "PURCHASED")` não encontraria a linha gravada
 * como `pedido_emitido`. Com isto, ela procura por todas as grafias de uma vez.
 *
 * Depois de a migration normalizar o que está armazenado, a lista extra deixa de ter
 * efeito prático — e continua barata de manter.
 */
export function grafiasRequisicao(...estados: EstadoRequisicao[]): string[] {
  const alvos = new Set<string>(estados);
  for (const [apelido, canonico] of Object.entries(APELIDOS_REQUISICAO)) {
    if (alvos.has(canonico)) alvos.add(apelido);
  }
  return [...alvos];
}

export function grafiasCotacao(...estados: EstadoCotacao[]): string[] {
  const alvos = new Set<string>(estados);
  for (const [apelido, canonico] of Object.entries(APELIDOS_COTACAO)) {
    if (alvos.has(canonico)) alvos.add(apelido);
  }
  return [...alvos];
}

export function grafiasPedido(...estados: EstadoPedido[]): string[] {
  const alvos = new Set<string>(estados);
  for (const [apelido, canonico] of Object.entries(APELIDOS_PEDIDO)) {
    if (alvos.has(canonico)) alvos.add(apelido);
  }
  return [...alvos];
}

/** Estados que nenhuma transição alcança, tirando o inicial. Deve ser vazio. */
export function estadosOrfaos<T extends string>(
  inicial: T,
  todos: readonly T[],
  transicoes: Record<T, readonly T[]>
): T[] {
  const chegaveis = alcancaveis(inicial, transicoes);
  return todos.filter((e) => !chegaveis.has(e));
}
