/**
 * As duas linhas do rodapé do papel timbrado, montadas do cadastro da empresa.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * O rodapé de todo PDF do SGSST trazia site, CNPJ, telefone, e-mail e endereço
 * **fixos no código**, da AIVX. O documento de cada cliente saía com o CNPJ e o
 * endereço da fabricante da ferramenta — e o roteiro 0.5, que manda conferir
 * esses dados "em Configurações", descrevia uma tela que não existia.
 *
 * O QUE ESTE ARQUIVO DECIDE
 *
 * O que NÃO imprimir. Empresa que ainda não preencheu o telefone emite documento
 * sem telefone no rodapé — não com um traço, não com um rótulo vazio, e nunca
 * com o dado de outra empresa.
 *
 * Por isso a montagem é por junção do que existe, e não por molde com buracos:
 * um molde `"site · CNPJ x · tel · email"` com metade vazia sai
 * `" ·  · CNPJ  · "`, que parece defeito de impressão e ocupa a linha sem dizer
 * nada.
 *
 * O CNPJ GANHA RÓTULO; OS OUTROS NÃO
 *
 * "12.345.678/0001-99" sozinho no meio de uma linha não se identifica. Site,
 * telefone e e-mail se reconhecem pela forma. O rótulo é o que a pessoa precisa
 * para ler, não um campo de formulário transposto.
 */

export interface DadosDoTimbre {
  nome?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  logoUrl?: string | null;
}

/** O separador do rodapé, com folga dos dois lados. */
const SEPARADOR = "  ·  ";

function limpo(valor?: string | null): string {
  return (valor ?? "").trim();
}

/**
 * A primeira linha: site, CNPJ, telefone e e-mail, na ordem, só o que existe.
 *
 * Vazia quando nada foi preenchido — e quem chama não deve desenhar linha
 * nenhuma nesse caso, em vez de desenhar uma linha em branco.
 */
export function linhaDeContato(dados: DadosDoTimbre): string {
  const partes = [
    limpo(dados.site),
    limpo(dados.cnpj) ? `CNPJ ${limpo(dados.cnpj)}` : "",
    limpo(dados.telefone),
    limpo(dados.email),
  ].filter(Boolean);

  return partes.join(SEPARADOR);
}

/** A segunda linha: o endereço, sozinho. */
export function linhaDeEndereco(dados: DadosDoTimbre): string {
  return limpo(dados.endereco);
}

/**
 * O que falta preencher para o timbre ficar completo.
 *
 * A tela de Configurações usa isto para dizer o que a ausência causa, em vez de
 * deixar a pessoa descobrir emitindo um PDF e olhando o rodapé. `nome` não entra:
 * é obrigatório na tabela e sempre existe.
 */
export interface FaltaNoTimbre {
  campo: keyof DadosDoTimbre;
  rotulo: string;
  /** O que deixa de sair no documento. */
  consequencia: string;
}

const EXIGIDOS: readonly FaltaNoTimbre[] = [
  {
    campo: "logoUrl",
    rotulo: "Logotipo",
    consequencia: "o topo de todo PDF sai sem logo, e o cabeçalho das telas também",
  },
  {
    campo: "cnpj",
    rotulo: "CNPJ",
    consequencia: "o rodapé sai sem o CNPJ, que é o que identifica a empresa no documento",
  },
  {
    campo: "endereco",
    rotulo: "Endereço",
    consequencia: "a segunda linha do rodapé fica vazia",
  },
  {
    campo: "telefone",
    rotulo: "Telefone",
    consequencia: "o rodapé sai sem telefone de contato",
  },
  {
    campo: "email",
    rotulo: "E-mail",
    consequencia: "o rodapé sai sem e-mail de contato",
  },
  {
    campo: "site",
    rotulo: "Site",
    consequencia: "o rodapé começa direto pelo CNPJ",
  },
];

export function faltasNoTimbre(dados: DadosDoTimbre): FaltaNoTimbre[] {
  return EXIGIDOS.filter((f) => !limpo(dados[f.campo] as string | null | undefined));
}

/** Verdadeiro quando o rodapé sairia sem nenhuma informação de contato. */
export function timbreSemContato(dados: DadosDoTimbre): boolean {
  return !linhaDeContato(dados) && !linhaDeEndereco(dados);
}
