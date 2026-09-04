/**
 * Quem pode enviar arquivo, e o que fazer quando o token não serve mais.
 *
 * POR QUE ISTO EXISTE
 *
 * O endpoint de upload aceitava `POST` de qualquer origem sem autenticação
 * nenhuma: quem descobrisse a URL gravava arquivo no bucket. Passar a exigir a
 * sessão do Supabase fecha isso — mas cria um risco novo, e o risco cai justamente
 * sobre quem está na obra.
 *
 * O RISCO QUE ESTE MÓDULO EXISTE PARA EVITAR
 *
 * O token de acesso do Supabase é curto (uma hora). O trabalhador tira a foto da
 * evidência no andaime, com sinal ruim, e o envio pode levar minutos. Se o token
 * vencer no meio, o servidor recusa e a foto se perde — e ele não tem como saber
 * que se perdeu nem como refazer, porque a condição que ele fotografou já mudou.
 *
 * Então a autenticação, aqui, é a parte fácil. O que protege o usuário são duas
 * regras:
 *
 * 1. RENOVAR ANTES DE ENVIAR, quando o token está perto de vencer. Evitar o erro é
 *    melhor que tratá-lo: não gasta a subida do arquivo duas vezes numa conexão
 *    ruim, que é o recurso escasso no campo.
 *
 * 2. RENOVAR E TENTAR DE NOVO, UMA VEZ, se o servidor recusar mesmo assim. Uma vez
 *    só — repetir em laço numa recusa que é definitiva (sessão encerrada de
 *    verdade) transformaria a falha em travamento, e o usuário preferiria o aviso.
 *
 * A lógica fica separada do `fetch` de propósito: dá para testar a decisão de
 * renovar sem precisar de rede, de sessão e de relógio.
 */

/**
 * Quanto antes do vencimento já vale renovar.
 *
 * Dois minutos porque é a ordem de grandeza de uma foto de celular subindo em 3G
 * ruim. Margem menor não cobriria o envio; margem muito maior renovaria a sessão
 * a cada upload sem necessidade.
 */
export const MARGEM_ANTES_DE_VENCER_S = 120;

export type DecisaoDoUpload =
  | { enviar: true; token: string; renovarPrimeiro: boolean }
  | { enviar: false; motivo: string };

/**
 * Dá para enviar com a sessão que existe agora?
 *
 * `agora` entra por parâmetro para o teste não depender do relógio da máquina.
 */
export function decisaoDoUpload(params: {
  token: string | null | undefined;
  /** `expires_at` da sessão do Supabase, em segundos desde a época. */
  expiraEm?: number | null;
  agora: number;
}): DecisaoDoUpload {
  const token = (params.token ?? "").trim();

  if (!token) {
    return {
      enviar: false,
      motivo:
        "Você precisa estar conectado para enviar arquivos. Entre novamente e repita o envio.",
    };
  }

  // Sem `expires_at` não há como julgar: envia e deixa o servidor decidir. Recusar
  // por falta de informação bloquearia um token que pode estar perfeitamente válido.
  if (params.expiraEm == null) {
    return { enviar: true, token, renovarPrimeiro: false };
  }

  const segundosRestantes = params.expiraEm - params.agora;

  // Já venceu, ou vence antes de o arquivo terminar de subir: renova antes.
  // Não é recusa — a sessão continua válida, só o token de acesso é que é curto.
  return {
    enviar: true,
    token,
    renovarPrimeiro: segundosRestantes <= MARGEM_ANTES_DE_VENCER_S,
  };
}

export type AposResposta =
  | { acao: "PRONTO" }
  | { acao: "RENOVAR_E_REPETIR" }
  | { acao: "DESISTIR"; mensagem: string };

/**
 * O que fazer com a resposta do servidor de upload.
 *
 * Só 401 e 403 merecem nova tentativa: são as duas formas de "seu token não serve".
 * Repetir um 400 ("arquivo não enviado") ou um 413 (arquivo grande demais) gastaria
 * a conexão do campo de novo para receber exatamente a mesma recusa.
 */
export function aposRespostaDoUpload(params: {
  status: number;
  /** Já houve uma renovação nesta tentativa? */
  jaRenovou: boolean;
}): AposResposta {
  if (params.status >= 200 && params.status < 300) return { acao: "PRONTO" };

  const ehProblemaDeToken = params.status === 401 || params.status === 403;

  if (ehProblemaDeToken && !params.jaRenovou) {
    return { acao: "RENOVAR_E_REPETIR" };
  }

  if (ehProblemaDeToken) {
    // Renovou e o servidor recusou de novo: a sessão terminou de verdade. A frase
    // diz o que fazer, e diz que o arquivo NÃO foi enviado — para o usuário não
    // sair do andaime achando que a evidência está registrada.
    return {
      acao: "DESISTIR",
      mensagem:
        "Sua sessão expirou e o arquivo não foi enviado. Entre novamente e repita o envio.",
    };
  }

  // 5xx não é recusa, é indisponibilidade — e a diferença muda o que o usuário faz.
  // "Recusou" pede que ele mude algo (arquivo menor, outro formato); numa falha
  // temporária o que resolve é repetir. Dizer "recusou" num 503 manda o trabalhador
  // procurar defeito numa foto que estava boa.
  if (params.status >= 500) {
    return {
      acao: "DESISTIR",
      mensagem:
        `O servidor de arquivos está indisponível (HTTP ${params.status}) e o arquivo não foi enviado. ` +
        "Tente novamente em alguns instantes.",
    };
  }

  return {
    acao: "DESISTIR",
    mensagem: `O servidor recusou o envio (HTTP ${params.status}). O arquivo não foi enviado.`,
  };
}
