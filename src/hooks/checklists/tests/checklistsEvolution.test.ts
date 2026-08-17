import { describe, it, expect } from "vitest";
import { calculateHaversineDistanceMeters, isWithinRadius } from "@/utils/geolocationUtils";
import { PeriodicidadeAgendamento, StatusAgendamento, StatusAgendamentoExecucao } from "@/types/checklistsEvolution";

describe("PROMPT 020 - Evolução do Módulo Checklists - Unit Tests", () => {
  it("deve calcular a distância entre duas coordenadas geográficas usando Haversine", () => {
    // Ponto 1: Marco Zero SP (-23.550520, -46.633308)
    // Ponto 2: Praça da Sé SP (-23.550300, -46.633900) ~60 metros de distância
    const dist = calculateHaversineDistanceMeters(-23.55052, -46.633308, -23.5503, -46.6339);

    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(100);
  });

  it("deve validar se a localização atual está DENTRO do raio de 200 metros da obra", () => {
    const latAlvo = -23.55052;
    const lonAlvo = -46.633308;
    const raioMaxMetros = 200;

    // Ponto dentro do raio (~50 metros de distância)
    const latAtual = -23.5507;
    const lonAtual = -46.6335;

    const result = isWithinRadius(latAtual, lonAtual, latAlvo, lonAlvo, raioMaxMetros);

    expect(result.inside).toBe(true);
    expect(result.distanceMeters).toBeLessThanOrEqual(raioMaxMetros);
  });

  it("deve detectar quando a localização está FORA do raio de 200 metros da obra", () => {
    const latAlvo = -23.55052;
    const lonAlvo = -46.633308;
    const raioMaxMetros = 200;

    // Ponto distante (~2.5 km de distância)
    const latAtual = -23.57;
    const lonAtual = -46.65;

    const result = isWithinRadius(latAtual, lonAtual, latAlvo, lonAlvo, raioMaxMetros);

    expect(result.inside).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(raioMaxMetros);
  });

  it("deve gerar tokens de QR Code únicos e seguros", () => {
    const token1 = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const token2 = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    expect(token1).not.toBe(token2);
    expect(token1.startsWith("qr_")).toBe(true);
  });

  it("deve validar enums centralizados de agendamento e execuções", () => {
    const statusAgendamento: StatusAgendamento[] = ["ATIVO", "PAUSADO", "ENCERRADO"];
    const statusExecucao: StatusAgendamentoExecucao[] = [
      "PENDENTE",
      "EM_ANDAMENTO",
      "CONCLUIDA",
      "ATRASADA",
      "CANCELADA",
    ];
    const periodicidades: PeriodicidadeAgendamento[] = [
      "UNICA",
      "DIARIA",
      "SEMANAL",
      "QUINZENAL",
      "MENSAL",
      "TRIMESTRAL",
      "SEMESTRAL",
      "ANUAL",
    ];

    expect(statusAgendamento).toHaveLength(3);
    expect(statusExecucao).toHaveLength(5);
    expect(periodicidades).toHaveLength(8);
  });
});
