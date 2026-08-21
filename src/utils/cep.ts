/**
 * Consulta de CEP nos Correios, via ViaCEP.
 *
 * A mesma consulta estava escrita três vezes no projeto — no cadastro de
 * clientes, no de fornecedores e agora era pedida no de colaboradores. Cada cópia
 * tratava o erro de um jeito: uma avisava o usuário, outra escrevia no console e
 * seguia. Três comportamentos para a mesma falha.
 *
 * O que fica aqui é a parte comum: a máscara, a chamada e a leitura da resposta.
 * A composição do endereço fica com quem chama, porque cada cadastro guarda de um
 * jeito — o cliente tem um campo único, o fornecedor tem município e UF
 * separados.
 *
 * A regra do erro: **CEP não encontrado é resposta válida do serviço**, não falha.
 * A ViaCEP devolve HTTP 200 com `{ erro: true }`. Tratar isso como exceção faria a
 * tela dizer "erro ao buscar" quando o certo é dizer "esse CEP não existe".
 */

/** Resposta da ViaCEP, só os campos que o projeto usa. */
interface RespostaViaCep {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

export interface EnderecoDoCep {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export type ResultadoCep =
  | { situacao: "OK"; endereco: EnderecoDoCep }
  | { situacao: "NAO_ENCONTRADO" }
  | { situacao: "CEP_INVALIDO" }
  | { situacao: "ERRO"; mensagem: string };

/** Só os dígitos, no máximo oito. */
export function cepLimpo(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 8);
}

/**
 * Máscara XX.XXX-XXX, aplicada enquanto se digita.
 *
 * Formata o que já foi digitado sem completar o que falta: máscara que insere
 * separador antes do dígito deixa o cursor num lugar que o usuário não pediu.
 */
export function mascaraCep(valor: string): string {
  const digitos = cepLimpo(valor);

  if (digitos.length >= 6) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}-${digitos.slice(5)}`;
  }
  if (digitos.length >= 3) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  }
  return digitos;
}

/** Verdadeiro quando há dígitos suficientes para consultar. */
export function cepCompleto(valor: string): boolean {
  return cepLimpo(valor).length === 8;
}

/**
 * Endereço em uma linha, no formato usado pelos cadastros de campo único.
 *
 * Parte vazia é omitida junto do separador dela — endereço com ", , " no meio
 * denuncia dado faltando de um jeito que não ajuda ninguém.
 */
export function enderecoEmUmaLinha(endereco: EnderecoDoCep): string {
  const cidadeUf = [endereco.localidade, endereco.uf].filter(Boolean).join(" - ");
  return [endereco.logradouro, endereco.bairro, cidadeUf].filter(Boolean).join(", ");
}

/**
 * Junta o endereço da base dos Correios com o complemento digitado.
 *
 * O complemento entra depois do logradouro e antes do bairro, que é como se
 * escreve endereço no Brasil: "Rua Larga, Qd 1741 Lt 16, Buriti Sereno, ...".
 * Colar o complemento no fim produziria "..., Aparecida de Goiânia - GO, Qd 1741".
 */
export function enderecoComComplemento(
  endereco: string | null | undefined,
  complemento: string | null | undefined
): string {
  const base = (endereco ?? "").trim();
  const extra = (complemento ?? "").trim();

  if (!extra) return base;
  if (!base) return extra;

  const partes = base.split(",").map((p) => p.trim());
  if (partes.length === 1) return `${partes[0]}, ${extra}`;

  return [partes[0], extra, ...partes.slice(1)].join(", ");
}

/**
 * Consulta o CEP. `buscar` é injetável para o teste não depender de rede.
 *
 * Nunca lança: devolve a situação. Quem chama decide o que dizer ao usuário, e as
 * três telas passam a dizer a mesma coisa.
 */
export async function buscarCep(
  valor: string,
  buscar: typeof fetch = fetch
): Promise<ResultadoCep> {
  const digitos = cepLimpo(valor);
  if (digitos.length !== 8) return { situacao: "CEP_INVALIDO" };

  try {
    const resposta = await buscar(`https://viacep.com.br/ws/${digitos}/json/`);

    if (!resposta.ok) {
      return { situacao: "ERRO", mensagem: `Serviço respondeu ${resposta.status}.` };
    }

    const dados = (await resposta.json()) as RespostaViaCep;

    // A ViaCEP responde 200 com `erro: true` para CEP inexistente. É resposta
    // válida do serviço, não falha de comunicação.
    if (dados.erro) return { situacao: "NAO_ENCONTRADO" };

    return {
      situacao: "OK",
      endereco: {
        cep: mascaraCep(dados.cep ?? digitos),
        logradouro: dados.logradouro ?? "",
        bairro: dados.bairro ?? "",
        localidade: dados.localidade ?? "",
        uf: dados.uf ?? "",
      },
    };
  } catch (e) {
    return { situacao: "ERRO", mensagem: (e as Error).message };
  }
}

/** Mensagem pronta para cada situação, para as telas não divergirem. */
export const MENSAGEM_CEP: Record<ResultadoCep["situacao"], string> = {
  OK: "Endereço preenchido pelos Correios.",
  NAO_ENCONTRADO: "CEP não encontrado na base dos Correios.",
  CEP_INVALIDO: "Informe os oito dígitos do CEP.",
  ERRO: "Não foi possível consultar o CEP agora. Preencha o endereço à mão.",
};
