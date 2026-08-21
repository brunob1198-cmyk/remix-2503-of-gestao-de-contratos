import { describe, it, expect } from "vitest";
import {
  buscarCep,
  cepCompleto,
  cepLimpo,
  enderecoComComplemento,
  enderecoEmUmaLinha,
  mascaraCep,
} from "@/utils/cep";

/**
 * A consulta de CEP estava escrita três vezes, com três tratamentos diferentes
 * para a mesma falha. Estes testes travam o comportamento que passou a ser único —
 * em especial a distinção entre "CEP não existe" e "não consegui consultar", que
 * as cópias anteriores confundiam.
 */

function respostaFalsa(corpo: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({
      ok,
      status,
      json: async () => corpo,
    }) as Response) as unknown as typeof fetch;
}

describe("cepLimpo e mascaraCep", () => {
  it("descarta o que não é dígito", () => {
    expect(cepLimpo("74.275-120")).toBe("74275120");
  });

  it("corta o excesso em oito dígitos", () => {
    expect(cepLimpo("742751209999")).toBe("74275120");
  });

  it("formata como XX.XXX-XXX", () => {
    expect(mascaraCep("74275120")).toBe("74.275-120");
  });

  it("formata parcialmente enquanto se digita, sem completar o que falta", () => {
    expect(mascaraCep("7")).toBe("7");
    expect(mascaraCep("74")).toBe("74");
    expect(mascaraCep("742")).toBe("74.2");
    expect(mascaraCep("74275")).toBe("74.275");
    expect(mascaraCep("742751")).toBe("74.275-1");
  });

  it("é idempotente: remascarar não duplica separador", () => {
    expect(mascaraCep(mascaraCep("74275120"))).toBe("74.275-120");
  });

  it("cepCompleto só com oito dígitos", () => {
    expect(cepCompleto("74.275-12")).toBe(false);
    expect(cepCompleto("74.275-120")).toBe(true);
  });
});

describe("enderecoEmUmaLinha", () => {
  const base = {
    cep: "74.275-120",
    logradouro: "Rua C-152",
    bairro: "Jardim América",
    localidade: "Goiânia",
    uf: "GO",
  };

  it("monta logradouro, bairro e cidade - UF", () => {
    expect(enderecoEmUmaLinha(base)).toBe("Rua C-152, Jardim América, Goiânia - GO");
  });

  it("omite a parte vazia junto do separador dela", () => {
    // Endereco com ", , " no meio denuncia dado faltando sem ajudar ninguem.
    expect(enderecoEmUmaLinha({ ...base, bairro: "" })).toBe("Rua C-152, Goiânia - GO");
    expect(enderecoEmUmaLinha({ ...base, logradouro: "" })).toBe(
      "Jardim América, Goiânia - GO"
    );
  });

  it("cidade sem UF não deixa o hífen solto", () => {
    expect(enderecoEmUmaLinha({ ...base, uf: "" })).toBe(
      "Rua C-152, Jardim América, Goiânia"
    );
  });

  it("tudo vazio devolve string vazia, não uma pontuação", () => {
    expect(
      enderecoEmUmaLinha({ cep: "", logradouro: "", bairro: "", localidade: "", uf: "" })
    ).toBe("");
  });
});

describe("enderecoComComplemento", () => {
  it("insere o complemento depois do logradouro", () => {
    // E como se escreve endereco no Brasil. Colar no fim produziria
    // "..., Aparecida de Goiania - GO, Qd 1741".
    const r = enderecoComComplemento(
      "Rua Larga, Buriti Sereno, Aparecida de Goiânia - GO",
      "Qd 1741 Lt 16"
    );
    expect(r).toBe("Rua Larga, Qd 1741 Lt 16, Buriti Sereno, Aparecida de Goiânia - GO");
  });

  it("endereço de uma só parte recebe o complemento no fim", () => {
    expect(enderecoComComplemento("Rua Larga", "nº 478")).toBe("Rua Larga, nº 478");
  });

  it("sem complemento devolve o endereço intacto", () => {
    expect(enderecoComComplemento("Rua Larga, Centro", "")).toBe("Rua Larga, Centro");
    expect(enderecoComComplemento("Rua Larga, Centro", null)).toBe("Rua Larga, Centro");
  });

  it("sem endereço devolve só o complemento", () => {
    expect(enderecoComComplemento("", "Qd 5 Lt 2")).toBe("Qd 5 Lt 2");
    expect(enderecoComComplemento(null, "Qd 5 Lt 2")).toBe("Qd 5 Lt 2");
  });

  it("os dois vazios devolvem string vazia", () => {
    expect(enderecoComComplemento(null, null)).toBe("");
  });

  it("ignora espaço em volta", () => {
    expect(enderecoComComplemento("  Rua Larga, Centro  ", "  nº 10  ")).toBe(
      "Rua Larga, nº 10, Centro"
    );
  });
});

describe("buscarCep", () => {
  it("devolve o endereço quando o CEP existe", async () => {
    const r = await buscarCep(
      "74275120",
      respostaFalsa({
        cep: "74275-120",
        logradouro: "Rua C-152",
        bairro: "Jardim América",
        localidade: "Goiânia",
        uf: "GO",
      })
    );

    expect(r.situacao).toBe("OK");
    if (r.situacao === "OK") {
      expect(r.endereco.logradouro).toBe("Rua C-152");
      expect(r.endereco.uf).toBe("GO");
      // Normaliza a mascara: a ViaCEP devolve "74275-120", o projeto usa "74.275-120".
      expect(r.endereco.cep).toBe("74.275-120");
    }
  });

  it("CEP inexistente é NAO_ENCONTRADO, não erro", async () => {
    // A ViaCEP responde 200 com `erro: true`. Tratar como excecao faria a tela
    // dizer "erro ao buscar" quando o certo e dizer "esse CEP nao existe".
    const r = await buscarCep("99999999", respostaFalsa({ erro: true }));
    expect(r.situacao).toBe("NAO_ENCONTRADO");
  });

  it("aceita o `erro` como string, que a API também usa", async () => {
    const r = await buscarCep("99999999", respostaFalsa({ erro: "true" }));
    expect(r.situacao).toBe("NAO_ENCONTRADO");
  });

  it("CEP incompleto não vai à rede", async () => {
    let chamou = false;
    const espia = (async () => {
      chamou = true;
      return respostaFalsa({})("", {});
    }) as unknown as typeof fetch;

    const r = await buscarCep("7427", espia);
    expect(r.situacao).toBe("CEP_INVALIDO");
    expect(chamou).toBe(false);
  });

  it("resposta não-ok vira ERRO com o status", async () => {
    const r = await buscarCep("74275120", respostaFalsa({}, false, 503));
    expect(r.situacao).toBe("ERRO");
    if (r.situacao === "ERRO") expect(r.mensagem).toContain("503");
  });

  it("falha de rede vira ERRO em vez de exceção", async () => {
    // A tela nao pode quebrar porque o servico dos Correios caiu.
    const quebra = (async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;

    const r = await buscarCep("74275120", quebra);
    expect(r.situacao).toBe("ERRO");
    if (r.situacao === "ERRO") expect(r.mensagem).toContain("Failed to fetch");
  });

  it("campo ausente na resposta vira string vazia, não undefined", async () => {
    const r = await buscarCep("74275120", respostaFalsa({ localidade: "Goiânia" }));
    expect(r.situacao).toBe("OK");
    if (r.situacao === "OK") {
      expect(r.endereco.logradouro).toBe("");
      expect(enderecoEmUmaLinha(r.endereco)).toBe("Goiânia");
    }
  });

  it("aceita o CEP já mascarado", async () => {
    const r = await buscarCep("74.275-120", respostaFalsa({ localidade: "Goiânia" }));
    expect(r.situacao).toBe("OK");
  });
});
