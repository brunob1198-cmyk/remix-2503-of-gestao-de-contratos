import { describe, expect, it } from "vitest";
import {
  catExigeAcao,
  herancaParaCat,
  mensagemDaCat,
  situacaoDaCat,
} from "@/utils/sgsstCatDoIncidente";

describe("situacaoDaCat", () => {
  it("CAT vinculada vence a chave, mesmo se a chave estiver desmarcada", () => {
    // O documento existe. A chave e declaracao de quem digitou; nao manda no fato.
    expect(
      situacaoDaCat({ catEmitida: false, diasPerdidos: 10, catsVinculadas: 1 })
    ).toBe("REGISTRADA");
  });

  it("chave marcada e nenhuma CAT: declarada sem registro", () => {
    // O caso do roteiro 11.2. E a pior das situacoes, porque passa por resolvida.
    expect(
      situacaoDaCat({ catEmitida: true, diasPerdidos: 10, catsVinculadas: 0 })
    ).toBe("DECLARADA_SEM_REGISTRO");
  });

  it("afastamento sem chave e sem CAT: devida e nao declarada", () => {
    expect(
      situacaoDaCat({ catEmitida: false, diasPerdidos: 7, catsVinculadas: 0 })
    ).toBe("DEVIDA_NAO_DECLARADA");
  });

  it("dias perdidos valem mesmo com tipo classificado como quase acidente", () => {
    // Encontrado num registro real: tipo "Quase Acidente" com 7 dias perdidos.
    // Julgar pelo tipo deixaria passar; dia perdido significa lesao.
    expect(
      situacaoDaCat({ catEmitida: false, diasPerdidos: 7, catsVinculadas: 0 })
    ).toBe("DEVIDA_NAO_DECLARADA");
  });

  it("sem afastamento e sem declaracao: nada a cobrar aqui", () => {
    expect(situacaoDaCat({ catEmitida: false, diasPerdidos: 0, catsVinculadas: 0 }))
      .toBe("NAO_EXIGIDA");
    expect(situacaoDaCat({ catEmitida: null, diasPerdidos: null, catsVinculadas: 0 }))
      .toBe("NAO_EXIGIDA");
  });

  it("dias perdidos invalido nao inventa pendencia", () => {
    expect(
      situacaoDaCat({ catEmitida: false, diasPerdidos: NaN, catsVinculadas: 0 })
    ).toBe("NAO_EXIGIDA");
  });
});

describe("catExigeAcao", () => {
  it("cobra as duas situacoes sem documento", () => {
    expect(catExigeAcao("DECLARADA_SEM_REGISTRO")).toBe(true);
    expect(catExigeAcao("DEVIDA_NAO_DECLARADA")).toBe(true);
  });

  it("nao cobra o que esta resolvido ou nao se aplica", () => {
    expect(catExigeAcao("REGISTRADA")).toBe(false);
    expect(catExigeAcao("NAO_EXIGIDA")).toBe(false);
  });
});

describe("mensagemDaCat", () => {
  it("explica que a chave nao cria a CAT", () => {
    const m = mensagemDaCat("DECLARADA_SEM_REGISTRO");
    expect(m).not.toBeNull();
    expect(m!.comoResolver).toContain("não cria a CAT");
  });

  it("informa o prazo legal quando a CAT e devida", () => {
    // Sem o prazo, o aviso parece burocracia adiavel.
    const m = mensagemDaCat("DEVIDA_NAO_DECLARADA");
    expect(m!.comoResolver).toContain("primeiro dia útil");
    expect(m!.comoResolver).toContain("óbito");
  });

  it("cala quando nao ha nada a dizer", () => {
    expect(mensagemDaCat("REGISTRADA")).toBeNull();
    expect(mensagemDaCat("NAO_EXIGIDA")).toBeNull();
  });
});

describe("herancaParaCat", () => {
  it("leva data, projeto, colaborador e dias do incidente", () => {
    // Redigitar o que ja esta no incidente e onde os dois registros divergem.
    expect(
      herancaParaCat({
        incidenteId: "inc-1",
        projetoId: "proj-1",
        colaboradorId: "colab-1",
        dataOcorrencia: "2026-09-03T16:09:00Z",
        titulo: "ACIDENTE AIVX 001",
        descricao: "Queda de nivel",
        diasPerdidos: 7,
      })
    ).toEqual({
      incidente_id: "inc-1",
      projeto_id: "proj-1",
      colaborador_id: "colab-1",
      data_acidente: "2026-09-03",
      descricao: "Queda de nivel",
      dias_afastamento: 7,
    });
  });

  it("usa o titulo quando nao ha descricao", () => {
    const h = herancaParaCat({
      incidenteId: "inc-1",
      titulo: "ACIDENTE AIVX 001",
      descricao: "   ",
    });
    expect(h.descricao).toBe("ACIDENTE AIVX 001");
  });

  it("dias negativo ou invalido vira zero, nao propaga lixo", () => {
    expect(herancaParaCat({ incidenteId: "i", diasPerdidos: -5 }).dias_afastamento).toBe(0);
    expect(herancaParaCat({ incidenteId: "i", diasPerdidos: null }).dias_afastamento).toBe(0);
  });

  it("sem data de ocorrencia devolve nulo, nao string vazia", () => {
    // String vazia gravada em coluna date estoura no banco.
    expect(herancaParaCat({ incidenteId: "i" }).data_acidente).toBeNull();
  });
});
