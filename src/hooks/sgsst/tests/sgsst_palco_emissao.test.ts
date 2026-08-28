// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { montarPalcoDeEmissao } from "@/lib/sgsstPapelTimbrado";

/**
 * O TESTE QUE FALTAVA.
 *
 * Um `position: fixed` no container fez TODO documento do SGSST sair em branco: o
 * html2pdf clona o elemento que recebe, o clone levava o estilo inline junto, saía
 * do fluxo, e o container da biblioteca ficava com altura zero. O que aparecia no
 * PDF era só o timbre — estampado depois, pelo pdf-lib, no PDF já paginado.
 *
 * Nada verificava essa invariante. Estes testes verificam.
 */
describe("montarPalcoDeEmissao", () => {
  it("o container entregue ao html2pdf NÃO sai do fluxo", () => {
    // É a invariante inteira: o clone herda o `style` inline, e qualquer
    // posicionamento aqui zera a altura medida pela biblioteca.
    const { container } = montarPalcoDeEmissao("<p>conteúdo</p>");

    expect(container.style.position).toBe("");
    expect(container.style.left).toBe("");
    expect(container.style.top).toBe("");
    expect(container.style.display).not.toBe("none");
  });

  it("é o PALCO que fica fora da tela", () => {
    const { palco } = montarPalcoDeEmissao("<p>conteúdo</p>");

    expect(palco.style.position).toBe("fixed");
    expect(parseFloat(palco.style.left)).toBeLessThan(-1000);
  });

  it("o palco tem a largura útil da página, e o container a acompanha", () => {
    // Medir numa largura e rasterizar em outra é como as quebras de página saíam
    // do lugar. O palco fixa a largura; o container ocupa 100% dela.
    const { palco, container } = montarPalcoDeEmissao("<p>x</p>");

    expect(palco.style.width).toMatch(/mm$/);
    expect(parseFloat(palco.style.width)).toBeCloseTo(186, 0);
    expect(container.style.width).toBe("100%");
  });

  it("o conteúdo vai no container, não no palco", () => {
    const { palco, container } = montarPalcoDeEmissao("<p>marca do teste</p>");

    expect(container.innerHTML).toContain("marca do teste");
    expect(palco.firstElementChild).toBe(container);
  });

  it("cada emissão recebe um id próprio — o seletor da fonte depende dele", () => {
    const a = montarPalcoDeEmissao("<p>a</p>").container.id;
    const b = montarPalcoDeEmissao("<p>b</p>").container.id;

    expect(a).not.toBe("");
    expect(a).not.toBe(b);
  });

  it("remover o palco tira o container junto", () => {
    // O container carrega a folha de estilo do documento; esquecido no DOM, ela
    // vaza para a interface do sistema.
    const { palco, container } = montarPalcoDeEmissao("<p>x</p>");
    document.body.appendChild(palco);
    expect(document.body.contains(container)).toBe(true);

    palco.remove();
    expect(document.body.contains(container)).toBe(false);
  });
});
