import { alturaDeLinhas } from "@/utils/pdfTexto";
import { chaveDoTexto, type Ancora } from "@/utils/ancoraDeAssinatura";

/**
 * O bloco de assinatura do instrutor e do responsável técnico.
 *
 * DOIS DEFEITOS, E ELES SÃO O MESMO
 *
 * 1. **Não havia onde assinar.** O bloco imprimia o nome, punha um traço embaixo
 *    dele e o papel embaixo do traço. Quem fosse assinar de próprio punho não
 *    tinha espaço nenhum: o traço já vinha com o nome colado em cima. E sobravam
 *    ~22pt de folga DEPOIS do papel, no lugar onde ninguém assina.
 *
 * 2. **A assinatura eletrônica não tinha âncora.** Só as células de tabela
 *    registravam onde carimbar. O instrutor assinava pelo link, o nome dele saía
 *    na folha de assinaturas do fim, e a linha dele dentro do documento
 *    continuava em branco — como se ele não tivesse assinado.
 *
 * O segundo depende do primeiro: âncora é um retângulo, e não havia retângulo
 * livre para ser. Carimbar por cima do nome impresso seria pior que não carimbar.
 *
 * A FORMA
 *
 *     [espaço em branco]   ← aqui se assina, à mão ou por carimbo
 *     ─────────────────
 *     Nome de quem assina
 *     Papel
 *
 * É a ordem usual de um bloco de assinatura, e é a única que reserva o espaço
 * acima do traço — que é onde a mão e o carimbo esperam poder escrever.
 */

/**
 * Altura do espaço de assinar, em pontos (~10 mm).
 *
 * Medida de assinatura à mão: menos que isso e a pessoa escreve por cima do
 * traço; muito mais e o bloco empurra o rodapé para outra página sem motivo.
 */
export const ESPACO_PARA_ASSINAR = 28;

/** Respiro entre o traço e o nome impresso logo abaixo dele. */
const RESPIRO_APOS_A_LINHA = 4;

export interface MetricasDoBloco {
  /** Corpo do nome. */
  corpo: number;
  /** Corpo do papel, menor. */
  nota: number;
  /** Folga depois do bloco, antes do que vier a seguir. */
  entreBlocos: number;
}

export interface GeometriaDoBloco {
  /** Distância do topo do bloco até o traço. Todo esse espaço é de assinar. */
  topoDaLinha: number;
  topoDoNome: number;
  topoDoPapel: number;
  /** Altura total, incluindo a folga para o bloco seguinte. */
  altura: number;
}

export function geometriaDoBloco(m: MetricasDoBloco): GeometriaDoBloco {
  const topoDaLinha = ESPACO_PARA_ASSINAR;
  const topoDoNome = topoDaLinha + RESPIRO_APOS_A_LINHA;
  const topoDoPapel = topoDoNome + alturaDeLinhas(1, m.corpo);

  return {
    topoDaLinha,
    topoDoNome,
    topoDoPapel,
    // A altura vem do que foi desenhado, e não de um número escolhido à parte:
    // era a folga inventada que deixava o vazio no fim, longe de onde se assina.
    altura: topoDoPapel + alturaDeLinhas(1, m.nota) + m.entreBlocos,
  };
}

/**
 * A âncora deste campo, ou nula quando não há como carimbar com segurança.
 *
 * NOME REPETIDO NÃO GANHA SEGUNDA ÂNCORA
 *
 * Se o instrutor também estiver na lista como participante, a célula dele na
 * tabela já registrou a âncora. Registrar a segunda faria `ancoraDe` devolver
 * nulo para as duas — ela recusa chave ambígua de propósito — e o documento
 * sairia SEM carimbo nenhum, pior do que está hoje.
 *
 * Fica a primeira, que é a da tabela. Não é um desempate por mérito: é a ordem de
 * desenho, e mudá-la é decisão de quem lê o documento, não deste código. Uma
 * assinatura eletrônica é um ato só, e não pode afirmar presença na lista E
 * responsabilidade como instrutor ao mesmo tempo.
 */
export function ancoraDoCampo(params: {
  nome?: string | null;
  /** Chaves já registradas neste documento, na ordem em que foram desenhadas. */
  jaUsadas: readonly string[];
  pagina: number;
  x: number;
  /** Base do retângulo — o próprio traço. `y` cresce para cima no PDF. */
  y: number;
  largura: number;
}): Ancora | null {
  const chave = chaveDoTexto(params.nome ?? "");

  // Campo em branco existe: a turma pode não ter responsável técnico cadastrado.
  // Sem nome não há a quem casar o carimbo.
  if (!chave) return null;

  if (params.jaUsadas.includes(chave)) return null;

  return {
    chave,
    pagina: params.pagina,
    x: params.x,
    y: params.y,
    largura: params.largura,
    altura: ESPACO_PARA_ASSINAR,
  };
}
