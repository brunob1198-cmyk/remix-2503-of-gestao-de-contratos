/**
 * Qual arquivo do bucket uma URL aponta — e se ela aponta algum.
 *
 * POR QUE ISTO NÃO É UM `split("/").pop()`
 *
 * O `deleteImage` recebe o que estiver gravado na coluna do banco, e ali convivem
 * três coisas diferentes: URL do R2, URL antiga do Supabase Storage (de antes da
 * migração) e caminho relativo solto. Só a primeira tem arquivo no R2 para apagar.
 *
 * Tratar as três como iguais confunde "não havia nada para apagar aqui" com
 * "tentei apagar e falhou" — e as duas situações levam a conclusões opostas sobre
 * se sobrou lixo no bucket.
 */

/** O host público do bucket. Mesmo valor de `uploadImage`/`fileUrlResolver`. */
export const HOST_DO_BUCKET = "pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

export type ArquivoDoBucket =
  | { ehDoBucket: true; chave: string }
  | { ehDoBucket: false; motivo: string };

/**
 * Extrai a chave do objeto no bucket a partir da URL pública.
 *
 * Recusa chave com barra, e não por gosto de validar: o Worker apaga por chave, e
 * uma chave contendo caminho é a forma clássica de pedir a exclusão de um objeto
 * que não é o que a URL aparentava. Os uploads deste projeto gravam sempre no raiz
 * (`<timestamp>-<nome>`), então barra aqui é sinal de que algo está errado, não de
 * um caso legítimo que eu esteja bloqueando.
 */
export function arquivoDoBucket(url: string | null | undefined): ArquivoDoBucket {
  const bruta = (url ?? "").trim();
  if (!bruta) return { ehDoBucket: false, motivo: "URL vazia" };

  let endereco: URL;
  try {
    endereco = new URL(bruta);
  } catch {
    // Caminho relativo: nunca houve arquivo no R2 com esse endereço.
    return { ehDoBucket: false, motivo: "não é uma URL absoluta" };
  }

  if (endereco.host !== HOST_DO_BUCKET) {
    return {
      ehDoBucket: false,
      motivo: `o arquivo está em ${endereco.host}, não no bucket do R2`,
    };
  }

  const chave = decodeURIComponent(endereco.pathname.replace(/^\/+/, ""));

  if (!chave) return { ehDoBucket: false, motivo: "a URL não nomeia arquivo algum" };

  if (chave.includes("/") || chave.includes("..")) {
    return { ehDoBucket: false, motivo: "a chave do arquivo tem formato inesperado" };
  }

  return { ehDoBucket: true, chave };
}
