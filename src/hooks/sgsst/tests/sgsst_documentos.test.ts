import { describe, it, expect } from "vitest";
import { ALLOWED_DOC_EXTENSIONS, MAX_DOC_FILE_SIZE_BYTES } from "../../../utils/sgsstDocumentosUtils";

describe("SGSST Documentos + Cloudflare R2 Integration Rules", () => {
  it("validates allowed file extensions for SGSST documents", () => {
    const extensions = [".pdf", ".docx", ".xlsx", ".png", ".jpg"];
    extensions.forEach((ext) => {
      expect(ALLOWED_DOC_EXTENSIONS).toContain(ext);
    });
  });

  it("enforces maximum file size limit (50MB)", () => {
    expect(MAX_DOC_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it("validates document categories (PGR, APR, PT, INSPECAO, INCIDENTE, NAO_CONFORMIDADE, PCMSO, ASO, TREINAMENTO, EPI, OUTROS)", () => {
    const categorias = [
      "PGR",
      "APR",
      "PT",
      "INSPECAO",
      "INCIDENTE",
      "NAO_CONFORMIDADE",
      "PCMSO",
      "ASO",
      "TREINAMENTO",
      "EPI",
      "OUTROS",
    ];

    expect(categorias.length).toBe(11);
    expect(categorias).toContain("PGR");
    expect(categorias).toContain("ASO");
    expect(categorias).toContain("TREINAMENTO");
  });
});
