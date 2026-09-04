import { supabase } from "@/integrations/supabase/client";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { aposRespostaDoUpload, decisaoDoUpload } from "@/utils/uploadAutenticacao";

const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

/**
 * Converte qualquer URL ou caminho relativo para a URL absoluta final no R2,
 * removendo prefixos de buckets antigos do Supabase que não existem mais na estrutura do R2.
 */
/**
 * @deprecated Use resolveFileUrl from "@/utils/fileUrlResolver" instead.
 * Esta função está mantida temporariamente para evitar quebras durante a transição,
 * mas delega a lógica para o novo resolver centralizado.
 */
export function getPublicUrl(url: string | null | undefined): string {
  return resolveFileUrl(url);
}

export function getAbsoluteUrl(url: string | null | undefined): string {
  return getPublicUrl(url);
}

const WORKER_URL = "https://obras-upload-api.brunob1198.workers.dev/";

/**
 * Token de acesso da sessão atual, com o vencimento.
 *
 * `getSession()` e não `getUser()`: o segundo bate na rede a cada chamada, e o
 * upload já é o caminho mais lento do app.
 */
async function sessaoAtual(): Promise<{ token: string | null; expiraEm: number | null }> {
  const { data } = await supabase.auth.getSession();
  return {
    token: data.session?.access_token ?? null,
    expiraEm: data.session?.expires_at ?? null,
  };
}

/** Força um token novo. Devolve `null` se a sessão não puder mais ser renovada. */
async function renovarSessao(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.warn("Não foi possível renovar a sessão antes do upload:", error.message);
    return null;
  }
  return data.session?.access_token ?? null;
}

/**
 * Junta o detalhe do servidor à mensagem, quando o detalhe acrescenta algo.
 *
 * O corpo da resposta é JSON. Concatenar o corpo cru fazia o aviso terminar em
 * `({"success":false})`, que não diz nada a quem está na obra e faz a frase útil
 * parecer erro de programa. Então: aproveita só o campo `error`, e cala quando ele
 * repete o que a mensagem já disse.
 */
function comDetalhe(mensagem: string, corpo: string): string {
  let detalhe = corpo.trim();

  try {
    const json = JSON.parse(detalhe) as { error?: unknown };
    detalhe = typeof json.error === "string" ? json.error.trim() : "";
  } catch {
    // Não era JSON: o texto puro serve, contanto que seja curto.
    detalhe = detalhe.slice(0, 200);
  }

  if (!detalhe || mensagem.includes(detalhe)) return mensagem;
  return `${mensagem} (${detalhe})`;
}

/**
 * Envia um arquivo para o R2 pelo Worker.
 *
 * O `Authorization` vai em toda chamada: é ele que fecha o endpoint, que antes
 * aceitava `POST` de qualquer origem sem identificar ninguém.
 *
 * A REPETIÇÃO NÃO É ZELO EXTRA, É O QUE TORNA A MUDANÇA SEGURA PARA O CAMPO.
 *
 * Sem ela, o token vencendo durante a subida de uma foto — minutos, num sinal ruim
 * de obra — devolveria 401 e a evidência se perderia. Ver `uploadAutenticacao.ts`
 * para o raciocínio das duas regras (renovar antes; renovar e repetir uma vez).
 */
export async function uploadImage(file: File, folder?: "thumb" | "medium" | "original"): Promise<string> {
  let fileToUpload = file;

  if (!folder && file.type.startsWith('image/')) {
    const { compressImage } = await import("@/lib/imageCompression");
    fileToUpload = await compressImage(file);
  }

  const { token, expiraEm } = await sessaoAtual();
  const decisao = decisaoDoUpload({ token, expiraEm, agora: Math.floor(Date.now() / 1000) });

  if (decisao.enviar !== true) {
    // Falha antes de gastar a subida do arquivo, com a frase que diz o que fazer.
    // O caso conhecido é a página pública /extrator, onde o logo é enviado sem login.
    throw new Error(decisao.motivo);
  }

  let tokenAtual = decisao.token;
  let jaRenovou = false;

  if (decisao.renovarPrimeiro) {
    const novo = await renovarSessao();
    jaRenovou = true;
    if (novo) tokenAtual = novo;
    // Se a renovação falhou, ainda tenta com o token velho: ele pode ter alguns
    // segundos de vida, e uma tentativa é melhor que desistir sem tentar.
  }

  console.log("UPLOAD ATTEMPT:", file.name, (file.size / 1024).toFixed(2), "KB", folder ? `FOLDER: ${folder}` : "");

  // No máximo duas voltas: a segunda só acontece com token renovado.
  for (;;) {
    const formData = new FormData();
    formData.append("file", fileToUpload);
    if (folder) {
      formData.append("folder", folder);
    }

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenAtual}` },
      body: formData,
    });

    const proximoPasso = aposRespostaDoUpload({ status: response.status, jaRenovou });

    if (proximoPasso.acao === "RENOVAR_E_REPETIR") {
      const novo = await renovarSessao();
      jaRenovou = true;
      if (!novo) {
        throw new Error(
          "Sua sessão expirou e o arquivo não foi enviado. Entre novamente e repita o envio."
        );
      }
      tokenAtual = novo;
      continue;
    }

    if (proximoPasso.acao === "DESISTIR") {
      throw new Error(
        comDetalhe(proximoPasso.mensagem, await response.text().catch(() => ""))
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Falha upload");
    }

    // O worker retorna o path relativo (ex: "arquivo.pdf"). resolveFileUrl gera a URL final para novos arquivos (R2).
    return resolveFileUrl(data.url);
  }
}

export interface UploadedVariants {
  thumbUrl: string;
  mediumUrl: string;
  originalUrl: string;
}

export async function uploadImageWithVariants(file: File): Promise<UploadedVariants> {
  const { generateImageVariants } = await import("@/lib/generateImageVariants");
  const variants = await generateImageVariants(file);
  
  const [thumbUrl, mediumUrl, originalUrl] = await Promise.all([
    uploadImage(variants.thumb, "thumb"),
    uploadImage(variants.medium, "medium"),
    uploadImage(variants.original, "original")
  ]);

  return { thumbUrl, mediumUrl, originalUrl };
}

export async function verifyImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  return true;
}

/**
 * Pede ao Worker que apague o arquivo.
 *
 * MEDIDO NO NAVEGADOR: NÃO FUNCIONA, E NÃO É POR CAUSA DESTA MUDANÇA.
 *
 * O Worker responde apenas a `POST` e `OPTIONS`. O `DELETE` daqui é barrado pelo
 * navegador na verificação de permissão entre origens e nem chega ao servidor
 * ("Failed to fetch"). A função cai no `catch` e devolve `false` desde sempre — ou
 * seja, apagar imagem em Contratos, Clientes e Meu Perfil remove a referência no
 * banco e deixa o arquivo no bucket para sempre.
 *
 * Fica registrado aqui em vez de "corrigido de passagem": abrir exclusão remota é
 * decisão de projeto, não detalhe de implementação — um endpoint que apaga arquivo
 * precisa de mais cuidado de autorização que um que grava.
 */
export async function deleteImage(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(
      `${WORKER_URL}?url=${encodeURIComponent(url)}`,
      { method: "DELETE" }
    );
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Erro ao deletar imagem do R2:", error);
    return false;
  }
}
