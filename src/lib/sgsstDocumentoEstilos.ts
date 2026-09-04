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

    /* NADA de texto pode ser fatiado pela quebra de página.

       O PDF é rasterizado num canvas único e depois cortado em folhas. Sem
       "page-break-inside: avoid" o corte cai no meio da altura de uma linha e a
       frase sai partida ao meio na horizontal — metade no pé de uma página,
       metade no topo da seguinte, ilegível nas duas.

       Só "page-break-inside" resolve: o html2pdf 0.14 lê "pageBreakInside", mas
       IGNORA "avoid" em "page-break-after" — há um TODO explícito na fonte da
       biblioteca ("Add support for 'avoid' on breakBefore/After"). Por isso não
       existe aqui nenhuma regra de "break-after": ela daria a impressão de estar
       resolvendo e não faria nada. */
    .doc p, .doc-aviso, .doc-ident, h2.doc-sec, h3.doc-grupo,
    .doc-bloco, .doc-bloco > .tit, .doc-grid tr,
    table.doc-tabela thead,
    /* Auditados um a um: estes tinham "page-break-inside: auto" e apareceram
       fatiados na varredura da emissão real. O rodapé de rastreabilidade é o pior
       deles — é a linha que diz quem emitiu e quando, e cortada ao meio não serve
       de rastreabilidade nenhuma. As colunas de assinatura dependiam de o pai
       ".doc-assin" ser empurrado; quando ele passa de uma página o html2pdf
       desiste dele (guarda "nPages <= 1" na fonte da biblioteca) e os filhos
       ficavam sem proteção própria. */
    .doc-cab, .doc-rodape,
    .doc-assin > div, .doc-assin .nome, .doc-assin .papel { page-break-inside: avoid; }

    /* Por que .doc-bloco INTEIRO entra na lista.

       A primeira versao protegeu so o titulo e o paragrafo, e deixou o bloco de
       fora por medo de que um bloco com tabela longa fosse empurrado e estourasse
       a folha seguinte. O medo era infundado: a biblioteca so empurra elemento
       "de no maximo uma pagina" (nPages <= 1 na fonte dela), e ignora o que for
       mais alto. Bloco longo continua atravessando paginas como antes.

       E proteger so o titulo nao bastava. Medindo a emissao real, o titulo do
       bloco de Treinamentos caia em 918,3px com a pagina terminando em 949,3px:
       sobrava nos ultimos 7px da folha, e era ali que ele era cortado. Empurrado
       o bloco inteiro, o titulo vai junto e nao encosta na borda.

       O preco e uma folha que pode terminar com espaco em branco. Num documento
       de conformidade e o cambio certo: espaco em branco se explica, cabecalho
       partido ao meio nao. */

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

    /* Caixa de marcação, para os campos que as fichas oficiais trazem como opção
       e não como texto livre: tipo de exame, agentes de risco, validade, aptidão.

       Duas regras que a caixa carrega:

       - Campo que ninguém respondeu sai EM BRANCO, e não ausente. É o que permite
         o médico preencher à mão na folha impressa.
       - A marca é um X em texto, e não uma cor de fundo. O PDF sai do html2canvas
         e é impresso em preto e branco com frequência; marcação que depende de cor
         desaparece na fotocópia. */
    /* A CAIXINHA DE MARCAÇÃO: O "X" É DESENHO, NÃO TEXTO.

       Duas tentativas anteriores usaram um "X" de texto dentro do quadrado, e as
       duas saíram erradas no PDF por motivos diferentes. Medido no raster real,
       contando pixel de tinta dentro e fora do quadrado:

         inline-flex + align-items:center ... o glifo vazava do quadrado
         inline-block + line-height 7px .... tinta DENTRO = 0 (o X desaparecia:
                                             a 7px o rasterizador não desenha)
         inline-block + line-height 8..9px . vazava por BAIXO (118 a 196 px)

       A raiz é a mesma nas três: o PDF é rasterizado pelo html2canvas, que
       posiciona texto por métrica de fonte própria. Num quadrado de 9px, um erro
       de 1px já joga o glifo para fora — e não há valor de line-height que
       acerte, porque o erro não é de layout, é de baseline.

       Então o X deixa de ser texto. Duas camadas de "linear-gradient" a +45° e
       -45° desenham as diagonais como FUNDO, e fundo o html2canvas reproduz
       exatamente: medido, 460 px de tinta dentro do quadrado e ZERO vazando nos
       quatro lados.

       O quadrado não tem mais conteúdo de texto — quem marca é a classe
       "marcada", e o opcao() do ASO emite o span vazio. */
    .doc-marca { display: inline-block;
      width: 9px; height: 9px; box-sizing: border-box; padding: 0;
      border: 1px solid ${CORES_DOC.linhaForte};
      margin-right: 3px; background-color: #fff; vertical-align: middle; }
    .doc-marca.marcada { border-color: ${CORES_DOC.tinta};
      background-image:
        linear-gradient(45deg, transparent 42%, ${CORES_DOC.tinta} 42%, ${CORES_DOC.tinta} 58%, transparent 58%),
        linear-gradient(-45deg, transparent 42%, ${CORES_DOC.tinta} 42%, ${CORES_DOC.tinta} 58%, transparent 58%); }
    /* A opção inteira, caixa mais rótulo, sem quebrar entre as duas. */
    .doc-opcao { display: inline-block; font-size: 9px; color: ${CORES_DOC.texto};
      margin: 0 10px 3px 0; white-space: nowrap; }
    .doc-opcao.marcada { font-weight: 600; color: ${CORES_DOC.tinta}; }
    /* Linha de rótulo da categoria à esquerda e opções à direita. */
    table.doc-opcoes { width: 100%; border-collapse: collapse; }
    table.doc-opcoes td { padding: 3px 0; border-bottom: 1px solid ${CORES_DOC.linha}; }
    table.doc-opcoes td.cat { width: 20%; font-size: 8.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .04em; color: ${CORES_DOC.tinta}; }
    table.doc-opcoes tr:last-child td { border-bottom: 0; }

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

    /* Bloco de assinatura.

       Dois desenhos convivem aqui, e a diferença é qual elemento faz a régua:

       - ASO, PCMSO e relatório analítico usam a BORDA da coluna como régua, com
         nome e papel abaixo dela. É a forma convencional.
       - Os outros documentos trazem a própria régua num <hr>, com o nome acima.

       O segundo grupo ganhava as DUAS linhas — a borda da coluna e o <hr> — e o
       nome ficava prensado entre elas. No PDF, que é rasterizado, a borda de cima
       caía rente às maiúsculas e parecia riscar o nome. */
    .doc-assin { margin-top: 26px; display: flex; gap: 34px; page-break-inside: avoid; }
    .doc-assin > div { flex: 1; border-top: 1px solid ${CORES_DOC.texto}; padding-top: 5px; }

    /* Coluna que traz o próprio <hr>: a borda da coluna sai de cena.

       O seletor antigo era ".doc-assin.doc-assin-centro > div", que exigia as duas
       classes no MESMO elemento — e a classe está no filho. Ele nunca casou, e por
       isso a legenda embaixo da régua nunca ficou centralizada, apesar do nome da
       classe. */
    .doc-assin > div.doc-assin-centro { border-top: 0; padding-top: 0; text-align: center; }

    /* A legenda embaixo da régua precisa da regra explícita: ".doc p" fixa
       "text-align: justify", e regra direta vence alinhamento herdado. Era o
       segundo motivo de a coluna "centro" nunca sair centralizada. */
    .doc-assin > div.doc-assin-centro p { text-align: center; }

    /* Espaço para a caneta caber, e folga entre o nome impresso e a régua.

       Sem a folga o nome encosta na linha — no raster do PDF as maiúsculas e a
       régua viram um borrão só, que é o que parecia riscar o nome. */
    .doc-assin .doc-centro-txt { min-height: 30px; display: flex;
      align-items: flex-end; justify-content: center; padding-bottom: 6px; }

    /* A régua. Sem isto vale o padrão do navegador — 2px em relevo, que não
       combina com nenhuma outra linha do documento. */
    .doc-assin hr { border: 0; border-top: 1px solid ${CORES_DOC.texto}; margin: 0 0 4px; }

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
