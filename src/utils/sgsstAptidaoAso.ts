/**
 * A conclusão de aptidão do ASO.
 *
 * A coluna `aptidao` nascia `NOT NULL DEFAULT 'APTO'`. Isso significa que **um ASO
 * criado sem ninguém tocar no campo já saía dizendo que o trabalhador está apto** —
 * o sistema emitindo, por omissão, a única afirmação do documento que só um médico
 * pode fazer. E saía em corpo grande e verde no PDF, com a mesma aparência de uma
 * conclusão de fato assinada.
 *
 * Agora a conclusão é OPCIONAL. Ausente, o PDF imprime as caixas de marcação
 * vazias, para o médico examinador preencher e assinar — que é como as fichas de
 * ASO em uso funcionam. O sistema guarda o que foi respondido e cala sobre o que
 * não foi.
 *
 * O mesmo vale para as aptidões por atividade (altura, espaço confinado, máquinas),
 * com um estado a mais: **"não se aplica" não é "inapto"**. Quem nunca sobe em
 * andaime não é inapto para altura — a pergunta não se aplica ao trabalho dele.
 * Confundir os dois barraria gente de serviço que ela pode fazer, e o oposto
 * liberaria quem nunca foi avaliado.
 */

/** Conclusão geral: aptidão para a função. Nula = o médico ainda não concluiu. */
export type AptidaoAso = "APTO" | "APTO_COM_RESTRICAO" | "INAPTO";

export const APTIDAO_ASO_LABEL: Record<AptidaoAso, string> = {
  APTO: "Apto",
  APTO_COM_RESTRICAO: "Apto com restrição",
  INAPTO: "Inapto",
};

/** As três atividades que a ficha de ASO avalia à parte da função. */
export type AtividadeEspecificaAso = "ALTURA" | "ESPACO_CONFINADO" | "MAQUINAS";

export const ATIVIDADE_ESPECIFICA_LABEL: Record<AtividadeEspecificaAso, string> = {
  ALTURA: "Para realizar trabalhos em altura",
  ESPACO_CONFINADO: "Para realizar trabalhos em espaços confinados",
  MAQUINAS: "Para operar máquinas, equipamentos ou veículos",
};

/** Nome curto, para a tela e para o resumo. */
export const ATIVIDADE_ESPECIFICA_CURTO: Record<AtividadeEspecificaAso, string> = {
  ALTURA: "Trabalho em altura",
  ESPACO_CONFINADO: "Espaço confinado",
  MAQUINAS: "Máquinas e veículos",
};

/** A ordem em que as atividades saem na folha. */
export const ATIVIDADES_ESPECIFICAS: readonly AtividadeEspecificaAso[] = [
  "ALTURA",
  "ESPACO_CONFINADO",
  "MAQUINAS",
];

/**
 * Resposta a uma aptidão por atividade.
 *
 * `NAO_SE_APLICA` é resposta, e não ausência de resposta: alguém olhou e disse que
 * a pergunta não cabe. Nulo é que ninguém olhou.
 */
export type AptidaoAtividade = "APTO" | "INAPTO" | "NAO_SE_APLICA";

export const APTIDAO_ATIVIDADE_LABEL: Record<AptidaoAtividade, string> = {
  APTO: "Apto",
  INAPTO: "Inapto",
  NAO_SE_APLICA: "Não se aplica",
};

export type SituacaoConclusaoAso =
  /** O médico não registrou conclusão. O PDF sai com as caixas em branco. */
  | "NAO_CONCLUIDO"
  | "APTO"
  | "APTO_COM_RESTRICAO"
  | "INAPTO";

export const SITUACAO_CONCLUSAO_LABEL: Record<SituacaoConclusaoAso, string> = {
  NAO_CONCLUIDO: "Conclusão a preencher pelo médico",
  APTO: "Apto para a função",
  APTO_COM_RESTRICAO: "Apto com restrição",
  INAPTO: "Inapto para a função",
};

/**
 * Em que estado está a conclusão do ASO.
 *
 * Existe para que nenhuma tela precise decidir por conta própria o que fazer com
 * `aptidao` nula — e para que "não concluído" nunca caia no mesmo ramo de "apto".
 */
export function situacaoDaConclusao(
  aptidao?: AptidaoAso | null
): SituacaoConclusaoAso {
  if (!aptidao) return "NAO_CONCLUIDO";
  return aptidao;
}

/** Verdadeiro quando o documento ainda depende de o médico concluir. */
export function conclusaoPendente(aptidao?: AptidaoAso | null): boolean {
  return situacaoDaConclusao(aptidao) === "NAO_CONCLUIDO";
}

/**
 * Verdadeiro quando o ASO libera a função.
 *
 * Nulo NÃO libera: um ASO sem conclusão médica não autoriza trabalho, e tratá-lo
 * como liberação é o defeito que o `DEFAULT 'APTO'` produzia.
 */
export function liberaAFuncao(aptidao?: AptidaoAso | null): boolean {
  return aptidao === "APTO" || aptidao === "APTO_COM_RESTRICAO";
}

/**
 * Verdadeiro quando o ASO libera aquela atividade específica.
 *
 * Só `APTO` libera. Nulo é "não avaliado" e `NAO_SE_APLICA` é "não faz esse
 * serviço" — nenhum dos dois é autorização. É esta função que a PT de altura e a
 * de espaço confinado devem consultar.
 */
export function liberaAtividade(resposta?: AptidaoAtividade | null): boolean {
  return resposta === "APTO";
}

/**
 * Qual aptidão específica um tipo de PT exige do trabalhador.
 *
 * Só os dois tipos que o ASO efetivamente avalia. `Trabalho com Eletricidade`
 * também exige aptidão pela NR-10, e `Içamento` envolve máquina — mas o ASO não
 * tem campo para nenhum dos dois, e inventar aqui uma exigência que o documento
 * não responde travaria a PT sem nunca poder ser satisfeita.
 */
export function atividadeExigidaPorTipoDePt(
  tipoPt: string | null | undefined
): AtividadeEspecificaAso | null {
  const t = (tipoPt ?? "").trim().toLowerCase();
  if (t.includes("altura")) return "ALTURA";
  if (t.includes("confinado")) return "ESPACO_CONFINADO";
  return null;
}

/** O ASO como o portão da PT precisa ler. */
export interface AsoParaAutorizacao {
  aptidao?: AptidaoAso | null;
  apto_altura?: AptidaoAtividade | null;
  apto_espaco_confinado?: AptidaoAtividade | null;
  apto_maquinas?: AptidaoAtividade | null;
  /** ISO. Vencido não autoriza. */
  validade?: string | null;
  /** SUBSTITUIDO e CANCELADO não autorizam. */
  status?: string | null;
}

export type AutorizacaoNaPt =
  | { autoriza: true }
  | { autoriza: false; motivo: string; comoResolver: string };

function respostaDaAtividade(
  aso: AsoParaAutorizacao,
  atividade: AtividadeEspecificaAso
): AptidaoAtividade | null | undefined {
  if (atividade === "ALTURA") return aso.apto_altura;
  if (atividade === "ESPACO_CONFINADO") return aso.apto_espaco_confinado;
  return aso.apto_maquinas;
}

/**
 * O trabalhador pode ser autorizado nesta PT?
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * As colunas `apto_altura` e `apto_espaco_confinado` eram gravadas e impressas, e
 * NINGUÉM as consultava. Dava para marcar o trabalhador como INAPTO para altura no
 * ASO e, em seguida, autorizá-lo numa PT de Trabalho em Altura — o sistema aceitava
 * sem dizer nada. Pior: o formulário do ASO afirma que "a PT de altura e de espaço
 * confinado consultam estes campos", e o comentário de `liberaAtividade` dizia que
 * é ela que a PT "deve" consultar. A promessa estava escrita nos dois lugares e a
 * ligação nunca existiu.
 *
 * Autorizar quem está medicamente inapto para altura é o tipo de falha que só
 * aparece no acidente. Por isso aqui é IMPEDIMENTO, não aviso.
 *
 * A ORDEM DAS CHECAGENS É A ORDEM DA GRAVIDADE
 *
 * Sem ASO vem antes de ASO vencido, que vem antes de conclusão que não libera, que
 * vem antes da aptidão específica. Assim a mensagem aponta o que resolver primeiro,
 * em vez de reclamar do detalhe quando falta o documento inteiro.
 */
export function autorizacaoNaPt(params: {
  tipoPt: string | null | undefined;
  /** ASO vigente do trabalhador. `null` = não tem nenhum. */
  aso: AsoParaAutorizacao | null;
  hoje?: Date;
}): AutorizacaoNaPt {
  const atividade = atividadeExigidaPorTipoDePt(params.tipoPt);

  // Tipo de PT que o ASO não avalia: nada a conferir aqui. As outras regras da
  // PT (treinamento, checklist) continuam valendo por conta própria.
  if (!atividade) return { autoriza: true };

  const nome = ATIVIDADE_ESPECIFICA_CURTO[atividade].toLowerCase();

  if (!params.aso) {
    return {
      autoriza: false,
      motivo: "Trabalhador sem ASO.",
      comoResolver:
        `Não há atestado de saúde ocupacional para conferir a aptidão para ${nome}. ` +
        "Emita o ASO antes de autorizar.",
    };
  }

  const status = (params.aso.status ?? "ATIVO").toUpperCase();
  if (status !== "ATIVO") {
    return {
      autoriza: false,
      motivo: `ASO com situação ${status}.`,
      comoResolver: "Só ASO ativo autoriza. Emita o ASO vigente do trabalhador.",
    };
  }

  const validade = (params.aso.validade ?? "").trim();
  if (validade) {
    const hoje = params.hoje ?? new Date();
    // Compara por texto ISO para não depender de fuso: a validade é uma data, não
    // um instante, e converter para Date à meia-noite local já deslocou datas
    // neste projeto antes.
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
      hoje.getDate()
    ).padStart(2, "0")}`;
    if (validade < hojeIso) {
      return {
        autoriza: false,
        motivo: "ASO vencido.",
        comoResolver: `Venceu em ${validade}. Renove o ASO antes de autorizar.`,
      };
    }
  }

  if (!liberaAFuncao(params.aso.aptidao)) {
    const situacao = situacaoDaConclusao(params.aso.aptidao);
    return {
      autoriza: false,
      motivo: `ASO ${SITUACAO_CONCLUSAO_LABEL[situacao].toLowerCase()}.`,
      comoResolver:
        situacao === "NAO_CONCLUIDO"
          ? "O médico examinador ainda não registrou a conclusão. Sem conclusão não há autorização."
          : "A conclusão do ASO não libera o trabalhador para a função.",
    };
  }

  const resposta = respostaDaAtividade(params.aso, atividade);
  if (liberaAtividade(resposta)) return { autoriza: true };

  if (resposta === "INAPTO") {
    return {
      autoriza: false,
      motivo: `ASO declara o trabalhador INAPTO para ${nome}.`,
      comoResolver:
        "Só o médico examinador pode mudar essa conclusão, em novo ASO. " +
        "Enquanto ela valer, este trabalhador não pode ser autorizado nesta PT.",
    };
  }

  if (resposta === "NAO_SE_APLICA") {
    return {
      autoriza: false,
      motivo: `ASO marca ${nome} como "não se aplica".`,
      comoResolver:
        "O médico registrou que a pergunta não cabia para este trabalhador — e isso " +
        "não é autorização. Se ele passou a fazer esse serviço, é caso de novo ASO.",
    };
  }

  return {
    autoriza: false,
    motivo: `ASO não avaliou aptidão para ${nome}.`,
    comoResolver:
      "Campo em branco significa que ninguém avaliou, e não que está liberado. " +
      "Peça ao médico examinador que registre a aptidão específica.",
  };
}
