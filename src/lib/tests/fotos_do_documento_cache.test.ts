// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepararFotosDoDocumento } from "@/lib/fotosDoDocumento";

/**
 * Guarda de regressão para o `cache: "reload"` do download das fotos.
 *
 * POR QUE VALE UM TESTE PARA UM ARGUMENTO DE `fetch`
 *
 * Ele parece supérfluo e é exatamente o tipo de coisa que se remove numa limpeza.
 * Mas sem ele o defeito volta, e volta silencioso: a tela mostra a foto num `<img>`
 * comum, essa resposta entra no cache SEM cabeçalho de CORS, e o `fetch` da emissão
 * reaproveita a resposta guardada e falha. O usuário vê "Imagem não incorporada" numa
 * foto que está visível na tela ao lado.
 *
 * O defeito não aparece em teste de unidade comum nem em navegação rápida: depende da
 * ORDEM (tela antes da emissão) e de o bucket não mandar `Vary: Origin`. Foi medido em
 * produção, e a verificação anterior passou justamente porque fez o `fetch` primeiro.
 *
 * Então o que este teste trava é a intenção: quem tirar o `reload` quebra o teste e lê
 * o porquê.
 */

/**
 * Sonda de `<img>` que responde na hora.
 *
 * Quando o `fetch` falha, o código sonda a URL com uma `<img>` para separar "o host
 * não me deixa ler" de "o host não respondeu", e espera até 6 s por isso. No jsdom a
 * imagem nunca carrega nem falha, então esses 6 s viravam estouro de tempo do teste.
 * Responder na hora mantém o teste rápido sem mexer no prazo real do app.
 */
function sondaDeImagemImediata() {
  class ImagemFalsa {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(_valor: string) {
      setTimeout(() => this.onerror?.(), 0);
    }
  }
  vi.stubGlobal("Image", ImagemFalsa);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prepararFotosDoDocumento — cache", () => {
  it("baixa a foto ignorando o cache do navegador", async () => {
    sondaDeImagemImediata();
    const chamadas: Array<{ url: string; init?: RequestInit }> = [];

    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      chamadas.push({ url: String(url), init });
      // Falha depois de registrar a chamada: aqui só interessa COMO foi pedido.
      return Promise.reject(new TypeError("Failed to fetch"));
    });

    await prepararFotosDoDocumento([
      { url: "https://pub-exemplo.r2.dev/1-foto.webp", descricao: "Evidência 1" },
    ]);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("https://pub-exemplo.r2.dev/1-foto.webp");
    expect(chamadas[0].init?.cache).toBe("reload");
  });

  it("nao acrescenta parametro a URL para furar o cache", async () => {
    // A alternativa seria `?t=<agora>`, e ela tem dois defeitos: cria um objeto novo
    // no cache de borda a cada emissão (mais custo no R2) e faz a URL pedida diferir
    // da que está gravada no banco, o que atrapalha qualquer investigação futura.
    sondaDeImagemImediata();
    const chamadas: string[] = [];

    vi.stubGlobal("fetch", (url: string) => {
      chamadas.push(String(url));
      return Promise.reject(new TypeError("Failed to fetch"));
    });

    await prepararFotosDoDocumento([
      { url: "https://pub-exemplo.r2.dev/1-foto.webp", descricao: "Evidência 1" },
    ]);

    expect(chamadas[0]).not.toContain("?");
  });
});
