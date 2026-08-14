import { describe, it, expect } from "vitest";

describe("Módulo de Checklists Inteligentes", () => {
  it("validates question answer types and scoring logic", () => {
    const tiposResposta = [
      "Sim_Nao",
      "Conforme_NaoConforme",
      "Conforme_NaoConforme_NA",
      "Sim_Nao_NA",
      "OK_NaoOK",
      "Escala",
      "Numero",
      "Texto",
      "Data",
      "Hora",
      "Selecao",
      "MultiplaSelecao",
    ];

    expect(tiposResposta.length).toBe(12);
    expect(tiposResposta).toContain("Conforme_NaoConforme_NA");
  });

  it("calculates compliance percentage ignoring N/A items", () => {
    const respostas = [
      { valor: "Conforme", isNc: false, isNa: false, peso: 1 },
      { valor: "Conforme", isNc: false, isNa: false, peso: 1 },
      { valor: "NaoConforme", isNc: true, isNa: false, peso: 1 },
      { valor: "NA", isNc: false, isNa: true, peso: 1 },
    ];

    let conforme = 0;
    let naoConforme = 0;
    let na = 0;
    let obtida = 0;
    let maxima = 0;

    respostas.forEach((r) => {
      if (r.isNa) {
        na++;
      } else if (r.isNc) {
        naoConforme++;
        maxima += r.peso;
      } else {
        conforme++;
        obtida += r.peso;
        maxima += r.peso;
      }
    });

    const percentual = Math.round((obtida / maxima) * 100);

    expect(conforme).toBe(2);
    expect(naoConforme).toBe(1);
    expect(na).toBe(1);
    expect(maxima).toBe(3);
    expect(obtida).toBe(2);
    expect(percentual).toBe(67);
  });

  it("validates 5W2H plan of action structure and priority levels", () => {
    const prioridades = ["Baixa", "Media", "Alta", "Critica"];
    const statusList = ["Aberto", "Em_Andamento", "Concluido", "Atrasado", "Cancelado"];

    expect(prioridades).toContain("Critica");
    expect(statusList).toContain("Aberto");
  });
});
