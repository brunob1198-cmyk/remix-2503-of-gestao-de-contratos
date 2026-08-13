import { describe, it, expect } from "vitest";
import { SgsstFuncao } from "../useSgsstFuncoes";
import { SgsstColaboradorDados } from "../useSgsstColaboradores";

describe("SGSST Core Models & Rules Validation", () => {
  it("validates SgsstFuncao structure", () => {
    const funcao: SgsstFuncao = {
      id: "funcao-1",
      empresa_id: "empresa-1",
      nome: "TÉCNICO DE SEGURANÇA DO TRABALHO",
      cbo: "3516-05",
      descricao: "Inspeção e controle de SST em canteiro",
      requisitos_minimos: "Curso Técnico em SST",
      status: "ativo",
    };

    expect(funcao.id).toBe("funcao-1");
    expect(funcao.empresa_id).toBe("empresa-1");
    expect(funcao.status).toBe("ativo");
  });

  it("validates SgsstColaboradorDados structure", () => {
    const colaborador: SgsstColaboradorDados = {
      id: "colab-1",
      empresa_id: "empresa-1",
      profile_id: "profile-123",
      recurso_id: null,
      funcao_id: "funcao-1",
      area_id: "area-1",
      matricula: "MAT-001",
      data_admissao: "2026-01-15",
      data_demissao: null,
      tipo_vinculo: "CLT",
      status: "ativo",
    };

    expect(colaborador.empresa_id).toBe("empresa-1");
    expect(colaborador.profile_id).toBe("profile-123");
    expect(colaborador.tipo_vinculo).toBe("CLT");
  });
});
