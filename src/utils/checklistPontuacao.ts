/**
 * Pontuação e validação da aplicação de checklist.
 *
 * A tela se chama "Checklists Inteligentes" e o `peso_pontuacao` do item existia
 * no banco, no tipo e no cadastro — e **não entrava na conta**. O cálculo somava
 * `1.0` fixo por item, então o "extintor obstruído" pesava igual a "quadro de
 * avisos atualizado". Um índice de conformidade que trata os dois como iguais não
 * mede risco, mede quantidade de linhas.
 *
 * Três regras que o arquivo protege:
 *
 * 1. **O peso conta.** Item de peso 10 não conforme derruba o índice dez vezes mais
 *    que um de peso 1. É o que faz o número significar algo.
 *
 * 2. **"Não aplicável" sai do denominador.** Mesma regra da inspeção de segurança:
 *    somar N/A aos conformes infla o índice justamente no caso em que ele deveria
 *    alertar. Um checklist de 40 itens com 5 respondidos e 35 N/A não tem 100% de
 *    conformidade — tem 5 itens verificados.
 *
 * 3. **Nada avaliado devolve `null`, não 0% nem 100%.** Nenhum dos dois é verdade
 *    quando não houve verificação.
 */

/** Valores que o projeto usa para "não aplicável". */
const VALORES_NA = new Set(["NA", "N/A", "NaoAplicavel", "Nao_Aplicavel"]);

/**
 * Valores que significam não conformidade.
 *
 * A lista existe porque os tipos de resposta do modelo usam vocabulários
 * diferentes — `Sim_Nao`, `Conforme_NaoConforme`, `OK_NaoOK`. Tratar só um deles
 * faria o mesmo desvio contar em um modelo e não contar em outro.
 */
const VALORES_NAO_CONFORME = new Set([
  "NaoConforme",
  "Nao_Conforme",
  "Nao",
  "NaoOK",
  "Nao_OK",
]);

export function ehNaoAplicavel(valor: string | null | undefined): boolean {
  return VALORES_NA.has((valor ?? "").trim());
}

/**
 * Verdadeiro quando a resposta é não conformidade.
 *
 * A marcação explícita da tela (`is_nao_conforme`) tem prioridade: tipos de
 * resposta livres — escala, número, texto — não têm valor "não conforme" que se
 * possa adivinhar, e quem responde é que decide.
 */
export function ehNaoConforme(resposta: {
  resposta_valor?: string | null;
  is_nao_conforme?: boolean | null;
}): boolean {
  if (resposta.is_nao_conforme === true) return true;
  if (ehNaoAplicavel(resposta.resposta_valor)) return false;
  return VALORES_NAO_CONFORME.has((resposta.resposta_valor ?? "").trim());
}

/** Só o que o cálculo precisa de uma resposta. */
export interface RespostaParaPontuacao {
  item_id: string;
  resposta_valor?: string | null;
  is_nao_conforme?: boolean | null;
  /** Peso do item, vindo do modelo. Ausente ou inválido cai em 1. */
  peso_pontuacao?: number | null;
  /**
   * Item impeditivo, vindo do modelo. Não conformidade nele reprova o checklist
   * inteiro. Não confundir com o peso: peso gradua a nota, crítico veta.
   */
  critico?: boolean | null;
}

export interface PontuacaoAplicacao {
  totalItens: number;
  totalConforme: number;
  totalNaoConforme: number;
  totalNa: number;
  /** Soma dos pesos dos itens conformes. */
  pontuacaoObtida: number;
  /** Soma dos pesos dos itens avaliados (conformes + não conformes). */
  pontuacaoMaxima: number;
  /** Percentual sobre os pesos avaliados; nulo quando nada foi avaliado. */
  percentualConformidade: number | null;
  /**
   * Quantos itens **críticos** saíram não conformes. Um já reprova; o número diz o
   * tamanho do problema.
   */
  itensCriticosNaoConformes: number;
  /**
   * Verdadeiro quando há item crítico não conforme.
   *
   * O veredito é separado do percentual, e nenhum dos dois altera o outro. Um
   * checklist de quarenta itens com o extintor obstruído e trinta e nove conformes
   * dá 97,5% — o número está certo e a conclusão está errada, porque o canteiro não
   * pode operar. Zerar o percentual esconderia quantos itens estavam certos;
   * ignorar o item crítico esconderia que o trabalho não pode começar.
   */
  reprovadoPorItemCritico: boolean;
}

/**
 * Peso efetivo do item.
 *
 * Peso zero, negativo ou ausente vira 1. Peso zero deixaria o item fora da conta
 * sem ninguém ter marcado "não aplicável" — desvio invisível é pior que desvio
 * contado.
 */
export function pesoEfetivo(peso: number | null | undefined): number {
  if (peso === null || peso === undefined) return 1;
  if (!Number.isFinite(peso) || peso <= 0) return 1;
  return peso;
}

/** Percentual arredondado a uma casa, sem passar por `toFixed` duas vezes. */
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export function calcularPontuacao(
  respostas: readonly RespostaParaPontuacao[]
): PontuacaoAplicacao {
  let totalConforme = 0;
  let totalNaoConforme = 0;
  let totalNa = 0;
  let pontuacaoObtida = 0;
  let pontuacaoMaxima = 0;
  let itensCriticosNaoConformes = 0;

  // Respondidas de fato. Item em branco não é conforme nem não conforme — é item
  // não respondido, e contá-lo como qualquer um dos dois seria inventar resposta.
  const respondidas = respostas.filter(
    (r) => !!r.item_id && !!(r.resposta_valor ?? "").trim()
  );

  for (const r of respondidas) {
    const peso = pesoEfetivo(r.peso_pontuacao);

    if (ehNaoAplicavel(r.resposta_valor)) {
      totalNa += 1;
      continue;
    }

    if (ehNaoConforme(r)) {
      totalNaoConforme += 1;
      pontuacaoMaxima += peso;

      // O item crítico continua pesando na nota normalmente. O veto é adicional,
      // não substituto: a nota diz quanto está certo, o veto diz que não se opera.
      if (r.critico) itensCriticosNaoConformes += 1;
      continue;
    }

    totalConforme += 1;
    pontuacaoObtida += peso;
    pontuacaoMaxima += peso;
  }

  return {
    totalItens: respondidas.length,
    totalConforme,
    totalNaoConforme,
    totalNa,
    pontuacaoObtida: arredondar(pontuacaoObtida),
    pontuacaoMaxima: arredondar(pontuacaoMaxima),
    percentualConformidade:
      pontuacaoMaxima === 0 ? null : arredondar((pontuacaoObtida / pontuacaoMaxima) * 100),
    itensCriticosNaoConformes,
    reprovadoPorItemCritico: itensCriticosNaoConformes > 0,
  };
}

/** Pontos que uma resposta individual vale, para gravar na linha dela. */
export function pontosDaResposta(resposta: RespostaParaPontuacao): number {
  if (ehNaoAplicavel(resposta.resposta_valor)) return 0;
  if (ehNaoConforme(resposta)) return 0;
  return pesoEfetivo(resposta.peso_pontuacao);
}

// ---------------------------------------------------------------------------
// Exigências condicionais do item
// ---------------------------------------------------------------------------

/**
 * O que o item exige quando a resposta é não conformidade.
 *
 * O modelo já permitia configurar as três, e **nenhuma era verificada**: dava para
 * concluir um checklist com "não conforme" sem comentário, sem foto e sem plano de
 * ação, mesmo com as três marcadas como obrigatórias. Configuração que não obriga
 * nada é pior que configuração ausente — quem monta o modelo acredita ter travado
 * algo que não travou.
 */
export interface ExigenciasDoItem {
  titulo: string;
  exigir_comentario_nao_conforme?: boolean | null;
  exigir_foto_nao_conforme?: boolean | null;
  gerar_plano_acao_nao_conforme?: boolean | null;
  /** Item impeditivo. Nunca pode ficar sem resposta: ele decide o veredito. */
  critico?: boolean | null;
}

export interface RespostaParaValidacao {
  item_id: string;
  resposta_valor?: string | null;
  is_nao_conforme?: boolean | null;
  comentario?: string | null;
  /** Quantas evidências foram anexadas a esta resposta. */
  quantidadeEvidencias?: number;
  /** Preenchido quando há plano de ação com "o que fazer". */
  temPlanoAcao?: boolean;
}

export interface PendenciaDeItem {
  itemId: string;
  titulo: string;
  motivo: string;
}

/**
 * Pendências que impedem concluir a aplicação.
 *
 * Item obrigatório sem resposta vem primeiro: é a falta mais básica, e listá-la
 * junto das condicionais faria a mensagem começar pelo detalhe.
 */
export function pendenciasDaAplicacao(params: {
  itens: readonly (ExigenciasDoItem & { id: string; obrigatorio?: boolean | null })[];
  respostas: Readonly<Record<string, RespostaParaValidacao>>;
}): PendenciaDeItem[] {
  const { itens, respostas } = params;
  const pendencias: PendenciaDeItem[] = [];

  for (const item of itens) {
    const resposta = respostas[item.id];
    const respondido = !!(resposta?.resposta_valor ?? "").trim();

    // Item crítico decide o veredito da aplicação inteira. Deixá-lo em branco
    // deixaria a conclusão indefinida — não é "não avaliado", é a pergunta que
    // precisava ser respondida.
    if (item.critico && !respondido) {
      pendencias.push({
        itemId: item.id,
        titulo: item.titulo,
        motivo: "item crítico sem resposta — ele decide a aprovação do checklist",
      });
      continue;
    }

    if (item.obrigatorio && !respondido) {
      pendencias.push({
        itemId: item.id,
        titulo: item.titulo,
        motivo: "item obrigatório sem resposta",
      });
      continue;
    }

    // Sem resposta não há não conformidade a qualificar, e o item não é
    // obrigatório — nada mais a cobrar dele.
    if (!respondido || !resposta) continue;
    if (!ehNaoConforme(resposta)) continue;

    if (item.exigir_comentario_nao_conforme && !(resposta.comentario ?? "").trim()) {
      pendencias.push({
        itemId: item.id,
        titulo: item.titulo,
        motivo: "não conformidade sem o comentário exigido pelo modelo",
      });
    }

    if (item.exigir_foto_nao_conforme && (resposta.quantidadeEvidencias ?? 0) === 0) {
      pendencias.push({
        itemId: item.id,
        titulo: item.titulo,
        motivo: "não conformidade sem a foto exigida pelo modelo",
      });
    }

    if (item.gerar_plano_acao_nao_conforme && !resposta.temPlanoAcao) {
      pendencias.push({
        itemId: item.id,
        titulo: item.titulo,
        motivo: "não conformidade sem plano de ação",
      });
    }
  }

  return pendencias;
}

/** Mensagem pronta, citando os primeiros e dizendo quantos sobraram. */
export function textoDasPendencias(
  pendencias: readonly PendenciaDeItem[],
  quantosCitar = 3
): string {
  if (pendencias.length === 0) return "";

  const citados = pendencias
    .slice(0, quantosCitar)
    .map((p) => `${p.titulo} (${p.motivo})`)
    .join("; ");

  const resto = pendencias.length - quantosCitar;
  return resto > 0 ? `${citados} — e mais ${resto}` : citados;
}
