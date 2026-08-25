/**
 * Estilos compartilhados dos documentos SGSST (PCMSO, ASO, relatório analítico).
 *
 * Existe por dois motivos:
 *
 * 1. Os três documentos são da mesma família e devem parecer da mesma família.
 *    Antes cada gerador tinha seu próprio bloco de CSS, e eles já estavam
 *    divergindo.
 *
 * 2. Correção de contraste. A primeira versão usava faixas de azul-marinho
 *    sólido (#1e3a5f) nos cabeçalhos de tabela com texto branco. Na tela fica
 *    aceitável, mas o PDF é gerado por html2canvas — a área chapada escura sai
 *    saturada, pesa na impressão e come tinta. A regra aqui é a inversa: fundo
 *    claro com tinta escura, e o traço fino fazendo a separação. A cor forte fica
 *    reservada para detalhes pequenos: o filete da barra de identificação e o
 *    valor da conclusão de aptidão.
 */

export const CORES_DOC = {
  /** Tinta principal dos títulos. Escura, mas aplicada em texto, não em área. */
  tinta: "#1e3a5f",
  texto: "#334155",
  textoFraco: "#64748b",
  textoMuitoFraco: "#94a3b8",
  linha: "#e2e8f0",
  linhaForte: "#cbd5e1",
  fundoSuave: "#f8fafc",
  fundoCabecalho: "#eef2f7",
  /** Pendência: âmbar de baixa saturação, legível sem gritar. */
  avisoFundo: "#fdf6e3",
  avisoBorda: "#d9a441",
  avisoTexto: "#8a6413",
  ok: "#15803d",
  atencao: "#b45309",
  critico: "#b91c1c",
} as const;

/**
 * Base comum: tipografia, barra de identificação, títulos de seção, tabelas,
 * blocos de aviso, assinaturas e rodapé.
 *
 * As classes usam o prefixo `doc-` para os três documentos compartilharem a
 * mesma marcação.
 */
export const estilosDocumentoSgsst = `
  <style>
    .doc { padding: 18px 26px; color: ${CORES_DOC.texto}; }

    /* Cabeçalho: separação por traço fino, sem faixa chapada. */
    .doc-cab { border-bottom: 1px solid ${CORES_DOC.linhaForte}; padding-bottom: 10px; margin-bottom: 16px; }
    .doc-cab h1 { font-size: 16px; color: ${CORES_DOC.tinta}; margin: 0 0 3px;
      text-transform: uppercase; letter-spacing: .01em; font-weight: 700; }
    .doc-cab .doc-sub { font-size: 10px; color: ${CORES_DOC.textoFraco}; margin: 0; }
    .doc-cab.doc-centro { text-align: center; }

    /* Barra de identificação: aqui a cor forte aparece, mas só como filete. */
    .doc-ident { background: ${CORES_DOC.fundoSuave}; border: 1px solid ${CORES_DOC.linha};
      border-left: 3px solid ${CORES_DOC.tinta}; border-radius: 3px;
      padding: 9px 13px; margin-bottom: 16px; }
    .doc-ident table { width: 100%; border-collapse: collapse; }
    .doc-ident td { font-size: 10.5px; color: ${CORES_DOC.texto}; padding: 2px 0; vertical-align: middle; }
    .doc-ident td.rot { color: ${CORES_DOC.textoFraco}; width: 22%; }

    h2.doc-sec { font-size: 11.5px; color: ${CORES_DOC.tinta}; text-transform: uppercase;
      letter-spacing: .04em; border-bottom: 1px solid ${CORES_DOC.linhaForte};
      padding-bottom: 4px; margin: 16px 0 8px; font-weight: 700; }
    h3.doc-grupo { font-size: 11px; color: ${CORES_DOC.texto}; margin: 12px 0 5px; font-weight: 600; }

    .doc p { font-size: 10.5px; color: ${CORES_DOC.texto}; margin: 0 0 6px; text-align: justify; }
    .doc-vazio { color: ${CORES_DOC.textoFraco} !important; font-style: italic; font-size: 10px !important; }
    .doc-falta { color: ${CORES_DOC.atencao}; font-style: italic; }

    /* Aviso de pendência: âmbar suave, filete à esquerda. */
    .doc-aviso { background: ${CORES_DOC.avisoFundo}; border-left: 3px solid ${CORES_DOC.avisoBorda};
      padding: 6px 9px; color: ${CORES_DOC.avisoTexto} !important; font-size: 10px !important;
      border-radius: 2px; margin-bottom: 8px; }

    /* Blocos em caixa, usados pelo ASO. */
    .doc-bloco { border: 1px solid ${CORES_DOC.linha}; border-radius: 3px; margin-bottom: 11px; }
    .doc-bloco > .tit { background: ${CORES_DOC.fundoCabecalho}; font-size: 8.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .05em; color: ${CORES_DOC.tinta};
      padding: 5px 10px; border-bottom: 1px solid ${CORES_DOC.linha}; }
    .doc-bloco > .corpo { padding: 9px 10px; }
    .doc-grid { width: 100%; border-collapse: collapse; }
    .doc-grid td { font-size: 10.5px; color: ${CORES_DOC.texto}; padding: 3px 0; vertical-align: middle; }
    .doc-grid td.rot { color: ${CORES_DOC.textoFraco}; width: 22%; }

    /* Tabelas: cabeçalho em fundo claro com tinta escura.

       As células são alinhadas no MEIO, e não no topo. Numa fileira em que uma
       célula quebra em três linhas — descrição de risco, endereço completo,
       medida de controle — o alinhamento no topo joga as vizinhas curtas para
       cima e a fileira deixa de ser lida como uma fileira. No meio, o olho
       percorre a linha reta. */
    table.doc-tabela { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.doc-tabela th { background: ${CORES_DOC.fundoCabecalho}; color: ${CORES_DOC.tinta};
      font-size: 8.5px; text-transform: uppercase; letter-spacing: .03em; font-weight: 700;
      padding: 5px 6px; text-align: left; border-bottom: 1px solid ${CORES_DOC.linhaForte}; }
    table.doc-tabela td { font-size: 9.5px; color: ${CORES_DOC.texto}; padding: 5px 6px;
      border-bottom: 1px solid ${CORES_DOC.linha}; vertical-align: middle; }
    table.doc-tabela tr { page-break-inside: avoid; }
    table.doc-tabela tfoot td { border-top: 1px solid ${CORES_DOC.linhaForte}; border-bottom: 0;
      background: ${CORES_DOC.fundoSuave}; }
    .doc-num { text-align: right; font-variant-numeric: tabular-nums; }
    /* Célula de assinatura dentro de tabela: a PT precisa de uma linha por pessoa
       da equipe, e não de um par de blocos no pé da folha. */
    table.doc-tabela td.doc-assin-linha { width: 30%; height: 22px;
      border-bottom: 1px solid ${CORES_DOC.texto}; }
    .doc-centro-txt { text-align: center; }

    /* Indicadores em cartão, usados pelo relatório. */
    .doc-cards { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .doc-card { flex: 1 1 22%; border: 1px solid ${CORES_DOC.linha};
      border-radius: 3px; padding: 7px 9px; background: ${CORES_DOC.fundoSuave}; }
    .doc-card .rot { font-size: 8px; text-transform: uppercase; letter-spacing: .05em;
      color: ${CORES_DOC.textoFraco}; }
    .doc-card .val { font-size: 17px; font-weight: 700; color: ${CORES_DOC.tinta}; }
    .doc-card .sub { font-size: 8.5px; color: ${CORES_DOC.textoMuitoFraco}; }

    /* Conclusão de aptidão do ASO: 1px de borda; o peso vem do tamanho da letra. */
    .doc-conclusao { text-align: center; padding: 11px; border: 1px solid ${CORES_DOC.linhaForte};
      border-radius: 3px; margin-bottom: 11px; background: ${CORES_DOC.fundoSuave}; }
    .doc-conclusao .rot { font-size: 8.5px; text-transform: uppercase; letter-spacing: .06em;
      color: ${CORES_DOC.textoFraco}; }
    .doc-conclusao .valor { font-size: 19px; font-weight: 700; letter-spacing: .02em; margin-top: 2px; }

    .doc-apto { color: ${CORES_DOC.ok}; }
    .doc-restr { color: ${CORES_DOC.atencao}; }
    .doc-inapto { color: ${CORES_DOC.critico}; }
    .doc-pior { color: ${CORES_DOC.critico}; font-weight: 600; }
    .doc-melhor { color: ${CORES_DOC.ok}; font-weight: 600; }
    .doc-neutro { color: ${CORES_DOC.textoMuitoFraco}; }

    .doc-assin { margin-top: 26px; display: flex; gap: 34px; page-break-inside: avoid; }
    .doc-assin > div { flex: 1; border-top: 1px solid ${CORES_DOC.texto}; padding-top: 5px; }
    .doc-assin.doc-assin-centro > div { text-align: center; }
    .doc-assin .nome { font-size: 10.5px; font-weight: 600; color: ${CORES_DOC.tinta}; }
    .doc-assin .papel { font-size: 8.5px; color: ${CORES_DOC.textoFraco}; }

    .doc-rodape { margin-top: 18px; border-top: 1px solid ${CORES_DOC.linha}; padding-top: 5px;
      font-size: 8px; color: ${CORES_DOC.textoMuitoFraco}; }
    .doc-rodape.doc-centro { text-align: center; }
  </style>
`;

/** Escapa texto vindo do banco antes de entrar no HTML do documento. */
export function escDoc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Data ISO para dd/mm/aaaa, sem depender de fuso. */
export function dataBrDoc(iso?: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}
