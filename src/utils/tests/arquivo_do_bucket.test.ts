import { describe, expect, it } from "vitest";
import { HOST_DO_BUCKET, arquivoDoBucket } from "@/utils/arquivoDoBucket";

const url = (caminho: string) => `https://${HOST_DO_BUCKET}/${caminho}`;

describe("arquivoDoBucket", () => {
  it("extrai a chave de uma URL do bucket", () => {
    const r = arquivoDoBucket(url("1788872091780-foto.webp"));
    expect(r).toEqual({ ehDoBucket: true, chave: "1788872091780-foto.webp" });
  });

  it("decodifica nome com espaco e acento", () => {
    // O worker grava `${Date.now()}-${file.name}`, e nome de arquivo de celular
    // vem com espaco e acento; a URL chega escapada.
    const r = arquivoDoBucket(url("123-Rel%C3%A1torio%20final.pdf"));
    if (r.ehDoBucket !== true) throw new Error("esperava chave");
    expect(r.chave).toBe("123-Relátorio final.pdf");
  });

  it.each([
    ["URL antiga do Supabase Storage", "https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public/avatars/x.png"],
    ["caminho relativo", "avatars/x.png"],
    ["string vazia", ""],
    ["nulo", null],
  ])("nao e do bucket: %s", (_nome, entrada) => {
    const r = arquivoDoBucket(entrada as string);
    expect(r.ehDoBucket).toBe(false);
  });

  it("nomeia o host quando o arquivo esta em outro lugar", () => {
    const r = arquivoDoBucket("https://exemplo.com/foto.png");
    if (r.ehDoBucket !== false) throw new Error("esperava recusa");
    expect(r.motivo).toContain("exemplo.com");
  });

  it("recusa chave com barra", () => {
    // O Worker apaga por chave. Chave com caminho e o jeito de pedir a exclusao
    // de um objeto diferente do que a URL aparentava.
    const r = arquivoDoBucket(url("pasta/arquivo.png"));
    expect(r.ehDoBucket).toBe(false);
  });

  it("recusa travessia de diretorio", () => {
    const r = arquivoDoBucket(url("..%2F..%2Foutro.png"));
    expect(r.ehDoBucket).toBe(false);
  });

  it("recusa URL do bucket sem arquivo", () => {
    const r = arquivoDoBucket(`https://${HOST_DO_BUCKET}/`);
    expect(r.ehDoBucket).toBe(false);
  });
});
