import { describe, expect, it } from "vitest";
import { decidirSobreOCache } from "../cacheDoUsuario";

/**
 * O defeito que estes casos guardam:
 *
 * O usuário saiu do login e voltou. Todas as telas ficaram vazias — "Nenhum
 * contrato cadastrado", "Nenhum projeto cadastrado", R$ 0,00 — enquanto o banco
 * continuava com tudo. Em janela anônima aparecia normal, o que provou que o
 * problema era o que estava gravado no navegador, não o servidor.
 *
 * O cache persistido não tinha dono: a mesma gaveta para qualquer usuário, e
 * nada a esvaziava no logout.
 */

const BRUNO = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

describe("de quem é o cache persistido", () => {
  it("reaproveita quando o dono gravado é quem está entrando", () => {
    expect(decidirSobreOCache(BRUNO, BRUNO)).toEqual({ limpar: false, motivo: null });
  });

  it("descarta quando não há ninguém logado", () => {
    // É este o caso do logout, e também o da sessão que expirou sozinha.
    // Sem sessão, toda consulta volta vazia pelo RLS *sem erro* — e é esse
    // vazio que era gravado por cima do cache bom.
    expect(decidirSobreOCache(BRUNO, null)).toEqual({ limpar: true, motivo: "sem-usuario" });
  });

  it("descarta quando quem entra não é o dono", () => {
    // Computador de obra ou tablet compartilhado: sem isto, a segunda pessoa
    // via contratos e valores da empresa da primeira.
    expect(decidirSobreOCache(BRUNO, OUTRO)).toEqual({ limpar: true, motivo: "outro-usuario" });
  });

  it("descarta cache sem dono registrado", () => {
    // Cache gravado por uma versão anterior do app, que não registrava dono.
    // Não dá para provar de quem é; adivinhar erraria exatamente no caso acima.
    expect(decidirSobreOCache(null, BRUNO)).toEqual({ limpar: true, motivo: "dono-desconhecido" });
  });

  it("descarta quando não há dono nem sessão", () => {
    expect(decidirSobreOCache(null, null)).toEqual({ limpar: true, motivo: "sem-usuario" });
  });

  it("nunca reaproveita por engano: só um caso dos cinco mantém o cache", () => {
    // Trava de rede: se alguém afrouxar a regra, este teste cai junto.
    const casos: Array<[string | null, string | null]> = [
      [BRUNO, BRUNO],
      [BRUNO, OUTRO],
      [BRUNO, null],
      [null, BRUNO],
      [null, null],
    ];
    const mantidos = casos.filter(([dono, atual]) => !decidirSobreOCache(dono, atual).limpar);
    expect(mantidos).toEqual([[BRUNO, BRUNO]]);
  });
});
