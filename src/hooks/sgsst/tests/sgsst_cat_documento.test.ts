import { describe, it, expect } from "vitest";
import { montarHtmlCat, pendenciasCat, type CatDocumentoDados } from "@/lib/catDocumento";
import type { SgsstCat } from "@/hooks/sgsst/useSgsstCats";

/**
 * A CAT impressa vai para cliente, seguradora e fiscalização. Campo obrigatório
 * saindo em branco esconde a falta de quem assina, então os testes cobram que a
 * ausência apareça marcada — e que o documento diga, em destaque, que não
 * substitui a CAT oficial do INSS.
 */

const CAT_COMPLETA: SgsstCat = {
  id: "cat-1",
  empresa_id: "emp-1",
  numero_cat: "2026000123456",
  tipo_cat: "INICIAL",
  colaborador_id: "col-1",
  incidente_id: "inc-1",
  projeto_id: "proj-1",
  area_id: "area-1",
  data_acidente: "2026-07-15",
  data_emissao: "2026-07-16",
  cid: "S62.6",
  descricao: "Corte no dedo ao manusear chapa metálica sem luva adequada.",
  dias_afastamento: 8,
  houve_obito: false,
  colaborador: {
    id: "col-1",
    cpf: "123.456.789-00",
    profile: { id: "p1", nome: "José da Silva" },
    funcao: { id: "f1", nome: "Serralheiro" },
  },
  area: { id: "area-1", nome: "Oficina" },
  projeto: { id: "proj-1", codigo: "OB01", nome: "Obra Norte" },
  incidente: { id: "inc-1", codigo: "INC-2026-004", titulo: "Corte em chapa" },
};

function dados(over: Partial<CatDocumentoDados> = {}): CatDocumentoDados {
  return {
    cat: CAT_COMPLETA,
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("montarHtmlCat", () => {
  it("avisa em destaque que nao substitui a CAT oficial", () => {
    // Sem esse aviso alguem entregaria isto no lugar do documento do INSS, o que
    // e pior que nao ter documento nenhum.
    const html = montarHtmlCat(dados());
    expect(html).toContain("não substitui a CAT oficial");
    expect(html).toContain("INSS");
    expect(html).toContain("doc-aviso");
  });

  it("identifica a organizacao e o numero da CAT", () => {
    const html = montarHtmlCat(dados());
    expect(html).toContain("Construtora Exemplo LTDA");
    expect(html).toContain("12.345.678/0001-99");
    expect(html).toContain("2026000123456");
  });

  it("traz o trabalhador com CPF e funcao", () => {
    const html = montarHtmlCat(dados());
    expect(html).toContain("José da Silva");
    expect(html).toContain("123.456.789-00");
    expect(html).toContain("Serralheiro");
  });

  it("traz a obra, o setor e a ocorrencia vinculada", () => {
    const html = montarHtmlCat(dados());
    expect(html).toContain("Obra Norte");
    expect(html).toContain("Oficina");
    expect(html).toContain("INC-2026-004");
  });

  it("traz CID, dias de afastamento e datas", () => {
    const html = montarHtmlCat(dados());
    expect(html).toContain("S62.6");
    expect(html).toContain("15/07/2026");
    expect(html).toContain("16/07/2026");
  });

  it("marca numero da CAT ausente em vez de deixar em branco", () => {
    const html = montarHtmlCat(dados({ cat: { ...CAT_COMPLETA, numero_cat: null } }));
    expect(html).toContain("não registrado");
    expect(html).toContain("doc-falta");
  });

  it("marca CPF ausente", () => {
    const html = montarHtmlCat(
      dados({
        cat: {
          ...CAT_COMPLETA,
          colaborador: { ...CAT_COMPLETA.colaborador!, cpf: null },
        },
      })
    );
    expect(html).toContain("não informado");
  });

  it("avisa quando a descricao do acidente esta vazia", () => {
    const html = montarHtmlCat(dados({ cat: { ...CAT_COMPLETA, descricao: null } }));
    expect(html).toContain("Descrição do acidente não preenchida");
  });

  it("destaca o obito quando houve", () => {
    const html = montarHtmlCat(
      dados({ cat: { ...CAT_COMPLETA, houve_obito: true, tipo_cat: "COMUNICACAO_OBITO" } })
    );
    expect(html).toContain("SIM");
    expect(html).toContain("doc-pior");
  });

  it("diz quando nao ha incidente vinculado, em vez de deixar vazio", () => {
    const html = montarHtmlCat(
      dados({ cat: { ...CAT_COMPLETA, incidente_id: null, incidente: null } })
    );
    expect(html).toContain("Sem registro de incidente vinculado");
  });

  it("tem os dois campos de assinatura", () => {
    const html = montarHtmlCat(dados());
    expect(html).toContain("Responsável pela emissão");
    expect(html).toContain("Ciência do trabalhador");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlCat(
      dados({ cat: { ...CAT_COMPLETA, descricao: '<script>alert("x")</script>' } })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlCat(dados());
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("pendenciasCat", () => {
  it("CAT completa nao acusa pendencia", () => {
    expect(pendenciasCat(dados())).toEqual([]);
  });

  it("acusa numero da CAT ausente", () => {
    const p = pendenciasCat(dados({ cat: { ...CAT_COMPLETA, numero_cat: null } }));
    expect(p.join(" ")).toContain("Número da CAT");
    expect(p.join(" ")).toContain("INSS");
  });

  it("acusa trabalhador nao vinculado", () => {
    const p = pendenciasCat(
      dados({ cat: { ...CAT_COMPLETA, colaborador_id: null, colaborador: null } })
    );
    expect(p.join(" ")).toContain("Trabalhador acidentado não vinculado");
  });

  it("acusa descricao e CID ausentes", () => {
    const p = pendenciasCat(dados({ cat: { ...CAT_COMPLETA, descricao: "", cid: null } }));
    expect(p.join(" ")).toContain("Descrição do acidente");
    expect(p.join(" ")).toContain("CID");
  });

  it("acusa CNPJ da organizacao ausente", () => {
    const p = pendenciasCat(dados({ empresa: { nome: "X", cnpj: null } }));
    expect(p.join(" ")).toContain("CNPJ");
  });

  it("acusa obro marcado com tipo de CAT incoerente", () => {
    // Obito tem prazo e tratamento proprios; tipo errado esconde isso.
    const p = pendenciasCat(
      dados({ cat: { ...CAT_COMPLETA, houve_obito: true, tipo_cat: "INICIAL" } })
    );
    expect(p.join(" ")).toContain("Comunicação de Óbito");
  });

  it("nao acusa incoerencia quando obito e tipo batem", () => {
    const p = pendenciasCat(
      dados({ cat: { ...CAT_COMPLETA, houve_obito: true, tipo_cat: "COMUNICACAO_OBITO" } })
    );
    expect(p.join(" ")).not.toContain("Comunicação de Óbito");
  });

  it("acusa obra nao vinculada", () => {
    const p = pendenciasCat(
      dados({ cat: { ...CAT_COMPLETA, projeto_id: null, projeto: null } })
    );
    expect(p.join(" ")).toContain("Obra do acidente");
  });
});
