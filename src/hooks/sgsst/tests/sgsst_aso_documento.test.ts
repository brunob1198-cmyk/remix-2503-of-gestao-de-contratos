import { describe, it, expect } from "vitest";
import { pendenciasAso, montarHtmlAso } from "@/lib/asoDocumento";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";

/**
 * O ASO é o documento que vai para a mão do trabalhador, e a NR-07 lista os
 * campos obrigatórios. Um campo em branco é autuação direta — por isso tanto a
 * checagem de pendências quanto o que sai no papel são testados.
 */

function asoCompleto(over: Partial<SgsstAso> = {}): SgsstAso {
  return {
    id: "a1",
    empresa_id: "e1",
    colaborador_id: "c1",
    numero_documento: "ASO-2026-0001",
    data_emissao: "2026-08-20",
    tipo: "Periódico",
    aptidao: "APTO",
    validade: "2027-08-20",
    medico_responsavel: "Dr. Carlos Lima",
    crm_medico: "CRM-SP 111111",
    medico_coordenador: "Dra. Ana Prado",
    crm_coordenador: "CRM-SP 222222",
    descricao_riscos: "Ruído acima de 85 dB(A) e poeira de sílica cristalina.",
    empresa_nome: "Construtora Exemplo Ltda",
    empresa_cnpj: "12.345.678/0001-90",
    status: "ATIVO",
    colaborador: {
      id: "c1",
      cpf: "123.456.789-00",
      profile: { id: "u1", nome: "José da Silva" },
      funcao: { id: "f1", nome: "Eletricista" },
    },
    exames: [
      {
        id: "v1",
        aso_id: "a1",
        exame_id: "x1",
        exame: {
          id: "x1",
          nome_exame: "Audiometria tonal",
          tipo: "Periódico",
          data_realizacao: "2026-08-18",
          resultado: "Normal",
          status: "REALIZADO",
        },
      },
    ],
    ...over,
  } as SgsstAso;
}

describe("pendenciasAso", () => {
  it("não reclama de um ASO completo", () => {
    expect(pendenciasAso(asoCompleto())).toEqual([]);
  });

  it("cobra a descrição dos riscos, que é obrigatória no documento", () => {
    const p = pendenciasAso(asoCompleto({ descricao_riscos: null }));
    expect(p.some((x) => /perigos e fatores de risco/i.test(x))).toBe(true);
  });

  it("cobra os dois médicos separadamente", () => {
    const p = pendenciasAso(
      asoCompleto({ medico_coordenador: null, crm_coordenador: null })
    );
    expect(p.some((x) => /coordenador do PCMSO/i.test(x))).toBe(true);
    expect(p.some((x) => /CRM do coordenador/i.test(x))).toBe(true);
    // O examinador estava preenchido: não deve aparecer.
    expect(p.some((x) => /examinador/i.test(x))).toBe(false);
  });

  it("cobra o CPF do trabalhador", () => {
    const p = pendenciasAso(
      asoCompleto({
        colaborador: { id: "c1", cpf: "", profile: { id: "u1", nome: "José" } } as never,
      })
    );
    expect(p.some((x) => /CPF/i.test(x))).toBe(true);
  });

  it("cobra o CNPJ da organização", () => {
    expect(pendenciasAso(asoCompleto({ empresa_cnpj: null })).some((x) => /CNPJ/i.test(x))).toBe(
      true
    );
  });

  it("cobra ASO sem nenhum exame vinculado", () => {
    const p = pendenciasAso(asoCompleto({ exames: [], exame_id: null }));
    expect(p.some((x) => /exames realizados/i.test(x))).toBe(true);
  });

  it("aceita o vínculo antigo de exame único, para não cobrar ASO já emitido", () => {
    const p = pendenciasAso(asoCompleto({ exames: [], exame_id: "x9" }));
    expect(p.some((x) => /exames realizados/i.test(x))).toBe(false);
  });

  it("exige a descrição da restrição quando a aptidão é com restrição", () => {
    const p = pendenciasAso(
      asoCompleto({ aptidao: "APTO_COM_RESTRICAO", descricao_restricao: null })
    );
    expect(p.some((x) => /restrição/i.test(x))).toBe(true);
  });

  it("não exige descrição de restrição quando o trabalhador é apto", () => {
    const p = pendenciasAso(asoCompleto({ aptidao: "APTO", descricao_restricao: null }));
    expect(p.some((x) => /descrição da restrição/i.test(x))).toBe(false);
  });
});

describe("montarHtmlAso", () => {
  it("traz os campos de identificação exigidos pela norma", () => {
    const html = montarHtmlAso(asoCompleto());
    expect(html).toContain("Construtora Exemplo Ltda");
    expect(html).toContain("12.345.678/0001-90");
    expect(html).toContain("José da Silva");
    expect(html).toContain("123.456.789-00");
    expect(html).toContain("Eletricista");
  });

  it("usa o nome congelado no ASO, não o da empresa atual", () => {
    const html = montarHtmlAso(asoCompleto({ empresa_nome: "Razão Social Antiga S/A" }));
    expect(html).toContain("Razão Social Antiga S/A");
  });

  it("assina com os dois médicos, em papéis distintos", () => {
    const html = montarHtmlAso(asoCompleto());
    expect(html).toContain("Médico examinador");
    expect(html).toContain("Dr. Carlos Lima");
    expect(html).toContain("Médico coordenador do PCMSO");
    expect(html).toContain("Dra. Ana Prado");
  });

  it("lista todos os exames vinculados, com data e resultado", () => {
    const html = montarHtmlAso(
      asoCompleto({
        exames: [
          {
            id: "v1",
            aso_id: "a1",
            exame_id: "x1",
            exame: {
              id: "x1",
              nome_exame: "Audiometria tonal",
              tipo: "Periódico",
              data_realizacao: "2026-08-18",
              resultado: "Normal",
              status: "REALIZADO",
            },
          },
          {
            id: "v2",
            aso_id: "a1",
            exame_id: "x2",
            exame: {
              id: "x2",
              nome_exame: "Espirometria",
              tipo: "Periódico",
              data_realizacao: "2026-08-19",
              resultado: "Alterado",
              status: "REALIZADO",
            },
          },
        ],
      })
    );
    expect(html).toContain("Audiometria tonal");
    expect(html).toContain("Espirometria");
    expect(html).toContain("18/08/2026");
    expect(html).toContain("19/08/2026");
  });

  it("destaca o campo obrigatório vazio em vez de deixar em branco", () => {
    const html = montarHtmlAso(asoCompleto({ descricao_riscos: null }));
    expect(html).toContain("aso-pendente");
    expect(html).toMatch(/Campo obrigat[óo]rio/i);
  });

  it("avisa quando não há exame nenhum", () => {
    const html = montarHtmlAso(asoCompleto({ exames: [], exame_id: null }));
    expect(html).toMatch(/Nenhum exame vinculado/i);
  });

  it("mostra a conclusão de aptidão em destaque", () => {
    expect(montarHtmlAso(asoCompleto({ aptidao: "INAPTO" }))).toContain("INAPTO");
    expect(montarHtmlAso(asoCompleto({ aptidao: "APTO_COM_RESTRICAO" }))).toContain(
      "APTO COM RESTRIÇÃO"
    );
  });

  it("mostra o bloco de restrição só quando a aptidão é com restrição", () => {
    const comRestricao = montarHtmlAso(
      asoCompleto({
        aptidao: "APTO_COM_RESTRICAO",
        descricao_restricao: "Vedado trabalho em altura.",
        data_inicio_restricao: "2026-08-20",
      })
    );
    expect(comRestricao).toContain("Vedado trabalho em altura.");

    const apto = montarHtmlAso(asoCompleto({ aptidao: "APTO" }));
    expect(apto).not.toContain("Vedado trabalho em altura.");
  });

  it("tem espaço para a ciência do trabalhador", () => {
    expect(montarHtmlAso(asoCompleto())).toContain("Ciência do trabalhador");
  });

  it("escapa HTML dos campos de texto", () => {
    const html = montarHtmlAso(
      asoCompleto({ descricao_riscos: '<img src=x onerror="alert(1)">' })
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("cai para o nome do recurso quando não há profile", () => {
    const html = montarHtmlAso(
      asoCompleto({
        colaborador: {
          id: "c1",
          cpf: "111",
          profile: null,
          recurso: { id: "r1", nome: "Maria Terceirizada" },
        } as never,
      })
    );
    expect(html).toContain("Maria Terceirizada");
  });
});
