// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Roteiro 0.5, a parte que o sistema errava.
 *
 * O envio do logotipo gravava a URL APENAS no `localStorage`. A coluna
 * `empresas.logo_url` existe, o `AuthContext` a lê a cada login, e nada no
 * aplicativo a escrevia — o logotipo era do navegador de quem o subiu, e não da
 * empresa.
 *
 * O segundo defeito é mais perigoso que o primeiro: a RLS só deixa o admin da
 * própria empresa atualizar `empresas`. Para os demais o UPDATE **não dá erro**,
 * afeta zero linha e volta calado — e a tela dizia "Logo atualizado com
 * sucesso!". É a mesma armadilha do resto do projeto: consulta bloqueada e
 * consulta sem resultado são indistinguíveis.
 */

const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const uploadImage = vi.fn();
const refreshProfile = vi.fn();

let auth = { empresaId: "emp-1", empresaLogoUrl: null as string | null, refreshProfile };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: (...a: unknown[]) => update(...a) }) },
}));

vi.mock("@/services/uploadImage", () => ({
  uploadImage: (...a: unknown[]) => uploadImage(...a),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  // `useCallback` fora de componente: aqui o hook é chamado direto, e o que
  // interessa é a lógica, não o ciclo de render.
  return { ...react, useCallback: (fn: unknown) => fn };
});

const { useCustomLogo } = await import("@/hooks/useCustomLogo");

/** Encadeia update().eq().select() devolvendo o que o teste mandar. */
function respostaDoBanco(resposta: { data: unknown; error: unknown }) {
  select.mockResolvedValue(resposta);
  eq.mockReturnValue({ select });
  update.mockReturnValue({ eq });
}

const arquivo = () =>
  ({ type: "image/png", size: 1000, name: "logo.png" }) as unknown as File;

beforeEach(() => {
  vi.clearAllMocks();
  auth = { empresaId: "emp-1", empresaLogoUrl: null, refreshProfile };
  uploadImage.mockResolvedValue("https://cdn/logo.png");
  localStorage.clear();
});

describe("useCustomLogo — onde o logotipo é gravado", () => {
  it("grava na EMPRESA, e não só no navegador", () => {
    respostaDoBanco({ data: [{ id: "emp-1" }], error: null });

    return useCustomLogo()
      .uploadLogo(arquivo())
      .then(() => {
        expect(update).toHaveBeenCalledWith({ logo_url: "https://cdn/logo.png" });
        expect(eq).toHaveBeenCalledWith("id", "emp-1");
      });
  });

  it("guarda também a cópia local, que o RDO lê fora do React", async () => {
    respostaDoBanco({ data: [{ id: "emp-1" }], error: null });
    await useCustomLogo().uploadLogo(arquivo());
    expect(localStorage.getItem("custom_logo_url")).toBe("https://cdn/logo.png");
  });

  it("recarrega o perfil, para o cabeçalho mostrar o novo logo na hora", async () => {
    respostaDoBanco({ data: [{ id: "emp-1" }], error: null });
    await useCustomLogo().uploadLogo(arquivo());
    expect(refreshProfile).toHaveBeenCalled();
  });
});

describe("useCustomLogo — quando a RLS recusa em silêncio", () => {
  it("zero linha afetada vira erro, e não sucesso", async () => {
    // Sem esta conferência a tela dizia "Logo atualizado com sucesso!" e nada
    // tinha sido salvo.
    respostaDoBanco({ data: [], error: null });

    await expect(useCustomLogo().uploadLogo(arquivo())).rejects.toThrow(/permiss/i);
  });

  it("recusa não deixa a cópia local mentindo que salvou", async () => {
    respostaDoBanco({ data: [], error: null });

    await expect(useCustomLogo().uploadLogo(arquivo())).rejects.toThrow();
    expect(localStorage.getItem("custom_logo_url")).toBeNull();
  });

  it("erro do banco sobe como erro", async () => {
    respostaDoBanco({ data: null, error: new Error("falha de rede") });
    await expect(useCustomLogo().uploadLogo(arquivo())).rejects.toThrow("falha de rede");
  });

  it("sem empresa identificada não tenta gravar", async () => {
    auth = { empresaId: null, empresaLogoUrl: null, refreshProfile };
    await expect(useCustomLogo().uploadLogo(arquivo())).rejects.toThrow(/Empresa/i);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("useCustomLogo — o que vale como logotipo atual", () => {
  it("o valor da empresa manda sobre a cópia local", () => {
    // A cópia local pode ser de outra empresa, de outro dia ou de um envio que
    // falhou; o valor da empresa é o único com dono.
    localStorage.setItem("custom_logo_url", "https://cdn/velho.png");
    auth = { empresaId: "emp-1", empresaLogoUrl: "https://cdn/novo.png", refreshProfile };

    expect(useCustomLogo().customLogo).toBe("https://cdn/novo.png");
  });

  it("sem valor da empresa ainda, usa a cópia local", () => {
    // Cobre o instante entre abrir a página e o AuthContext terminar de carregar.
    localStorage.setItem("custom_logo_url", "https://cdn/local.png");
    expect(useCustomLogo().customLogo).toBe("https://cdn/local.png");
  });

  it("sem nenhum dos dois, não inventa logotipo", () => {
    expect(useCustomLogo().customLogo).toBeNull();
  });
});

describe("useCustomLogo — remoção", () => {
  it("apaga na empresa, e não só no navegador", async () => {
    respostaDoBanco({ data: [{ id: "emp-1" }], error: null });
    localStorage.setItem("custom_logo_url", "https://cdn/logo.png");

    await useCustomLogo().removeLogo();

    expect(update).toHaveBeenCalledWith({ logo_url: null });
    expect(localStorage.getItem("custom_logo_url")).toBeNull();
  });

  it("recusa da RLS não apaga a cópia local", async () => {
    respostaDoBanco({ data: [], error: null });
    localStorage.setItem("custom_logo_url", "https://cdn/logo.png");

    await expect(useCustomLogo().removeLogo()).rejects.toThrow(/permiss/i);
    expect(localStorage.getItem("custom_logo_url")).toBe("https://cdn/logo.png");
  });
});

describe("useCustomLogo — validação do arquivo", () => {
  it("recusa o que não é imagem antes de subir qualquer coisa", async () => {
    const pdf = { type: "application/pdf", size: 10 } as unknown as File;
    await expect(useCustomLogo().uploadLogo(pdf)).rejects.toThrow(/imagem/i);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("recusa acima de 5 MB", async () => {
    const grande = { type: "image/png", size: 6 * 1024 * 1024 } as unknown as File;
    await expect(useCustomLogo().uploadLogo(grande)).rejects.toThrow(/5MB/i);
    expect(uploadImage).not.toHaveBeenCalled();
  });
});
