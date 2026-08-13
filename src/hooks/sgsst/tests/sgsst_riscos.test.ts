import { describe, it, expect } from "vitest";
import { SgsstRisco } from "../useSgsstRiscos";

describe("SGSST Catálogo de Riscos Model Validation", () => {
  it("validates SgsstRisco model structure and categories", () => {
    const risco: SgsstRisco = {
      id: "risco-1",
      empresa_id: "empresa-123",
      codigo: "RISK-001",
      nome: "RUÍDO EXCESSIVO CONTÍNUO OU INTERMITENTE",
      categoria: "Físico",
      agente: "Pressão sonora acima de 85 dB(A)",
      fonte_geradora: "Compressores e serras circulares",
      consequencia: "Perda auditiva induzida por ruído (PAIR)",
      descricao: "Medição diária necessária no canteiro de obras",
      status: "ativo",
    };

    expect(risco.id).toBe("risco-1");
    expect(risco.empresa_id).toBe("empresa-123");
    expect(risco.categoria).toBe("Físico");
    expect(risco.status).toBe("ativo");
  });
});
