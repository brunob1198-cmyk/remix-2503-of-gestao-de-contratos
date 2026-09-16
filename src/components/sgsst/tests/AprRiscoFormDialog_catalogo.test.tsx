// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { AprRiscoFormDialog } from "../AprRiscoFormDialog";
import type { SgsstRisco } from "@/hooks/sgsst/useSgsstRiscos";

/**
 * Roteiro 1.8, do lado da tela.
 *
 * Os testes de `catalogoAtivo` provam a REGRA. Este prova a LIGAÇÃO: nove
 * seletores consomem os catálogos, e era exatamente aí que a regra faltava —
 * dois filtravam por conta própria, sete ofereciam tudo. Testar só o utilitário
 * deixaria o defeito original passar inteiro.
 *
 * O diálogo da APR serve de amostra porque recebe o catálogo por propriedade,
 * sem hook nem provider — dá para montar o componente de verdade.
 *
 * O QUE ESTE ARQUIVO **NÃO** COBRE, E POR QUÊ
 *
 * A outra metade da regra — "o inativo que JÁ está escolhido continua na lista" —
 * está em `catalogoAtivo.test.ts`, e não aqui. Tentei cobri-la montando o
 * diálogo com um item antigo selecionado e o Radix Select não se deixa observar
 * no jsdom: o efeito de carga roda (o campo de perigo recebe o valor), mas o
 * `<select>` oculto e o atributo do gatilho reportam valores que se contradizem.
 * Teste que não se explica não é garantia, é ruído — e um que passasse por acaso
 * seria pior que nenhum.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const risco = (id: string, nome: string, status: string): SgsstRisco =>
  ({ id, nome, status, categoria: "Físico" }) as SgsstRisco;

const CATALOGO = [
  risco("r-ativo", "Ruído", "ativo"),
  risco("r-velho", "Risco descontinuado", "inativo"),
];

function montar(riscoItem?: { risco_catalogo_id?: string | null }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(
      <AprRiscoFormDialog
        open
        onOpenChange={() => {}}
        etapaId="e1"
        riscoItem={riscoItem as never}
        riscosCatalogo={CATALOGO}
        onSave={async () => {}}
      />
    );
  });
}

/**
 * As opções do catálogo, com o seletor aberto.
 *
 * O Radix só monta o conteúdo quando abre, e abre por teclado sem depender de
 * `pointerdown`, que o jsdom não entrega como o navegador. O conteúdo vai para
 * um portal, então a busca é no documento todo e não no container.
 */
function opcoesDoCatalogo(): string[] {
  const gatilhos = Array.from(document.querySelectorAll('[role="combobox"]'));
  const gatilho = gatilhos[0] as HTMLElement | undefined;
  if (!gatilho) return [];

  act(() => {
    gatilho.focus();
    gatilho.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
    );
  });

  return Array.from(document.querySelectorAll('[role="option"]')).map((o) =>
    (o.textContent ?? "").trim()
  );
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  document.body.innerHTML = "";
});

describe("AprRiscoFormDialog — o catálogo oferecido", () => {
  it("o risco inativo não é oferecido", () => {
    montar();
    const textos = opcoesDoCatalogo().join(" | ");
    expect(textos).toContain("Ruído");
    expect(textos).not.toContain("Risco descontinuado");
  });

  it("o ativo não ganha o rótulo de inativo", () => {
    montar();
    expect(opcoesDoCatalogo().join(" | ")).not.toContain("(inativo)");
  });
});
