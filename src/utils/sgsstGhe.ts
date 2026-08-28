/**
 * GHE — Grupo Homogêneo de Exposição.
 *
 * O agrupamento existe porque levantar risco e exame função por função repete o
 * mesmo levantamento para quem tem a mesma exposição, e repetição é onde as duas
 * cópias começam a divergir. A NR-01 trata do agrupamento de similarmente
 * expostos em 1.5.4.4.4.
 *
 * TRÊS REGRAS QUE ESTE MÓDULO NÃO NEGOCIA
 *
 * 1. **Grupo não apaga função.** Toda função deste módulo aceita exame/risco
 *    vinculado ao GHE *e* vinculado à função. Um exame de grupo (audiometria de
 *    quem está no setor ruidoso) e um exame de função (acuidade visual do
 *    operador de empilhadeira dentro do mesmo grupo) coexistem no mesmo
 *    programa, e o documento tem de mostrar de onde cada um veio.
 *
 * 2. **"Não carregou" não é "não tem".** Quando a origem dos riscos ou dos
 *    exames não veio, o resultado diz `DESCONHECIDO` em vez de devolver lista
 *    vazia. Lista vazia num documento de conformidade afirma que o grupo não tem
 *    risco levantado — afirmação que ninguém fez.
 *
 * 3. **Quantidade declarada e quantidade contada são números diferentes.** O
 *    responsável técnico declara quantos trabalhadores o grupo tem; o cadastro
 *    sabe quantos colaboradores ativos existem nas funções do grupo. Divergir é
 *    normal (levantamento de campo desatualizado, admissão do mês). Este módulo
 *    mostra as duas e nomeia a diferença; não escolhe uma nem sobrescreve a
 *    outra.
 */

/** Ocasiões de exame, na ordem em que aparecem no documento. */
export const OCASIOES_EXAME = [
  "Admissional",
  "Periódico",
  "Retorno ao Trabalho",
  "Mudança de Risco/Função",
  "Demissional",
  "Outros",
] as const;

export type OcasiaoExame = (typeof OCASIOES_EXAME)[number];

/** Cabeçalho curto, para a matriz não estourar a largura da página. */
export const ROTULO_OCASIAO: Record<OcasiaoExame, string> = {
  Admissional: "Adm.",
  Periódico: "Perió.",
  "Retorno ao Trabalho": "Ret. trab.",
  "Mudança de Risco/Função": "Mud. função",
  Demissional: "Demis.",
  Outros: "Outros",
};

export interface GheBasico {
  id: string;
  codigo: string;
  nome: string;
  setor?: string | null;
  area_influencia?: string | null;
  carga_horaria?: string | null;
  quantidade_trabalhadores?: number | null;
  descricao?: string | null;
  status?: string | null;
}

export interface FuncaoDoGhe {
  id: string;
  nome: string;
  descricao?: string | null;
  cbo?: string | null;
}

/** Exame previsto, como vem do PCMSO. */
export interface ExamePrevistoGhe {
  id: string;
  nome_exame: string;
  tipo_exame: string;
  periodicidade_meses?: number | null;
  funcao_id?: string | null;
  ghe_id?: string | null;
  observacoes?: string | null;
}

/** Item do inventário do PGR, com as funções que ele alcança. */
export interface RiscoDoInventario {
  id: string;
  ghe_id?: string | null;
  categoria?: string | null;
  agente?: string | null;
  /** Como o dano aparece no documento. */
  danos_saude?: string | null;
  funcaoIds: string[];
}

/**
 * Código sugerido para o próximo GHE.
 *
 * Segue o formato dominante nos modelos ("GHE-01") e continua a numeração a
 * partir do maior número já usado — não da quantidade de grupos. Se existem
 * GHE-01 e GHE-07, o próximo é GHE-08 e não GHE-03: reaproveitar um número
 * liberado por exclusão faria o código antigo, já citado em documento emitido,
 * apontar para outro grupo.
 */
export function proximoCodigoGhe(existentes: readonly string[]): string {
  let maior = 0;
  for (const codigo of existentes) {
    const m = /(\d+)\s*$/.exec((codigo || "").trim());
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maior) maior = n;
  }
  return `GHE-${String(maior + 1).padStart(2, "0")}`;
}

/** Comparação de código como o banco compara: sem espaços, sem caixa. */
export function codigoNormalizado(codigo: string): string {
  return (codigo || "").trim().toUpperCase();
}

/**
 * O código já está em uso por OUTRO grupo?
 *
 * Recebe o `id` do que está sendo editado para que renomear um grupo sem mudar o
 * código não acuse conflito consigo mesmo.
 */
export function codigoEmUso(
  codigo: string,
  existentes: readonly { id: string; codigo: string }[],
  idEditando?: string | null
): boolean {
  const alvo = codigoNormalizado(codigo);
  if (!alvo) return false;
  return existentes.some(
    (g) => g.id !== idEditando && codigoNormalizado(g.codigo) === alvo
  );
}

/** Cabeçalho do GHE como sai no documento, sem os campos vazios. */
export function cabecalhoDoGhe(ghe: GheBasico): { rotulo: string; valor: string }[] {
  const linhas: { rotulo: string; valor: string }[] = [];
  const por = (rotulo: string, valor: unknown) => {
    const v = valor === null || valor === undefined ? "" : String(valor).trim();
    // Campo vazio sai da lista em vez de aparecer como "—": no cabeçalho de GHE
    // um rótulo sem valor lido por auditor é lacuna, e lacuna declarada em toda
    // linha vira ruído. O que falta aparece nas pendências, não no cabeçalho.
    if (v) linhas.push({ rotulo, valor: v });
  };
  por("Setor", ghe.setor);
  por("Área de influência", ghe.area_influencia);
  por("Carga horária", ghe.carga_horaria);
  return linhas;
}

/** Origem do vínculo: o documento precisa dizer se o exame é do grupo ou da função. */
export type OrigemDoVinculo = "GRUPO" | "FUNCAO";

export interface CelulaMatriz {
  /** Marcado nesta ocasião? */
  previsto: boolean;
  /** Só para o periódico: "12 meses". Vazio nas outras ocasiões. */
  periodicidade: string;
  /** De onde veio a previsão. Vazio quando não previsto. */
  origens: OrigemDoVinculo[];
}

export interface LinhaMatrizExames {
  exame: string;
  celulas: Record<OcasiaoExame, CelulaMatriz>;
}

export type MatrizExamesGhe =
  | { situacao: "DESCONHECIDO" }
  | { situacao: "SEM_EXAME" }
  | { situacao: "OK"; linhas: LinhaMatrizExames[]; ocasioesUsadas: OcasiaoExame[] };

function celulaVazia(): CelulaMatriz {
  return { previsto: false, periodicidade: "", origens: [] };
}

function celulasVazias(): Record<OcasiaoExame, CelulaMatriz> {
  const r = {} as Record<OcasiaoExame, CelulaMatriz>;
  for (const o of OCASIOES_EXAME) r[o] = celulaVazia();
  return r;
}

/**
 * Matriz exame × ocasião de um GHE.
 *
 * Entram os exames vinculados ao próprio grupo E os vinculados a qualquer função
 * do grupo — é isso que faz o quadro do GHE ser o quadro completo de quem está
 * nele. A coluna `origens` guarda a distinção, para o documento poder marcar o
 * que é específico de função em vez de fingir que todo mundo do grupo faz.
 *
 * `ocasioesUsadas` existe para a tabela não imprimir seis colunas quando o
 * programa só usa três: coluna inteira vazia gasta largura que as outras
 * precisam.
 */
export function matrizExamesDoGhe(params: {
  exames: readonly ExamePrevistoGhe[] | null | undefined;
  gheId: string;
  funcaoIdsDoGhe: readonly string[];
}): MatrizExamesGhe {
  // `null`/`undefined` é "não carregou". Array vazio é "carregou e não há".
  if (!params.exames) return { situacao: "DESCONHECIDO" };

  const funcoes = new Set(params.funcaoIdsDoGhe);
  const porNome = new Map<string, LinhaMatrizExames>();

  for (const ex of params.exames) {
    const doGrupo = ex.ghe_id === params.gheId;
    const daFuncao = !!ex.funcao_id && funcoes.has(ex.funcao_id);
    if (!doGrupo && !daFuncao) continue;

    const nome = (ex.nome_exame || "").trim();
    if (!nome) continue;

    const chave = nome.toUpperCase();
    let linha = porNome.get(chave);
    if (!linha) {
      linha = { exame: nome, celulas: celulasVazias() };
      porNome.set(chave, linha);
    }

    // Tipo fora do enum conhecido cai em "Outros" em vez de criar coluna nova ou
    // ser descartado: descartar sumiria com um exame previsto de verdade.
    const ocasiao = (OCASIOES_EXAME as readonly string[]).includes(ex.tipo_exame)
      ? (ex.tipo_exame as OcasiaoExame)
      : "Outros";

    const celula = linha.celulas[ocasiao];
    celula.previsto = true;

    if (ocasiao === "Periódico") {
      const meses = ex.periodicidade_meses;
      if (typeof meses === "number" && meses > 0) {
        // Dois exames de mesmo nome com periodicidades diferentes dentro do grupo
        // é conflito real de programa. Vence a MENOR: é a que o grupo precisa
        // cumprir para que ambas as previsões fiquem atendidas.
        const anterior = Number(celula.periodicidade.replace(/\D/g, "")) || Infinity;
        if (meses < anterior) {
          celula.periodicidade = `${meses} ${meses === 1 ? "mês" : "meses"}`;
        }
      }
    }

    if (doGrupo && !celula.origens.includes("GRUPO")) celula.origens.push("GRUPO");
    if (daFuncao && !celula.origens.includes("FUNCAO")) celula.origens.push("FUNCAO");
  }

  const linhas = [...porNome.values()].sort((a, b) => a.exame.localeCompare(b.exame, "pt-BR"));
  if (linhas.length === 0) return { situacao: "SEM_EXAME" };

  const ocasioesUsadas = OCASIOES_EXAME.filter((o) =>
    linhas.some((l) => l.celulas[o].previsto)
  );

  return { situacao: "OK", linhas, ocasioesUsadas };
}

export interface RiscoDoGhe {
  categoria: string;
  agente: string;
  danos: string;
  origens: OrigemDoVinculo[];
}

export type RiscosDoGhe =
  | { situacao: "DESCONHECIDO" }
  | { situacao: "SEM_RISCO" }
  | { situacao: "OK"; riscos: RiscoDoGhe[] };

/**
 * Riscos que alcançam um GHE.
 *
 * Vêm do inventário do PGR, não de um cadastro paralelo do PCMSO. Duplicar o
 * levantamento nos dois programas é como eles passam a discordar sobre a mesma
 * exposição — e é a discordância que o auditor encontra primeiro.
 */
export function riscosDoGhe(params: {
  inventario: readonly RiscoDoInventario[] | null | undefined;
  gheId: string;
  funcaoIdsDoGhe: readonly string[];
}): RiscosDoGhe {
  if (!params.inventario) return { situacao: "DESCONHECIDO" };

  const funcoes = new Set(params.funcaoIdsDoGhe);
  const porChave = new Map<string, RiscoDoGhe>();

  for (const item of params.inventario) {
    const doGrupo = item.ghe_id === params.gheId;
    const daFuncao = item.funcaoIds.some((f) => funcoes.has(f));
    if (!doGrupo && !daFuncao) continue;

    const categoria = (item.categoria || "Não classificado").trim();
    const agente = (item.agente || "").trim();
    const chave = `${categoria.toUpperCase()}|${agente.toUpperCase()}`;

    let risco = porChave.get(chave);
    if (!risco) {
      risco = { categoria, agente, danos: (item.danos_saude || "").trim(), origens: [] };
      porChave.set(chave, risco);
    } else if (!risco.danos && item.danos_saude) {
      // O mesmo agente lançado duas vezes, uma com dano descrito e outra sem:
      // aproveita a descrição que existe em vez de deixar a célula vazia por
      // ordem de leitura.
      risco.danos = item.danos_saude.trim();
    }

    if (doGrupo && !risco.origens.includes("GRUPO")) risco.origens.push("GRUPO");
    if (daFuncao && !risco.origens.includes("FUNCAO")) risco.origens.push("FUNCAO");
  }

  const riscos = [...porChave.values()].sort(
    (a, b) =>
      a.categoria.localeCompare(b.categoria, "pt-BR") ||
      a.agente.localeCompare(b.agente, "pt-BR")
  );

  if (riscos.length === 0) return { situacao: "SEM_RISCO" };
  return { situacao: "OK", riscos };
}

/**
 * Funções do grupo que ainda não constam como expostas ao risco.
 *
 * Serve ao inventário do PGR, onde marcar o GHE e marcar as funções são duas
 * operações diferentes: o grupo é o que aparece na seção de GHE do PCMSO, e as
 * funções é o que liga o risco a quem o exerce.
 *
 * Marcar as funções automaticamente ao escolher o grupo seria decidir pelo
 * usuário, e há caso legítimo em que o risco alcança o grupo como local sem
 * alcançar toda função dele — o visitante do setor ruidoso está no local e não é
 * função do grupo. Então a regra é apontar a diferença e deixar o atalho à mão,
 * nunca agir sozinho.
 *
 * `funcoesDoGrupo` em `null` é "não carregou": devolve lista vazia porque não há
 * diferença CONHECIDA a apontar — o que é diferente de uma diferença de zero.
 */
export function funcoesFaltandoDoGrupo(params: {
  gheId: string | null | undefined;
  funcoesDoGrupo: readonly FuncaoDoGhe[] | null | undefined;
  funcaoIdsMarcados: readonly string[];
}): FuncaoDoGhe[] {
  if (!params.gheId || params.gheId === "none") return [];
  if (!params.funcoesDoGrupo) return [];
  const marcados = new Set(params.funcaoIdsMarcados);
  return params.funcoesDoGrupo.filter((f) => !marcados.has(f.id));
}

export interface DivergenciaQuantidade {
  declarada: number | null;
  contada: number | null;
  /** Só quando as duas existem e diferem. */
  aviso: string;
}

/**
 * Confronta a quantidade declarada no GHE com a contagem de ativos.
 *
 * Não corrige nenhuma das duas. Divergência tem causa legítima — admissão
 * recente, levantamento de campo anterior ao cadastro — e a correção é decisão
 * de quem assina. O que o sistema deve fazer é não deixar a diferença passar em
 * silêncio até o auditor achá-la.
 */
export function divergenciaDeQuantidade(params: {
  declarada?: number | null;
  contada?: number | null;
}): DivergenciaQuantidade {
  const declarada = typeof params.declarada === "number" ? params.declarada : null;
  const contada = typeof params.contada === "number" ? params.contada : null;

  if (declarada === null || contada === null || declarada === contada) {
    return { declarada, contada, aviso: "" };
  }

  return {
    declarada,
    contada,
    aviso:
      `Quantidade declarada (${declarada}) diferente dos colaboradores ativos ` +
      `nas funções do grupo (${contada}). Confirme qual reflete o grupo hoje.`,
  };
}

export interface LinhaQuadroFuncao {
  ordem: number;
  nome: string;
  cbo: string;
  /** Vazio quando a função não tem descrição cadastrada. */
  descricao: string;
  /** GHEs que contêm esta função, por código. Vazio quando não está em nenhum. */
  ghes: string[];
}

/**
 * Quadro de funções com descrição detalhada das atividades.
 *
 * É a primeira coisa que os modelos de PCMSO trazem, e por um motivo prático: a
 * descrição da atividade é o que liga o exame ao que a pessoa faz. Sem ela, uma
 * linha "audiometria — periódico — 12 meses" não permite conferir se o exame faz
 * sentido para aquela função.
 *
 * Função sem descrição entra no quadro com a descrição vazia, e não fora dele. O
 * quadro é a lista das funções avaliadas; omitir a função sem texto faria o
 * documento parecer completo com uma função de menos.
 */
export function quadroDeFuncoes(params: {
  funcoes: readonly FuncaoDoGhe[];
  /** ghe.id -> códigos; usado para mostrar em que grupo a função está. */
  ghesPorFuncao?: Map<string, string[]>;
}): LinhaQuadroFuncao[] {
  return [...params.funcoes]
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
    .map((f, i) => ({
      ordem: i + 1,
      nome: (f.nome || "").trim(),
      cbo: (f.cbo || "").trim(),
      descricao: (f.descricao || "").trim(),
      ghes: params.ghesPorFuncao?.get(f.id) ?? [],
    }));
}

/**
 * Pendências do GHE, no mesmo formato que o resto do SGSST usa.
 *
 * São avisos de completude do documento, não erros de gravação: um GHE recém
 * criado é legitimamente incompleto enquanto o levantamento não terminou.
 */
export function pendenciasDoGhe(params: {
  ghe: GheBasico;
  funcoes: readonly FuncaoDoGhe[];
  matriz: MatrizExamesGhe;
  riscos: RiscosDoGhe;
}): string[] {
  const p: string[] = [];
  const { ghe, funcoes, matriz, riscos } = params;

  if (funcoes.length === 0) {
    p.push("Nenhuma função vinculada ao grupo — sem função, o grupo não alcança ninguém.");
  }
  if (!ghe.setor?.trim()) p.push("Setor não informado.");
  if (!ghe.area_influencia?.trim()) p.push("Área de influência não informada.");
  if (!ghe.carga_horaria?.trim()) p.push("Carga horária não informada.");
  if (typeof ghe.quantidade_trabalhadores !== "number") {
    p.push("Quantidade de trabalhadores do grupo não declarada.");
  }

  const semDescricao = funcoes.filter((f) => !(f.descricao || "").trim());
  if (semDescricao.length > 0) {
    p.push(
      `${semDescricao.length} ${semDescricao.length === 1 ? "função" : "funções"} sem descrição ` +
        `detalhada das atividades: ${semDescricao.map((f) => f.nome).join(", ")}.`
    );
  }

  // "Não carregou" não gera pendência: seria acusar lacuna que talvez não exista.
  if (riscos.situacao === "SEM_RISCO") {
    p.push("Nenhum risco do inventário do PGR alcança este grupo.");
  }
  if (matriz.situacao === "SEM_EXAME") {
    p.push("Nenhum exame previsto para o grupo nem para suas funções.");
  }

  return p;
}
