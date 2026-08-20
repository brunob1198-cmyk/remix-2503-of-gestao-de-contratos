import { describe, it, expect } from "vitest";
import {
  avaliarOxigenio,
  avaliarInflamaveis,
  avaliarContaminante,
  avaliarCalibracao,
  avaliarMedicao,
  avaliarLiberacaoEntrada,
  MOMENTO_LABEL,
  MOMENTO_AJUDA,
  OXIGENIO_MINIMO_ENTRADA,
  OXIGENIO_DEFICIENCIA,
  OXIGENIO_MAXIMO,
  INFLAMAVEIS_MAXIMO_LIE,
  PAPEL_VIGIA,
  type MedicaoAtmosfera,
  type MomentoMedicao,
} from "@/utils/sgsstAtmosfera";

/**
 * Este é o único módulo do sistema em que o erro custa vida. A regra que os
 * testes cobram em toda parte: na ausência de dado, NÃO libera.
 */

const HOJE = new Date("2026-08-20T00:00:00");

describe("valores da norma", () => {
  it("usa os limites da NR-33 conferidos no texto oficial", () => {
    // Guarda contra alguem "arredondar" um limite de vida. 20,9 e o limiar de
    // DEFICIENCIA; o minimo de ENTRADA da 33.5.15.2 e 19,5.
    expect(OXIGENIO_MINIMO_ENTRADA).toBe(19.5);
    expect(OXIGENIO_DEFICIENCIA).toBe(20.9);
    expect(OXIGENIO_MAXIMO).toBe(23);
    expect(INFLAMAVEIS_MAXIMO_LIE).toBe(10);
  });

  it("todo momento de medicao tem rotulo e ajuda", () => {
    const momentos: MomentoMedicao[] = ["ANTES_ENTRADA", "DURANTE", "APOS_INTERRUPCAO"];
    for (const m of momentos) {
      expect(MOMENTO_LABEL[m]).toBeTruthy();
      expect(MOMENTO_AJUDA[m]).toBeTruthy();
    }
  });
});

describe("avaliarOxigenio", () => {
  it("aprova oxigenio na faixa normal", () => {
    expect(avaliarOxigenio(20.9).situacao).toBe("APROVADO");
    expect(avaliarOxigenio(21).situacao).toBe("APROVADO");
    expect(avaliarOxigenio(23).situacao).toBe("APROVADO");
  });

  it("reprova abaixo do minimo de entrada", () => {
    const r = avaliarOxigenio(19.4);
    expect(r.situacao).toBe("REPROVADO");
    expect(r.mensagem).toContain("33.5.15.2");
    expect(r.mensagem).toContain("Entrada proibida");
  });

  it("reprova atmosfera enriquecida acima de 23%", () => {
    // Excesso de oxigenio acelera combustao — reprova tanto quanto a falta.
    const r = avaliarOxigenio(23.1);
    expect(r.situacao).toBe("REPROVADO");
    expect(r.mensagem).toContain("enriquecida");
  });

  it("faixa 19,5 a 20,9 sem causa declarada fica em atencao, nao aprova", () => {
    // E deficiencia de oxigenio. A norma so admite com causa conhecida e
    // controlada; sem a declaracao, nao libera.
    const r = avaliarOxigenio(20);
    expect(r.situacao).toBe("ATENCAO");
    expect(r.mensagem).toContain("deficiência de oxigênio");
  });

  it("faixa 19,5 a 20,9 com causa declarada aprova", () => {
    const r = avaliarOxigenio(20, true);
    expect(r.situacao).toBe("APROVADO");
    expect(r.mensagem).toContain("conhecida e controlada");
  });

  it("causa declarada NAO salva valor fora da faixa de entrada", () => {
    // A declaracao cobre a deficiencia entre 19,5 e 20,9, nao o abaixo de 19,5.
    expect(avaliarOxigenio(18, true).situacao).toBe("REPROVADO");
    expect(avaliarOxigenio(24, true).situacao).toBe("REPROVADO");
  });

  it("exatamente 19,5 aprova como deficiencia com causa, atencao sem", () => {
    expect(avaliarOxigenio(19.5).situacao).toBe("ATENCAO");
    expect(avaliarOxigenio(19.5, true).situacao).toBe("APROVADO");
  });

  it("nao medido nao e aprovado", () => {
    expect(avaliarOxigenio(null).situacao).toBe("NAO_MEDIDO");
    expect(avaliarOxigenio(undefined).situacao).toBe("NAO_MEDIDO");
  });

  it("zero e medicao, nao ausencia — e reprova", () => {
    expect(avaliarOxigenio(0).situacao).toBe("REPROVADO");
  });
});

describe("avaliarInflamaveis", () => {
  it("aprova abaixo de 10% do LIE", () => {
    expect(avaliarInflamaveis(0).situacao).toBe("APROVADO");
    expect(avaliarInflamaveis(9.9).situacao).toBe("APROVADO");
  });

  it("reprova em exatamente 10%: o limite e 'abaixo de 10%'", () => {
    const r = avaliarInflamaveis(10);
    expect(r.situacao).toBe("REPROVADO");
    expect(r.mensagem).toContain("Anexo II");
  });

  it("reprova acima de 10%", () => {
    expect(avaliarInflamaveis(15).situacao).toBe("REPROVADO");
  });

  it("nao medido nao e aprovado", () => {
    expect(avaliarInflamaveis(null).situacao).toBe("NAO_MEDIDO");
  });
});

describe("avaliarContaminante", () => {
  it("aprova dentro do limite informado", () => {
    const r = avaliarContaminante({
      contaminante_nome: "H₂S",
      contaminante_valor: 5,
      contaminante_unidade: "ppm",
      contaminante_limite: 8,
    });
    expect(r.situacao).toBe("APROVADO");
    expect(r.mensagem).toContain("H₂S");
    expect(r.mensagem).toContain("ppm");
  });

  it("reprova acima do limite", () => {
    const r = avaliarContaminante({
      contaminante_valor: 12,
      contaminante_limite: 8,
    });
    expect(r.situacao).toBe("REPROVADO");
    expect(r.mensagem).toContain("Entrada proibida");
  });

  it("no limite exato aprova", () => {
    expect(
      avaliarContaminante({ contaminante_valor: 8, contaminante_limite: 8 }).situacao
    ).toBe("APROVADO");
  });

  it("valor sem limite informado fica em atencao, nao aprova", () => {
    // Ha um numero, mas nada contra o que compara-lo. A NR-33 nao fixa limite
    // proprio, entao o valor tem de vir da NR-15 ou do PGR.
    const r = avaliarContaminante({ contaminante_valor: 5 });
    expect(r.situacao).toBe("ATENCAO");
    expect(r.mensagem).toContain("NR-15");
  });

  it("nao medido e reportado como tal", () => {
    expect(avaliarContaminante({}).situacao).toBe("NAO_MEDIDO");
  });

  it("usa rotulo generico quando o contaminante nao tem nome", () => {
    const r = avaliarContaminante({ contaminante_valor: 1, contaminante_limite: 5 });
    expect(r.mensagem).toContain("Contaminante");
  });
});

describe("avaliarCalibracao", () => {
  it("aprova calibracao valida", () => {
    expect(avaliarCalibracao("2027-01-01", HOJE).situacao).toBe("APROVADO");
  });

  it("aprova no proprio dia do vencimento", () => {
    expect(avaliarCalibracao("2026-08-20", HOJE).situacao).toBe("APROVADO");
  });

  it("reprova calibracao vencida", () => {
    const r = avaliarCalibracao("2026-08-19", HOJE);
    expect(r.situacao).toBe("REPROVADO");
    expect(r.mensagem).toContain("descalibrado");
  });

  it("validade nao informada fica em atencao", () => {
    expect(avaliarCalibracao(null, HOJE).situacao).toBe("ATENCAO");
  });
});

const MEDICAO_OK: MedicaoAtmosfera = {
  id: "m1",
  medido_em: "2026-08-20T07:00:00Z",
  momento: "ANTES_ENTRADA",
  oxigenio_percentual: 21,
  inflamaveis_percentual_lie: 2,
  contaminante_nome: "H₂S",
  contaminante_valor: 3,
  contaminante_unidade: "ppm",
  contaminante_limite: 8,
  calibracao_validade: "2027-03-01",
};

describe("avaliarMedicao", () => {
  it("libera quando tudo esta aprovado", () => {
    const r = avaliarMedicao(MEDICAO_OK, HOJE);
    expect(r.liberado).toBe(true);
    expect(r.impedimentos).toEqual([]);
  });

  it("nao libera com oxigenio reprovado", () => {
    const r = avaliarMedicao({ ...MEDICAO_OK, oxigenio_percentual: 18 }, HOJE);
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("Entrada proibida");
  });

  it("nao libera sem medir oxigenio", () => {
    const r = avaliarMedicao({ ...MEDICAO_OK, oxigenio_percentual: null }, HOJE);
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("Oxigênio não medido");
  });

  it("nao libera sem medir inflamaveis", () => {
    const r = avaliarMedicao({ ...MEDICAO_OK, inflamaveis_percentual_lie: null }, HOJE);
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("inflamáveis não medidos");
  });

  it("contaminante nao medido NAO impede: ha espaco confinado sem contaminante esperado", () => {
    const r = avaliarMedicao(
      {
        ...MEDICAO_OK,
        contaminante_nome: null,
        contaminante_valor: null,
        contaminante_limite: null,
      },
      HOJE
    );
    expect(r.liberado).toBe(true);
    expect(r.contaminante.situacao).toBe("NAO_MEDIDO");
  });

  it("contaminante medido sem limite impede, porque nao da para concluir", () => {
    const r = avaliarMedicao({ ...MEDICAO_OK, contaminante_limite: null }, HOJE);
    expect(r.liberado).toBe(false);
  });

  it("calibracao vencida impede mesmo com todos os gases dentro da faixa", () => {
    // Medicao com detector descalibrado nao e medicao.
    const r = avaliarMedicao({ ...MEDICAO_OK, calibracao_validade: "2020-01-01" }, HOJE);
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("descalibrado");
  });

  it("calibracao nao informada impede", () => {
    const r = avaliarMedicao({ ...MEDICAO_OK, calibracao_validade: null }, HOJE);
    expect(r.liberado).toBe(false);
  });

  it("deficiencia de oxigenio sem causa declarada impede", () => {
    const r = avaliarMedicao({ ...MEDICAO_OK, oxigenio_percentual: 20 }, HOJE);
    expect(r.liberado).toBe(false);
    expect(r.oxigenio.situacao).toBe("ATENCAO");
  });

  it("deficiencia com causa declarada libera", () => {
    const r = avaliarMedicao(
      { ...MEDICAO_OK, oxigenio_percentual: 20, causa_variacao_conhecida: true },
      HOJE
    );
    expect(r.liberado).toBe(true);
  });

  it("medicao completamente vazia nao libera", () => {
    const r = avaliarMedicao({}, HOJE);
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.length).toBeGreaterThanOrEqual(3);
  });
});

describe("avaliarLiberacaoEntrada", () => {
  const comVigia = [PAPEL_VIGIA, "Executante"];

  it("libera com medicao pre-entrada aprovada e vigia designado", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [MEDICAO_OK],
      responsabilidades: comVigia,
      hoje: HOJE,
    });
    expect(r.liberado).toBe(true);
    expect(r.impedimentos).toEqual([]);
    expect(r.medicaoVigente?.id).toBe("m1");
  });

  it("nao libera sem nenhuma medicao", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [],
      responsabilidades: comVigia,
      hoje: HOJE,
    });
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("Nenhuma avaliação atmosférica");
    expect(r.medicaoVigente).toBeNull();
  });

  it("nao libera sem vigia designado", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [MEDICAO_OK],
      responsabilidades: ["Executante", "Supervisor de Entrada"],
      hoje: HOJE,
    });
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("Vigia");
  });

  it("reconhece o vigia sem depender de caixa ou espaco", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [MEDICAO_OK],
      responsabilidades: ["  vIGIA  "],
      hoje: HOJE,
    });
    expect(r.liberado).toBe(true);
  });

  it("medicao DURANTE nao substitui a de antes da entrada", () => {
    // Monitorar durante e obrigacao adicional, nao a condicao de entrada.
    const r = avaliarLiberacaoEntrada({
      medicoes: [{ ...MEDICAO_OK, momento: "DURANTE" }],
      responsabilidades: comVigia,
      hoje: HOJE,
    });
    expect(r.liberado).toBe(false);
    expect(r.impedimentos.join(" ")).toContain("antes da entrada");
  });

  it("usa a medicao pre-entrada mais recente", () => {
    const antiga: MedicaoAtmosfera = {
      ...MEDICAO_OK,
      id: "antiga",
      medido_em: "2026-08-19T07:00:00Z",
      oxigenio_percentual: 18,
    };
    const nova: MedicaoAtmosfera = {
      ...MEDICAO_OK,
      id: "nova",
      medido_em: "2026-08-20T07:00:00Z",
    };

    // A antiga reprovava; a nova, mais recente, libera.
    const r = avaliarLiberacaoEntrada({
      medicoes: [antiga, nova],
      responsabilidades: comVigia,
      hoje: HOJE,
    });
    expect(r.medicaoVigente?.id).toBe("nova");
    expect(r.liberado).toBe(true);
  });

  it("medicao nova reprovada nao e salva por uma antiga aprovada", () => {
    const aprovadaAntiga: MedicaoAtmosfera = {
      ...MEDICAO_OK,
      id: "antiga",
      medido_em: "2026-08-19T07:00:00Z",
    };
    const reprovadaNova: MedicaoAtmosfera = {
      ...MEDICAO_OK,
      id: "nova",
      medido_em: "2026-08-20T09:00:00Z",
      inflamaveis_percentual_lie: 40,
    };

    const r = avaliarLiberacaoEntrada({
      medicoes: [aprovadaAntiga, reprovadaNova],
      responsabilidades: comVigia,
      hoje: HOJE,
    });
    expect(r.medicaoVigente?.id).toBe("nova");
    expect(r.liberado).toBe(false);
  });

  it("momento ausente e tratado como antes da entrada", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [{ ...MEDICAO_OK, momento: null }],
      responsabilidades: comVigia,
      hoje: HOJE,
    });
    expect(r.liberado).toBe(true);
  });

  it("acumula os dois impedimentos quando falta medicao e vigia", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [],
      responsabilidades: [],
      hoje: HOJE,
    });
    expect(r.impedimentos).toHaveLength(2);
  });

  it("responsabilidade nula nao quebra a checagem de vigia", () => {
    const r = avaliarLiberacaoEntrada({
      medicoes: [MEDICAO_OK],
      responsabilidades: [null, undefined, PAPEL_VIGIA],
      hoje: HOJE,
    });
    expect(r.liberado).toBe(true);
  });
});
