// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { CHAVE_DONO_DO_CACHE, aplicarPoliticaDoCache } from "../cacheDoUsuario";

/**
 * O teste irmão confere a REGRA; este confere que ela de fato esvazia o cache.
 *
 * A distinção importa: a decisão certa com o efeito não aplicado devolveria
 * exatamente o mesmo defeito — telas reidratando dado de uma sessão que já
 * acabou — e um teste só da função pura passaria feliz.
 */

const BRUNO = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

/** Um cache como o que existe em uso: consultas com dados de uma empresa. */
function clienteComDados(): QueryClient {
  const qc = new QueryClient();
  qc.setQueryData(["contratos"], [{ id: "c1" }, { id: "c2" }]);
  qc.setQueryData(["projetos"], [{ id: "p1" }]);
  return qc;
}

const quantasConsultas = (qc: QueryClient) => qc.getQueryCache().getAll().length;

afterEach(() => localStorage.clear());

describe("aplicar a política ao cache real", () => {
  it("esvazia o cache quando a sessão acaba", () => {
    localStorage.setItem(CHAVE_DONO_DO_CACHE, BRUNO);
    const qc = clienteComDados();
    expect(quantasConsultas(qc)).toBe(2);

    const motivo = aplicarPoliticaDoCache(qc, null);

    expect(motivo).toBe("sem-usuario");
    expect(quantasConsultas(qc)).toBe(0);
    expect(qc.getQueryData(["contratos"])).toBeUndefined();
    // Sem dono registrado, o próximo login não reaproveita nada por engano.
    expect(localStorage.getItem(CHAVE_DONO_DO_CACHE)).toBeNull();
  });

  it("esvazia o cache quando entra outra pessoa no mesmo navegador", () => {
    localStorage.setItem(CHAVE_DONO_DO_CACHE, BRUNO);
    const qc = clienteComDados();

    const motivo = aplicarPoliticaDoCache(qc, OUTRO);

    expect(motivo).toBe("outro-usuario");
    expect(qc.getQueryData(["contratos"])).toBeUndefined();
    expect(localStorage.getItem(CHAVE_DONO_DO_CACHE)).toBe(OUTRO);
  });

  it("preserva o cache do próprio usuário — senão todo recarregamento buscaria tudo de novo", () => {
    localStorage.setItem(CHAVE_DONO_DO_CACHE, BRUNO);
    const qc = clienteComDados();

    const motivo = aplicarPoliticaDoCache(qc, BRUNO);

    expect(motivo).toBeNull();
    expect(quantasConsultas(qc)).toBe(2);
    expect(qc.getQueryData(["contratos"])).toEqual([{ id: "c1" }, { id: "c2" }]);
  });

  it("registra o dono no primeiro login, para o seguinte poder reaproveitar", () => {
    const qc = new QueryClient();

    // Cache herdado da versão anterior do app: sem dono, é descartado.
    expect(aplicarPoliticaDoCache(qc, BRUNO)).toBe("dono-desconhecido");
    expect(localStorage.getItem(CHAVE_DONO_DO_CACHE)).toBe(BRUNO);

    // A partir daqui o mesmo usuário mantém o próprio cache.
    qc.setQueryData(["contratos"], [{ id: "c1" }]);
    expect(aplicarPoliticaDoCache(qc, BRUNO)).toBeNull();
    expect(qc.getQueryData(["contratos"])).toEqual([{ id: "c1" }]);
  });

  it("não deixa o login quebrar quando o IndexedDB não está disponível", () => {
    // Navegação privada, cota estourada, política de site: apagar o cache
    // persistido pode falhar. Falhar ali não pode derrubar a autenticação.
    localStorage.setItem(CHAVE_DONO_DO_CACHE, BRUNO);
    const qc = clienteComDados();

    // jsdom não implementa IndexedDB — é exatamente o cenário indisponível.
    expect(() => aplicarPoliticaDoCache(qc, null)).not.toThrow();
    expect(quantasConsultas(qc)).toBe(0);
  });
});
