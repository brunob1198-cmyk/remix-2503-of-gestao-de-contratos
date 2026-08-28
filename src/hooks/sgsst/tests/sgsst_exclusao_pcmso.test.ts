import { describe, it, expect } from "vitest";
import { avisoExclusaoPcmso } from "@/utils/sgsstExclusaoPcmso";

/**
 * Excluir PCMSO tem duas consequencias assimetricas, e a segunda ninguem
 * adivinha: o plano de exames e o historico vao embora junto (CASCADE), mas os
 * ASOs e exames que apontavam para o programa SOBREVIVEM e perdem o vinculo
 * (SET NULL) — e o PDF do ASO imprime o PCMSO de referencia.
 */

describe("aviso de exclusao do PCMSO", () => {
  it("rascunho sem dependente: so avisa o que cascateia", () => {
    const a = avisoExclusaoPcmso({ status: "RASCUNHO", dependentes: { asos: 0, exames: 0 } });
    expect(a.desvinculaDocumento).toBe(false);
    expect(a.sugereCancelarEmVez).toBe(false);
    expect(a.linhas).toHaveLength(1);
    expect(a.linhas[0]).toContain("plano de exames");
  });

  it("com ASO vinculado, a PRIMEIRA linha e a consequencia mais grave", () => {
    const a = avisoExclusaoPcmso({ status: "RASCUNHO", dependentes: { asos: 3, exames: 0 } });
    expect(a.desvinculaDocumento).toBe(true);
    expect(a.linhas[0]).toContain("3 ASOs");
    // O que ninguem adivinha: o atestado sobrevive e o campo fica em branco.
    expect(a.linhas[0]).toContain("NÃO são apagados");
    expect(a.linhas[0]).toContain("PDF do ASO");
  });

  it("conta ASO e exame juntos, com plural correto", () => {
    const a = avisoExclusaoPcmso({ status: "RASCUNHO", dependentes: { asos: 1, exames: 5 } });
    expect(a.linhas[0]).toContain("1 ASO e 5 exames");
    expect(a.linhas[0]).not.toContain("1 ASOs");
  });

  it("so exame vinculado tambem dispara o aviso", () => {
    const a = avisoExclusaoPcmso({ status: "RASCUNHO", dependentes: { asos: 0, exames: 2 } });
    expect(a.desvinculaDocumento).toBe(true);
    expect(a.linhas[0]).toContain("2 exames");
    // A CONTAGEM nao deve citar ASO; a frase explicativa cita o PDF do ASO
    // legitimamente, e um `not.toContain("ASO")` cru confundiria as duas coisas.
    expect(a.linhas[0].split(" apontam para")[0]).not.toContain("ASO");
  });

  it("fora do rascunho, sugere cancelar em vez de excluir", () => {
    // Programa que produziu efeito pede status, nao exclusao: a NR-07 se
    // sustenta no historico.
    for (const status of ["ATIVO", "EM_REVISAO", "ENCERRADO", "CANCELADO"] as const) {
      const a = avisoExclusaoPcmso({ status, dependentes: { asos: 0, exames: 0 } });
      expect(a.sugereCancelarEmVez, status).toBe(true);
      expect(a.linhas.join(" ")).toContain("CANCELADO");
    }
  });

  it("rascunho NAO sugere cancelar: e o caso legitimo de excluir", () => {
    const a = avisoExclusaoPcmso({ status: "RASCUNHO", dependentes: { asos: 0, exames: 0 } });
    expect(a.linhas.join(" ")).not.toContain("CANCELADO");
  });

  it("nunca promete que a exclusao apaga o ASO", () => {
    // O oposto seria pior que nao avisar: faria a pessoa achar que apagou o
    // atestado, e ele continua valendo la.
    const a = avisoExclusaoPcmso({ status: "ATIVO", dependentes: { asos: 4, exames: 4 } });
    const texto = a.linhas.join(" ").toLowerCase();
    expect(texto).not.toMatch(/apaga os asos|exclui os asos|remove os asos/);
  });
});
