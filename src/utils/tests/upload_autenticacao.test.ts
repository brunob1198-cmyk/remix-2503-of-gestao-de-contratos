import { describe, expect, it } from "vitest";
import {
  MARGEM_ANTES_DE_VENCER_S,
  aposRespostaDoUpload,
  decisaoDoUpload,
} from "@/utils/uploadAutenticacao";

const AGORA = 1_700_000_000;

describe("decisaoDoUpload", () => {
  it("recusa sem token, com frase que diz o que fazer", () => {
    const d = decisaoDoUpload({ token: null, agora: AGORA });
    expect(d.enviar).toBe(false);
    if (d.enviar !== false) throw new Error("esperava recusa");
    expect(d.motivo).toContain("conectado");
  });

  it("trata token só com espaços como ausente", () => {
    expect(decisaoDoUpload({ token: "   ", agora: AGORA }).enviar).toBe(false);
  });

  it("envia sem renovar quando o token tem folga", () => {
    const d = decisaoDoUpload({
      token: "tok",
      expiraEm: AGORA + 3600,
      agora: AGORA,
    });
    expect(d).toEqual({ enviar: true, token: "tok", renovarPrimeiro: false });
  });

  it("renova antes quando o token vence dentro da margem", () => {
    const d = decisaoDoUpload({
      token: "tok",
      expiraEm: AGORA + MARGEM_ANTES_DE_VENCER_S - 1,
      agora: AGORA,
    });
    expect(d).toEqual({ enviar: true, token: "tok", renovarPrimeiro: true });
  });

  it("renova antes quando o token JA venceu, em vez de recusar", () => {
    // A sessão pode continuar válida com o token de acesso vencido: quem decide é
    // o refresh token. Recusar aqui mandaria o usuário fazer login sem precisar.
    const d = decisaoDoUpload({ token: "tok", expiraEm: AGORA - 500, agora: AGORA });
    expect(d).toEqual({ enviar: true, token: "tok", renovarPrimeiro: true });
  });

  it("sem expires_at, envia e deixa o servidor julgar", () => {
    const d = decisaoDoUpload({ token: "tok", expiraEm: null, agora: AGORA });
    expect(d).toEqual({ enviar: true, token: "tok", renovarPrimeiro: false });
  });
});

describe("aposRespostaDoUpload", () => {
  it("200 encerra", () => {
    expect(aposRespostaDoUpload({ status: 200, jaRenovou: false })).toEqual({
      acao: "PRONTO",
    });
  });

  it.each([401, 403])("%i pede renovacao na primeira vez", (status) => {
    expect(aposRespostaDoUpload({ status, jaRenovou: false })).toEqual({
      acao: "RENOVAR_E_REPETIR",
    });
  });

  it.each([401, 403])("%i depois de renovar desiste, sem lacar", (status) => {
    const r = aposRespostaDoUpload({ status, jaRenovou: true });
    expect(r.acao).toBe("DESISTIR");
    if (r.acao !== "DESISTIR") throw new Error("esperava DESISTIR");
    // Precisa dizer que o arquivo nao foi enviado: o usuario no campo nao pode
    // sair achando que a evidencia ficou registrada.
    expect(r.mensagem).toContain("não foi enviado");
    expect(r.mensagem).toContain("Entre novamente");
  });

  it.each([400, 413])("%i nao repete: a recusa nao muda", (status) => {
    const r = aposRespostaDoUpload({ status, jaRenovou: false });
    expect(r.acao).toBe("DESISTIR");
    if (r.acao !== "DESISTIR") throw new Error("esperava DESISTIR");
    expect(r.mensagem).toContain(String(status));
    expect(r.mensagem).toContain("recusou");
  });

  it.each([500, 502, 503])("%i fala de indisponibilidade, nao de recusa", (status) => {
    // A diferenca nao e de estilo: "recusou" manda o usuario mudar o arquivo,
    // e num 5xx o que resolve e repetir o mesmo envio.
    const r = aposRespostaDoUpload({ status, jaRenovou: false });
    expect(r.acao).toBe("DESISTIR");
    if (r.acao !== "DESISTIR") throw new Error("esperava DESISTIR");
    expect(r.mensagem).not.toContain("recusou");
    expect(r.mensagem).toContain("indisponível");
    expect(r.mensagem).toContain("Tente novamente");
    expect(r.mensagem).toContain("não foi enviado");
  });

  it("401 depois de renovar vence o tratamento de 5xx", () => {
    // Ordem importa: 401 e problema de token e tem frase propria, mesmo que o
    // status caia na faixa de erro do servidor por engano de leitura.
    const r = aposRespostaDoUpload({ status: 401, jaRenovou: true });
    if (r.acao !== "DESISTIR") throw new Error("esperava DESISTIR");
    expect(r.mensagem).toContain("sessão expirou");
  });
});
