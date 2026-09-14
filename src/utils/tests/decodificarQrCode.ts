import jsQR from "jsqr";
import { modulosDoQrCode } from "@/utils/qrCodeGenerator";

/**
 * Lê de volta um QR Code gerado por nós. **Só para teste.**
 *
 * Fica fora de `src/utils` solto de propósito: o `jsqr` é dependência de
 * desenvolvimento, e um módulo da aplicação importando-o quebraria o build.
 *
 * POR QUE PRECISA EXISTIR
 *
 * O gerador antigo desenhava algo parecido com um QR Code e não codificava nada.
 * Sobreviveu porque todo teste olhava a aparência — "é data:image/", "tem os três
 * quadrados" — e nenhum tentava ler. Quem descobriu foi o usuário, apontando o
 * celular para a tela.
 *
 * A decodificação roda sobre a MATRIZ de módulos, montada como imagem em
 * memória, e não sobre o PNG: assim não é preciso canvas nem leitor de PNG para
 * rodar no CI, e a matriz é a mesma que a imagem desenha.
 */
export function decodificarQrCode(texto: string, escalaEmPixels = 4): string | null {
  const { tamanho, escuro } = modulosDoQrCode(texto);

  // Quiet zone: sem a borda branca em volta, o leitor não acha o código.
  const borda = 4;
  const lado = (tamanho + borda * 2) * escalaEmPixels;
  const dados = new Uint8ClampedArray(lado * lado * 4);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const col = Math.floor(x / escalaEmPixels) - borda;
      const lin = Math.floor(y / escalaEmPixels) - borda;
      const dentro = col >= 0 && lin >= 0 && col < tamanho && lin < tamanho;
      const v = dentro && escuro[lin * tamanho + col] ? 0 : 255;
      const i = (y * lado + x) * 4;
      dados[i] = v;
      dados[i + 1] = v;
      dados[i + 2] = v;
      dados[i + 3] = 255;
    }
  }

  return jsQR(dados, lado, lado)?.data ?? null;
}
