/**
 * Riscos específicos da PT.
 *
 * A aba "APR & Riscos" da PT mostrava a tabela e não tinha como cadastrar nada: as
 * mutações `addRisco` e `removeRisco` existiam no hook e a tela não usava nenhuma
 * das duas. Quem abria a PT via "Nenhum risco específico cadastrado" sem nenhum
 * botão por perto.
 *
 * DUAS PORTAS, PORQUE SÃO DUAS SITUAÇÕES
 *
 * 1. A APR já mapeou os riscos da atividade. Redigitá-los na PT é trabalho
 *    duplicado e é onde as duas listas começam a divergir — então existe a
 *    importação.
 * 2. A condição do dia traz risco que a APR não previu: chuva, um vizinho
 *    trabalhando ao lado, andaime que chegou diferente. Esse risco é da PT e de
 *    mais nada, e para ele existe o cadastro manual.
 *
 * A PT é o momento; a APR é a análise. Sem a porta 2 a PT não registraria o que só
 * se vê na hora, e sem a porta 1 ninguém usaria a porta 2 por preguiça de digitar.
 */

/** Risco da APR, como a árvore devolve. */
export interface RiscoDaApr {
  id: string;
  perigo: string;
  risco: string;
  consequencia?: string | null;
  probabilidade: number;
  severidade: number;
  risco_catalogo_id?: string | null;
}

/** Risco já vinculado à PT. */
export interface RiscoDaPt {
  id: string;
  perigo: string;
  risco: string;
}

/**
 * Chave de comparação entre risco da APR e risco da PT.
 *
 * Perigo mais risco, sem caixa e sem espaço repetido. Não entra a consequência: o
 * mesmo perigo descrito com consequência redigida de outro jeito continua sendo o
 * mesmo risco, e diferenciá-lo produziria linha duplicada na folha.
 */
export function chaveDoRisco(perigo: string, risco: string): string {
  const limpa = (s: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return `${limpa(perigo)}::${limpa(risco)}`;
}

export interface ImportacaoDaApr {
  /** Riscos da APR que ainda não estão na PT. */
  aImportar: RiscoDaApr[];
  /** Ignorados porque a PT já os tem. */
  jaNaPt: number;
  /**
   * Ignorados porque apareciam repetidos DENTRO da APR.
   *
   * Contado separado de `jaNaPt` de propósito. Somar os dois num número só fazia o
   * botão dizer "1 já na PT" com a PT vazia — o risco estava repetido em duas
   * etapas da APR, e a mensagem culpava a PT por algo que era da APR.
   */
  duplicadosNaApr: number;
}

/**
 * O que há para importar da APR para a PT.
 *
 * Ignora o que já está na PT em vez de recusar a importação inteira: o caso comum
 * é a APR ganhar um risco novo depois de a PT já ter importado os primeiros, e
 * nesse caso importar só a diferença é exatamente o que se quer.
 */
export function importacaoDaApr(params: {
  riscosDaApr: readonly RiscoDaApr[];
  riscosDaPt: readonly RiscoDaPt[];
}): ImportacaoDaApr {
  const naPt = new Set(params.riscosDaPt.map((r) => chaveDoRisco(r.perigo, r.risco)));

  // Também deduplica DENTRO da APR: o mesmo perigo pode estar mapeado em duas
  // etapas, e a PT não tem etapas — importar as duas geraria linha repetida.
  //
  // QUANDO O REPETIDO TEM AVALIAÇÃO DIFERENTE, VENCE O MAIS GRAVE.
  //
  // Encontrado numa APR real: "Choque elétrico / Energia elétrica" aparecia como
  // 3×2 = MODERADO numa etapa e 3×4 = ALTO em outra. Ficar com o primeiro que
  // aparece levava o MODERADO para a PT e descartava em silêncio a avaliação mais
  // severa do mesmo perigo — a folha que vai para a mão do executante passaria a
  // subestimar o risco.
  //
  // Não é "o primeiro" nem "o último": é o de maior probabilidade × severidade.
  // Empate mantém o primeiro, que é estável e não muda a cada importação.
  const escolhido = new Map<string, RiscoDaApr>();
  const ordem: string[] = [];
  let jaNaPt = 0;
  let duplicadosNaApr = 0;

  for (const r of params.riscosDaApr) {
    const chave = chaveDoRisco(r.perigo, r.risco);

    if (naPt.has(chave)) {
      jaNaPt++;
      continue;
    }

    const anterior = escolhido.get(chave);
    if (!anterior) {
      escolhido.set(chave, r);
      ordem.push(chave);
      continue;
    }

    duplicadosNaApr++;
    if (r.probabilidade * r.severidade > anterior.probabilidade * anterior.severidade) {
      escolhido.set(chave, r);
    }
  }

  return {
    aImportar: ordem.map((c) => escolhido.get(c) as RiscoDaApr),
    jaNaPt,
    duplicadosNaApr,
  };
}

/** Frase para o botão, que precisa dizer o que vai acontecer antes do clique. */
export function textoDaImportacao(imp: ImportacaoDaApr): string {
  if (imp.aImportar.length === 0) {
    if (imp.jaNaPt > 0) return "Todos os riscos da APR já estão nesta PT.";
    if (imp.duplicadosNaApr > 0) return "A APR só tem riscos repetidos entre etapas.";
    return "A APR vinculada não tem risco mapeado.";
  }

  const n = imp.aImportar.length;
  const base = `Importar ${n} risco${n > 1 ? "s" : ""} da APR`;

  // Só menciona o que de fato aconteceu. Dizer "já na PT" quando a repetição era
  // interna à APR joga a culpa na tela errada.
  const notas: string[] = [];
  if (imp.jaNaPt > 0) notas.push(`${imp.jaNaPt} já na PT`);
  if (imp.duplicadosNaApr > 0) notas.push(`${imp.duplicadosNaApr} repetido(s) na APR`);

  return notas.length > 0 ? `${base} (${notas.join(", ")})` : base;
}

export type ValidacaoDoRisco = { ok: true } | { ok: false; erro: string };

/**
 * Confere o mínimo antes de gravar.
 *
 * Probabilidade e severidade são de 1 a 5 porque é essa a matriz do projeto; valor
 * fora disso produziria uma classificação que a matriz não sabe nomear.
 */
export function validarRiscoDaPt(params: {
  perigo: string;
  risco: string;
  probabilidade: number;
  severidade: number;
}): ValidacaoDoRisco {
  if (!params.perigo.trim()) {
    return { ok: false, erro: "Descreva o perigo ou fator de risco." };
  }
  if (!params.risco.trim()) {
    return { ok: false, erro: "Descreva o risco associado ao perigo." };
  }

  for (const [nome, valor] of [
    ["Probabilidade", params.probabilidade],
    ["Severidade", params.severidade],
  ] as const) {
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      return { ok: false, erro: `${nome} deve ser um número inteiro de 1 a 5.` };
    }
  }

  return { ok: true };
}
