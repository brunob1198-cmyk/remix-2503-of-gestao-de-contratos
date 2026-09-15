import { describe, expect, it } from "vitest";
import { montarHtmlAso } from "@/lib/asoDocumento";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";

/**
 * O ASO sem conclusão médica não pode afirmar aptidão. Nem uma caixa.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * É o item 5.1/5.2 do roteiro de testes, e o único que vem com a instrução
 * "se falhar, pare e reporte": um ASO que sai afirmando aptidão sem médico é o
 * erro mais grave que este sistema pode cometer. Já aconteceu — um DEFAULT
 * 'APTO' no banco fazia a folha imprimir APTO, em corpo grande e verde, para uma
 * conclusão que ninguém tinha tomado.
 *
 * O comportamento foi corrigido, o aviso foi escrito, e nada guardava nenhum dos
 * dois. O teste que havia cobria só o caminho oposto: com conclusão registrada,
 * marca a caixa certa. Ninguém cobrava o caso em branco — que é justamente o
 * perigoso, porque é o silencioso.
 *
 * COMO ELE CONFERE
 *
 * Não pelo texto: lendo as CAIXAS do documento, uma a uma, com o rótulo que vem
 * ao lado. É o que o médico e o fiscal veem. Um teste que procurasse a palavra
 * "Apto" no HTML passaria mesmo com a caixa marcada, porque a palavra está lá de
 * qualquer jeito — ela é o rótulo da opção em branco.
 */

function aso(over: Partial<SgsstAso> = {}): SgsstAso {
  return {
    id: "a1",
    empresa_id: "e1",
    colaborador_id: "c1",
    numero_documento: "ASO-2026-0001",
    data_emissao: "2026-08-20",
    tipo: "Admissional",
    aptidao: null,
    validade: "2027-08-20",
    medico_responsavel: "Dr. Carlos Lima",
    crm_medico: "CRM-SP 111111",
    medico_coordenador: "Dra. Ana Prado",
    crm_coordenador: "CRM-SP 222222",
    descricao_riscos: "Ruído acima de 85 dB(A).",
    riscos_marcados: ["FIS_RUIDO"],
    sem_risco_especifico: false,
    data_exame_clinico: "2026-08-19",
    unidade: "MATRIZ",
    empresa_nome: "Construtora Exemplo Ltda",
    empresa_cnpj: "12.345.678/0001-90",
    status: "ATIVO",
    colaborador: {
      id: "c1",
      cpf: "123.456.789-00",
      profile: { id: "u1", nome: "José da Silva" },
      funcao: { id: "f1", nome: "Eletricista" },
    },
    exames: [],
    ...over,
  } as SgsstAso;
}

interface Caixa {
  marcada: boolean;
  rotulo: string;
}

/**
 * As caixas do documento, com o texto que vem logo depois de cada uma.
 *
 * O recorte começa depois do `</style>`: a folha inteira vai num só HTML, e o
 * CSS cita os mesmos nomes de classe. Sem cortar, o estilo entraria na conta.
 */
function caixasDoDocumento(html: string): Caixa[] {
  const corpo = html.slice(html.indexOf("</style>"));
  const achadas: Caixa[] = [];

  for (const m of corpo.matchAll(
    /<span class="doc-marca( marcada)?"[^>]*>[\s\S]{0,40}?<\/span>([\s\S]{0,70})/g
  )) {
    achadas.push({
      marcada: !!m[1],
      rotulo: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 45),
    });
  }

  return achadas;
}

const ehDeAptidao = (c: Caixa) => /\b(apto|inapto)\b/i.test(c.rotulo) || /restri/i.test(c.rotulo);

describe("ASO sem conclusão médica registrada", () => {
  const caixas = caixasDoDocumento(montarHtmlAso(aso()));

  it("o documento tem caixas de aptidão para o médico marcar", () => {
    // Rede de proteção: se o seletor parar de achar as caixas, a asserção
    // principal passaria vazia — e diria que está tudo certo sem ter olhado nada.
    expect(caixas.length).toBeGreaterThan(10);
    expect(caixas.filter(ehDeAptidao).length).toBeGreaterThan(0);
  });

  it("NENHUMA caixa de aptidão sai marcada", () => {
    const marcadas = caixas.filter((c) => ehDeAptidao(c) && c.marcada);
    expect(
      marcadas.map((c) => c.rotulo),
      "o ASO está afirmando uma conclusão médica que ninguém registrou"
    ).toEqual([]);
  });

  it("a folha diz, por escrito, que não atesta aptidão", () => {
    const html = montarHtmlAso(aso());
    expect(html).toContain("Conclusão de aptidão não registrada");
    expect(html).toContain("não atesta aptidão enquanto o");
  });

  it("o que está marcado é só o que foi realmente informado", () => {
    // Tipo do exame e risco marcado são registro de fato; aptidão é juízo médico.
    const marcadas = caixas.filter((c) => c.marcada).map((c) => c.rotulo);
    expect(marcadas.join(" | ")).toContain("Admissional");
    expect(marcadas.every((r) => !/\b(apto|inapto)\b/i.test(r))).toBe(true);
  });
});

describe("ASO com conclusão registrada", () => {
  it("marca a conclusão informada, e o aviso desaparece", () => {
    const html = montarHtmlAso(aso({ aptidao: "APTO" }));
    const aptidao = caixasDoDocumento(html).filter(ehDeAptidao);

    expect(aptidao.some((c) => c.marcada && /\bapto\b/i.test(c.rotulo))).toBe(true);
    expect(html).not.toContain("Conclusão de aptidão não registrada");
  });

  it("inapto marca inapto, e não apto", () => {
    const aptidao = caixasDoDocumento(montarHtmlAso(aso({ aptidao: "INAPTO" }))).filter(ehDeAptidao);
    const marcadas = aptidao.filter((c) => c.marcada).map((c) => c.rotulo);

    expect(marcadas.some((r) => /inapto/i.test(r))).toBe(true);
    // "Apto" isolado — `\b` impede que "Inapto" conte como acerto.
    expect(marcadas.some((r) => /\bapto\b/i.test(r) && !/inapto/i.test(r))).toBe(false);
  });
});
