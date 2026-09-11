import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { progressoDaFila, type SignatarioDaFila } from "@/utils/assinaturaFila";

/**
 * As solicitações de assinatura da empresa, com a fila de cada uma.
 *
 * POR QUE A FILA VEM JUNTA, E NÃO SOB DEMANDA
 *
 * A pergunta que a central responde é "o que está parado e com quem" — e ela só
 * tem resposta com os signatários na mão. Carregar a fila ao abrir cada linha
 * faria a tela mostrar uma lista de documentos sem dizer nada sobre nenhum, que é
 * a versão inútil desta tela.
 */

export const ASSINATURAS_LIMITE = 200;

export interface SolicitacaoDeAssinatura {
  id: string;
  documento_id: string | null;
  modulo_origem: string;
  entidade_tipo: string;
  entidade_id: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  signatarios: (SignatarioDaFila & {
    email: string | null;
    cargo: string | null;
    token: string | null;
    primeiro_acesso_em: string | null;
    recusa_motivo: string | null;
  })[];
  documento: {
    arquivo_original: string | null;
    arquivo_assinado: string | null;
    hash_assinado: string | null;
  } | null;
  progresso: ReturnType<typeof progressoDaFila>;
}

interface LinhaSignatario {
  id: string;
  nome: string;
  ordem: number;
  status: string;
  signed_at: string | null;
  email: string | null;
  cargo: string | null;
  token: string | null;
  primeiro_acesso_em: string | null;
  recusa_motivo: string | null;
}

interface LinhaSolicitacao {
  id: string;
  documento_id: string | null;
  modulo_origem: string;
  entidade_tipo: string;
  entidade_id: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  signature_signers: LinhaSignatario[] | null;
  signature_documents:
    | { arquivo_original: string | null; arquivo_assinado: string | null; hash_assinado: string | null }[]
    | null;
}

export function useAssinaturas(options?: { enabled?: boolean }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["assinaturas_solicitacoes", empresaId],
    enabled: !!empresaId && options?.enabled !== false,
    queryFn: async (): Promise<SolicitacaoDeAssinatura[]> => {
      const { data: linhas, error: erro } = await (supabase
        .from("signature_requests" as never)
        .select(
          `id, documento_id, modulo_origem, entidade_tipo, entidade_id, status,
           expires_at, created_at,
           signature_signers(id, nome, ordem, status, signed_at, email, cargo, token,
                             primeiro_acesso_em, recusa_motivo),
           signature_documents(arquivo_original, arquivo_assinado, hash_assinado)`
        )
        .order("created_at", { ascending: false })
        .limit(ASSINATURAS_LIMITE) as never as Promise<{
        data: LinhaSolicitacao[] | null;
        error: { message?: string } | null;
      }>);

      if (erro) throw new Error(erro.message ?? "falha ao ler as solicitações");

      return (linhas ?? []).map((l) => {
        const signatarios = (l.signature_signers ?? [])
          .map((s) => ({
            id: s.id,
            nome: s.nome,
            ordem: s.ordem,
            status: (s.status as SignatarioDaFila["status"]) ?? "PENDENTE",
            assinadoEm: s.signed_at,
            email: s.email,
            cargo: s.cargo,
            token: s.token,
            primeiro_acesso_em: s.primeiro_acesso_em,
            recusa_motivo: s.recusa_motivo,
          }))
          .sort((a, b) => a.ordem - b.ordem);

        return {
          ...l,
          signatarios,
          // O documento é uma lista no retorno do join; aqui interessa o mais
          // recente, que é o único que existe hoje por solicitação.
          documento: l.signature_documents?.[0] ?? null,
          progresso: progressoDaFila(signatarios),
        };
      });
    },
  });

  return {
    solicitacoes: data ?? [],
    isLoading,
    error,
    refetch,
    /** True quando a lista bateu o teto e pode estar incompleta. */
    truncado: (data?.length ?? 0) >= ASSINATURAS_LIMITE,
  };
}
