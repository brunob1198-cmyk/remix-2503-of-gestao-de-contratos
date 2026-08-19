import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmpresaAtual {
  id: string;
  nome: string;
  cnpj: string | null;
}

/**
 * Dados da organização do usuário logado.
 *
 * Existe porque a NR-07 exige identificação da organização (nome e CNPJ) tanto no
 * documento-base do PCMSO quanto no ASO, e nenhum hook expunha isso — o
 * AuthContext carrega o profile, não a empresa.
 *
 * A tabela `empresas` não tem `razao_social`: esse campo pertence a `clientes` e
 * `fornecedores`. O nome legal da organização aqui é `nome`.
 */
export function useEmpresaAtual() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["empresa_atual", empresaId],
    enabled: !!empresaId,
    // Dado praticamente estático; não faz sentido revalidar a cada navegação.
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<EmpresaAtual | null> => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .eq("id", empresaId!)
        .single();

      if (error) throw error;
      return data as EmpresaAtual;
    },
  });

  return { empresa: data ?? null, isLoading, error };
}
