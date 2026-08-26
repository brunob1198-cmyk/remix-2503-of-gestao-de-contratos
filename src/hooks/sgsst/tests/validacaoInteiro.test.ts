import { describe, it, expect } from "vitest";
import { validarInteiroPositivo, lerInteiroPositivo } from "@/utils/validacaoInteiro";

/**
 * Os campos de contagem do vínculo de função: quantidade padrão de EPI e
 * periodicidade de troca em meses.
 *
 * O caso que estes testes protegem é a diferença entre VAZIO e ZERO. Vazio na
 * periodicidade significa "sem troca programada" — uma decisão. Zero mês seria
 * um prazo impossível, e gravado como número faria o sistema cobrar troca todo
 * dia. São coisas diferentes e o campo tem de tratá-las como diferentes.
 */

describe("validarInteiroPositivo", () => {
  const obrigatorio = validarInteiroPositivo(true, "a quantidade");
  const opcional = validarInteiroPositivo(false, "a troca");

  it("aceita inteiro positivo", () => {
    expect(obrigatorio("1")).toBeNull();
    expect(obrigatorio("12")).toBeNull();
    expect(opcional("6")).toBeNull();
  });

  it("recusa zero — não é o mesmo que deixar em branco", () => {
    expect(obrigatorio("0")).not.toBeNull();
    expect(opcional("0")).not.toBeNull();
  });

  it("recusa negativo", () => {
    expect(obrigatorio("-3")).not.toBeNull();
    expect(opcional("-1")).not.toBeNull();
  });

  it("recusa fracionário: não existe meia unidade de EPI nem meio mês de troca", () => {
    expect(obrigatorio("1.5")).not.toBeNull();
    expect(obrigatorio("2,5")).not.toBeNull();
  });

  it("aceita vírgula quando o valor resultante é inteiro", () => {
    // Quem digita "1,0" quis dizer 1. Recusar seria rejeitar em silêncio.
    expect(obrigatorio("1,0")).toBeNull();
  });

  it("recusa texto que não é número", () => {
    expect(obrigatorio("seis")).not.toBeNull();
    expect(opcional("6 meses")).not.toBeNull();
  });

  it("exige valor quando obrigatório, e aceita vazio quando não é", () => {
    expect(obrigatorio("")).not.toBeNull();
    expect(opcional("")).toBeNull();
  });

  it("nomeia o campo na mensagem, para o erro dizer qual campo corrigir", () => {
    expect(obrigatorio("0")).toContain("quantidade");
    expect(opcional("0")).toContain("troca");
    expect(obrigatorio("")).toContain("a quantidade");
  });

  it("começa a mensagem com maiúscula", () => {
    // O nome do campo entra em minúscula ("a troca") para caber em "Informe a
    // troca."; na frase que começa pelo nome, a inicial precisa subir.
    const msg = opcional("0");
    expect(msg?.charAt(0)).toBe(msg?.charAt(0).toUpperCase());
  });
});

describe("lerInteiroPositivo", () => {
  it("devolve null para vazio, e não zero", () => {
    // É o ponto central: gravar 0 no lugar de null faria o sistema tratar
    // "sem troca programada" como "trocar a cada zero mês".
    expect(lerInteiroPositivo("")).toBeNull();
    expect(lerInteiroPositivo("")).not.toBe(0);
  });

  it("lê o número, aceitando vírgula", () => {
    expect(lerInteiroPositivo("6")).toBe(6);
    expect(lerInteiroPositivo("1,0")).toBe(1);
    expect(lerInteiroPositivo("24")).toBe(24);
  });
});
