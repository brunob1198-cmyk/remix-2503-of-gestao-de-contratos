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
