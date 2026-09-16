// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { ControleDeResposta } from "../AplicarChecklistDialog";

/**
 * Roteiro 15.3: "cada um mostra o controle certo na aplicação".
 *
 * Os testes de `respostaDoChecklist` provam a REGRA. Este prova a TELA: monta o
 * componente de verdade e olha o que foi para o DOM. É a diferença entre saber
 * que a função devolve `formato: "data"` e saber que apareceu um campo de data.
 *
 * Era exatamente aí que o defeito morava — a regra nunca existiu como regra, e o
 * JSX decidia tudo com `startsWith("Sim")`.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function montar(props: {
  tipo: string;
  valor?: string;
  isNc?: boolean;
  onResponder?: (valor: string, naoConforme: boolean) => void;
}): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(
      <ControleDeResposta
        tipo={props.tipo}
        valor={props.valor ?? ""}
        isNc={props.isNc ?? false}
        onResponder={props.onResponder ?? (() => {})}
      />
    );
  });

  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

const textos = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim());

describe("ControleDeResposta — o que aparece na tela", () => {
  it("Conforme/NC/NA mostra os três botões", () => {
    expect(textos(montar({ tipo: "Conforme_NaoConforme_NA" }))).toEqual([
      "Conforme",
      "Não Conforme",
      "N/A",
    ]);
  });

  it("Conforme/NC sem NA não mostra o N/A", () => {
    expect(textos(montar({ tipo: "Conforme_NaoConforme" }))).toEqual([
      "Conforme",
      "Não Conforme",
    ]);
  });

  it("Sim/Não mostra Sim e Não, e não Conforme", () => {
    expect(textos(montar({ tipo: "Sim_Nao" }))).toEqual(["Sim", "Não"]);
  });

  it("OK/Não OK mostra OK e Não OK", () => {
    // Antes este tipo caía no ramo padrão e a tela dizia "Conforme".
    expect(textos(montar({ tipo: "OK_NaoOK" }))).toEqual(["OK", "Não OK"]);
  });

  it("Escala mostra as cinco notas, e não dois botões", () => {
    const t = textos(montar({ tipo: "Escala" }));
    expect(t.slice(0, 5)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("Número vira campo numérico", () => {
    const input = montar({ tipo: "Numero" }).querySelector("input");
    expect(input?.getAttribute("type")).toBe("number");
  });

  it("Data vira campo de data", () => {
    const input = montar({ tipo: "Data" }).querySelector("input");
    expect(input?.getAttribute("type")).toBe("date");
  });

  it("Texto vira campo de texto com a dica", () => {
    const input = montar({ tipo: "Texto" }).querySelector("input");
    expect(input?.getAttribute("type")).toBe("text");
    expect(input?.getAttribute("placeholder")).toBeTruthy();
  });

  it("os tipos de botão não têm campo livre", () => {
    expect(montar({ tipo: "Conforme_NaoConforme_NA" }).querySelector("input")).toBeNull();
  });
});

describe("ControleDeResposta — o que é gravado", () => {
  it("o botão de não conformidade grava o valor do tipo e marca desvio", () => {
    const onResponder = vi.fn();
    const el = montar({ tipo: "Sim_Nao", onResponder });

    act(() => {
      el.querySelectorAll("button")[1].click();
    });

    expect(onResponder).toHaveBeenCalledWith("Nao", true);
  });

  it("OK/Não OK grava OK, e não Conforme", () => {
    const onResponder = vi.fn();
    const el = montar({ tipo: "OK_NaoOK", onResponder });

    act(() => {
      el.querySelectorAll("button")[0].click();
    });

    expect(onResponder).toHaveBeenCalledWith("OK", false);
  });

  it("a nota da escala é gravada como valor, e nenhuma é desvio por si", () => {
    const onResponder = vi.fn();
    const el = montar({ tipo: "Escala", onResponder });

    act(() => {
      el.querySelectorAll("button")[2].click();
    });

    expect(onResponder).toHaveBeenCalledWith("3", false);
  });
});

describe("ControleDeResposta — o desvio nos tipos livres", () => {
  const botaoDesvio = (el: HTMLElement) =>
    Array.from(el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Desvio")
    );

  it("tipo livre ganha o botão de desvio", () => {
    for (const tipo of ["Escala", "Numero", "Texto", "Data"]) {
      expect(botaoDesvio(montar({ tipo }))).toBeTruthy();
      act(() => root?.unmount());
      container?.remove();
    }
  });

  it("tipo de botão não ganha: a própria opção já classifica", () => {
    expect(botaoDesvio(montar({ tipo: "Conforme_NaoConforme_NA" }))).toBeUndefined();
  });

  it("fica desabilitado enquanto não há resposta", () => {
    // Desvio marcado em campo vazio gravaria não conformidade que o cálculo
    // descarta por falta de valor — desvio que some é pior que desvio nenhum.
    expect(botaoDesvio(montar({ tipo: "Numero", valor: "" }))?.disabled).toBe(true);
    act(() => root?.unmount());
    container?.remove();

    expect(botaoDesvio(montar({ tipo: "Numero", valor: "92" }))?.disabled).toBe(false);
  });

  it("marcar o desvio conserva o valor respondido", () => {
    const onResponder = vi.fn();
    const el = montar({ tipo: "Numero", valor: "92", onResponder });

    act(() => botaoDesvio(el)!.click());

    expect(onResponder).toHaveBeenCalledWith("92", true);
  });

  it("desmarcar o desvio também conserva o valor", () => {
    const onResponder = vi.fn();
    const el = montar({ tipo: "Numero", valor: "92", isNc: true, onResponder });

    act(() => botaoDesvio(el)!.click());

    expect(onResponder).toHaveBeenCalledWith("92", false);
  });
});
