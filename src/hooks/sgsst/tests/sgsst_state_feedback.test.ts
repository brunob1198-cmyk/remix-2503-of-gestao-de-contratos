import { describe, it, expect } from "vitest";
import { classifySgsstError } from "@/utils/sgsstErrors";
import { escapeSearchTerm } from "@/utils/sgsstSearch";

describe("classifySgsstError", () => {
  it("reconhece tabela ausente pelo codigo PGRST205 do PostgREST", () => {
    const r = classifySgsstError(
      { code: "PGRST205", message: "Could not find the table 'public.sgsst_pgr' in the schema cache" },
      "PGR"
    );
    expect(r.kind).toBe("schema");
    expect(r.titulo).toContain("PGR");
    expect(r.descricao).toContain("db push");
  });

  it("reconhece tabela ausente pelo codigo 42P01 do Postgres", () => {
    expect(classifySgsstError({ code: "42P01" }, "APR").kind).toBe("schema");
  });

  it("reconhece tabela ausente apenas pela mensagem, sem codigo", () => {
    expect(
      classifySgsstError({ message: 'relation "sgsst_apr" does not exist' }, "APR").kind
    ).toBe("schema");
  });

  it("nao confunde falta de permissao com falta de tabela", () => {
    const r = classifySgsstError(
      { code: "42501", message: "permission denied for table sgsst_pgr" },
      "PGR"
    );
    expect(r.kind).toBe("permissao");
    expect(r.descricao).not.toContain("db push");
  });

  it("trata RLS e JWT expirado como problema de acesso", () => {
    expect(classifySgsstError({ message: "new row violates row-level security policy" }, "PT").kind)
      .toBe("permissao");
    expect(classifySgsstError({ code: "PGRST301" }, "PT").kind).toBe("permissao");
  });

  it("separa falha de rede de falha de banco", () => {
    expect(classifySgsstError({ message: "Failed to fetch" }, "EPI").kind).toBe("conexao");
    expect(classifySgsstError(new TypeError("Load failed"), "EPI").kind).toBe("conexao");
  });

  it("cai no caso desconhecido sem quebrar em entradas atipicas", () => {
    expect(classifySgsstError(null, "PGR").kind).toBe("desconhecido");
    expect(classifySgsstError("erro solto", "PGR").kind).toBe("desconhecido");
    expect(classifySgsstError({}, "PGR").kind).toBe("desconhecido");
    expect(classifySgsstError({ code: 500 }, "PGR").kind).toBe("desconhecido");
  });

  it("expoe o detalhe tecnico quando existe e o omite quando nao ha nada", () => {
    expect(classifySgsstError({ code: "PGRST205", message: "boom" }, "PGR").detalhe).toBe(
      "PGRST205 — boom"
    );
    expect(classifySgsstError({}, "PGR").detalhe).toBeUndefined();
  });
});

describe("escapeSearchTerm", () => {
  it("remove os separadores que quebram a sintaxe do filtro or do PostgREST", () => {
    // Sem escape, "laudo, 2026" viraria duas condicoes e a query falharia com 400.
    expect(escapeSearchTerm("laudo, 2026")).toBe("laudo  2026");
    expect(escapeSearchTerm('capacete (novo)')).toBe("capacete  novo");
    expect(escapeSearchTerm('aspas "duplas"')).toBe("aspas  duplas");
  });

  it("neutraliza os curingas do LIKE para a busca nao mudar de padrao", () => {
    expect(escapeSearchTerm("100%")).toBe("100\\%");
    expect(escapeSearchTerm("a_b")).toBe("a\\_b");
  });

  it("apara espacos das pontas", () => {
    expect(escapeSearchTerm("  ancoragem  ")).toBe("ancoragem");
  });

  it("devolve string vazia quando o termo era so pontuacao, para o filtro ser omitido", () => {
    expect(escapeSearchTerm(",,,")).toBe("");
    expect(escapeSearchTerm("   ")).toBe("");
  });
});
