// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { OpcoesOuAviso, SEM_OBRA_CADASTRADA } from "../SelecaoVazia";

/**
 * Roteiro 0.3: "Sem obra, quase todo formulário do SGSST travará no campo
 * obrigatório de obra."
 *
 * O roteiro precisou avisar porque o sistema não avisava: oito seletores abriam
 * uma caixa vazia, sem opção, sem explicação e sem saída.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function montar(no: React.ReactNode): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(no));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

const obra = (id: string) => ({ id, codigo: "OBR-" + id, nome: "Obra " + id });

const renderizar = (itens: ReturnType<typeof obra>[] | null | undefined) =>
  montar(
    <OpcoesOuAviso itens={itens} aviso={SEM_OBRA_CADASTRADA}>
      {(p) => <div key={p.id} data-opcao>{`[${p.codigo}] ${p.nome}`}</div>}
    </OpcoesOuAviso>
  );

describe("OpcoesOuAviso", () => {
  it("com itens, mostra os itens e nenhum aviso", () => {
    const el = renderizar([obra("1"), obra("2")]);
    expect(el.querySelectorAll("[data-opcao]")).toHaveLength(2);
    expect(el.textContent).not.toContain("Nenhuma obra");
  });

  it("lista vazia mostra o aviso no lugar da caixa em branco", () => {
    const el = renderizar([]);
    expect(el.querySelectorAll("[data-opcao]")).toHaveLength(0);
    expect(el.textContent).toContain("Nenhuma obra cadastrada");
  });

  it("nulo e indefinido também avisam, e não quebram", () => {
    // Lista ainda carregando e lista vazia chegam iguais ao seletor; nenhum dos
    // dois pode virar caixa muda.
    expect(renderizar(null).textContent).toContain("Nenhuma obra cadastrada");
    act(() => root?.unmount());
    container?.remove();
    expect(renderizar(undefined).textContent).toContain("Nenhuma obra cadastrada");
  });

  it("o aviso diz O QUE FAZER, e não só que está vazio", () => {
    // "Nenhum resultado" deixa a pessoa sem saber se cadastra, recarrega ou
    // pede acesso. O aviso precisa apontar a saída.
    expect(SEM_OBRA_CADASTRADA).toMatch(/cadastre/i);
    expect(SEM_OBRA_CADASTRADA).toMatch(/obras/i);
  });
});
