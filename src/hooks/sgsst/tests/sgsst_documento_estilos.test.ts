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
