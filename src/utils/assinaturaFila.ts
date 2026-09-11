/**
 * A fila de assinaturas: quem pode assinar agora, e quando o documento fecha.
 *
 * O QUE EXISTIA E O QUE FALTAVA
 *
 * As tabelas foram desenhadas para isto — `signature_signers` tem `ordem` desde a
 * criação. Mas nada usava: `SignatureService.sign()` criava o signatário no
 * momento da assinatura, com `ordem: 1` fixo no código. Ou seja, havia um campo de
 * fila e nenhuma fila; quem assinava era sempre a primeira e única pessoa.
 *
 * Aqui a fila passa a existir de verdade: os signatários são declarados antes, em
 * ordem, e cada um só pode assinar quando chegar a sua vez.
 *
 * TRÊS DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * 1. **Ordem repetida assina em paralelo.** Dois signatários com a mesma `ordem`
 *    podem assinar em qualquer sequência entre si. É o caso das duas testemunhas:
 *    exigir que a testemunha B espere a A não representa nada do mundo real e
 *    trava o documento por nada.
 *
 * 2. **Uma recusa para a fila inteira.** Recusar não é "pular": é uma decisão
 *    sobre o documento. Deixar os seguintes assinarem produziria um documento
 *    assinado por quatro pessoas e recusado por uma — que não é assinado nem
 *    recusado, e ninguém sabe dizer o que é.
 *
 * 3. **Vencimento derruba a vez, não o passado.** Passada a data limite ninguém
 *    mais assina, mas quem já assinou continua tendo assinado. Invalidar o que já
 *    foi feito por causa do relógio apagaria ato de terceiro.
 */

export type StatusDoSignatario = "PENDENTE" | "ASSINADO" | "RECUSADO";

export interface SignatarioDaFila {
  id: string;
  nome: string;
  /** Posição na fila. Repetida significa assinatura em paralelo. */
  ordem: number;
  status: StatusDoSignatario;
  assinadoEm?: string | null;
}

export type SituacaoDaFila =
  | "SEM_SIGNATARIOS"
  | "AGUARDANDO"
  | "CONCLUIDA"
  | "RECUSADA";

function normalizar(status: string | null | undefined): StatusDoSignatario {
  const s = (status ?? "").toUpperCase();
  if (s === "ASSINADO" || s === "RECUSADO") return s;
  return "PENDENTE";
}

/** Ordena pela posição na fila; empate mantém a ordem de cadastro. */
export function ordenarFila(
  signatarios: readonly SignatarioDaFila[]
): SignatarioDaFila[] {
  return [...signatarios].sort((a, b) => a.ordem - b.ordem);
}

export function situacaoDaFila(
  signatarios: readonly SignatarioDaFila[]
): SituacaoDaFila {
  if (signatarios.length === 0) return "SEM_SIGNATARIOS";

  // A recusa vence tudo, inclusive a conclusão: se alguém recusou, o documento
  // não fechou, mesmo que todos os outros tenham assinado.
  if (signatarios.some((s) => normalizar(s.status) === "RECUSADO")) return "RECUSADA";

  if (signatarios.every((s) => normalizar(s.status) === "ASSINADO")) return "CONCLUIDA";

  return "AGUARDANDO";
}

/**
 * Quem pode assinar neste momento.
 *
 * Todos os pendentes da menor `ordem` ainda em aberto — um só, no caso comum, e
 * mais de um quando há empate de ordem.
 */
export function proximosDaVez(
  signatarios: readonly SignatarioDaFila[]
): SignatarioDaFila[] {
  if (situacaoDaFila(signatarios) !== "AGUARDANDO") return [];

  const pendentes = ordenarFila(signatarios).filter(
    (s) => normalizar(s.status) === "PENDENTE"
  );
  if (pendentes.length === 0) return [];

  const menorOrdem = pendentes[0].ordem;
  return pendentes.filter((s) => s.ordem === menorOrdem);
}

export type VezDeAssinar =
  | { pode: true; signatario: SignatarioDaFila }
  | { pode: false; motivo: string; comoResolver: string };

/**
 * Este signatário pode assinar agora?
 *
 * `agora` e `expiraEm` entram como texto ISO para o teste não depender do relógio
 * e para a comparação não passar por `Date`, que interpreta "YYYY-MM-DD" em UTC e
 * no fuso do Brasil volta um dia.
 */
export function vezDeAssinar(params: {
  signatarios: readonly SignatarioDaFila[];
  signatarioId: string;
  /** `expires_at` da solicitação, quando houver. */
  expiraEm?: string | null;
  agora: string;
}): VezDeAssinar {
  const eu = params.signatarios.find((s) => s.id === params.signatarioId);

  if (!eu) {
    return {
      pode: false,
      motivo: "Este link não corresponde a nenhum signatário deste documento.",
      comoResolver: "Confira se o link recebido está completo, ou peça um novo ao solicitante.",
    };
  }

  const meuStatus = normalizar(eu.status);

  if (meuStatus === "ASSINADO") {
    return {
      pode: false,
      motivo: "Você já assinou este documento.",
      comoResolver: "Nada a fazer. O documento assinado fica disponível ao final da fila.",
    };
  }

  if (meuStatus === "RECUSADO") {
    return {
      pode: false,
      motivo: "Você recusou a assinatura deste documento.",
      comoResolver: "Se foi engano, o solicitante precisa abrir uma nova solicitação.",
    };
  }

  const situacao = situacaoDaFila(params.signatarios);

  if (situacao === "RECUSADA") {
    return {
      pode: false,
      motivo: "Um dos signatários recusou a assinatura e o documento foi interrompido.",
      comoResolver:
        "A recusa encerra a fila para todos. O solicitante precisa tratar a recusa e " +
        "abrir uma nova solicitação.",
    };
  }

  // Vencimento depois da checagem de já-assinou: quem assinou antes do prazo não
  // pode receber uma mensagem de documento vencido.
  const limite = (params.expiraEm ?? "").trim();
  if (limite && limite < params.agora) {
    return {
      pode: false,
      motivo: "O prazo para assinatura deste documento venceu.",
      comoResolver: "Peça ao solicitante para reabrir a solicitação com novo prazo.",
    };
  }

  const daVez = proximosDaVez(params.signatarios);
  if (!daVez.some((s) => s.id === eu.id)) {
    const faltam = ordenarFila(params.signatarios)
      .filter((s) => normalizar(s.status) === "PENDENTE" && s.ordem < eu.ordem)
      .map((s) => s.nome);

    return {
      pode: false,
      motivo: "Ainda não é a sua vez de assinar.",
      comoResolver:
        faltam.length > 0
          ? `Aguardando a assinatura de: ${faltam.join(", ")}. Você receberá um aviso quando chegar a sua vez.`
          : "Você receberá um aviso quando chegar a sua vez.",
    };
  }

  return { pode: true, signatario: eu };
}

export interface ProgressoDaFila {
  total: number;
  assinados: number;
  pendentes: number;
  recusados: number;
  situacao: SituacaoDaFila;
  /** Nomes de quem pode assinar agora. Vazio quando a fila não está aguardando. */
  aguardando: string[];
}

/** Resumo para a tela do solicitante acompanhar sem abrir cada signatário. */
export function progressoDaFila(
  signatarios: readonly SignatarioDaFila[]
): ProgressoDaFila {
  const conta = (alvo: StatusDoSignatario) =>
    signatarios.filter((s) => normalizar(s.status) === alvo).length;

  return {
    total: signatarios.length,
    assinados: conta("ASSINADO"),
    pendentes: conta("PENDENTE"),
    recusados: conta("RECUSADO"),
    situacao: situacaoDaFila(signatarios),
    aguardando: proximosDaVez(signatarios).map((s) => s.nome),
  };
}
