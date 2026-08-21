import { describe, it, expect } from "vitest";
import {
  montarHtmlInspecao,
  pendenciasInspecao,
  resumoConformidadeInspecao,
  type InspecaoDocumentoDados,
} from "@/lib/inspecaoDocumento";
import type {
  SgsstInspecao,
  SgsstInspecaoItem,
  SgsstInspecaoNaoConformidade,
} from "@/hooks/sgsst/useSgsstInspecoes";

/**
 * O que estes testes protegem é a conta do índice de conformidade. É a que mais
 * se falseia sozinha: um checklist com 5 conformes e 35 "não aplicáveis" não tem
 * 100% de conformidade — tem 5 itens verificados. Um índice inflado no relatório
 * de inspeção é pior que nenhum índice.
 */

const INSPECAO: SgsstInspecao = {
  id: "i1",
  empresa_id: "e1",
  projeto_id: "pj1",
  codigo: "INSP-2026-041",
  titulo: "Inspeção semanal de andaimes — Bloco C",
  tipo: "PERIODICA" as SgsstInspecao["tipo"],
  data_planejada: "2026-08-17",
  data_execucao: "2026-08-17",
  status: "CONCLUIDA",
  projeto: { id: "pj1", codigo: "OBR-03", nome: "Residencial Aurora" },
  area: { id: "a1", nome: "Bloco C" },
  responsavel: { id: "u1", nome: "Carlos Andrade" },
};

function item(over: Partial<SgsstInspecaoItem> = {}): SgsstInspecaoItem {
  return {
    id: "it1",
    empresa_id: "e1",
    inspecao_id: "i1",
    ordem: 1,
    descricao: "Rodapé instalado em toda a plataforma",
    obrigatorio: true,
    resposta: "CONFORME",
    ...over,
  };
}

const NC: SgsstInspecaoNaoConformidade = {
  id: "nc1",
  empresa_id: "e1",
  inspecao_id: "i1",
  item_id: "it2",
  descricao: "Plataforma sem rodapé no vão leste",
  evidencia: "Foto 03",
  criticidade: "ALTA",
  prazo: "2026-08-24",
  status: "ABERTA",
  responsavel: { id: "u2", nome: "Marina Reis" },
};

function dados(over: Partial<InspecaoDocumentoDados> = {}): InspecaoDocumentoDados {
  return {
    inspecao: INSPECAO,
    itens: [
      item({ id: "it1", ordem: 1, resposta: "CONFORME" }),
      item({ id: "it2", ordem: 2, resposta: "NAO_CONFORME" }),
    ],
    naoConformidades: [NC],
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("resumoConformidadeInspecao — a conta que não pode inflar", () => {
  it("percentual sobre os itens avaliados", () => {
    const r = resumoConformidadeInspecao([
      item({ id: "a", resposta: "CONFORME" }),
      item({ id: "b", resposta: "CONFORME" }),
      item({ id: "c", resposta: "NAO_CONFORME" }),
    ]);
    expect(r.avaliados).toBe(3);
    expect(r.percentual).toBeCloseTo(66.67, 1);
  });

  it("não aplicável fica FORA do denominador", () => {
    // 5 conformes e 35 n/a nao sao 100% de conformidade: sao 5 itens verificados.
    const itens = [
      ...Array.from({ length: 5 }, (_, i) => item({ id: `c${i}`, resposta: "CONFORME" })),
      ...Array.from({ length: 35 }, (_, i) =>
        item({ id: `n${i}`, resposta: "NAO_APLICAVEL" })
      ),
    ];
    const r = resumoConformidadeInspecao(itens);
    expect(r.avaliados).toBe(5);
    expect(r.naoAplicaveis).toBe(35);
    expect(r.percentual).toBe(100);
  });

  it("pendente também fica fora — não aconteceu ainda", () => {
    const r = resumoConformidadeInspecao([
      item({ id: "a", resposta: "CONFORME" }),
      item({ id: "b", resposta: "PENDENTE" }),
    ]);
    expect(r.avaliados).toBe(1);
    expect(r.pendentes).toBe(1);
    expect(r.percentual).toBe(100);
  });

  it("nada avaliado devolve nulo em vez de zero ou cem", () => {
    // Zero afirmaria conformidade nula; cem afirmaria conformidade total. Nenhum
    // dos dois e verdade quando nada foi verificado.
    const r = resumoConformidadeInspecao([item({ resposta: "NAO_APLICAVEL" })]);
    expect(r.percentual).toBeNull();
  });

  it("checklist vazio devolve nulo", () => {
    expect(resumoConformidadeInspecao([]).percentual).toBeNull();
  });

  it("o documento diz quantos itens ficaram fora da conta", () => {
    const html = montarHtmlInspecao(
      dados({
        itens: [
          item({ id: "a", resposta: "CONFORME" }),
          item({ id: "b", resposta: "NAO_APLICAVEL" }),
          item({ id: "c", resposta: "PENDENTE" }),
        ],
      })
    );
    expect(html).toContain("Fora da conta");
    expect(html).toContain("1 n/a · 1 pendente(s)");
  });

  it("o documento explica por que o cálculo exclui esses itens", () => {
    expect(montarHtmlInspecao(dados())).toContain("ficam fora do cálculo");
  });

  it("percentual sai em formato brasileiro", () => {
    expect(montarHtmlInspecao(dados())).toContain("50,0%");
  });
});

describe("montarHtmlInspecao", () => {
  it("identifica a inspeção, a obra e as datas", () => {
    const html = montarHtmlInspecao(dados());
    expect(html).toContain("Inspeção semanal de andaimes");
    expect(html).toContain("Residencial Aurora");
    expect(html).toContain("17/08/2026");
  });

  it("lista os itens na ordem definida", () => {
    const html = montarHtmlInspecao(
      dados({
        itens: [
          item({ id: "b", ordem: 2, descricao: "Segundo item" }),
          item({ id: "a", ordem: 1, descricao: "Primeiro item" }),
        ],
      })
    );
    expect(html.indexOf("Primeiro item")).toBeLessThan(html.indexOf("Segundo item"));
  });

  it("destaca o item não conforme", () => {
    const html = montarHtmlInspecao(dados());
    expect(html).toContain("doc-inapto");
    expect(html).toContain("Não conforme");
  });

  it("lista as não conformidades com responsável e prazo", () => {
    const html = montarHtmlInspecao(dados());
    expect(html).toContain("Plataforma sem rodapé no vão leste");
    expect(html).toContain("Marina Reis");
    expect(html).toContain("24/08/2026");
  });

  it("NC sem prazo e sem responsável sai marcada", () => {
    const html = montarHtmlInspecao(
      dados({ naoConformidades: [{ ...NC, prazo: null, responsavel: null }] })
    );
    expect(html).toContain("sem prazo");
    expect(html).toContain("não designado");
  });

  it("item não conforme sem NC aberta é apontado", () => {
    // Achado sem tratamento morre no papel.
    const html = montarHtmlInspecao(dados({ naoConformidades: [] }));
    expect(html).toContain("nenhuma não conformidade foi aberta");
  });

  it("inspeção toda conforme não recebe esse apontamento", () => {
    const html = montarHtmlInspecao(
      dados({ itens: [item({ resposta: "CONFORME" })], naoConformidades: [] })
    );
    expect(html).toContain("Nenhuma não conformidade registrada");
  });

  it("mostra o vínculo com PGR, APR ou PT quando existe", () => {
    const html = montarHtmlInspecao(
      dados({
        inspecao: {
          ...INSPECAO,
          pgr: { id: "g1", titulo: "PGR 2026" },
          pt: { id: "t1", titulo: "PT de altura" },
        },
      })
    );
    expect(html).toContain("PGR 2026");
    expect(html).toContain("PT de altura");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlInspecao(
      dados({ inspecao: { ...INSPECAO, titulo: '<script>alert("x")</script>' } })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlInspecao(dados());
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("montarHtmlInspecao — inspeção não concluída", () => {
  it.each(["PLANEJADA", "EM_EXECUCAO", "CANCELADA"] as const)(
    "%s sai com aviso de que não comprova verificação",
    (status) => {
      const html = montarHtmlInspecao(dados({ inspecao: { ...INSPECAO, status } }));
      expect(html).toContain("esta inspeção não foi concluída");
    }
  );

  it("inspeção concluída não recebe o aviso", () => {
    expect(montarHtmlInspecao(dados())).not.toContain("não foi concluída");
  });

  it("sem data de execução, o campo sai marcado", () => {
    const html = montarHtmlInspecao(
      dados({ inspecao: { ...INSPECAO, data_execucao: null } })
    );
    expect(html).toContain("não executada");
    expect(html).toContain("doc-falta");
  });
});

describe("pendenciasInspecao", () => {
  it("inspeção completa não acusa pendência", () => {
    expect(pendenciasInspecao(dados())).toEqual([]);
  });

  it("status não concluído é a primeira pendência", () => {
    const p = pendenciasInspecao(dados({ inspecao: { ...INSPECAO, status: "PLANEJADA" } }));
    expect(p[0]).toContain("não comprova verificação concluída");
  });

  it("acusa item obrigatório sem resposta", () => {
    const p = pendenciasInspecao(
      dados({ itens: [item({ obrigatorio: true, resposta: "PENDENTE" })] })
    );
    expect(p.join(" ")).toContain("obrigatório(s) sem resposta");
  });

  it("item não obrigatório pendente não é cobrado como obrigatório", () => {
    const p = pendenciasInspecao(
      dados({
        itens: [item({ obrigatorio: false, resposta: "PENDENTE" })],
        naoConformidades: [],
      })
    );
    expect(p.join(" ")).not.toContain("obrigatório(s) sem resposta");
  });

  it("acusa item não conforme sem NC aberta", () => {
    const p = pendenciasInspecao(dados({ naoConformidades: [] }));
    expect(p.join(" ")).toContain("sem não conformidade aberta");
  });

  it("item não conforme COM Nca aberta não é cobrado", () => {
    const p = pendenciasInspecao(dados());
    expect(p.join(" ")).not.toContain("sem não conformidade aberta");
  });

  it("acusa NC sem responsável e sem prazo", () => {
    const p = pendenciasInspecao(
      dados({ naoConformidades: [{ ...NC, responsavel: null, prazo: null }] })
    );
    expect(p.join(" ")).toContain("sem responsável designado");
    expect(p.join(" ")).toContain("sem prazo de tratamento");
  });

  it("acusa checklist vazio", () => {
    const p = pendenciasInspecao(dados({ itens: [], naoConformidades: [] }));
    expect(p.join(" ")).toContain("Nenhum item de verificação");
  });

  it("acusa responsável pela inspeção ausente", () => {
    const p = pendenciasInspecao(dados({ inspecao: { ...INSPECAO, responsavel: null } }));
    expect(p.join(" ")).toContain("Responsável pela inspeção");
  });
});
