import { describe, expect, it } from "vitest";
import { generateQRCodeDataUrl } from "./qrCodeGenerator";
import { decodificarQrCode as decodificar } from "./tests/decodificarQrCode";

/**
 * POR QUE ESTE TESTE DECODIFICA, E NAO OLHA A IMAGEM
 *
 * A versao anterior deste modulo desenhava algo PARECIDO com um QR Code — tres
 * quadrados de canto e um borrao derivado de um hash — e nao codificava nada.
 * Passava em qualquer revisao visual, e ficou no ar ate alguem apontar o celular
 * para a tela. Chegou a ser impresso na folha de assinaturas, ao lado da frase
 * "Escanear para verificar autenticidade".
 *
 * Testar cor, tamanho ou "tem tres quadrados" repetiria o erro. O unico teste que
 * vale e este: ler de volta e conferir que o texto voltou inteiro.
 *
 * A decodificacao roda sobre a MATRIZ de modulos, montada como imagem em memoria.
 * Assim nao e preciso canvas nem leitor de PNG para rodar no CI — e a matriz e a
 * mesma que a imagem desenha.
 */

describe("generateQRCodeDataUrl", () => {
  it("devolve um PNG de verdade", async () => {
    const url = await generateQRCodeDataUrl("https://exemplo.com/x");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(500);
  });

  it("recusa conteudo vazio em vez de devolver imagem decorativa", async () => {
    // Entregar algo ilegivel com cara de valido foi o defeito anterior.
    await expect(generateQRCodeDataUrl("")).rejects.toThrow();
    await expect(generateQRCodeDataUrl("   ")).rejects.toThrow();
  });

  it("textos diferentes produzem imagens diferentes", async () => {
    const a = await generateQRCodeDataUrl("https://exemplo.com/a");
    const b = await generateQRCodeDataUrl("https://exemplo.com/b");
    expect(a).not.toBe(b);
  });
});

describe("o codigo e REALMENTE legivel", () => {
  it("a URL de iniciar checklist volta inteira ao decodificar", () => {
    // O caso que o usuario tentou escanear e nao funcionou.
    const url = "https://gestaodecontratos.bssassessoria.com.br/checklists/iniciar/qr_1789416882430_gmw3bhv";
    expect(decodificar(url)).toBe(url);
  });

  it("a URL de verificacao de assinatura tambem", () => {
    // Esta e impressa na folha de assinaturas, ao lado de "Escanear para
    // verificar autenticidade". A frase precisa ser verdade.
    const url = "https://gestaodecontratos.bssassessoria.com.br/verificar-assinatura/9abb0088-9a7b-4622-8d91-41ff24beaaea";
    expect(decodificar(url)).toBe(url);
  });

  it("aguenta acento e caracteres do portugues", () => {
    const texto = "Saveiro 001 — inspeção de devolução, pátio São João";
    expect(decodificar(texto)).toBe(texto);
  });

  it("aguenta uma URL longa, com parametros", () => {
    const url =
      "https://gestaodecontratos.bssassessoria.com.br/checklists/iniciar/" +
      "qr_1789416882430_gmw3bhv?origem=adesivo&veiculo=Saveiro%20001&obra=0010.25";
    expect(decodificar(url)).toBe(url);
  });

  it("o texto decodificado e o texto pedido, e nao um parecido", () => {
    // Guarda contra a classe de defeito anterior: imagem plausivel, conteudo
    // errado. Se a matriz viesse de um hash, isto falharia.
    const a = "https://exemplo.com/token-AAAA";
    const b = "https://exemplo.com/token-BBBB";
    expect(decodificar(a)).toBe(a);
    expect(decodificar(b)).toBe(b);
    expect(decodificar(a)).not.toBe(decodificar(b));
  });
});
