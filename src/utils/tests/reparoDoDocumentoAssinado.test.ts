import { describe, expect, it } from "vitest";
import { estadoDoDocumento } from "../reparoDoDocumentoAssinado";

/**
 * Relatado com print: dois signatários assinaram, a fila fechou, e o botão de
 * baixar o documento assinado nunca apareceu — sem explicação nenhuma na tela.
 *
 * A causa: a montagem do arquivo final envia o PDF para o armazenamento, e o
 * envio exige sessão do Supabase. Quem assina por link público não tem sessão —
 * que é exatamente o caso que a fila existe para atender.
 */

const base = {
  situacao: "CONCLUIDA" as const,
  arquivoOriginal: "original.pdf",
  tokens: ["tok-1", "tok-2"],
};

describe("estadoDoDocumento", () => {
  it("com o arquivo montado, não há nada a dizer", () => {
    expect(estadoDoDocumento({ ...base, arquivoAssinado: "assinado.pdf" })).toEqual({
      tipo: "PRONTO",
    });
  });

  it("fila fechada e arquivo ausente vira reparo, não silêncio", () => {
    const r = estadoDoDocumento({ ...base, arquivoAssinado: null });
    expect(r.tipo).toBe("REPARAVEL");
  });

  it("o aviso diz o que aconteceu, e não só que falta algo", () => {
    // "Documento indisponível" mandaria o dono procurar defeito no lugar errado.
    const r = estadoDoDocumento({ ...base, arquivoAssinado: null });
    if (r.tipo !== "REPARAVEL") throw new Error("esperava REPARAVEL");

    expect(r.aviso).toMatch(/sess[ãa]o/i);
    // E precisa dizer que as assinaturas não se perdem: sem isso a reação
    // natural é refazer a solicitação e pedir tudo de novo aos signatários.
    expect(r.aviso).toMatch(/n[ãa]o se perdem/i);
  });

  it("usa um token da fila para refazer o fechamento", () => {
    const r = estadoDoDocumento({ ...base, arquivoAssinado: null });
    if (r.tipo !== "REPARAVEL") throw new Error("esperava REPARAVEL");
    expect(r.token).toBe("tok-1");
  });

  it("token vazio ou nulo é ignorado, e o próximo serve", () => {
    const r = estadoDoDocumento({
      ...base,
      arquivoAssinado: null,
      tokens: [null, "   ", "tok-3"],
    });
    if (r.tipo !== "REPARAVEL") throw new Error("esperava REPARAVEL");
    expect(r.token).toBe("tok-3");
  });
});

describe("estadoDoDocumento — quando não há o que reparar", () => {
  it("fila ainda aberta não cobra documento", () => {
    // Documento em fila não tem arquivo final, e isso é o normal.
    expect(
      estadoDoDocumento({ ...base, situacao: "AGUARDANDO", arquivoAssinado: null }).tipo
    ).toBe("NAO_SE_APLICA");
  });

  it("fila recusada não cobra documento", () => {
    // Recusada nunca terá arquivo: cobrar seria pedir o impossível.
    expect(
      estadoDoDocumento({ ...base, situacao: "RECUSADA", arquivoAssinado: null }).tipo
    ).toBe("NAO_SE_APLICA");
  });

  it("sem o original, não há o que remontar — e o aviso diz isso", () => {
    const r = estadoDoDocumento({ ...base, arquivoAssinado: null, arquivoOriginal: null });
    expect(r.tipo).toBe("SEM_REPARO");
    if (r.tipo !== "SEM_REPARO") return;
    expect(r.aviso).toMatch(/refa[çc]a a solicita[çc][ãa]o/i);
  });

  it("sem token nenhum, avisa que não dá para refazer", () => {
    const r = estadoDoDocumento({ ...base, arquivoAssinado: null, tokens: [null, ""] });
    expect(r.tipo).toBe("SEM_REPARO");
    if (r.tipo !== "SEM_REPARO") return;
    expect(r.aviso).toMatch(/link de nenhum signat/i);
  });

  it("o aviso do caso sem reparo também explica a causa", () => {
    // Quem lê precisa entender o problema mesmo quando não há botão para clicar.
    for (const caso of [
      { ...base, arquivoAssinado: null, arquivoOriginal: null },
      { ...base, arquivoAssinado: null, tokens: [] },
    ]) {
      const r = estadoDoDocumento(caso);
      if (r.tipo !== "SEM_REPARO") throw new Error("esperava SEM_REPARO");
      expect(r.aviso).toMatch(/sess[ãa]o/i);
    }
  });
});
