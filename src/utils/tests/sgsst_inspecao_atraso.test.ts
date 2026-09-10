import { describe, expect, it } from "vitest";
import {
  diasDeAtraso,
  exigeAtencao,
  resumoDoPrazo,
  situacaoDoPrazo,
} from "@/utils/sgsstInspecaoAtraso";

const HOJE = "2026-09-10";

describe("situacaoDoPrazo", () => {
  it("planejada com data de ontem esta ATRASADA", () => {
    // O caso do roteiro 9.9: criar com data de ontem e nao executar.
    expect(
      situacaoDoPrazo({ status: "PLANEJADA", dataPlanejada: "2026-09-09", hoje: HOJE })
    ).toBe("ATRASADA");
  });

  it("planejada para HOJE ainda esta no prazo", () => {
    // O dia nao acabou. Marcar como atrasada de manha cobraria o que ainda da tempo.
    expect(
      situacaoDoPrazo({ status: "PLANEJADA", dataPlanejada: HOJE, hoje: HOJE })
    ).toBe("NO_PRAZO");
  });

  it("planejada para amanha esta no prazo", () => {
    expect(
      situacaoDoPrazo({ status: "PLANEJADA", dataPlanejada: "2026-09-11", hoje: HOJE })
    ).toBe("NO_PRAZO");
  });

  it("em execucao com data passada NAO e o mesmo que atrasada", () => {
    // Alguem esta fazendo. Juntar com quem nao comecou faria o gestor cobrar
    // quem trabalha e perder de vista quem nem abriu a inspecao.
    expect(
      situacaoDoPrazo({ status: "EM_EXECUCAO", dataPlanejada: "2026-09-01", hoje: HOJE })
    ).toBe("EM_EXECUCAO_ALEM_DO_PRAZO");
  });

  it("em execucao dentro do previsto", () => {
    expect(
      situacaoDoPrazo({ status: "EM_EXECUCAO", dataPlanejada: HOJE, hoje: HOJE })
    ).toBe("EM_EXECUCAO");
  });

  it.each(["CONCLUIDA", "CANCELADA"])(
    "%s nunca esta atrasada, mesmo com data antiga",
    (status) => {
      expect(
        situacaoDoPrazo({ status, dataPlanejada: "2020-01-01", hoje: HOJE })
      ).toBe("ENCERRADA");
    }
  );

  it("sem data planejada nao da para julgar prazo", () => {
    // Nao e atraso nem pontualidade: e falta de plano, e some se for chamado
    // de qualquer um dos dois.
    expect(situacaoDoPrazo({ status: "PLANEJADA", dataPlanejada: null, hoje: HOJE }))
      .toBe("SEM_DATA");
    expect(situacaoDoPrazo({ status: "PLANEJADA", dataPlanejada: "   ", hoje: HOJE }))
      .toBe("SEM_DATA");
  });

  it("aceita timestamp completo, usando so o dia", () => {
    // O banco pode devolver data com hora; comparar a string inteira faria
    // "2026-09-10T08:00" perder para "2026-09-10".
    expect(
      situacaoDoPrazo({
        status: "PLANEJADA",
        dataPlanejada: "2026-09-09T23:59:59Z",
        hoje: "2026-09-10T00:00:01Z",
      })
    ).toBe("ATRASADA");
  });

  it("status em minusculas e tratado igual", () => {
    expect(
      situacaoDoPrazo({ status: "concluida", dataPlanejada: "2020-01-01", hoje: HOJE })
    ).toBe("ENCERRADA");
  });
});

describe("exigeAtencao", () => {
  it("cobra atraso e execucao alem do prazo", () => {
    expect(exigeAtencao("ATRASADA")).toBe(true);
    expect(exigeAtencao("EM_EXECUCAO_ALEM_DO_PRAZO")).toBe(true);
  });

  it("nao cobra o que esta em ordem", () => {
    for (const s of ["NO_PRAZO", "EM_EXECUCAO", "ENCERRADA", "SEM_DATA"] as const) {
      expect(exigeAtencao(s)).toBe(false);
    }
  });
});

describe("diasDeAtraso", () => {
  it("conta os dias corridos", () => {
    // "Atrasada" e "atrasada ha 40 dias" pedem providencias diferentes.
    expect(diasDeAtraso({ dataPlanejada: "2026-08-01", hoje: HOJE })).toBe(40);
    expect(diasDeAtraso({ dataPlanejada: "2026-09-09", hoje: HOJE })).toBe(1);
  });

  it("devolve 0 quando nao ha atraso", () => {
    expect(diasDeAtraso({ dataPlanejada: HOJE, hoje: HOJE })).toBe(0);
    expect(diasDeAtraso({ dataPlanejada: "2026-12-01", hoje: HOJE })).toBe(0);
    expect(diasDeAtraso({ dataPlanejada: null, hoje: HOJE })).toBe(0);
  });

  it("atravessa a virada de mes e de ano", () => {
    expect(diasDeAtraso({ dataPlanejada: "2025-12-31", hoje: "2026-01-01" })).toBe(1);
  });
});

describe("resumoDoPrazo", () => {
  it("separa atraso de execucao alem do prazo e de falta de data", () => {
    const r = resumoDoPrazo(
      [
        { status: "PLANEJADA", data_planejada: "2026-09-09" }, // atrasada, 1 dia
        { status: "PLANEJADA", data_planejada: "2026-08-01" }, // atrasada, 40 dias
        { status: "EM_EXECUCAO", data_planejada: "2026-09-07" }, // alem do prazo
        { status: "PLANEJADA", data_planejada: "2026-09-20" }, // no prazo
        { status: "EM_EXECUCAO", data_planejada: HOJE }, // no prazo
        { status: "CONCLUIDA", data_planejada: "2020-01-01" }, // encerrada
        { status: "PLANEJADA", data_planejada: null }, // sem data
      ],
      HOJE
    );

    expect(r.atrasadas).toBe(2);
    expect(r.emExecucaoAlemDoPrazo).toBe(1);
    expect(r.noPrazo).toBe(2);
    expect(r.semData).toBe(1);
    expect(r.maiorAtrasoEmDias).toBe(40);
  });

  it("conjunto vazio nao inventa atraso", () => {
    expect(resumoDoPrazo([], HOJE)).toEqual({
      atrasadas: 0,
      emExecucaoAlemDoPrazo: 0,
      noPrazo: 0,
      semData: 0,
      maiorAtrasoEmDias: 0,
    });
  });

  it("encerrada nao entra em nenhuma contagem de prazo", () => {
    // Nao pode virar "no prazo": ela nao esta pendente de nada.
    const r = resumoDoPrazo([{ status: "CANCELADA", data_planejada: "2020-01-01" }], HOJE);
    expect(r).toEqual({
      atrasadas: 0,
      emExecucaoAlemDoPrazo: 0,
      noPrazo: 0,
      semData: 0,
      maiorAtrasoEmDias: 0,
    });
  });
});
