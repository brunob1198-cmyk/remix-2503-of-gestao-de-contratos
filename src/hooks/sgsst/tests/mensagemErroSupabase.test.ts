import { describe, it, expect } from "vitest";
import { mensagemDeErroSupabase } from "@/utils/mensagemErroSupabase";

/**
 * O caso real: criar requisição de compra devolvia
 * "Could not find the 'tipo_compra' column of 'requisicoes_compra' in the
 * schema cache". A coluna não existia porque a migration não tinha sido
 * executada — e a mensagem crua manda procurar o defeito na tela.
 */

describe("banco atrás do aplicativo", () => {
  it("reconhece coluna ausente no formato do PostgREST e nomeia tabela.coluna", () => {
    const m = mensagemDeErroSupabase({
      message: "Could not find the 'tipo_compra' column of 'requisicoes_compra' in the schema cache",
    });
    expect(m).toContain("requisicoes_compra.tipo_compra");
    expect(m).toContain("migration");
    // Precisa dizer que nada foi gravado: sem isso a pessoa reenvia o formulário
    // achando que gravou pela metade.
    expect(m).toContain("Nada foi gravado");
  });

  it("reconhece coluna ausente no formato do Postgres", () => {
    const m = mensagemDeErroSupabase({
      message: 'column requisicoes_compra.tipo_compra does not exist',
      code: "42703",
    });
    expect(m).toContain("requisicoes_compra.tipo_compra");
    expect(m).toContain("migration");
  });

  it("reconhece tabela ausente e tira o prefixo public.", () => {
    const m = mensagemDeErroSupabase({
      message: "Could not find the table 'public.sc_alcadas' in the schema cache",
      code: "PGRST205",
    });
    expect(m).toContain('"sc_alcadas"');
    expect(m).not.toContain("public.");
    expect(m).toContain("migration");
  });

  it("reconhece relation ausente do Postgres", () => {
    const m = mensagemDeErroSupabase({ message: 'relation "sc_alcadas" does not exist' });
    expect(m).toContain('"sc_alcadas"');
  });
});

describe("erros que não são falha do sistema", () => {
  it("chave duplicada vira 'já existe', e não erro técnico", () => {
    const m = mensagemDeErroSupabase({
      code: "23505",
      message: 'duplicate key value violates unique constraint "x"',
    });
    expect(m).toContain("já existe");
    expect(m).not.toContain("duplicate key");
  });

  it("chave estrangeira explica o vínculo", () => {
    const m = mensagemDeErroSupabase({ code: "23503", message: "violates foreign key" });
    expect(m).toContain("vinculado");
  });

  it("RLS fala de permissão, e não de política", () => {
    const m = mensagemDeErroSupabase({ code: "42501", message: "row-level security" });
    expect(m).toContain("permissão");
  });

  it("CHECK mantém a mensagem original à vista, porque ela nomeia a regra", () => {
    const m = mensagemDeErroSupabase({
      code: "23514",
      message: 'violates check constraint "aso_riscos_coerencia"',
    });
    expect(m).toContain("aso_riscos_coerencia");
  });
});

describe("quando não há causa reconhecida", () => {
  it("devolve a mensagem original inalterada", () => {
    // Traduzir para uma frase genérica apagaria a unica pista disponivel.
    const original = "algo bem especifico que so o servidor sabe";
    expect(mensagemDeErroSupabase({ message: original })).toBe(original);
  });

  it("erro sem mensagem nenhuma ainda produz frase utilizavel", () => {
    expect(mensagemDeErroSupabase({})).toBeTruthy();
    expect(mensagemDeErroSupabase(null)).toBeTruthy();
    expect(mensagemDeErroSupabase(undefined)).toBeTruthy();
  });
});
