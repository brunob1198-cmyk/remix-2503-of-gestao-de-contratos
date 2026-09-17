import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Guarda o documento assinado, no servidor.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * O arquivo final era montado E ENVIADO pelo navegador de quem assinava por
 * ultimo. O envio ao armazenamento exige uma sessao do Supabase — e quem assina
 * por link publico nao tem sessao nenhuma, que e exatamente o caso que a fila
 * existe para atender: o instrutor de fora, o terceirizado, quem nao tem conta.
 *
 * Resultado relatado: dois assinaram, a fila fechou, e o documento assinado
 * nunca apareceu. O erro caia no console de quem tinha acabado de assinar e ia
 * embora.
 *
 * A CREDENCIAL AQUI E O TOKEN DO SIGNATARIO, E NAO UMA SESSAO
 *
 * Por isso a funcao e publica (`verify_jwt = false`): exigir sessao reintroduzia
 * o mesmo problema. O que autentica e o token do link — o mesmo segredo que
 * permitiu assinar. Quem nao o tem nao chega aqui.
 *
 * A CHAVE DE SERVICO NAO SAI DAQUI
 *
 * Ela fica no servidor e e usada para duas coisas: ler o signatario pelo token e
 * falar com o Worker de upload. O navegador nunca a ve.
 *
 * O QUE ESTA FUNCAO NAO FAZ
 *
 * Nao MONTA o PDF. A montagem — juntar original e folha, carimbar os nomes nas
 * ancoras — continua no navegador, onde ja funciona e onde vive o unico gerador
 * da folha de assinaturas. Portar mil linhas para ca criaria um segundo gerador,
 * e dois geradores do mesmo documento divergem na primeira correcao de layout.
 *
 * O que estava quebrado era o ARMAZENAMENTO, e e so isso que muda de lugar.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-assinatura-token, x-hash-original, x-hash-assinado",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WORKER_URL = "https://obras-upload-api.brunob1198.workers.dev/";

/** Teto do arquivo. Documento assinado grande existe; absurdo, nao. */
const LIMITE_BYTES = 40 * 1024 * 1024;

/** Base publica do R2, a mesma que `resolveFileUrl` usa no navegador. */
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

/**
 * O endereco a guardar no banco.
 *
 * O navegador passava a resposta do Worker por `resolveFileUrl`, que completa um
 * caminho solto com a base publica do R2. Aqui e preciso fazer o mesmo: gravar o
 * caminho cru deixaria `arquivo_assinado` com um valor de formato diferente do
 * de todos os documentos anteriores, e quem le esse campo esperando uma URL
 * quebraria — em silencio, que e como este defeito comecou.
 */
function enderecoPublico(url: string): string {
  const limpo = url.trim();
  if (/^https?:\/\//i.test(limpo)) return limpo;
  return `${R2_PUBLIC_BASE_URL}/${limpo.replace(/^\/+/, "")}`;
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return resposta({ ok: false, erro: "Metodo nao suportado." }, 405);
  }

  try {
    const token = (req.headers.get("x-assinatura-token") ?? "").trim();
    if (!token) {
      return resposta({ ok: false, erro: "Token de assinatura ausente." }, 400);
    }

    const bytes = new Uint8Array(await req.arrayBuffer());

    if (bytes.byteLength === 0) {
      return resposta({ ok: false, erro: "O corpo da requisicao esta vazio." }, 400);
    }

    if (bytes.byteLength > LIMITE_BYTES) {
      return resposta(
        { ok: false, erro: `O arquivo excede ${LIMITE_BYTES / (1024 * 1024)} MB.` },
        413
      );
    }

    // Confere que e PDF pelos primeiros bytes, e nao pelo que o cliente disser.
    // Sem isto, um POST com o token gravaria qualquer coisa como "o documento
    // assinado" daquela solicitacao.
    const assinaturaDoArquivo = new TextDecoder().decode(bytes.slice(0, 5));
    if (assinaturaDoArquivo !== "%PDF-") {
      return resposta({ ok: false, erro: "O conteudo enviado nao e um PDF." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const chaveDeServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, chaveDeServico);

    // O token identifica o signatario, e por ele se chega a solicitacao.
    const { data: signatario, error: erroSignatario } = await supabase
      .from("signature_signers")
      .select("id, request_id")
      .eq("token", token)
      .maybeSingle();

    if (erroSignatario) {
      return resposta({ ok: false, erro: "Falha ao validar o link." }, 500);
    }

    if (!signatario) {
      return resposta({ ok: false, erro: "Link invalido." }, 403);
    }

    /*
      NAO SUBSTITUI DOCUMENTO QUE JA EXISTE.

      Quem tem o token ja podia chamar o fechamento direto do navegador, entao
      isto nao fecha uma porta nova — fecha a pior consequencia dela: trocar, mais
      tarde, o arquivo final de uma solicitacao que ja estava completa. O reparo
      da Central so aparece quando nao ha arquivo, entao nada legitimo esbarra
      nesta guarda.

      `jaExistia` separa este caso do outro 409 (o banco recusou o fechamento).
      Sem essa marca, o cliente teria de adivinhar pelo texto do erro — e um
      reenvio depois de a rede cair pareceria falha, com o arquivo ja no lugar.
    */
    const { data: documento } = await supabase
      .from("signature_documents")
      .select("arquivo_assinado")
      .eq("request_id", signatario.request_id)
      .maybeSingle();

    if (documento?.arquivo_assinado) {
      return resposta(
        {
          ok: false,
          erro: "Esta solicitacao ja tem documento assinado.",
          jaExistia: true,
          url: documento.arquivo_assinado,
        },
        409
      );
    }

    // ---- envio ao armazenamento, com a credencial do servidor ----
    const formData = new FormData();
    formData.append(
      "file",
      new File([bytes], `documento_assinado_${signatario.request_id}.pdf`, {
        type: "application/pdf",
      })
    );

    const envio = await fetch(WORKER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${chaveDeServico}` },
      body: formData,
    });

    if (!envio.ok) {
      // A mensagem diz o codigo: 401/403 aqui significa que o Worker passou a
      // exigir outra credencial, e nao que o arquivo estava errado.
      return resposta(
        { ok: false, erro: `O armazenamento recusou o envio (HTTP ${envio.status}).` },
        502
      );
    }

    const retorno = await envio.json();
    if (!retorno?.success || !retorno?.url) {
      return resposta(
        { ok: false, erro: retorno?.error ?? "O armazenamento nao devolveu o endereco." },
        502
      );
    }

    const arquivoUrl = enderecoPublico(String(retorno.url));

    // ---- fechamento da solicitacao ----
    // A mesma RPC que o navegador chamava. Ela e quem confere se a fila ainda tem
    // pendentes, entao a regra de "so fecha quando todos assinaram" continua num
    // lugar so — o banco.
    const { data: fechamento, error: erroFechamento } = await supabase.rpc(
      "fechar_solicitacao_por_token",
      {
        p_token: token,
        p_arquivo_assinado: arquivoUrl,
        p_hash_original: req.headers.get("x-hash-original") ?? "",
        p_hash_assinado: req.headers.get("x-hash-assinado") ?? "",
      }
    );

    if (erroFechamento) {
      return resposta(
        { ok: false, erro: erroFechamento.message ?? "Falha ao fechar a solicitacao." },
        500
      );
    }

    const r = fechamento as { ok?: boolean; erro?: string } | null;
    if (!r?.ok) {
      // O arquivo subiu e a solicitacao nao fechou. Devolver a URL permite ao
      // cliente mostrar o que houve sem perder o que ja foi armazenado.
      return resposta(
        { ok: false, erro: r?.erro ?? "O banco recusou o fechamento.", url: arquivoUrl },
        409
      );
    }

    return resposta({ ok: true, url: arquivoUrl });
  } catch (e) {
    return resposta(
      { ok: false, erro: e instanceof Error ? e.message : "Falha inesperada." },
      500
    );
  }
});
