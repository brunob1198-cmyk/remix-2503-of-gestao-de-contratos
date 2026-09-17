import { useCallback } from "react";
import { uploadImage } from "@/services/uploadImage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CHAVE_COPIA_DO_LOGOTIPO as LOGO_STORAGE_KEY } from "@/lib/cacheDoUsuario";

/**
 * O logotipo da empresa.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Roteiro 0.5: "Conferir se o logotipo e o endereço da empresa estão preenchidos
 * em Configurações. É o que sai no papel timbrado de todo PDF."
 *
 * O envio funcionava: validava o arquivo, subia e devolvia a URL. Só que a URL
 * era gravada APENAS no `localStorage` — `empresas.logo_url` existe na tabela,
 * o `AuthContext` a LÊ a cada login, e nada no aplicativo a escrevia. A coluna
 * ficava nula para sempre.
 *
 * Na prática o logotipo era do NAVEGADOR, não da empresa:
 *
 *   * quem subiu vê; todo colega vê o quadrado vazio;
 *   * no celular não aparece, porque é outro navegador;
 *   * limpar dados do site apaga, sem aviso e sem como recuperar;
 *   * e o relatório que o colega emite sai sem o logotipo.
 *
 * É a mesma família do sumiço de dados de setembro: informação da empresa
 * guardada no armazenamento do navegador, sem dono e sem quem a reponha.
 *
 * O `localStorage` CONTINUA sendo escrito, agora como cópia de leitura: o RDO e
 * o detalhe da medição montam HTML fora do React e leem a chave direto. A
 * diferença é que agora ela é cópia de algo que tem lugar definitivo, e não o
 * lugar definitivo.
 *
 * QUEM NÃO É ADMIN PRECISA SABER QUE NÃO SALVOU
 *
 * A política de RLS deixa só o admin da própria empresa atualizar `empresas`.
 * Para os demais o UPDATE não dá erro: afeta zero linha e volta calado. Sem a
 * conferência abaixo, a tela dizia "Logo atualizado com sucesso!" e nada tinha
 * sido salvo — a mentira mais cara que uma tela pode contar.
 */

/** Guarda a cópia de leitura. Falha de armazenamento não pode derrubar o envio. */
function guardarCopiaLocal(url: string | null): void {
  try {
    if (url) localStorage.setItem(LOGO_STORAGE_KEY, url);
    else localStorage.removeItem(LOGO_STORAGE_KEY);
  } catch {
    // Aba anônima ou armazenamento bloqueado: o valor definitivo já está na
    // empresa, e é de lá que o próximo login o traz.
  }
}

function lerCopiaLocal(): string | null {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useCustomLogo() {
  const { empresaId, empresaLogoUrl, refreshProfile } = useAuth();

  // O valor da empresa manda. A cópia local só cobre o instante entre abrir a
  // página e o `AuthContext` terminar de carregar o perfil.
  const customLogo = empresaLogoUrl ?? lerCopiaLocal();

  /** Grava na empresa e confere que gravou mesmo. */
  const gravarNaEmpresa = useCallback(
    async (url: string | null) => {
      if (!empresaId) {
        throw new Error("Empresa não identificada. Entre novamente e tente de novo.");
      }

      const { data, error } = await supabase
        .from("empresas")
        .update({ logo_url: url })
        .eq("id", empresaId)
        .select("id");

      if (error) throw error;

      // Zero linha aqui não é "nada mudou": é a RLS recusando em silêncio.
      if (!data || data.length === 0) {
        throw new Error(
          "Sem permissão para alterar o logotipo da empresa. Apenas o administrador pode."
        );
      }
    },
    [empresaId]
  );

  const uploadLogo = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("O arquivo precisa ser uma imagem");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("A imagem deve ter no máximo 5MB");
      }

      const publicUrl = await uploadImage(file);
      await gravarNaEmpresa(publicUrl);

      guardarCopiaLocal(publicUrl);
      await refreshProfile();

      return publicUrl;
    },
    [gravarNaEmpresa, refreshProfile]
  );

  const removeLogo = useCallback(async () => {
    await gravarNaEmpresa(null);
    guardarCopiaLocal(null);
    await refreshProfile();
  }, [gravarNaEmpresa, refreshProfile]);

  return { customLogo, uploadLogo, removeLogo };
}
