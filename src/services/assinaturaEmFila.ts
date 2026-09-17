import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/services/uploadImage";
import {
  gerarFolhaDeAssinaturas,
  montarDocumentoAssinado,
} from "@/services/pdfSignatureService";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
// `situacaoDaFila` saiu daqui de propósito: quem decide se a fila fechou é o
// banco, dentro de `assinar_por_token`. Manter a função importada sugeriria que a
// decisão ainda mora no cliente — e foi essa suposição que deixou a assinatura
// externa gravando em lugar nenhum.
import {
  progressoDaFila,
  vezDeAssinar,
  type SignatarioDaFila,
} from "@/utils/assinaturaFila";

/**
 * Solicitação de assinatura com fila ordenada.
 *
 * O `SignatureService` existente assina em um ato só: cria o signatário no momento
 * da assinatura e fecha. Serve ao checklist, onde quem aplica é quem assina.
 *
 * Aqui a fila é declarada antes — assinador 1, 2, 3 — e cada um recebe um link
 * próprio. O documento só fecha quando o último assina, e aí a folha de
 * assinaturas é gerada com todos.
 *
 * POR QUE UM SERVIÇO NOVO E NÃO UMA REFORMA DO ANTIGO
 *
 * O fluxo de um ato e o de fila divergem em tudo o que importa: quando o
 * signatário é criado, quem pode assinar, quando o PDF final é gerado. Reformar o
 * antigo obrigaria cada chamada de checklist a carregar condicional de fila, e o
 * risco de quebrar a assinatura que já funciona não se paga.
 */

export interface NovoSignatario {
  nome: string;
  /** Posição na fila. Repetida entre dois signatários = assinam em paralelo. */
  ordem: number;
  cpf?: string | null;
  email?: string | null;
  cargo?: string | null;
  empresaNome?: string | null;
  /** Quando o signatário tem conta no sistema. */
  userId?: string | null;
}

export interface SolicitacaoComFila {
  solicitacaoId: string;
  /** Um link por signatário, na ordem da fila. */
  links: { signatarioId: string; nome: string; ordem: number; url: string }[];
}

/** A URL que o signatário recebe. Absoluta, porque vai por WhatsApp e e-mail. */
export function urlDeAssinatura(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/assinar/${token}`;
}

interface RespostaDeErro {
  message?: string;
}

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc(nome as never, args as never) as never as Promise<{
    data: T;
    error: RespostaDeErro | null;
  }>);
  if (error) throw new Error(error.message ?? `falha em ${nome}`);
  return data;
}

/**
 * Cria a solicitação, a fila e o documento a assinar.
 *
 * O PDF entra AQUI, antes de qualquer assinatura: é o documento que cada
 * signatário vai ler antes de decidir. Sem ele, a pessoa assinaria um título.
 */
export async function criarSolicitacaoComFila(params: {
  empresaId: string;
  moduloOrigem: string;
  entidadeTipo: string;
  entidadeId: string;
  documentoId?: string | null;
  /** PDF do documento a ser assinado. */
  arquivo: File;
  signatarios: readonly NovoSignatario[];
  /** Prazo para assinar, em ISO. Sem prazo, a fila não vence. */
  expiraEm?: string | null;
}): Promise<SolicitacaoComFila> {
  if (params.signatarios.length === 0) {
    throw new Error("Informe ao menos um signatário.");
  }

  // O arquivo sobe primeiro: se o upload falhar, nada é gravado e não sobra
  // solicitação órfã apontando para documento que não existe.
  const arquivoUrl = await uploadImage(params.arquivo);

  const { data: solicitacao, error: erroSolicitacao } = await (supabase
    .from("signature_requests" as never)
    .insert({
      empresa_id: params.empresaId,
      documento_id: params.documentoId ?? null,
      modulo_origem: params.moduloOrigem,
      entidade_tipo: params.entidadeTipo,
      entidade_id: params.entidadeId,
      status: "PENDENTE",
      metodo: "ASSINATURA_ELETRONICA_INTERNA",
      expires_at: params.expiraEm ?? null,
    } as never)
    .select()
    .single() as never as Promise<{
    data: { id: string } | null;
    error: RespostaDeErro | null;
  }>);

  if (erroSolicitacao || !solicitacao) {
    throw new Error(erroSolicitacao?.message ?? "falha ao criar a solicitação");
  }

  const tokens = await Promise.all(
    params.signatarios.map(() => rpc<string>("gerar_token_de_assinatura", {}))
  );

  const { data: criados, error: erroSignatarios } = await (supabase
    .from("signature_signers" as never)
    .insert(
      params.signatarios.map((s, i) => ({
        empresa_id: params.empresaId,
        signature_request_id: solicitacao.id,
        user_id: s.userId ?? null,
        nome: s.nome,
        cpf: s.cpf ?? null,
        email: s.email ?? null,
        cargo: s.cargo ?? null,
        empresa_nome: s.empresaNome ?? null,
        ordem: s.ordem,
        status: "PENDENTE",
        token: tokens[i],
      })) as never
    )
    .select() as never as Promise<{
    data: { id: string; nome: string; ordem: number; token: string }[] | null;
    error: RespostaDeErro | null;
  }>);

  if (erroSignatarios || !criados) {
    throw new Error(erroSignatarios?.message ?? "falha ao criar os signatários");
  }

  await (supabase.from("signature_documents" as never).insert({
    empresa_id: params.empresaId,
    signature_request_id: solicitacao.id,
    arquivo_original: arquivoUrl,
    // O hash do original é calculado na geração da folha final, sobre o mesmo
    // conteúdo. Aqui vai vazio para não gravar um valor que ninguém conferiu.
    hash_original: "",
    tamanho: params.arquivo.size,
    mime_type: params.arquivo.type || "application/pdf",
  } as never) as never as Promise<unknown>);

  await registrarEvento(params.empresaId, solicitacao.id, "SOLICITACAO_CRIADA", {
    signatarios: params.signatarios.length,
  });

  return {
    solicitacaoId: solicitacao.id,
    links: criados
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => ({
        signatarioId: s.id,
        nome: s.nome,
        ordem: s.ordem,
        url: urlDeAssinatura(s.token),
      })),
  };
}

export interface AssinaturaPorToken {
  encontrado: boolean;
  signatarioId?: string;
  nome?: string;
  cargo?: string | null;
  empresaNome?: string | null;
  solicitacaoId?: string;
  moduloOrigem?: string;
  entidadeTipo?: string;
  documentoId?: string | null;
  expiraEm?: string | null;
  arquivoOriginal?: string | null;
  fila?: SignatarioDaFila[];
}

/** Lê a solicitação pelo link, sem exigir conta. */
export async function buscarPorToken(token: string): Promise<AssinaturaPorToken> {
  const dados = await rpc<AssinaturaPorToken>("assinatura_por_token", { p_token: token });
  if (dados?.encontrado) {
    // Registra que o link foi aberto. Falha aqui não pode impedir a leitura: é
    // informação de acompanhamento, não parte do ato de assinar.
    try {
      await rpc<void>("registrar_acesso_ao_link", { p_token: token });
    } catch (e) {
      console.warn("Não foi possível registrar o acesso ao link:", e);
    }
  }
  return dados ?? { encontrado: false };
}

/** Data de hoje em ISO pelo fuso local — `toISOString()` é UTC e erra o dia. */
function hojeLocalIso(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export type ResultadoDaAssinatura =
  | { assinou: true; filaConcluida: boolean; arquivoAssinado?: string | null }
  | { assinou: false; motivo: string; comoResolver: string };

/**
 * Registra a assinatura de um signatário e, se foi o último, fecha a solicitação.
 *
 * A ordem é conferida AQUI antes de gravar, com a mesma regra que a tela usa para
 * habilitar o botão. Confiar só na tela deixaria a fila aberta a quem montasse a
 * chamada à mão — e a ordem é justamente o que este fluxo promete.
 */
export async function assinarPorToken(params: {
  token: string;
  /** Confirmação digitada pelo signatário, guardada na auditoria. */
  confirmacao?: string;
}): Promise<ResultadoDaAssinatura> {
  const dados = await buscarPorToken(params.token);

  if (!dados.encontrado || !dados.signatarioId || !dados.solicitacaoId) {
    return {
      assinou: false,
      motivo: "Este link não corresponde a nenhum signatário deste documento.",
      comoResolver: "Confira se o link está completo, ou peça um novo ao solicitante.",
    };
  }

  const vez = vezDeAssinar({
    signatarios: dados.fila ?? [],
    signatarioId: dados.signatarioId,
    expiraEm: dados.expiraEm,
    agora: hojeLocalIso(),
  });

  if (vez.pode !== true) {
    return { assinou: false, motivo: vez.motivo, comoResolver: vez.comoResolver };
  }

  const assinadoEm = new Date().toISOString();

  // A GRAVAÇÃO PASSA PELO BANCO, E NÃO POR UPDATE DIRETO.
  //
  // A versão anterior fazia `update` em `signature_signers` do navegador do
  // signatário. A RLS daquela tabela exige empresa do usuário autenticado — e
  // signatário externo não tem usuário. O update acertava ZERO linhas e NÃO dava
  // erro: a tela dizia "assinatura registrada" e nada era gravado. Só funcionava
  // para quem estivesse logado, que é justamente quem não precisa do link.
  const r = await rpc<{ ok: boolean; erro?: string; filaConcluida?: boolean }>(
    "assinar_por_token",
    {
      p_token: params.token,
      p_confirmacao: params.confirmacao ?? null,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }
  );

  if (!r?.ok) {
    return {
      assinou: false,
      motivo: r?.erro ?? "Não foi possível registrar a assinatura.",
      comoResolver: "Recarregue a página e tente novamente. Se persistir, avise o solicitante.",
    };
  }

  if (r.filaConcluida !== true) {
    return { assinou: true, filaConcluida: false };
  }

  const filaAtualizada = (dados.fila ?? []).map((s) =>
    s.id === dados.signatarioId ? { ...s, status: "ASSINADO" as const, assinadoEm } : s
  );

  const arquivoAssinado = await fecharSolicitacao({
    token: params.token,
    solicitacaoId: dados.solicitacaoId,
    titulo: dados.documentoId || dados.entidadeTipo || "Documento",
    empresaNome: dados.empresaNome ?? "",
    arquivoOriginal: dados.arquivoOriginal ?? null,
    fila: filaAtualizada,
  });

  return { assinou: true, filaConcluida: true, arquivoAssinado };
}

export interface FechamentoDaSolicitacao {
  token: string;
  solicitacaoId: string;
  titulo: string;
  empresaNome: string;
  arquivoOriginal: string | null;
  fila: readonly SignatarioDaFila[];
}

/**
 * Gera a folha de assinaturas e marca a solicitação como concluída.
 *
 * A folha sai só no fim, com todos. Gerar a cada assinatura produziria N versões
 * do mesmo documento, e a penúltima pareceria final para quem a baixasse.
 *
 * ESTA VERSÃO DEIXA O ERRO SUBIR
 *
 * Quem assina não pode ver erro depois de ter assinado com sucesso — ele tentaria
 * assinar de novo à toa —, então o caminho automático engole a falha. Mas engolir
 * em silêncio foi como a fila ficou "Concluída" sem documento: a montagem falhava
 * e ninguém ficava sabendo.
 *
 * Então a falha some num lugar só, o automático. O reparo manual, disparado por
 * quem está olhando a Central, precisa dizer o que deu errado — é a diferença
 * entre "não incomode quem já terminou" e "esconda o problema do dono".
 */
export async function montarEFecharSolicitacao(
  params: FechamentoDaSolicitacao
): Promise<string> {
  {
    const verificationUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/verificar-assinatura/${params.solicitacaoId}`
        : "";

    const folha = await gerarFolhaDeAssinaturas({
      requestId: params.solicitacaoId,
      documentTitle: params.titulo,
      empresaNome: params.empresaNome,
      verificationUrl,
      assinantes: params.fila.map((s) => ({
        nome: s.nome,
        ordem: s.ordem,
        assinadoEm: s.assinadoEm ?? new Date().toISOString(),
      })),
    });

    // O ARQUIVO FINAL É O DOCUMENTO MAIS A FOLHA, E NÃO A FOLHA SOZINHA.
    //
    // Antes, o "documento assinado" era só a folha: nome, data e hash, sem o
    // documento. Quem baixava recebia a prova de que alguém assinou algo, sem o
    // algo. Um documento assinado precisa se sustentar sozinho.
    const original = await baixarOriginal(params.arquivoOriginal);

    const { arquivo, hashAssinado } = original
      ? await montarDocumentoAssinado({
          original,
          folha: await folha.pdfBlob.arrayBuffer(),
          requestId: params.solicitacaoId,
          // Só quem de fato assinou. Quem recusou ou não respondeu não pode ter o
          // nome carimbado na folha — seria afirmar uma assinatura que não houve.
          assinantes: params.fila
            .filter((s) => s.status === "ASSINADO")
            .map((s) => ({ nome: s.nome, assinadoEm: s.assinadoEm ?? new Date().toISOString() })),
        })
      : // Sem o original acessível, a folha sozinha é o que há — e é melhor que
        // nada. O caso não deveria ocorrer; se ocorrer, fica no log.
        { arquivo: folha.pdfFile, hashAssinado: folha.hashAssinado };

    const arquivoUrl = await uploadImage(arquivo);

    const r = await rpc<{ ok: boolean; erro?: string }>("fechar_solicitacao_por_token", {
      p_token: params.token,
      p_arquivo_assinado: arquivoUrl,
      p_hash_original: folha.hashOriginal,
      p_hash_assinado: hashAssinado,
    });

    if (!r?.ok) {
      throw new Error(r?.erro ?? "O banco recusou o fechamento da solicitação.");
    }

    return arquivoUrl;
  }
}

/**
 * O fechamento do caminho automático: mesma montagem, sem assustar quem assinou.
 */
async function fecharSolicitacao(params: FechamentoDaSolicitacao): Promise<string | null> {
  try {
    return await montarEFecharSolicitacao(params);
  } catch (e) {
    // A assinatura já foi gravada; só a montagem do arquivo falhou. Deixar a
    // exceção subir faria o signatário ver erro depois de ter assinado com
    // sucesso, e ele tentaria assinar de novo sem necessidade.
    //
    // O preço disso é a Central mostrar "Concluída" sem documento — e por isso
    // ela passou a oferecer o reparo, em vez de o dono só descobrir a falta.
    console.error("Falha ao montar o documento assinado:", e);
    return null;
  }
}

/**
 * Baixa o PDF original para juntar à folha.
 *
 * `cache: "reload"` pela mesma razão das fotos nos documentos: a tela já abriu
 * esse arquivo numa aba, e a resposta guardada no cache pode ter vindo sem o
 * cabeçalho de CORS — aí a leitura dos bytes falha, embora o arquivo apareça.
 */
async function baixarOriginal(url: string | null): Promise<ArrayBuffer | null> {
  if (!url) return null;
  try {
    const resposta = await fetch(resolveFileUrl(url), { cache: "reload" });
    if (!resposta.ok) {
      console.warn(`Documento original respondeu HTTP ${resposta.status}`);
      return null;
    }
    return await resposta.arrayBuffer();
  } catch (e) {
    console.warn("Não foi possível baixar o documento original:", e);
    return null;
  }
}

export async function recusarPorToken(params: {
  token: string;
  motivo: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const r = await rpc<{ ok: boolean; erro?: string }>("recusar_assinatura_por_token", {
    p_token: params.token,
    p_motivo: params.motivo,
  });
  return r ?? { ok: false, erro: "resposta vazia" };
}

async function registrarEvento(
  empresaId: string | null,
  solicitacaoId: string,
  evento: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await (supabase.from("signature_events" as never).insert({
      empresa_id: empresaId,
      signature_request_id: solicitacaoId,
      evento,
      metadata,
    } as never) as never as Promise<unknown>);
  } catch (e) {
    // Auditoria que falha não pode derrubar o ato auditado.
    console.warn("Não foi possível registrar o evento de auditoria:", e);
  }
}

export { progressoDaFila };
