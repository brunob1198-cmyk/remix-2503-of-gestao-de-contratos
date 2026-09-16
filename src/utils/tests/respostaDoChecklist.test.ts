import { describe, expect, it } from "vitest";
import { controleDaResposta, rotuloDaResposta } from "../respostaDoChecklist";
import { ehNaoConforme } from "../checklistPontuacao";

/**
 * Roteiro 15.3: "Criar um item de cada tipo de resposta: Conforme/NC/NA, Sim/Não,
 * escala, número, texto, data → Todos salvam e cada um mostra o controle certo na
 * aplicação."
 *
 * A segunda metade é que falhava. O cadastro oferecia nove tipos; a aplicação
 * reconhecia "Sim" e "NA" e jogava todo o resto nos mesmos dois botões.
 */

describe("controleDaResposta — os tipos de botão", () => {
  it("Conforme/NC/NA dá dois botões e o não aplicável", () => {
    const c = controleDaResposta("Conforme_NaoConforme_NA");
    expect(c.formato).toBe("botoes");
    expect(c.opcoes.map((o) => o.valor)).toEqual(["Conforme", "NaoConforme"]);
    expect(c.temNaoAplicavel).toBe(true);
  });

  it("Conforme/NC sem NA não oferece o não aplicável", () => {
    expect(controleDaResposta("Conforme_NaoConforme").temNaoAplicavel).toBe(false);
  });

  it("Sim/Não grava Sim e Nao, não Conforme", () => {
    const c = controleDaResposta("Sim_Nao");
    expect(c.opcoes.map((o) => o.valor)).toEqual(["Sim", "Nao"]);
    expect(c.opcoes.map((o) => o.rotulo)).toEqual(["Sim", "Não"]);
  });

  it("OK/Não OK grava OK e NaoOK, e os botões dizem OK", () => {
    // Antes este tipo caía no ramo padrão: botão escrito "Conforme" e valor
    // `Conforme` gravado. A escolha do modelo não chegava a lugar nenhum.
    const c = controleDaResposta("OK_NaoOK");
    expect(c.opcoes.map((o) => o.valor)).toEqual(["OK", "NaoOK"]);
    expect(c.opcoes.map((o) => o.rotulo)).toEqual(["OK", "Não OK"]);
  });

  it("nos tipos de botão a opção já classifica; não se marca desvio à mão", () => {
    for (const tipo of ["Conforme_NaoConforme_NA", "Sim_Nao", "OK_NaoOK"]) {
      expect(controleDaResposta(tipo).desvioEhMarcadoAMao).toBe(false);
    }
  });

  it("o valor de não conformidade de cada tipo é entendido pelo cálculo", () => {
    // A regra mora em dois arquivos: aqui o que a tela grava, lá o que a nota
    // reconhece. Se um mudar sozinho, o desvio deixa de contar em silêncio.
    for (const tipo of ["Conforme_NaoConforme", "Sim_Nao", "OK_NaoOK"]) {
      const nc = controleDaResposta(tipo).opcoes.find((o) => o.naoConforme)!;
      expect(ehNaoConforme({ resposta_valor: nc.valor })).toBe(true);
    }
  });

  it("o valor conforme de cada tipo NÃO é lido como desvio", () => {
    for (const tipo of ["Conforme_NaoConforme", "Sim_Nao", "OK_NaoOK"]) {
      const ok = controleDaResposta(tipo).opcoes.find((o) => !o.naoConforme)!;
      expect(ehNaoConforme({ resposta_valor: ok.valor })).toBe(false);
    }
  });

  it("tipo desconhecido ou vazio cai no par mais comum, não em tela em branco", () => {
    for (const tipo of ["", null, undefined, "TipoQueNaoExiste"]) {
      const c = controleDaResposta(tipo);
      expect(c.formato).toBe("botoes");
      expect(c.opcoes.map((o) => o.valor)).toEqual(["Conforme", "NaoConforme"]);
    }
  });
});

describe("controleDaResposta — os tipos livres", () => {
  it("Escala dá as cinco notas", () => {
    const c = controleDaResposta("Escala");
    expect(c.formato).toBe("escala");
    expect(c.opcoes.map((o) => o.valor)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("nenhuma nota da escala é não conformidade por si", () => {
    // Em "estado da plataforma" 5 é ótimo; em "nível de poeira" 5 é péssimo. O
    // modelo não declara o lado bom, então o sistema não inventa.
    const c = controleDaResposta("Escala");
    expect(c.opcoes.some((o) => o.naoConforme)).toBe(false);
    expect(c.desvioEhMarcadoAMao).toBe(true);
  });

  it("número, texto e data viram campo, não botão", () => {
    expect(controleDaResposta("Numero").formato).toBe("numero");
    expect(controleDaResposta("Texto").formato).toBe("texto");
    expect(controleDaResposta("Data").formato).toBe("data");
  });

  it("nos tipos livres o desvio é marcado à mão", () => {
    for (const tipo of ["Escala", "Numero", "Texto", "Data"]) {
      expect(controleDaResposta(tipo).desvioEhMarcadoAMao).toBe(true);
    }
  });

  it("tipo livre não oferece não aplicável", () => {
    for (const tipo of ["Escala", "Numero", "Texto", "Data"]) {
      expect(controleDaResposta(tipo).temNaoAplicavel).toBe(false);
    }
  });

  it("todo campo livre tem dica, menos a escala que se explica sozinha", () => {
    for (const tipo of ["Numero", "Texto", "Data"]) {
      expect(controleDaResposta(tipo).dicaDoCampo).not.toBe("");
    }
  });
});

describe("rotuloDaResposta", () => {
  it("traduz o vocabulário gravado", () => {
    expect(rotuloDaResposta("NaoConforme")).toBe("Não conforme");
    expect(rotuloDaResposta("NaoOK")).toBe("Não OK");
    expect(rotuloDaResposta("NA")).toBe("Não aplicável");
  });

  it("data sai em português, não em ISO", () => {
    // O valor é guardado em ISO para ordenar; a folha é lida por gente.
    expect(rotuloDaResposta("2026-09-16", "Data")).toBe("16/09/2026");
  });

  it("data mal formada sai como está, sem inventar", () => {
    expect(rotuloDaResposta("ontem", "Data")).toBe("ontem");
  });

  it("valor livre passa inteiro", () => {
    expect(rotuloDaResposta("92")).toBe("92");
    expect(rotuloDaResposta("trinca no montante")).toBe("trinca no montante");
  });

  it("vazio continua vazio", () => {
    expect(rotuloDaResposta("")).toBe("");
    expect(rotuloDaResposta(null)).toBe("");
  });
});
