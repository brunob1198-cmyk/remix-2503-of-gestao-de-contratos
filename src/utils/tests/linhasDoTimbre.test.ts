import { describe, expect, it } from "vitest";
import {
  faltasNoTimbre,
  linhaDeContato,
  linhaDeEndereco,
  timbreSemContato,
} from "../linhasDoTimbre";

/**
 * Decisão 1 do dono: o sistema monta o timbre a partir da logo e dos dados
 * cadastrados de CADA empresa.
 *
 * Antes eram constantes no código, da AIVX: o PDF de todo cliente saía com o
 * CNPJ e o endereço da fabricante da ferramenta. O que este arquivo protege é o
 * comportamento quando falta dado — porque a alternativa fácil (semear um valor
 * padrão) reintroduziria exatamente o defeito.
 */

const completo = {
  nome: "Construtora Exemplo LTDA",
  cnpj: "12.345.678/0001-99",
  endereco: "Rua das Obras, 100 — Centro, Goiânia – GO",
  telefone: "(62) 3000-0000",
  email: "contato@exemplo.com.br",
  site: "exemplo.com.br",
  logoUrl: "https://cdn/logo.png",
};

describe("linhaDeContato", () => {
  it("monta na ordem: site, CNPJ, telefone, e-mail", () => {
    expect(linhaDeContato(completo)).toBe(
      "exemplo.com.br  ·  CNPJ 12.345.678/0001-99  ·  (62) 3000-0000  ·  contato@exemplo.com.br"
    );
  });

  it("o que falta simplesmente não entra — sem separador solto", () => {
    // Um molde com buracos sairia " ·  · CNPJ  · ", que parece defeito de
    // impressão e ocupa a linha sem dizer nada.
    expect(linhaDeContato({ cnpj: "12.345.678/0001-99" })).toBe("CNPJ 12.345.678/0001-99");
    expect(linhaDeContato({ site: "exemplo.com.br", email: "a@b.c" })).toBe(
      "exemplo.com.br  ·  a@b.c"
    );
  });

  it("só o CNPJ ganha rótulo", () => {
    // Um CNPJ solto no meio da linha não se identifica; site, telefone e e-mail
    // se reconhecem pela forma.
    const l = linhaDeContato(completo);
    expect(l).toContain("CNPJ 12.345.678/0001-99");
    expect(l).not.toMatch(/Telefone|E-mail|Site/i);
  });

  it("nada preenchido devolve linha vazia, e não separadores", () => {
    expect(linhaDeContato({})).toBe("");
    expect(linhaDeContato({ nome: "Só o nome" })).toBe("");
  });

  it("espaço em branco não vira campo preenchido", () => {
    expect(linhaDeContato({ site: "   ", telefone: "\t" })).toBe("");
  });

  it("o nome da empresa NÃO entra no rodapé", () => {
    // Ele já sai no corpo do documento; repetir aqui gastaria a linha que é dos
    // dados de contato.
    expect(linhaDeContato(completo)).not.toContain("Construtora Exemplo");
  });
});

describe("linhaDeEndereco", () => {
  it("devolve o endereço", () => {
    expect(linhaDeEndereco(completo)).toBe("Rua das Obras, 100 — Centro, Goiânia – GO");
  });

  it("ausente vira vazio, para quem chama não desenhar linha nenhuma", () => {
    expect(linhaDeEndereco({})).toBe("");
    expect(linhaDeEndereco({ endereco: "  " })).toBe("");
  });
});

describe("faltasNoTimbre", () => {
  it("cadastro completo não acusa falta", () => {
    expect(faltasNoTimbre(completo)).toEqual([]);
  });

  it("aponta o que falta, e o que cada falta causa no documento", () => {
    const faltas = faltasNoTimbre({ nome: "X" });
    expect(faltas.map((f) => f.campo)).toEqual([
      "logoUrl",
      "cnpj",
      "endereco",
      "telefone",
      "email",
      "site",
    ]);
    // A consequência é o ponto: sem ela a pessoa só descobre emitindo um PDF e
    // olhando o rodapé.
    for (const f of faltas) expect(f.consequencia).toBeTruthy();
  });

  it("a falta do logotipo cita os DOIS lugares que ele alimenta", () => {
    const logo = faltasNoTimbre({}).find((f) => f.campo === "logoUrl")!;
    expect(logo.consequencia).toMatch(/PDF/i);
    expect(logo.consequencia).toMatch(/tela/i);
  });

  it("o nome não é cobrado: é obrigatório na tabela e sempre existe", () => {
    expect(faltasNoTimbre({}).some((f) => f.campo === "nome")).toBe(false);
  });

  it("preencher um campo tira ele da lista", () => {
    const antes = faltasNoTimbre({ nome: "X" }).length;
    const depois = faltasNoTimbre({ nome: "X", cnpj: "00.000.000/0001-00" }).length;
    expect(depois).toBe(antes - 1);
  });
});

describe("timbreSemContato", () => {
  it("nada preenchido: o rodapé sairia sem informação nenhuma", () => {
    expect(timbreSemContato({ nome: "X" })).toBe(true);
  });

  it("qualquer dado já tira dessa condição", () => {
    expect(timbreSemContato({ telefone: "(62) 3000-0000" })).toBe(false);
    expect(timbreSemContato({ endereco: "Rua A, 1" })).toBe(false);
  });
});
