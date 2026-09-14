import { supabase } from "@/integrations/supabase/client";
import type { ItemPublico, RespostaPublica } from "@/utils/checklistPublico";

/**
 * Checklist preenchido por quem escaneou o QR Code, sem login.
 *
 * As duas chamadas passam por funcao no banco, e nao por acesso direto as
 * tabelas. O motivo e simples: abrir INSERT para o papel anonimo daria acesso a
 * todas as linhas de todas as empresas, porque a politica de RLS nao tem como
 * saber de qual QR Code aquela chamada veio. Na funcao, o TOKEN e a chave — ela
 * le o QR, descobre a empresa e o modelo, e so escreve o que aquele token
 * permite.
 *
 * O que o sistema sabe de quem respondeu e o que a pessoa digitou. Nada aqui
 * pode apresentar isso como identidade verificada.
 */

export interface SecaoPublica {
  id: string;
  titulo: string;
  ordem: number;
  itens: ItemPublico[];
}

export interface ChecklistPorQr {
  valido: boolean;
  erro?: string;
  token?: string;
  modelo_id?: string;
  modelo_nome?: string;
  modelo_categoria?: string;
  modelo_descricao?: string | null;
  exigir_geolocalizacao?: string;
  bloquear_fora_raio?: boolean;
  latitude_alvo?: number | null;
  longitude_alvo?: number | null;
  raio_permitido_metros?: number;
  vinculado_tipo?: string;
  vinculado_nome?: string | null;
  secoes?: SecaoPublica[];
}

interface ErroRpc {
  message?: string;
  code?: string;
}

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc(nome as never, args as never) as never as Promise<{
    data: T;
    error: ErroRpc | null;
  }>);

  if (error) {
    // A funcao e nova. Enquanto a migration nao for aplicada, o PostgREST
    // responde "nao encontrei" — e "erro ao carregar" mandaria o usuario tentar
    // de novo para sempre.
    if (error.code === "PGRST202") {
      throw new Error(
        "O preenchimento por QR Code ainda não está disponível neste ambiente. " +
          "Avise o responsável: falta aplicar a migration 20260915120000."
      );
    }
    throw new Error(error.message ?? `falha em ${nome}`);
  }

  return data;
}

/** O checklist inteiro, pronto para preencher. Não exige login. */
export async function checklistPorQr(token: string): Promise<ChecklistPorQr> {
  const dados = await rpc<ChecklistPorQr>("checklist_por_qr", { p_token: token });
  return dados ?? { valido: false, erro: "Resposta vazia do servidor." };
}

export interface EnvioDoChecklist {
  token: string;
  nome: string;
  documento?: string;
  observacoes?: string;
  respostas: Record<string, RespostaPublica>;
  posicao?: { latitude: number; longitude: number; precisao?: number } | null;
}

export interface ResultadoDoEnvio {
  ok: boolean;
  aplicacao_id: string;
  total_conforme: number;
  total_nao_conforme: number;
  reprovado_por_item_critico: boolean;
}

/**
 * Grava o checklist respondido.
 *
 * O servidor confere de novo tudo o que a tela conferiu — nome, item obrigatorio
 * em branco, item que nao e deste modelo. A tela e conveniencia; a chamada vem de
 * um aparelho que nao esta sob nosso controle.
 */
export async function responderChecklistPorQr(
  envio: EnvioDoChecklist
): Promise<ResultadoDoEnvio> {
  const respostas = Object.entries(envio.respostas)
    .filter(([, r]) => (r.valor ?? "").trim() !== "")
    .map(([item_id, r]) => ({
      item_id,
      valor: r.valor,
      comentario: r.comentario ?? null,
    }));

  return rpc<ResultadoDoEnvio>("responder_checklist_por_qr", {
    p_token: envio.token,
    p_aplicador_nome: envio.nome,
    p_aplicador_documento: envio.documento ?? null,
    p_respostas: respostas,
    p_observacoes: envio.observacoes ?? null,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    p_latitude: envio.posicao?.latitude ?? null,
    p_longitude: envio.posicao?.longitude ?? null,
    p_precisao: envio.posicao?.precisao ?? null,
  });
}
