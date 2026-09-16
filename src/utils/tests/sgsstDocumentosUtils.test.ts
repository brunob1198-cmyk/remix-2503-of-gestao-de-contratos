import { describe, expect, it } from "vitest";
import {
  ALLOWED_DOC_EXTENSIONS,
  MAX_DOC_FILE_SIZE_BYTES,
  recusaDoArquivo,
} from "../sgsstDocumentosUtils";

/**
 * Roteiro 14.5: "Subir um arquivo grande ou de tipo não suportado → Mensagem
 * clara do limite OU DO TIPO ACEITO — não uma falha silenciosa."
 *
 * O tamanho já era conferido. O tipo não: `ALLOWED_DOC_EXTENSIONS` existia e era
 * usada num lugar só, o atributo `accept` do input — que é dica, não trava. O
 * diálogo do sistema tem "todos os arquivos", e arrastar-e-soltar ignora o
 * `accept` por completo.
 *
 * Quem escolhesse um `.zip` não via mensagem nenhuma: o envio seguia, o arquivo
 * ia para o R2, e o documento ficava lá sem abrir para visualização.
 */

const arquivo = (name: string, size = 1024) => ({ name, size });

describe("recusaDoArquivo — tipo", () => {
  it.each(ALLOWED_DOC_EXTENSIONS)("aceita %s", (ext) => {
    expect(recusaDoArquivo(arquivo(`laudo${ext}`))).toBeNull();
  });

  it("recusa extensão fora da lista, dizendo o que é aceito", () => {
    const r = recusaDoArquivo(arquivo("programa.zip"));
    expect(r).toContain(".zip");
    expect(r).toContain(".pdf");
  });

  it("recusa arquivo sem extensão", () => {
    // "Sem extensão" e "extensão errada" são problemas diferentes, e a mensagem
    // de cada um leva a uma ação diferente.
    expect(recusaDoArquivo(arquivo("LEIAME"))).toContain("sem extensão");
  });

  it("não se engana com ponto no meio do nome", () => {
    expect(recusaDoArquivo(arquivo("PGR.rev.2.pdf"))).toBeNull();
    expect(recusaDoArquivo(arquivo("PGR.pdf.exe"))).not.toBeNull();
  });

  it("maiúsculas não driblam a regra", () => {
    // `.PDF` do Windows é o caso comum, e recusá-lo seria tão errado quanto
    // aceitar `.EXE`.
    expect(recusaDoArquivo(arquivo("LAUDO.PDF"))).toBeNull();
    expect(recusaDoArquivo(arquivo("virus.EXE"))).not.toBeNull();
  });
});

describe("recusaDoArquivo — tamanho", () => {
  it("aceita no limite exato", () => {
    expect(recusaDoArquivo(arquivo("laudo.pdf", MAX_DOC_FILE_SIZE_BYTES))).toBeNull();
  });

  it("recusa um byte acima, dizendo o tamanho e o limite", () => {
    const r = recusaDoArquivo(arquivo("laudo.pdf", MAX_DOC_FILE_SIZE_BYTES + 1));
    expect(r).toContain("50 MB");
    // Diz também quanto o arquivo tem: "passou do limite" sem o número faz a
    // pessoa tentar de novo às cegas.
    expect(r).toMatch(/\d+[.,]\d+ MB/);
  });

  it("o tamanho é checado antes do tipo", () => {
    // Um .zip de 80 MB tem dois problemas; dizer o do tamanho primeiro evita
    // que a pessoa converta o arquivo para PDF e esbarre no limite depois.
    const r = recusaDoArquivo(arquivo("enorme.zip", MAX_DOC_FILE_SIZE_BYTES + 1));
    expect(r).toContain("limite");
    expect(r).not.toContain(".zip");
  });
});
