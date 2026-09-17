import { supabase } from "@/integrations/supabase/client";
import type { DadosDoTimbre } from "@/utils/linhasDoTimbre";

/**
 * Os dados do timbre, lidos da empresa do usuário logado.
 *
 * POR QUE AQUI, E NÃO PASSADOS PELOS DOCUMENTOS
 *
 * Dezessete módulos chamam `emitirPdfTimbrado`. Fazer o timbre viajar como
 * parâmetro obrigaria os dezessete a carregar dados que não são deles — e o
 * primeiro que esquecesse emitiria um PDF sem rodapé, sem erro nenhum. O timbre
 * é da empresa, não do documento.
 *
 * É seguro ler daqui: a RLS de `empresas` só devolve a própria empresa, então
 * esta consulta não tem como trazer a linha de outra.
 *
 * O CACHE TEM DONO
 *
 * Guardar em módulo é o que evita uma consulta por PDF. Mas cache de dado da
 * EMPRESA sem dono foi exatamente o sumiço de setembro e o logotipo que vivia no
 * navegador — então `esquecerTimbreDaEmpresa` existe e é chamada pela mesma
 * política que limpa o resto quando o usuário troca.
 *
 * FALHA DE LEITURA NÃO INVENTA DADO
 *
 * Sem rede ou sem permissão, devolve o que tem — na pior hipótese, nada. O
 * rodapé sai incompleto, que é honesto. O que não pode acontecer é cair num
 * valor padrão: era assim que o CNPJ da fabricante da ferramenta ia no documento
 * de todo cliente.
 */

let emAndamento: Promise<DadosDoTimbre> | null = null;
let guardado: DadosDoTimbre | null = null;

/** Descarta o que estiver guardado. Chamada na troca de usuário. */
export function esquecerTimbreDaEmpresa(): void {
  emAndamento = null;
  guardado = null;
}

async function buscar(): Promise<DadosDoTimbre> {
  const { data: sessao } = await supabase.auth.getUser();
  const usuarioId = sessao?.user?.id;
  if (!usuarioId) return {};

  const { data: perfil } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", usuarioId)
    .maybeSingle();

  const empresaId = perfil?.empresa_id;
  if (!empresaId) return {};

  /*
    `as never` nas colunas novas: os tipos de src/integrations/supabase/types.ts
    sao gerados do banco, e endereco/telefone/email/site so existem depois que a
    migration 20260917220000 for aplicada. E a mesma convencao que o resto do
    SGSST usa para tabela ainda nao refletida nos tipos.
  */
  const { data, error } = await (supabase
    .from("empresas" as never)
    .select("nome, cnpj, endereco, telefone, email, site, logo_url")
    .eq("id", empresaId)
    .maybeSingle() as never as Promise<{
    data: {
      nome?: string | null;
      cnpj?: string | null;
      endereco?: string | null;
      telefone?: string | null;
      email?: string | null;
      site?: string | null;
      logo_url?: string | null;
    } | null;
    error: { message?: string } | null;
  }>);

  // Erro aqui não derruba a emissão: o documento sai com o rodapé que der.
  if (error || !data) return {};

  return {
    nome: data.nome,
    cnpj: data.cnpj,
    endereco: data.endereco,
    telefone: data.telefone,
    email: data.email,
    site: data.site,
    logoUrl: data.logo_url,
  };
}

/**
 * Os dados do timbre, buscados uma vez por sessão.
 *
 * Chamadas concorrentes compartilham a mesma promessa: emitir três documentos
 * em sequência não deve render três consultas.
 */
export async function dadosDoTimbre(): Promise<DadosDoTimbre> {
  if (guardado) return guardado;

  if (!emAndamento) {
    emAndamento = buscar()
      .then((dados) => {
        guardado = dados;
        return dados;
      })
      .catch(() => {
        // Não guarda a falha: a próxima emissão tenta de novo.
        emAndamento = null;
        return {} as DadosDoTimbre;
      });
  }

  return emAndamento;
}
