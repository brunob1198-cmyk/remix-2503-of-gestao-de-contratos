import { describe, it, expect } from "vitest";
import { estilosDocumentoSgsst, CORES_DOC } from "@/lib/sgsstDocumentoEstilos";
import { estilosFotosDocumento } from "@/lib/fotosDoDocumento";

/**
 * A folha do documento é o produto: é ela que vai para o cliente, para a
 * seguradora e para o arquivo. Estes testes travam as decisões de diagramação que
 * já custaram uma correção depois de o usuário ver o PDF.
 */

describe("alinhamento vertical das células", () => {
  it("as células são alinhadas no meio, não no topo", () => {
    // Numa fileira em que uma célula quebra em três linhas — descrição de risco,
    // endereço completo, medida de controle — o alinhamento no topo joga as
    // vizinhas curtas para cima e a fileira deixa de ser lida como fileira.
    expect(estilosDocumentoSgsst).not.toContain("vertical-align: top");
    expect(estilosDocumentoSgsst).not.toContain("vertical-align: bottom");
  });

  it("as três famílias de tabela do documento usam o mesmo alinhamento", () => {
    // `.doc-ident` (barra de identificação), `.doc-grid` (pares rótulo/valor
    // dentro de bloco) e `.doc-tabela` (listagens). Alinhar duas e esquecer a
    // terceira produziria folha com dois padrões na mesma página.
    //
    // Conta só as regras de CÉLULA: outros elementos podem usar
    // `vertical-align` legitimamente — a caixa de marcação usa, para centrar o X.
    for (const regra of [
      ".doc-ident td",
      ".doc-grid td",
      "table.doc-tabela td",
    ]) {
      const bloco = estilosDocumentoSgsst.slice(
        estilosDocumentoSgsst.indexOf(regra),
        estilosDocumentoSgsst.indexOf("}", estilosDocumentoSgsst.indexOf(regra))
      );
      expect(bloco, regra).toContain("vertical-align: middle");
    }
  });

  it("a célula de assinatura mantém a linha no pé, e não no meio", () => {
    // A linha existe para ser assinada em cima: ela é `border-bottom` da célula e
    // continua no pé mesmo com o texto vizinho centralizado.
    expect(estilosDocumentoSgsst).toContain("td.doc-assin-linha");
    expect(estilosDocumentoSgsst).toContain(`border-bottom: 1px solid ${CORES_DOC.texto}`);
  });
});

describe("quebra de página", () => {
  it("a fileira da tabela não é cortada ao meio pela quebra", () => {
    expect(estilosDocumentoSgsst).toContain("table.doc-tabela tr { page-break-inside: avoid");
  });

  it("o quadro da foto não é cortado ao meio pela quebra", () => {
    // Sem isto o selo cai numa folha e a imagem em outra.
    expect(estilosFotosDocumento).toContain("page-break-inside: avoid");
  });

  it("nenhum texto do documento pode ser fatiado pela quebra", () => {
    // O PDF e rasterizado num canvas unico e depois cortado em folhas. Sem esta
    // regra o corte cai no meio da ALTURA de uma linha e a frase sai partida na
    // horizontal — metade no pe de uma pagina, metade no topo da seguinte.
    // Aconteceu com "Matriculas em turmas do modulo de Treinamentos:" no dossie.
    for (const alvo of [
      ".doc p",
      ".doc-aviso",
      ".doc-ident",
      "h2.doc-sec",
      "h3.doc-grupo",
      ".doc-bloco > .tit",
      "table.doc-tabela thead",
    ]) {
      expect(estilosDocumentoSgsst, alvo).toContain(alvo);
    }

    const regra = estilosDocumentoSgsst.slice(
      estilosDocumentoSgsst.indexOf(".doc p, .doc-aviso"),
      estilosDocumentoSgsst.indexOf("}", estilosDocumentoSgsst.indexOf(".doc p, .doc-aviso"))
    );
    expect(regra).toContain("page-break-inside: avoid");
  });

  it("nao usa page-break-after: avoid, que a biblioteca ignora", () => {
    // O html2pdf 0.14 le `pageBreakInside`, mas NAO suporta `avoid` em
    // `page-break-after` — ha um TODO explicito na fonte dele. Uma regra dessas
    // aqui daria a impressao de estar resolvendo e nao faria nada, e a proxima
    // pessoa perderia tempo procurando o defeito em outro lugar.
    expect(estilosDocumentoSgsst).not.toContain("page-break-after: avoid");
    expect(estilosDocumentoSgsst).not.toContain("break-after: avoid");
  });

  it("o bloco inteiro tambem e indivisivel", () => {
    // A primeira versao deixou o bloco de fora, por medo de que um bloco com
    // tabela longa fosse empurrado e estourasse a folha seguinte. O medo era
    // infundado: o html2pdf so empurra elemento de no maximo uma pagina
    // (`nPages <= 1` na fonte dele) e ignora o que for mais alto.
    //
    // E proteger so o titulo nao bastou. Na emissao real o titulo do bloco de
    // Treinamentos caia em 918,3px com a pagina terminando em 949,3px — sobrava
    // nos ultimos 7px da folha, e era ali que era cortado.
    const lista = estilosDocumentoSgsst.slice(
      estilosDocumentoSgsst.indexOf(".doc p, .doc-aviso"),
      estilosDocumentoSgsst.indexOf("}", estilosDocumentoSgsst.indexOf(".doc p, .doc-aviso"))
    );
    expect(lista).toContain(".doc-bloco,");
    expect(lista).toContain("page-break-inside: avoid");
  });
});

describe("bloco de assinatura", () => {
  it("a coluna com <hr> nao ganha tambem a borda da coluna", () => {
    // Eram DUAS reguas — a borda da coluna e o <hr> — e o nome ficava prensado
    // entre as duas. No raster do PDF a borda de cima caia rente as maiusculas e
    // parecia riscar o nome.
    expect(estilosDocumentoSgsst).toContain(
      ".doc-assin > div.doc-assin-centro { border-top: 0;"
    );
  });

  it("o seletor de centralizacao casa com a classe no filho, e nao no pai", () => {
    // O seletor antigo era `.doc-assin.doc-assin-centro > div`, que exige as duas
    // classes no MESMO elemento — e a classe esta no filho. Nunca casou.
    // Procura o seletor como REGRA — seguido de `{` —, e não como texto solto: o
    // comentário da folha cita o seletor antigo para explicar o defeito, e um
    // `toContain` cru seria enganado pelo próprio comentário.
    expect(estilosDocumentoSgsst).not.toMatch(
      /\.doc-assin\.doc-assin-centro > div\s*\{/
    );
    expect(estilosDocumentoSgsst).toMatch(/\.doc-assin > div\.doc-assin-centro\s*\{/);
  });

  it("a legenda embaixo da regua tem regra propria de centralizacao", () => {
    // `.doc p` fixa `text-align: justify`, e regra direta vence alinhamento
    // herdado: sem esta linha a legenda continuaria a esquerda mesmo com a coluna
    // centralizada.
    expect(estilosDocumentoSgsst).toContain(".doc-assin > div.doc-assin-centro p { text-align: center");
  });

  it("ha espaco para assinar e folga entre o nome e a regua", () => {
    const regra = estilosDocumentoSgsst.slice(
      estilosDocumentoSgsst.indexOf(".doc-assin .doc-centro-txt"),
      estilosDocumentoSgsst.indexOf("}", estilosDocumentoSgsst.indexOf(".doc-assin .doc-centro-txt"))
    );
    const alturaMinima = regra.match(/min-height:\s*(\d+)px/);
    const folga = regra.match(/padding-bottom:\s*(\d+)px/);
    expect(alturaMinima, "min-height do espaço de assinatura").not.toBeNull();
    expect(folga, "padding-bottom entre o nome e a régua").not.toBeNull();
    expect(Number(alturaMinima![1])).toBeGreaterThanOrEqual(24);
    expect(Number(folga![1])).toBeGreaterThanOrEqual(4);
  });

  it("a regua tem borda explicita, e nao o relevo padrao do navegador", () => {
    // <hr> sem estilo sai com `border: 1px inset` — 2px em relevo cinza, que nao
    // combina com nenhuma outra linha do documento.
    expect(estilosDocumentoSgsst).toContain(".doc-assin hr { border: 0; border-top: 1px solid");
  });
});


describe("contraste do documento impresso", () => {
  it("o cabeçalho de tabela é fundo claro com tinta escura", () => {
    // A primeira versão usava faixa de azul-marinho sólido com texto branco. O
    // PDF sai do html2canvas, e área chapada escura sai saturada e come tinta.
    expect(estilosDocumentoSgsst).toContain(`background: ${CORES_DOC.fundoCabecalho}`);
    expect(estilosDocumentoSgsst).toContain(`color: ${CORES_DOC.tinta}`);
    expect(estilosDocumentoSgsst).not.toContain("color: #ffffff");
    expect(estilosDocumentoSgsst).not.toContain("color: white");
  });

  it("os estados de aptidão têm cores distintas entre si", () => {
    // Apto, restrição e inapto saindo na mesma cor faria a conclusão do ASO
    // depender só da palavra, que é o que se lê por último.
    const estados = [CORES_DOC.ok, CORES_DOC.atencao, CORES_DOC.critico];
    expect(new Set(estados).size).toBe(3);
  });
});
