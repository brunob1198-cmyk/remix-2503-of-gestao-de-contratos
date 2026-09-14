/**
 * Quebra de texto para o desenho direto em PDF.
 *
 * No caminho antigo quem quebrava linha era o navegador. Desenhando o PDF direto,
 * a conta passa a ser nossa: o `drawText` do pdf-lib escreve a string onde mandam,
 * e texto mais largo que a coluna simplesmente vaza por cima do que estiver ao
 * lado — sem aviso nenhum.
 *
 * A medição vem de fora (`medir`) porque a largura real depende da fonte
 * embutida. Aqui só entra a regra de onde cortar.
 */

export interface OpcoesDeQuebra {
  texto: string;
  larguraMaxima: number;
  corpo: number;
  medir: (texto: string, corpo: number) => number;
}

/**
 * O texto dividido em linhas que cabem na largura.
 *
 * Quebra nos espaços. Palavra que sozinha não cabe — um e-mail longo, um código
 * sem espaço — é partida no meio: deixá-la vazar seria escrever por cima da
 * coluna vizinha, que é pior que uma palavra partida.
 *
 * `\n` do texto de origem é respeitado como quebra obrigatória.
 */
export function quebrarTexto(opcoes: OpcoesDeQuebra): string[] {
  const { larguraMaxima, corpo, medir } = opcoes;
  const texto = opcoes.texto ?? "";

  if (!texto) return [""];
  if (!(larguraMaxima > 0)) return [texto];

  const linhas: string[] = [];

  for (const paragrafo of texto.split("\n")) {
    const palavras = paragrafo.split(/\s+/).filter((p) => p.length > 0);

    if (palavras.length === 0) {
      linhas.push("");
      continue;
    }

    let atual = "";

    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;

      if (medir(tentativa, corpo) <= larguraMaxima) {
        atual = tentativa;
        continue;
      }

      if (atual) {
        linhas.push(atual);
        atual = "";
      }

      // A palavra sozinha cabe? Então ela começa a próxima linha.
      if (medir(palavra, corpo) <= larguraMaxima) {
        atual = palavra;
        continue;
      }

      // Não cabe nem sozinha: parte em pedaços do tamanho da linha.
      const pedacos = partirPalavra(palavra, larguraMaxima, corpo, medir);
      linhas.push(...pedacos.slice(0, -1));
      atual = pedacos[pedacos.length - 1] ?? "";
    }

    linhas.push(atual);
  }

  return linhas;
}

/** Parte uma palavra que não cabe na linha, caractere a caractere. */
function partirPalavra(
  palavra: string,
  larguraMaxima: number,
  corpo: number,
  medir: (texto: string, corpo: number) => number
): string[] {
  const pedacos: string[] = [];
  let atual = "";

  for (const caractere of palavra) {
    const tentativa = atual + caractere;
    if (atual && medir(tentativa, corpo) > larguraMaxima) {
      pedacos.push(atual);
      atual = caractere;
    } else {
      atual = tentativa;
    }
  }

  if (atual) pedacos.push(atual);
  // Largura tão pequena que nem um caractere cabe: devolve a palavra inteira em
  // vez de laço infinito ou lista vazia. Vai vazar, e é o menos ruim.
  return pedacos.length > 0 ? pedacos : [palavra];
}

/**
 * O texto cortado no que couber em UMA linha, com reticências.
 *
 * Para célula de tabela, onde quebrar em duas linhas desalinharia a linha inteira.
 * Cortar seco produziria "Montador de Estrutur", que parece defeito de sistema;
 * as reticências dizem que há mais texto.
 */
export function truncarEmUmaLinha(opcoes: OpcoesDeQuebra): string {
  const { larguraMaxima, corpo, medir } = opcoes;
  const texto = (opcoes.texto ?? "").replace(/\s+/g, " ").trim();

  if (!texto || !(larguraMaxima > 0)) return texto;
  if (medir(texto, corpo) <= larguraMaxima) return texto;

  const reticencias = "…";
  let corte = texto;

  while (corte.length > 1 && medir(corte + reticencias, corpo) > larguraMaxima) {
    corte = corte.slice(0, -1);
  }

  return corte.trimEnd() + reticencias;
}

/**
 * Altura de um bloco de linhas.
 *
 * Entrelinha em 1,35 do corpo: é o respiro dos documentos atuais e o que mantém
 * texto acentuado sem encostar na linha de cima — "ÇÃO" em caixa alta sobe mais
 * que a altura nominal da fonte.
 */
export const ENTRELINHA = 1.35;

export function alturaDeLinhas(quantidade: number, corpo: number): number {
  return Math.max(0, quantidade) * corpo * ENTRELINHA;
}
