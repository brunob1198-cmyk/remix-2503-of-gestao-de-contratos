import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { esquecerTimbreDaEmpresa } from "@/lib/timbreDaEmpresa";

export interface EmpresaAtual {
  id: string;
  nome: string;
  cnpj: string | null;
  /**
   * Os quatro campos do rodapé do papel timbrado.
   *
   * Nascem nulos de propósito: até 17/09/2026 o rodapé de todo PDF trazia os
   * dados da AIVX escritos no código, e o documento de cada cliente saía com o
   * CNPJ da fabricante da ferramenta. Semear um valor padrão aqui reintroduziria
   * exatamente isso.
   */
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  /** O mesmo logotipo do cabeçalho das telas: um preenchimento, dois usos. */
  logo_url: string | null;
}

export type EmpresaAtualInput = Partial<
  Pick<EmpresaAtual, "nome" | "cnpj" | "endereco" | "telefone" | "email" | "site">
>;

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
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["empresa_atual", empresaId],
    enabled: !!empresaId,
    // Dado praticamente estático; não faz sentido revalidar a cada navegação.
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<EmpresaAtual | null> => {
      /*
        `as never` nas colunas novas: os tipos em src/integrations/supabase são
        gerados do banco, e endereco/telefone/email/site só passam a existir
        depois da migration 20260917220000.
      */
      const { data, error } = await (supabase
        .from("empresas" as never)
        .select("id, nome, cnpj, endereco, telefone, email, site, logo_url")
        .eq("id", empresaId!)
        .single() as never as Promise<{
        data: EmpresaAtual | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data;
    },
  });

  /**
   * Grava os dados da empresa — e confere que gravou.
   *
   * A RLS só deixa o ADMIN da própria empresa atualizar `empresas`. Para os
   * demais o UPDATE não dá erro: afeta zero linha e volta calado. Sem a
   * conferência abaixo, a tela diria "salvo" com nada salvo — a mesma armadilha
   * que o envio do logotipo tinha.
   */
  const salvarEmpresa = useMutation({
    mutationFn: async (input: EmpresaAtualInput) => {
      if (!empresaId) {
        throw new Error("Empresa não identificada. Entre novamente e tente de novo.");
      }

      const limpo = (v?: string | null) => {
        const t = (v ?? "").trim();
        return t ? t : null;
      };

      const { data, error } = await (supabase
        .from("empresas" as never)
        .update({
          nome: limpo(input.nome) ?? undefined,
          cnpj: limpo(input.cnpj),
          endereco: limpo(input.endereco),
          telefone: limpo(input.telefone),
          email: limpo(input.email),
          site: limpo(input.site),
        } as never)
        .eq("id", empresaId)
        .select("id") as never as Promise<{
        data: { id: string }[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error(
          "Sem permissão para alterar os dados da empresa. Apenas o administrador pode."
        );
      }
    },
    onSuccess: async () => {
      // O timbre guarda estes dados em módulo enquanto a sessão dura; sem isto o
      // próximo PDF sairia com o rodapé antigo.
      esquecerTimbreDaEmpresa();
      await queryClient.invalidateQueries({ queryKey: ["empresa_atual"] });
      await refreshProfile();
    },
  });

  return { empresa: data ?? null, isLoading, error, salvarEmpresa };
}
