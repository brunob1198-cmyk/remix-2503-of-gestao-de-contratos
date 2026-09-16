// Allowed MIME types / extensions for SGSST documents
export const ALLOWED_DOC_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".webp"
];

// Max file size: 50MB
export const MAX_DOC_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * O arquivo escolhido pode ser enviado?
 *
 * POR QUE ISTO PRECISOU EXISTIR
 *
 * `ALLOWED_DOC_EXTENSIONS` estava sendo usada em UM lugar: o atributo `accept`
 * do input. E `accept` é dica, não trava — o diálogo do sistema tem "todos os
 * arquivos", e arrastar-e-soltar o ignora por completo. Quem escolhesse um
 * `.zip` não via mensagem nenhuma: o envio seguia, o arquivo ia para o R2, e o
 * documento ficava lá sem abrir para visualização.
 *
 * A lista de tipos aceitos existia e nada a conferia. O tamanho, ao lado, já era
 * conferido de verdade — a diferença entre os dois era só descuido.
 *
 * DEVOLVE A MENSAGEM PRONTA, E NÃO UM BOOLEANO
 *
 * "Recusado" sem dizer o que é aceito obriga a pessoa a adivinhar. A mensagem
 * nomeia o que veio e o que caberia.
 */
export function recusaDoArquivo(arquivo: {
  name: string;
  size: number;
}): string | null {
  if (arquivo.size > MAX_DOC_FILE_SIZE_BYTES) {
    const limiteMb = Math.round(MAX_DOC_FILE_SIZE_BYTES / (1024 * 1024));
    const tamanhoMb = (arquivo.size / (1024 * 1024)).toFixed(1);
    return `O arquivo tem ${tamanhoMb} MB e o limite é ${limiteMb} MB.`;
  }

  const ponto = arquivo.name.lastIndexOf(".");
  const extensao = ponto >= 0 ? arquivo.name.slice(ponto).toLowerCase() : "";

  if (!extensao) {
    return `Arquivo sem extensão. São aceitos: ${ALLOWED_DOC_EXTENSIONS.join(", ")}.`;
  }

  if (!ALLOWED_DOC_EXTENSIONS.includes(extensao)) {
    return `Arquivos ${extensao} não são aceitos. São aceitos: ${ALLOWED_DOC_EXTENSIONS.join(", ")}.`;
  }

  return null;
}
