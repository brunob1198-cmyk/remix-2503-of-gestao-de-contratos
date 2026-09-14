/**
 * Onde cada pedaço do documento cai, folha a folha.
 *
 * O QUE ISTO SUBSTITUI
 *
 * No caminho antigo a paginação era do `html2pdf`, e ela funcionava assim: medir
 * onde a quebra cairia e **inserir uma div de enchimento** empurrando o elemento
 * inteiro para a folha seguinte. Esse enchimento é, literalmente, o espaço em
 * branco de que o usuário reclamava — uma tabela que começasse na metade da folha
 * deixava a metade de cima vazia.
 *
 * E o cabeçalho da tabela não se repetia na página seguinte, porque para o
 * html2pdf não havia tabela nenhuma: havia uma foto da folha, fatiada.
 *
 * Aqui a conta é nossa. O documento vira uma fila de FATIAS medidas, e a fila é
 * distribuída pelas folhas. Tabela grande simplesmente continua na folha
 * seguinte, com o cabeçalho repetido — sem sobrar branco atrás.
 *
 * Este módulo não sabe desenhar nada, e é de propósito: a regra de quebra é onde
 * mora o defeito visível, e ela precisa ser verificável sem gerar PDF.
 */

export interface Fatia {
  /** Altura ocupada, na mesma unidade da área útil (pontos). */
  altura: number;
  /**
   * Não pode ser a última coisa da folha.
   *
   * É o caso do título de seção: título sozinho no pé da página, com o conteúdo
   * na folha seguinte, é o defeito clássico de documento gerado — e o leitor
   * vira a página achando que a seção está vazia.
   */
  prendeAProxima?: boolean;
  /**
   * Nome do grupo a que a fatia pertence. Fatias do mesmo grupo compartilham o
   * cabeçalho repetido. Hoje, o grupo é uma tabela.
   */
  grupo?: string;
  /** Esta fatia é o cabeçalho do grupo, e reaparece no topo de cada folha nova. */
  cabecalhoDoGrupo?: boolean;
}

export interface FatiaPosicionada {
  /** Índice na lista original. Cabeçalho repetido aponta para o mesmo índice. */
  indice: number;
  /** Página, começando em 0. */
  pagina: number;
  /** Distância do topo da área útil. */
  topo: number;
  /** Verdadeiro quando é a reaparição do cabeçalho numa folha seguinte. */
  repetida: boolean;
}

/**
 * Distribui as fatias pelas folhas.
 *
 * Uma fatia mais alta que a folha inteira — foto grande, parágrafo enorme — é
 * colocada assim mesmo, no topo de uma folha nova. Ela vai transbordar, e isso é
 * visível; o alternativo seria um laço que nunca termina.
 */
export function paginarFatias(params: {
  fatias: readonly Fatia[];
  alturaUtil: number;
}): FatiaPosicionada[] {
  const { fatias, alturaUtil } = params;
  const posicoes: FatiaPosicionada[] = [];

  if (fatias.length === 0 || !(alturaUtil > 0)) return posicoes;

  let pagina = 0;
  let topo = 0;
  let cabecalho: { indice: number; fatia: Fatia } | null = null;

  const novaPagina = () => {
    pagina += 1;
    topo = 0;
  };

  for (let i = 0; i < fatias.length; i++) {
    const fatia = fatias[i];

    // Saiu do grupo: o cabeçalho anterior deixa de valer. Sem isto, uma tabela
    // seguinte herdaria o cabeçalho da tabela anterior.
    if (cabecalho && fatia.grupo !== cabecalho.fatia.grupo) {
      cabecalho = null;
    }

    // Quanto de folha esta fatia exige, contando o que ela prende junto.
    const proxima = fatias[i + 1];
    const exigencia =
      fatia.altura + (fatia.prendeAProxima && proxima ? proxima.altura : 0);

    // `topo > 0` impede a folha em branco: se a fatia não cabe nem numa folha
    // vazia, abrir outra folha não resolveria e só produziria uma página vazia.
    if (topo > 0 && topo + exigencia > alturaUtil) {
      novaPagina();

      // Continuação de tabela: o cabeçalho reaparece antes da primeira linha.
      if (cabecalho && fatia.grupo === cabecalho.fatia.grupo) {
        posicoes.push({ indice: cabecalho.indice, pagina, topo, repetida: true });
        topo += cabecalho.fatia.altura;
      }
    }

    posicoes.push({ indice: i, pagina, topo, repetida: false });
    topo += fatia.altura;

    if (fatia.cabecalhoDoGrupo && fatia.grupo) {
      cabecalho = { indice: i, fatia };
    }
  }

  return posicoes;
}

/** Quantas folhas o documento ocupou. */
export function totalDePaginas(posicoes: readonly FatiaPosicionada[]): number {
  if (posicoes.length === 0) return 1;
  return Math.max(...posicoes.map((p) => p.pagina)) + 1;
}
