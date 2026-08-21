import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";

/**
 * Emissão dos relatórios gerenciais do SGSST.
 *
 * A tela de Relatórios tinha um botão "Imprimir / PDF" que chamava
 * `window.print()`: saía a página do navegador — menu, filtros, cores de tela —
 * sem papel timbrado, sem identificação de quem gerou e sem registro do filtro
 * aplicado. Documento assim não se apresenta a cliente nem a fiscal.
 *
 * Agora é emissão de verdade: mesmo papel timbrado dos outros documentos do
 * SGSST, com o cabeçalho declarando o recorte — tipo, obra, período — porque um
 * relatório sem o filtro impresso não é conferível: quem recebe não sabe se está
 * vendo tudo ou um pedaço.
 *
 * O documento é genérico de propósito. Os nove relatórios da tela são todos
 * tabelas de colunas variáveis, e cada um ganhar uma função própria multiplicaria
 * a mesma tabela por nove.
 */

/** Uma linha é um mapa de coluna → valor, como a tela já monta. */
export type LinhaRelatorio = Record<string, unknown>;

export interface RelatorioGerencialDados {
  /** Nome do relatório, como o usuário o vê na tela. */
  titulo: string;
  /** Sigla do tipo, para o nome do arquivo. */
  tipo: string;
  linhas: readonly LinhaRelatorio[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  /** Recorte aplicado, na ordem em que a tela oferece os filtros. */
  filtros: {
    projeto?: string | null;
    dataInicial?: string | null;
    dataFinal?: string | null;
  };
  geradoPor?: string | null;
  /**
   * Aviso sobre o que o relatório conta. Alguns contam o registro filho e não o
   * pai — o de treinamentos lista matrículas, então curso sem aluno inscrito não
   * aparece. Sem dizer isso, a ausência parece perda de dado.
   */
  aviso?: string | null;
  /**
   * Verdadeiro quando a consulta bateu no limite e a lista pode estar cortada.
   * Relatório truncado em silêncio é pior que relatório recusado.
   */
  truncado?: boolean;
}

/** Colunas na ordem da primeira linha — é a ordem que a tela já mostra. */
function colunasDe(linhas: readonly LinhaRelatorio[]): string[] {
  if (linhas.length === 0) return [];
  return Object.keys(linhas[0]);
}

/**
 * Datas ISO viram formato brasileiro; o resto sai como está.
 *
 * A tela monta as linhas com o valor cru do banco, então a coluna "Data Emissão"
 * chega como "2026-03-11". Num documento impresso isso lê errado.
 */
function valorDaCelula(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return dataBr(texto);
  return esc(texto);
}

function textoDoPeriodo(filtros: RelatorioGerencialDados["filtros"]): string {
  const { dataInicial, dataFinal } = filtros;
  if (dataInicial && dataFinal) return `${dataBr(dataInicial)} a ${dataBr(dataFinal)}`;
  if (dataInicial) return `a partir de ${dataBr(dataInicial)}`;
  if (dataFinal) return `até ${dataBr(dataFinal)}`;
  return "todo o período";
}

export function montarHtmlRelatorioGerencial(dados: RelatorioGerencialDados): string {
  const { titulo, linhas, empresa, filtros, geradoPor, aviso, truncado } = dados;
  const colunas = colunasDe(linhas);
  const emitidoEm = new Date().toLocaleString("pt-BR");

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>${esc(titulo)}</h1>
        <p class="doc-sub">Relatório gerencial do SGSST</p>
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(empresa?.nome) || "—"}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(empresa?.cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Obra / projeto</td>
            <td>${esc(filtros.projeto) || "Todas as obras"}</td>
            <td class="rot">Período</td>
            <td>${textoDoPeriodo(filtros)}</td>
          </tr>
          <tr>
            <td class="rot">Registros</td>
            <td>${linhas.length}</td>
            <td class="rot">Emitido em</td>
            <td>${esc(emitidoEm)}</td>
          </tr>
        </table>
      </div>

      ${
        aviso
          ? `<p class="doc-aviso">${esc(aviso)}</p>`
          : ""
      }

      ${
        truncado
          ? `<p class="doc-aviso"><strong>Lista possivelmente incompleta.</strong>
              A consulta atingiu o limite de linhas do relatório. Reduza o período ou
              filtre por obra para conferir o conjunto inteiro.</p>`
          : ""
      }

      ${
        linhas.length === 0
          ? `<p class="doc-aviso">Nenhum registro no recorte selecionado. O relatório é
              emitido assim mesmo: ausência conferida é informação, e a folha comprova
              qual filtro foi aplicado.</p>`
          : `<table class="doc-tabela">
              <thead>
                <tr>${colunas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${linhas
                  .map(
                    (linha) =>
                      `<tr>${colunas
                        .map((c) => `<td>${valorDaCelula(linha[c])}</td>`)
                        .join("")}</tr>`
                  )
                  .join("")}
              </tbody>
             </table>`
      }

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Relatório gerencial do SGSST — documento de gestão interna
      </div>
    </div>
  `;
}

export async function gerarPdfRelatorioGerencial(
  dados: RelatorioGerencialDados
): Promise<void> {
  const marca = new Date().toISOString().slice(0, 10);

  await emitirPdfTimbrado({
    html: montarHtmlRelatorioGerencial(dados),
    nomeArquivo: `Relatorio_SGSST_${dados.tipo}_${marca}.pdf`,
    identificacao: `${dados.titulo} — ${dados.linhas.length} registro(s)`.slice(0, 88),
  });
}
