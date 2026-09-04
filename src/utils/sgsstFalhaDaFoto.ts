/**
 * Por que uma foto não entrou no PDF.
 *
 * O DEFEITO QUE ISTO CORRIGE
 *
 * O documento saía dizendo apenas "Failed to fetch", que é o texto que o navegador
 * usa para QUALQUER falha de rede — e que não diz a ninguém o que fazer. O usuário
 * via a foto na tela do sistema e não entendia por que ela não estava no PDF.
 *
 * O QUE ESTAVA ACONTECENDO, MEDIDO NO NAVEGADOR
 *
 * As fotos ficam num bucket público do Cloudflare R2 (`pub-*.r2.dev`), que NÃO
 * envia cabeçalho de CORS. Resultado, com a mesma URL:
 *
 *   fetch(url) ......................... Failed to fetch
 *   <img src=url> ...................... carrega, 512×512
 *   <img crossOrigin="anonymous"> ...... erro
 *
 * Ou seja: o arquivo existe e é público, e o host só não autoriza este site a LER
 * os bytes. Sem ler os bytes não há como embutir a imagem no PDF — o caminho
 * fetch → blob existe justamente para o canvas não ser contaminado, e desenhar a
 * `<img>` direto contaminaria o canvas e faria o `toDataURL` lançar exceção, o que
 * derrubaria a geração do PDF inteiro em vez de perder uma foto.
 *
 * Então a correção possível no código é DIAGNOSTICAR: dizer que é CORS do host,
 * nomear o host e dizer o que configurar. A liberação em si é do bucket.
 */

export type CausaDaFalhaDaFoto =
  /** O arquivo carrega em `<img>` mas o host não libera a leitura dos bytes. */
  | "CORS_DO_HOST"
  /** O host respondeu, e respondeu que não tem o arquivo. */
  | "ARQUIVO_AUSENTE"
  /** Baixou, mas o conteúdo não é uma imagem legível. */
  | "NAO_E_IMAGEM"
  /** Nem o `fetch` nem a `<img>` chegaram ao host. */
  | "SEM_RESPOSTA"
  | "OUTRA";

/** Só o host, para a mensagem dizer QUAL bucket configurar. */
export function hostDaUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Classifica a falha a partir do que foi observado.
 *
 * `imagemCarrega` é o discriminador que separa "não posso ler" de "não existe": se
 * a `<img>` carrega e o `fetch` falhou, o arquivo está lá e o problema é
 * permissão de leitura entre origens. Sem esse teste as duas situações chegavam ao
 * usuário com a mesma frase, e são consertadas em lugares diferentes.
 */
export function classificarFalhaDaFoto(params: {
  /** `false` quando o fetch nem chegou a receber resposta (TypeError). */
  fetchRespondeu: boolean;
  /** HTTP status, quando houve resposta. */
  status?: number | null;
  /** A mesma URL carrega numa `<img>` sem crossOrigin? */
  imagemCarrega?: boolean | null;
  /** Erro ao decodificar o que foi baixado. */
  conteudoInvalido?: boolean;
}): CausaDaFalhaDaFoto {
  if (params.conteudoInvalido) return "NAO_E_IMAGEM";

  if (params.fetchRespondeu) {
    const s = params.status ?? 0;
    if (s === 404 || s === 403 || s === 401 || s === 400) return "ARQUIVO_AUSENTE";
    return s >= 400 ? "OUTRA" : "OUTRA";
  }

  // Sem resposta ao fetch. A `<img>` decide entre CORS e host inalcançável.
  if (params.imagemCarrega === true) return "CORS_DO_HOST";
  if (params.imagemCarrega === false) return "SEM_RESPOSTA";
  return "OUTRA";
}

/**
 * A frase que sai no PDF.
 *
 * Diz o que aconteceu, e no caso de CORS diz o que configurar e onde. Mensagem que
 * só descreve o sintoma faz o usuário abrir chamado; mensagem que nomeia o host e
 * a política deixa o conserto ao alcance de quem administra o bucket.
 */
export function mensagemDaFalhaDaFoto(
  causa: CausaDaFalhaDaFoto,
  detalhe: { host?: string; status?: number | null; bruto?: string | null } = {}
): string {
  const host = detalhe.host ? ` (${detalhe.host})` : "";

  switch (causa) {
    case "CORS_DO_HOST":
      return (
        `o servidor das fotos${host} não autoriza este site a ler o arquivo. ` +
        "A foto existe e aparece na tela do sistema, mas para entrar no PDF o bucket " +
        "precisa liberar esta origem na política de CORS"
      );
    case "ARQUIVO_AUSENTE":
      return `o arquivo não foi encontrado no servidor${host}` +
        (detalhe.status ? ` (HTTP ${detalhe.status})` : "");
    case "NAO_E_IMAGEM":
      return "o arquivo baixado não é uma imagem legível";
    case "SEM_RESPOSTA":
      return `não houve resposta do servidor das fotos${host} — verifique a conexão`;
    default:
      return detalhe.bruto?.trim() || "falha ao baixar o arquivo";
  }
}

/**
 * Verdadeiro quando a causa é a mesma para todas as fotos e vale um aviso único.
 *
 * CORS do host não é problema de uma foto: se ele bloqueia, bloqueia todas. Repetir
 * a explicação em cada moldura enche o documento com o mesmo parágrafo — o resumo
 * aparece uma vez e as molduras ficam com a frase curta.
 */
export function falhaEhDoHostInteiro(causas: readonly CausaDaFalhaDaFoto[]): boolean {
  return causas.length > 0 && causas.every((c) => c === "CORS_DO_HOST");
}
