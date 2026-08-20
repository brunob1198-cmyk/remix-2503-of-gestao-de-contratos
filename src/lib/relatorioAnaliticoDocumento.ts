import { pdfGlobalStyles, getPdfOptions } from "@/lib/pdfTemplates";
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
  if (v === null) return `<span class="ra-neutro">sem base</span>`;
  if (Math.abs(v) < 0.05) return `<span class="ra-neutro">estável</span>`;
  const sobe = v > 0;
  const classe = sobe ? "ra-pior" : "ra-melhor";
  const seta = sobe ? "▲" : "▼";
  return `<span class="${classe}">${seta} ${pct(Math.abs(v))}</span>`;
}

function tabelaContagem(
  itens: ContagemPorChave[],
  rotuloChave: string,
  vazio: string
): string {
  if (itens.length === 0) {
    return `<p class="ra-vazio">${esc(vazio)}</p>`;
  }
  const total = itens.reduce((s, i) => s + i.total, 0);
  return `
    <table class="ra-tabela">
      <thead><tr><th>${esc(rotuloChave)}</th><th class="ra-num">Qtd.</th><th class="ra-num">%</th></tr></thead>
      <tbody>
        ${itens
          .map(
            (i) => `<tr>
              <td>${esc(i.chave)}</td>
              <td class="ra-num">${num(i.total)}</td>
              <td class="ra-num">${total > 0 ? pct((i.total / total) * 100) : "—"}</td>
            </tr>`
          )
          .join("")}
      </tbody>
      <tfoot><tr><td><strong>Total</strong></td><td class="ra-num"><strong>${num(
        total
      )}</strong></td><td class="ra-num">100%</td></tr></tfoot>
    </table>`;
}

function linhaComparativa(rotulo: string, a: number, b: number): string {
  return `<tr>
    <td>${esc(rotulo)}</td>
    <td class="ra-num">${num(a)}</td>
    <td class="ra-num">${num(b)}</td>
    <td class="ra-num">${tendencia(variacao(a, b))}</td>
  </tr>`;
}

const ESTILOS_RA = `
  <style>
    .ra-doc { padding: 18px 26px; }
    .ra-cab { border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
    .ra-cab h1 { font-size: 16px; color: #1e3a5f; margin: 0 0 3px; text-transform: uppercase; }
    .ra-cab p { font-size: 10px; color: #64748b; margin: 0; }
    .ra-ident { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1e3a5f;
      border-radius: 4px; padding: 9px 13px; margin-bottom: 16px; }
    .ra-ident table { width: 100%; border-collapse: collapse; }
    .ra-ident td { font-size: 10.5px; color: #334155; padding: 2px 0; }
    .ra-ident td.rot { color: #64748b; width: 22%; }
    h2.ra-sec { font-size: 11.5px; color: #1e3a5f; text-transform: uppercase; letter-spacing: .04em;
      border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 16px 0 8px; }
    .ra-doc p { font-size: 10.5px; color: #334155; margin: 0 0 6px; }
    .ra-vazio { color: #64748b !important; font-style: italic; font-size: 10px !important; }
    .ra-cards { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .ra-card { flex: 1 1 22%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 9px; }
    .ra-card .rot { font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
    .ra-card .val { font-size: 17px; font-weight: 700; color: #1e3a5f; }
    .ra-card .sub { font-size: 8.5px; color: #94a3b8; }
    table.ra-tabela { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.ra-tabela th { background: #1e3a5f; color: #fff; font-size: 8.5px; text-transform: uppercase;
      letter-spacing: .03em; padding: 5px 6px; text-align: left; }
    table.ra-tabela td { font-size: 9.5px; color: #334155; padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
    table.ra-tabela tfoot td { border-top: 1px solid #94a3b8; border-bottom: 0; background: #f8fafc; }
    .ra-num { text-align: right; font-variant-numeric: tabular-nums; }
    .ra-alerta { background: #fef3c7; border-left: 3px solid #d97706; padding: 6px 9px;
      color: #92400e !important; font-size: 10px !important; border-radius: 2px; margin-bottom: 8px; }
    .ra-pior { color: #b91c1c; font-weight: 600; }
    .ra-melhor { color: #15803d; font-weight: 600; }
    .ra-neutro { color: #94a3b8; }
    .ra-assin { margin-top: 26px; display: flex; gap: 36px; page-break-inside: avoid; }
    .ra-assin > div { flex: 1; border-top: 1px solid #334155; padding-top: 5px; }
    .ra-assin .nome { font-size: 10.5px; font-weight: 600; color: #1e3a5f; }
    .ra-assin .papel { font-size: 8.5px; color: #64748b; }
    .ra-rodape { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 5px;
      font-size: 8px; color: #94a3b8; }
  </style>
`;

function cards(r: ResumoAnual): string {
  const totalExames = r.examesClinicos + r.examesComplementares;
  return `
    <div class="ra-cards">
      <div class="ra-card">
        <div class="rot">Exames realizados</div>
        <div class="val">${num(totalExames)}</div>
        <div class="sub">${num(r.examesClinicos)} clínicos · ${num(
          r.examesComplementares
        )} complementares</div>
      </div>
      <div class="ra-card">
        <div class="rot">Resultados alterados</div>
        <div class="val">${num(r.resultadosAlterados)}</div>
        <div class="sub">${pct(percentualAlterados(r))} dos classificados</div>
      </div>
      <div class="ra-card">
        <div class="rot">CATs emitidas</div>
        <div class="val">${num(r.cats)}</div>
        <div class="sub">${num(r.diasAfastamento)} dia(s) de afastamento</div>
      </div>
      <div class="ra-card">
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
    ${ESTILOS_RA}
    <div class="ra-doc">

      <div class="ra-cab">
        <h1>Relatório Analítico do PCMSO</h1>
        <p>NR-07 item 7.6 · Exercício ${a.ano}</p>
      </div>

      <div class="ra-ident">
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
          ? `<p class="ra-alerta">⚠ Não há exames realizados nem CATs registradas em ${a.ano}. O relatório sai sem conteúdo estatístico.</p>`
          : ""
      }

      ${
        a.resultadosNaoClassificados > 0
          ? `<p class="ra-alerta">⚠ ${num(
              a.resultadosNaoClassificados
            )} exame(s) realizado(s) sem classificação de resultado. Eles não entram na estatística de achados — o relatório não presume que exame sem laudo é normal.</p>`
          : ""
      }

      ${cards(a)}

      <h2 class="ra-sec">a) Exames clínicos realizados</h2>
      <p>Foram realizadas <strong>${num(
        a.examesClinicos
      )}</strong> avaliações clínicas no exercício de ${a.ano}.</p>

      <h2 class="ra-sec">b) Exames complementares, por tipo</h2>
      ${tabelaContagem(
        a.complementaresPorTipo,
        "Exame complementar",
        "Nenhum exame complementar realizado no período."
      )}

      <h2 class="ra-sec">c) Estatística dos resultados</h2>
      <table class="ra-tabela">
        <thead><tr><th>Classificação</th><th class="ra-num">Qtd.</th></tr></thead>
        <tbody>
          <tr><td>Normal</td><td class="ra-num">${num(a.resultadosNormais)}</td></tr>
          <tr><td>Alterado</td><td class="ra-num">${num(a.resultadosAlterados)}</td></tr>
          <tr><td>Inconclusivo</td><td class="ra-num">${num(a.resultadosInconclusivos)}</td></tr>
          <tr><td>Não classificado</td><td class="ra-num">${num(
            a.resultadosNaoClassificados
          )}</td></tr>
        </tbody>
      </table>
      <p>Alterados representam <strong>${pct(
        percentualAlterados(a)
      )}</strong> dos exames classificados.</p>

      <h2 class="ra-sec">d) Incidência por setor — resultados alterados</h2>
      ${tabelaContagem(
        a.alteradosPorSetor,
        "Setor",
        "Nenhum resultado alterado no período."
      )}
      <p>Prevalência de achados alterados: <strong>${pct(
        prevalenciaPor100(a)
      )}</strong> por 100 trabalhadores ativos (${num(a.trabalhadoresAtivos)} ativos).</p>

      <h2 class="ra-sec">ASOs emitidos, por conclusão de aptidão</h2>
      ${tabelaContagem(a.asosPorAptidao, "Conclusão", "Nenhum ASO emitido no período.")}

      <h2 class="ra-sec">e) Comunicações de Acidente de Trabalho</h2>
      ${tabelaContagem(a.catsPorTipo, "Tipo de CAT", "Nenhuma CAT emitida no período.")}
      ${
        a.cats > 0
          ? `<p>Total de <strong>${num(a.diasAfastamento)}</strong> dia(s) de afastamento${
              a.obitos > 0
                ? ` · <strong class="ra-pior">${num(a.obitos)} óbito(s) comunicado(s)</strong>`
                : ""
            }.</p>
             ${tabelaContagem(a.catsPorSetor, "Setor do acidente", "")}`
          : ""
      }

      <h2 class="ra-sec">f) Comparação com o exercício anterior</h2>
      <table class="ra-tabela">
        <thead>
          <tr><th>Indicador</th><th class="ra-num">${a.ano}</th><th class="ra-num">${
            b.ano
          }</th><th class="ra-num">Variação</th></tr>
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
      <p class="ra-vazio">Em indicadores de saúde, alta é piora: por isso a seta vermelha aponta para cima.</p>

      <div class="ra-assin">
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

      <div class="ra-rodape">
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
  // Import dinâmico: html2pdf carrega html2canvas e jspdf, e só a emissão precisa.
  const { default: html2pdf } = await import("html2pdf.js");

  const container = document.createElement("div");
  container.innerHTML = montarHtmlRelatorioAnalitico(dados);

  const nome = `Relatorio_Analitico_PCMSO_${dados.relatorio.atual.ano}.pdf`;
  await html2pdf().set(getPdfOptions(nome)).from(container).save();
}
