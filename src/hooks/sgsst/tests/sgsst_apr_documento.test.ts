import { describe, it, expect } from "vitest";
import {
  montarHtmlApr,
  pendenciasApr,
  riscosDaEtapa,
  medidasDoRisco,
  somenteEpi,
  type AprDocumentoDados,
} from "@/lib/aprDocumento";
import type {
  SgsstApr,
  SgsstAprEtapa,
  SgsstAprRisco,
  SgsstAprMedida,
  SgsstAprParticipante,
} from "@/hooks/sgsst/useSgsstApr";

/**
 * A APR é o documento que a equipe lê antes de começar. O que estes testes
 * cobram é a estrutura que faz dela uma análise e não uma lista: etapa → riscos
 * da etapa → medidas de cada risco, com a hierarquia de controle na ordem certa.
 */

const APR: SgsstApr = {
  id: "apr1",
  empresa_id: "e1",
  projeto_id: "pj1",
  codigo: "APR-2026-008",
  titulo: "Montagem de estrutura metálica do galpão B",
  atividade: "Içamento e fixação de treliças a 12 m",
  descricao: "Serviço em duas frentes, com guindaste de 30 t.",
  data: "2026-08-03",
  validade: "2026-11-03",
  status: "APROVADA",
  projeto: { id: "pj1", codigo: "OBR-02", nome: "Galpão Logístico Sul" },
  area: { id: "a1", nome: "Pátio de montagem" },
  responsavel: { id: "u1", nome: "Marina Reis" },
};

const ETAPA_1: SgsstAprEtapa = {
  id: "et1",
  empresa_id: "e1",
  apr_id: "apr1",
  ordem: 1,
  descricao: "Preparação do terreno e posicionamento do guindaste",
  responsavel: { id: "u2", nome: "Carlos Andrade" },
};

const ETAPA_2: SgsstAprEtapa = {
  id: "et2",
  empresa_id: "e1",
  apr_id: "apr1",
  ordem: 2,
  descricao: "Içamento e fixação das treliças",
};

const RISCO_1: SgsstAprRisco = {
  id: "r1",
  empresa_id: "e1",
  etapa_id: "et1",
  perigo: "Solo sem capacidade de carga",
  risco: "Tombamento do guindaste",
  consequencia: "Óbito ou lesão grave",
  probabilidade: 2,
  severidade: 5,
  nivel_risco: 10,
  classificacao: "ALTO",
};

const RISCO_2: SgsstAprRisco = {
  id: "r2",
  empresa_id: "e1",
  etapa_id: "et2",
  perigo: "Trabalho em altura",
  risco: "Queda de nível diferente",
  consequencia: "Óbito",
  probabilidade: 3,
  severidade: 5,
  nivel_risco: 15,
  classificacao: "CRÍTICO",
};

const MEDIDA_ENG: SgsstAprMedida = {
  id: "m1",
  empresa_id: "e1",
  apr_risco_id: "r1",
  descricao: "Compactação e laudo geotécnico do ponto de apoio",
  tipo: "Engenharia",
  status: "implementado",
  prazo: "2026-08-01",
  responsavel: { id: "u2", nome: "Carlos Andrade" },
};

const MEDIDA_EPI: SgsstAprMedida = {
  id: "m2",
  empresa_id: "e1",
  apr_risco_id: "r2",
  descricao: "Cinto tipo paraquedista com talabarte duplo",
  tipo: "EPI",
  status: "implementado",
};

const PARTICIPANTE: SgsstAprParticipante = {
  id: "p1",
  empresa_id: "e1",
  apr_id: "apr1",
  participacao: "Executante",
  confirmacao: true,
  colaborador_dados: { id: "c1", profile: { nome: "José da Silva" } },
  funcao: { id: "f1", nome: "Montador" },
};

function dados(over: Partial<AprDocumentoDados> = {}): AprDocumentoDados {
  return {
    apr: APR,
    etapas: [ETAPA_1, ETAPA_2],
    riscos: [RISCO_1, RISCO_2],
    medidas: [MEDIDA_ENG, MEDIDA_EPI],
    participantes: [PARTICIPANTE],
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("montarHtmlApr — a estrutura da análise", () => {
  it("identifica a atividade, a obra e a validade", () => {
    const html = montarHtmlApr(dados());
    expect(html).toContain("Içamento e fixação de treliças a 12 m");
    expect(html).toContain("Galpão Logístico Sul");
    expect(html).toContain("03/11/2026");
  });

  it("cria um bloco por etapa, na ordem", () => {
    const html = montarHtmlApr(dados());
    expect(html).toContain("Etapa 1 — Preparação do terreno");
    expect(html).toContain("Etapa 2 — Içamento e fixação");
    expect(html.indexOf("Etapa 1")).toBeLessThan(html.indexOf("Etapa 2"));
  });

  it("põe cada risco na etapa a que pertence", () => {
    const html = montarHtmlApr(dados());
    const posEtapa2 = html.indexOf("Etapa 2");
    // O risco de altura e da etapa 2: tem de aparecer depois do titulo dela.
    expect(html.indexOf("Queda de nível diferente")).toBeGreaterThan(posEtapa2);
    expect(html.indexOf("Tombamento do guindaste")).toBeLessThan(posEtapa2);
  });

  it("imprime a conta do nível de risco, não só a classificação", () => {
    const html = montarHtmlApr(dados());
    expect(html).toContain("2 × 5 = 10");
    expect(html).toContain("ALTO");
  });

  it("mostra o responsável da etapa quando há", () => {
    expect(montarHtmlApr(dados())).toContain("Responsável pela etapa: Carlos Andrade");
  });

  it("dá uma linha de assinatura por participante", () => {
    const html = montarHtmlApr(
      dados({
        participantes: [PARTICIPANTE, { ...PARTICIPANTE, id: "p2" }],
      })
    );
    const linhas = html.match(/class="doc-assin-linha"/g) ?? [];
    expect(linhas).toHaveLength(2);
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlApr(
      dados({ apr: { ...APR, atividade: '<script>alert("x")</script>' } })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlApr(dados());
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("montarHtmlApr — risco sem medida de controle", () => {
  it("marca o risco e avisa no alto do documento", () => {
    // E a falha mais comum e a mais seria numa APR: identificar o perigo e nao
    // dizer o que fazer a respeito.
    const html = montarHtmlApr(dados({ medidas: [] }));
    expect(html).toContain("Nenhuma medida de controle definida");
    expect(html).toContain("2 risco(s) sem medida de controle");
  });

  it("APR completa não recebe esse aviso", () => {
    expect(montarHtmlApr(dados())).not.toContain("risco(s) sem medida de controle");
  });

  it("etapa sem risco levantado sai marcada", () => {
    const html = montarHtmlApr(dados({ riscos: [RISCO_1] }));
    expect(html).toContain("Etapa sem risco identificado");
  });

  it("APR sem etapa alguma diz que não houve análise", () => {
    const html = montarHtmlApr(dados({ etapas: [], riscos: [], medidas: [] }));
    expect(html).toContain("Nenhuma etapa descrita");
    expect(html).toContain("apenas um título");
  });
});

describe("montarHtmlApr — status", () => {
  it.each(["RASCUNHO", "EM_ANALISE", "REJEITADA", "CANCELADA"] as const)(
    "%s sai com aviso de que não está aprovada",
    (status) => {
      const html = montarHtmlApr(dados({ apr: { ...APR, status } }));
      expect(html).toContain("esta análise não está aprovada");
    }
  );

  it("APR aprovada não recebe o aviso", () => {
    expect(montarHtmlApr(dados())).not.toContain("não está aprovada");
  });

  it("APR encerrada também não — ela foi válida no período", () => {
    const html = montarHtmlApr(dados({ apr: { ...APR, status: "ENCERRADA" } }));
    expect(html).not.toContain("não está aprovada");
  });
});

describe("riscosDaEtapa", () => {
  it("filtra pela etapa", () => {
    expect(riscosDaEtapa(dados(), "et1")).toEqual([RISCO_1]);
    expect(riscosDaEtapa(dados(), "et2")).toEqual([RISCO_2]);
  });

  it("etapa sem risco devolve lista vazia", () => {
    expect(riscosDaEtapa(dados(), "et9")).toEqual([]);
  });
});

describe("medidasDoRisco e a hierarquia de controle", () => {
  it("filtra pelo risco", () => {
    expect(medidasDoRisco(dados(), "r1")).toEqual([MEDIDA_ENG]);
  });

  it("ordena da medida mais eficaz para a menos eficaz", () => {
    // NR-01 1.5.4.4.3: eliminacao, substituicao, engenharia, administrativa, EPI.
    const todas: SgsstAprMedida[] = [
      { ...MEDIDA_EPI, id: "a", apr_risco_id: "r1", tipo: "EPI" },
      { ...MEDIDA_EPI, id: "b", apr_risco_id: "r1", tipo: "Administrativa" },
      { ...MEDIDA_EPI, id: "c", apr_risco_id: "r1", tipo: "Eliminação" },
      { ...MEDIDA_EPI, id: "d", apr_risco_id: "r1", tipo: "Engenharia" },
      { ...MEDIDA_EPI, id: "e", apr_risco_id: "r1", tipo: "Substituição" },
    ];

    const ordem = medidasDoRisco({ ...dados(), medidas: todas }, "r1").map((m) => m.tipo);
    expect(ordem).toEqual([
      "Eliminação",
      "Substituição",
      "Engenharia",
      "Administrativa",
      "EPI",
    ]);
  });

  it("a medida mais eficaz aparece primeiro no documento", () => {
    const html = montarHtmlApr(
      dados({
        medidas: [
          { ...MEDIDA_EPI, apr_risco_id: "r1", descricao: "Luva anticorte" },
          { ...MEDIDA_ENG, descricao: "Guarda-corpo definitivo" },
        ],
      })
    );
    expect(html.indexOf("Guarda-corpo definitivo")).toBeLessThan(
      html.indexOf("Luva anticorte")
    );
  });
});

describe("somenteEpi", () => {
  it("verdadeiro quando o EPI é o único controle", () => {
    expect(somenteEpi([MEDIDA_EPI])).toBe(true);
  });

  it("falso quando há controle mais alto na hierarquia", () => {
    expect(somenteEpi([MEDIDA_EPI, MEDIDA_ENG])).toBe(false);
  });

  it("lista vazia é falso — ausência de medida é outro problema", () => {
    expect(somenteEpi([])).toBe(false);
  });

  it("o documento registra quando sobrou só EPI", () => {
    // Nao e erro por si: ha risco em que o EPI e o controle possivel. Mas quem
    // assina precisa ver que nada mais foi tentado antes.
    const html = montarHtmlApr(dados());
    expect(html).toContain("Somente EPI");
    expect(html).toContain("1.5.4.4.3");
  });
});

describe("pendenciasApr", () => {
  it("APR completa não acusa pendência", () => {
    expect(pendenciasApr(dados())).toEqual([]);
  });

  it("status não aprovado é a primeira pendência", () => {
    const p = pendenciasApr(dados({ apr: { ...APR, status: "RASCUNHO" } }));
    expect(p[0]).toContain("não vale como análise aprovada");
  });

  it("acusa risco sem medida citando o motivo", () => {
    const p = pendenciasApr(dados({ medidas: [] }));
    expect(p.join(" ")).toContain("sem medida de controle");
    expect(p.join(" ")).toContain("não protege ninguém");
  });

  it("acusa etapa sem risco", () => {
    const p = pendenciasApr(dados({ riscos: [RISCO_1] }));
    expect(p.join(" ")).toContain("etapa(s) sem risco levantado");
  });

  it("acusa APR sem etapa", () => {
    const p = pendenciasApr(dados({ etapas: [], riscos: [], medidas: [] }));
    expect(p.join(" ")).toContain("Nenhuma etapa descrita");
  });

  it("acusa equipe vazia", () => {
    const p = pendenciasApr(dados({ participantes: [] }));
    expect(p.join(" ")).toContain("Nenhum participante");
  });

  it("acusa responsável técnico ausente", () => {
    const p = pendenciasApr(dados({ apr: { ...APR, responsavel: null } }));
    expect(p.join(" ")).toContain("Responsável técnico");
  });

  it("acusa APR sem validade", () => {
    const p = pendenciasApr(dados({ apr: { ...APR, validade: null } }));
    expect(p.join(" ")).toContain("Sem validade definida");
  });

  it("acusa organização ausente", () => {
    const p = pendenciasApr(dados({ empresa: null }));
    expect(p.join(" ")).toContain("organização");
  });
});
