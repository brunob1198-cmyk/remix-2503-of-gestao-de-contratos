import { describe, it, expect } from "vitest";
import { cnpjLimpo, cnpjFormatado, cnpjValido, montarEndereco } from "@/utils/cnpj";

/**
 * O CNPJ e validado ANTES de sair para a rede: digitado errado e o caso comum, e
 * responder "invalido" na hora e mais claro que esperar o 404 de um servico
 * externo e ter que decidir se a falha foi do CNPJ ou do servico.
 */

// Os dois fecham nos digitos verificadores. O segundo e o do modelo de PCMSO que
// o usuario trouxe, conferido a mao.
const VALIDO = "11222333000181";
const VALIDO_REAL = "05696218000146";

describe("cnpjLimpo", () => {
  it("tira mascara e corta em catorze digitos", () => {
    expect(cnpjLimpo("11.222.333/0001-81")).toBe(VALIDO);
    expect(cnpjLimpo("11222333000181999")).toBe(VALIDO);
  });

  it("aceita entrada vazia sem estourar", () => {
    expect(cnpjLimpo("")).toBe("");
    expect(cnpjLimpo("abc")).toBe("");
  });
});

describe("cnpjFormatado", () => {
  it("aplica a mascara quando esta completo", () => {
    expect(cnpjFormatado(VALIDO)).toBe("11.222.333/0001-81");
  });

  it("incompleto sai sem mascara, em vez de mascara pela metade", () => {
    // Mascara parcial em documento parece dado truncado.
    expect(cnpjFormatado("112223")).toBe("112223");
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ que fecha nos verificadores", () => {
    expect(cnpjValido(VALIDO)).toBe(true);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido(VALIDO_REAL)).toBe(true);
  });

  it("recusa digito verificador errado", () => {
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("11222333000191")).toBe(false);
  });

  it("recusa tamanho diferente de catorze", () => {
    expect(cnpjValido("1122233300018")).toBe(false);
    // Quinze digitos e erro de digitacao. Truncar e aceitar consultaria OUTRA
    // empresa — valida, e nao a que a pessoa quis.
    expect(cnpjValido("112223330001812")).toBe(false);
    expect(cnpjValido("")).toBe(false);
  });

  it("recusa digito repetido, que passa na conta e nao existe", () => {
    // 11.111.111/1111-11 fecha no modulo 11. Aceitar levaria a uma consulta que
    // volta vazia e a um "nao encontrado" que parece problema do servico.
    for (let d = 0; d <= 9; d++) {
      expect(cnpjValido(String(d).repeat(14)), `digito ${d}`).toBe(false);
    }
  });
});

describe("montarEndereco", () => {
  it("junta rua e numero, e pula o que falta", () => {
    expect(
      montarEndereco({ logradouro: "Avenida das Américas", numero: "3500", bairro: "Barra da Tijuca" })
    ).toBe("Avenida das Américas, 3500 — Barra da Tijuca");
  });

  it("sem complemento nao deixa separador solto", () => {
    const e = montarEndereco({ logradouro: "Rua A", numero: "10", complemento: "", bairro: "Centro" });
    expect(e).toBe("Rua A, 10 — Centro");
    expect(e).not.toContain("—  —");
  });

  it("resposta vazia devolve string vazia, e nao pontuacao sozinha", () => {
    expect(montarEndereco({})).toBe("");
  });
});
