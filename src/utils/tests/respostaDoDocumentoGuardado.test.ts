import { describe, expect, it } from "vitest";
import { leituraDaResposta } from "../respostaDoDocumentoGuardado";

/**
 * O envio do documento assinado passou a ser feito pelo servidor, porque quem
 * assina por link público não tem sessão para enviar do navegador. O que sobrou
 * no navegador foi ler a resposta — e é aí que mora a armadilha: o servidor usa
 * 409 para dois casos opostos.
 */

describe("leituraDaResposta", () => {
  it("resposta boa devolve o endereço do arquivo", () => {
    expect(leituraDaResposta(200, { ok: true, url: "assinado.pdf" })).toEqual({
      tipo: "GUARDADO",
      url: "assinado.pdf",
    });
  });

  it("documento que já existia é sucesso, apesar do 409", () => {
    // Acontece quando a resposta se perde e o navegador tenta de novo. O arquivo
    // pedido está guardado; insistir em falha mandaria refazer o que está feito.
    expect(
      leituraDaResposta(409, {
        ok: false,
        jaExistia: true,
        url: "assinado.pdf",
        erro: "Esta solicitacao ja tem documento assinado.",
      })
    ).toEqual({ tipo: "GUARDADO", url: "assinado.pdf" });
  });

  it("409 do banco recusando o fechamento continua sendo falha", () => {
    // Mesmo código, caso oposto: o arquivo subiu e a fila NÃO fechou. Tratar
    // como sucesso esconderia uma solicitação que ficou pela metade.
    const r = leituraDaResposta(409, {
      ok: false,
      url: "assinado.pdf",
      erro: "Ainda há signatários pendentes.",
    });
    expect(r.tipo).toBe("FALHA");
    if (r.tipo !== "FALHA") return;
    expect(r.erro).toBe("Ainda há signatários pendentes.");
  });

  it("sucesso sem endereço não é sucesso", () => {
    // Devolver uma URL vazia gravaria "documento assinado: nada" na solicitação.
    expect(leituraDaResposta(200, { ok: true, url: "   " }).tipo).toBe("FALHA");
    expect(leituraDaResposta(200, { ok: true }).tipo).toBe("FALHA");
  });

  it("corpo ilegível ainda diz alguma coisa", () => {
    // Foi o silêncio que o dono relatou: a fila fechava e a tela não explicava
    // nada. Uma mensagem com o código HTTP ao menos dá por onde começar.
    const r = leituraDaResposta(502, null);
    expect(r.tipo).toBe("FALHA");
    if (r.tipo !== "FALHA") return;
    expect(r.erro).toMatch(/502/);
  });

  it("o erro do servidor tem preferência sobre o texto genérico", () => {
    const r = leituraDaResposta(400, { ok: false, erro: "O conteudo enviado nao e um PDF." });
    expect(r.tipo).toBe("FALHA");
    if (r.tipo !== "FALHA") return;
    expect(r.erro).toBe("O conteudo enviado nao e um PDF.");
  });

  it("jaExistia sem endereço não vira sucesso", () => {
    // A marca sozinha não prova que há arquivo; sem o endereço não há o que dar
    // a quem chamou.
    expect(leituraDaResposta(409, { jaExistia: true, erro: "ja existe" }).tipo).toBe("FALHA");
  });
});
