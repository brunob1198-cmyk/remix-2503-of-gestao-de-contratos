/**
 * Consulta de CNPJ na Receita Federal, via BrasilAPI.
 *
 * Segue o desenho do `cep.ts`: máscara, validação local, chamada, e um resultado
 * em união discriminada para a tela distinguir "não existe" de "não deu para
 * consultar". A regra do erro é a mesma: **CNPJ inexistente é resposta válida do
 * serviço**, não falha — dizer "erro ao buscar" quando o certo é "esse CNPJ não
 * existe" manda o usuário procurar defeito onde não há.
 *
 * Valida os dígitos ANTES de sair para a rede. Um CNPJ digitado errado é o caso
 * comum, e devolver "inválido" na hora é mais rápido e mais claro que esperar o
 * 404 de um serviço externo.
 *
 * Sobre o GRAU DE RISCO: a resposta traz os CNAEs, e o grau de risco vem do
 * Quadro I da NR-04 a partir do CNAE. Este módulo NÃO deriva esse grau. A tabela
 * tem mais de mil entradas e o grau dimensiona o SESMT — um valor errado aqui é
 * erro de conformidade, não de exibição. Uma tabela parcial seria pior que
 * nenhuma: pareceria autoritativa quando encontrasse e silenciosa quando não.
 * O módulo entrega os CNAEs; o grau fica declarado por quem responde por ele.
 */

/** Resposta da BrasilAPI, só os campos que o projeto usa. */
interface RespostaBrasilApiCnpj {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo?: number; descricao?: string }[];
  descricao_situacao_cadastral?: string;
  message?: string;
}

export interface Cnae {
  /** Formatado como "94.99-5-00". */
  codigo: string;
  descricao: string;
  /** True para o CNAE fiscal (principal). */
  principal: boolean;
}

export interface DadosDoCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  /** Endereço em uma linha, no formato que os documentos usam. */
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  /** Principal primeiro, secundários na ordem recebida. */
  cnaes: Cnae[];
  /** "ATIVA", "BAIXADA", etc. Vem da Receita e não é interpretado aqui. */
  situacaoCadastral: string;
}

export type ResultadoCnpj =
  | { situacao: "OK"; dados: DadosDoCnpj }
  | { situacao: "NAO_ENCONTRADO" }
  | { situacao: "CNPJ_INVALIDO" }
  | { situacao: "ERRO"; mensagem: string };

/** Só os dígitos, no máximo catorze. */
export function cnpjLimpo(valor: string): string {
  return (valor || "").replace(/\D/g, "").slice(0, 14);
}

/** Formata como 00.000.000/0000-00, sem exigir que esteja completo. */
export function cnpjFormatado(valor: string): string {
  const d = cnpjLimpo(valor);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Dígito verificador do CNPJ, pelo módulo 11 com os pesos da Receita. */
function digitoVerificador(base: string): number {
  // Os pesos vão de 2 a 9, da direita para a esquerda, reiniciando em 2.
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * O CNPJ fecha nos dígitos verificadores?
 *
 * Rejeita também os de dígito repetido (11.111.111/1111-11 e afins): eles passam
 * na conta do módulo 11 e não existem. Aceitá-los levaria a uma consulta que
 * volta vazia e a um "não encontrado" que parece problema do serviço.
 */
export function cnpjValido(valor: string): boolean {
  // Conta os dígitos ANTES do corte. `cnpjLimpo` trunca em catorze — bom para
  // mascarar enquanto se digita, e péssimo para validar: uma entrada de quinze
  // dígitos passaria como um CNPJ VÁLIDO DIFERENTE do que a pessoa digitou, e a
  // consulta voltaria dados de outra empresa.
  const todos = (valor || "").replace(/\D/g, "");
  if (todos.length !== 14) return false;

  const d = cnpjLimpo(valor);
  if (/^(\d)\1{13}$/.test(d)) return false;

  const primeiro = digitoVerificador(d.slice(0, 12));
  if (primeiro !== Number(d[12])) return false;

  const segundo = digitoVerificador(d.slice(0, 13));
  return segundo === Number(d[13]);
}

/** Monta o endereço em uma linha, pulando as partes ausentes. */
export function montarEndereco(r: RespostaBrasilApiCnpj): string {
  const rua = [r.logradouro, r.numero].filter(Boolean).join(", ");
  const partes = [rua, r.complemento, r.bairro].filter((p) => p && String(p).trim());
  return partes.join(" — ");
}

function lerCnaes(r: RespostaBrasilApiCnpj): Cnae[] {
  const formatar = (codigo: number | undefined): string => {
    // O código vem como número de 7 dígitos; a forma legível é 0000-0/00.
    const s = String(codigo ?? "").padStart(7, "0");
    return `${s.slice(0, 2)}.${s.slice(2, 4)}-${s.slice(4, 5)}-${s.slice(5)}`;
  };

  const lista: Cnae[] = [];
  if (r.cnae_fiscal) {
    lista.push({
      codigo: formatar(r.cnae_fiscal),
      descricao: r.cnae_fiscal_descricao ?? "",
      principal: true,
    });
  }
  for (const c of r.cnaes_secundarios ?? []) {
    // A Receita devolve um secundário fantasma com código 0 quando não há
    // nenhum; incluí-lo geraria uma linha "00.00-0-00" no documento.
    if (!c.codigo) continue;
    lista.push({ codigo: formatar(c.codigo), descricao: c.descricao ?? "", principal: false });
  }
  return lista;
}

const ENDPOINT = "https://brasilapi.com.br/api/cnpj/v1";

export async function consultarCnpj(valor: string): Promise<ResultadoCnpj> {
  const d = cnpjLimpo(valor);
  if (!cnpjValido(d)) return { situacao: "CNPJ_INVALIDO" };

  try {
    const resposta = await fetch(`${ENDPOINT}/${d}`);

    // 404 é a resposta do serviço para CNPJ que não existe: é informação, não
    // falha de rede.
    if (resposta.status === 404) return { situacao: "NAO_ENCONTRADO" };

    if (!resposta.ok) {
      return { situacao: "ERRO", mensagem: `A Receita respondeu ${resposta.status}.` };
    }

    const r = (await resposta.json()) as RespostaBrasilApiCnpj;
    if (!r.razao_social) return { situacao: "NAO_ENCONTRADO" };

    return {
      situacao: "OK",
      dados: {
        cnpj: cnpjFormatado(r.cnpj ?? d),
        razaoSocial: r.razao_social,
        nomeFantasia: r.nome_fantasia ?? "",
        endereco: montarEndereco(r),
        municipio: r.municipio ?? "",
        uf: r.uf ?? "",
        cep: r.cep ?? "",
        cnaes: lerCnaes(r),
        situacaoCadastral: r.descricao_situacao_cadastral ?? "",
      },
    };
  } catch (e) {
    // Rede fora, CORS, timeout. A tela precisa poder dizer "tente de novo" em vez
    // de "CNPJ não existe".
    return {
      situacao: "ERRO",
      mensagem: e instanceof Error ? e.message : "Falha ao consultar o CNPJ.",
    };
  }
}
