import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import { estilosDocumentoSgsst } from "@/lib/sgsstDocumentoEstilos";
import {
  percentualAlterados,
  prevalenciaPor100,
  variacao,
  type ContagemPorChave,
  type RelatorioAnalitico,
  type ResumoAnual,
} from "@/hooks/sgsst/useSgsstRelatorioAnalitico";

/**
 * Emissão do relatório analítico anual do PCMSO — NR-07 item 7.6.
 *
 * As seções seguem a ordem das alíneas do 7.6.2, e o comparativo com o ano
 * anterior é seção própria porque é item obrigatório, não um extra.
 *
 * Um princípio no documento inteiro: exame realizado sem classificação aparece
 * como "não classificado", nunca somado aos normais. O relatório não deve
 * presumir que a ausência de laudo significa ausência de achado.
 */

export interface RelatorioDocumentoDados {
  relatorio: RelatorioAnalitico;
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  /** Coordenador do PCMSO, que assina o relatório. */
  medicoCoordenador?: string | null;
  crmCoordenador?: string | null;
  responsavelSst?: string | null;
  geradoPor?: string | null;
}

function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(v: number): string {
  return v.toLocaleString("pt-BR");
}

function pct(v: number | null, casas = 1): string {
  return v === null ? "—" : `${v.toFixed(casas).replace(".", ",")}%`;
}

/** Seta de tendência. Para indicador de saúde, subir é ruim. */
function tendencia(v: number | null): string {
  if (v === null) return `<span class="doc-neutro">sem base</span>`;
  if (Math.abs(v) < 0.05) return `<span class="doc-neutro">estável</span>`;
  const sobe = v > 0;
  const classe = sobe ? "doc-pior" : "doc-melhor";
  const seta = sobe ? "▲" : "▼";
  return `<span class="${classe}">${seta} ${pct(Math.abs(v))}</span>`;
}

function tabelaContagem(
  itens: ContagemPorChave[],
  rotuloChave: string,
  vazio: string
): string {
  if (itens.length === 0) {
    return `<p class="doc-vazio">${esc(vazio)}</p>`;
  }
  const total = itens.reduce((s, i) => s + i.total, 0);
  return `
    <table class="doc-tabela">
      <thead><tr><th>${esc(rotuloChave)}</th><th class="doc-num">Qtd.</th><th class="doc-num">%</th></tr></thead>
      <tbody>
        ${itens
          .map(
            (i) => `<tr>
              <td>${esc(i.chave)}</td>
              <td class="doc-num">${num(i.total)}</td>
              <td class="doc-num">${total > 0 ? pct((i.total / total) * 100) : "—"}</td>
            </tr>`
          )
          .join("")}
      </tbody>
      <tfoot><tr><td><strong>Total</strong></td><td class="doc-num"><strong>${num(
        total
      )}</strong></td><td class="doc-num">100%</td></tr></tfoot>
    </table>`;
}

function linhaComparativa(rotulo: string, a: number, b: number): string {
  return `<tr>
    <td>${esc(rotulo)}</td>
    <td class="doc-num">${num(a)}</td>
    <td class="doc-num">${num(b)}</td>
    <td class="doc-num">${tendencia(variacao(a, b))}</td>
  </tr>`;
}



function cards(r: ResumoAnual): string {
  const totalExames = r.examesClinicos + r.examesComplementares;
  return `
    <div class="doc-cards">
      <div class="doc-card">
        <div class="rot">Exames realizados</div>
        <div class="val">${num(totalExames)}</div>
        <div class="sub">${num(r.examesClinicos)} clínicos · ${num(
          r.examesComplementares
        )} complementares</div>
      </div>
      <div class="doc-card">
        <div class="rot">Resultados alterados</div>
        <div class="val">${num(r.resultadosAlterados)}</div>
        <div class="sub">${pct(percentualAlterados(r))} dos classificados</div>
      </div>
      <div class="doc-card">
        <div class="rot">CATs emitidas</div>
        <div class="val">${num(r.cats)}</div>
        <div class="sub">${num(r.diasAfastamento)} dia(s) de afastamento</div>
      </div>
      <div class="doc-card">
        <div class="rot">Trabalhadores ativos</div>
        <div class="val">${num(r.trabalhadoresAtivos)}</div>
        <div class="sub">prevalência ${pct(prevalenciaPor100(r))} / 100</div>
      </div>
    </div>`;
}

export function montarHtmlRelatorioAnalitico(dados: RelatorioDocumentoDados): string {
  const { relatorio, empresa, medicoCoordenador, crmCoordenador, responsavelSst, geradoPor } =
    dados;
  const a = relatorio.atual;
  const b = relatorio.anterior;

  const semDados = a.examesClinicos + a.examesComplementares === 0 && a.cats === 0;

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Relatório Analítico do PCMSO</h1>
        <p>NR-07 item 7.6 · Exercício ${a.ano}</p>
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td><td><strong>${esc(empresa?.nome) || "—"}</strong></td>
            <td class="rot">CNPJ</td><td>${esc(empresa?.cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Período</td><td>01/01/${a.ano} a 31/12/${a.ano}</td>
            <td class="rot">Comparado a</td><td>${b.ano}</td>
          </tr>
        </table>
      </div>

      ${
        semDados
          ? `<p class="doc-aviso">⚠ Não há exames realizados nem CATs registradas em ${a.ano}. O relatório sai sem conteúdo estatístico.</p>`
          : ""
      }

      ${
        a.resultadosNaoClassificados > 0
          ? `<p class="doc-aviso">⚠ ${num(
              a.resultadosNaoClassificados
            )} exame(s) realizado(s) sem classificação de resultado. Eles não entram na estatística de achados — o relatório não presume que exame sem laudo é normal.</p>`
          : ""
      }

      ${cards(a)}

      <h2 class="doc-sec">a) Exames clínicos realizados</h2>
      <p>Foram realizadas <strong>${num(
        a.examesClinicos
      )}</strong> avaliações clínicas no exercício de ${a.ano}.</p>

      <h2 class="doc-sec">b) Exames complementares, por tipo</h2>
      ${tabelaContagem(
        a.complementaresPorTipo,
        "Exame complementar",
        "Nenhum exame complementar realizado no período."
      )}

      <h2 class="doc-sec">c) Estatística dos resultados</h2>
      <table class="doc-tabela">
        <thead><tr><th>Classificação</th><th class="doc-num">Qtd.</th></tr></thead>
        <tbody>
          <tr><td>Normal</td><td class="doc-num">${num(a.resultadosNormais)}</td></tr>
          <tr><td>Alterado</td><td class="doc-num">${num(a.resultadosAlterados)}</td></tr>
          <tr><td>Inconclusivo</td><td class="doc-num">${num(a.resultadosInconclusivos)}</td></tr>
          <tr><td>Não classificado</td><td class="doc-num">${num(
            a.resultadosNaoClassificados
          )}</td></tr>
        </tbody>
      </table>
      <p>Alterados representam <strong>${pct(
        percentualAlterados(a)
      )}</strong> dos exames classificados.</p>

      <h2 class="doc-sec">d) Incidência por obra — resultados alterados</h2>
      ${tabelaContagem(
        a.alteradosPorObra,
        "Obra",
        "Nenhum resultado alterado no período."
      )}
      <p>Prevalência de achados alterados: <strong>${pct(
        prevalenciaPor100(a)
      )}</strong> por 100 trabalhadores ativos (${num(a.trabalhadoresAtivos)} ativos).</p>

      <h2 class="doc-sec">ASOs emitidos, por conclusão de aptidão</h2>
      ${tabelaContagem(a.asosPorAptidao, "Conclusão", "Nenhum ASO emitido no período.")}

      <h2 class="doc-sec">e) Comunicações de Acidente de Trabalho</h2>
      ${tabelaContagem(a.catsPorTipo, "Tipo de CAT", "Nenhuma CAT emitida no período.")}
      ${
        a.cats > 0
          ? `<p>Total de <strong>${num(a.diasAfastamento)}</strong> dia(s) de afastamento${
              a.obitos > 0
                ? ` · <strong class="doc-pior">${num(a.obitos)} óbito(s) comunicado(s)</strong>`
                : ""
            }.</p>
             ${tabelaContagem(a.catsPorObra, "Obra do acidente", "")}`
          : ""
      }

      <h2 class="doc-sec">f) Comparação com o exercício anterior</h2>
      <table class="doc-tabela">
        <thead>
          <tr><th>Indicador</th><th class="doc-num">${a.ano}</th><th class="doc-num">${
            b.ano
          }</th><th class="doc-num">Variação</th></tr>
        </thead>
        <tbody>
          ${linhaComparativa("Exames clínicos", a.examesClinicos, b.examesClinicos)}
          ${linhaComparativa(
            "Exames complementares",
            a.examesComplementares,
            b.examesComplementares
          )}
          ${linhaComparativa("Resultados alterados", a.resultadosAlterados, b.resultadosAlterados)}
          ${linhaComparativa("CATs emitidas", a.cats, b.cats)}
          ${linhaComparativa("Dias de afastamento", a.diasAfastamento, b.diasAfastamento)}
          ${linhaComparativa("Óbitos comunicados", a.obitos, b.obitos)}
        </tbody>
      </table>
      <p class="doc-vazio">Em indicadores de saúde, alta é piora: por isso a seta vermelha aponta para cima.</p>

      <div class="doc-assin">
        <div>
          <div class="nome">${esc(medicoCoordenador) || "________________________"}</div>
          <div class="papel">Médico coordenador do PCMSO${
            crmCoordenador ? ` · ${esc(crmCoordenador)}` : ""
          }</div>
        </div>
        <div>
          <div class="nome">${esc(responsavelSst) || "________________________"}</div>
          <div class="papel">Responsável pela SST na organização</div>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(new Date().toLocaleString("pt-BR"))}${
          geradoPor ? ` por ${esc(geradoPor)}` : ""
        } · A NR-07 7.6.5 exige que este relatório seja apresentado e discutido com
        os responsáveis pela SST da organização.
      </div>
    </div>
  `;
}

export async function gerarPdfRelatorioAnalitico(
  dados: RelatorioDocumentoDados
): Promise<void> {
  const nome = `Relatorio_Analitico_PCMSO_${dados.relatorio.atual.ano}.pdf`;

  await emitirPdfTimbrado({
    html: montarHtmlRelatorioAnalitico(dados),
    nomeArquivo: nome,
    identificacao: `Relatório analítico do PCMSO — ${dados.relatorio.atual.ano}`,
  });
}
