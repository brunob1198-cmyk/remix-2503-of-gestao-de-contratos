import { describe, it, expect } from "vitest";
import { pendenciasPcmso, montarHtmlPcmso } from "@/lib/pcmsoDocumento";
import type { SgsstPcmso, SgsstPcmsoExame } from "@/hooks/sgsst/useSgsstPcmso";

/**
 * A NR-07 lista o que o documento-base precisa conter. Se um desses itens sai
 * vazio no PDF, a empresa é autuada — então a checagem de pendências e o próprio
 * layout precisam de teste, não de confiança.
 */

function pcmsoCompleto(over: Partial<SgsstPcmso> = {}): SgsstPcmso {
  return {
    id: "p1",
    empresa_id: "e1",
    titulo: "PCMSO 2026 — Obra Norte",
    codigo: "PCMSO-2026-001",
    data_inicio: "2026-01-01",
    status: "ATIVO",
    agravos_saude: "Ruído acima de 85 dB(A) pode causar PAIR.",
    criterios_conduta: "Audiometria alterada: afastar e reavaliar em 30 dias.",
    medico_responsavel: "Dra. Ana Prado",
    crm_medico: "CRM-SP 123456",
    ano_referencia: 2026,
    ...over,
  } as SgsstPcmso;
}

function exame(over: Partial<SgsstPcmsoExame> = {}): SgsstPcmsoExame {
  return {
    id: "x1",
    empresa_id: "e1",
    pcmso_id: "p1",
    nome_exame: "Audiometria tonal",
    tipo_exame: "Periódico",
    periodicidade_meses: 12,
    justificativa_tecnica: "Exposição a ruído exige detecção precoce de PAIR.",
    base_legal: "NR-07 Anexo I",
    faixa_etaria: "TODAS",
    risco_catalogo_id: "r1",
    ...over,
  } as SgsstPcmsoExame;
}

describe("pendenciasPcmso", () => {
  it("não reclama de um programa completo", () => {
    expect(pendenciasPcmso(pcmsoCompleto(), [exame()])).toEqual([]);
  });

  it("cobra os agravos à saúde, que são obrigatórios na 7.5", () => {
    const p = pendenciasPcmso(pcmsoCompleto({ agravos_saude: null }), [exame()]);
    expect(p.some((x) => /agravos/i.test(x))).toBe(true);
  });

  it("cobra os critérios de conduta", () => {
    const p = pendenciasPcmso(pcmsoCompleto({ criterios_conduta: "   " }), [exame()]);
    expect(p.some((x) => /crit[ée]rios/i.test(x))).toBe(true);
  });

  it("trata texto só com espaços como vazio", () => {
    expect(pendenciasPcmso(pcmsoCompleto({ agravos_saude: "\n  \t " }), [exame()]).length)
      .toBeGreaterThan(0);
  });

  it("cobra programa sem nenhum exame previsto", () => {
    const p = pendenciasPcmso(pcmsoCompleto(), []);
    expect(p.some((x) => /nenhum exame/i.test(x))).toBe(true);
  });

  it("cobra o médico coordenador e o CRM", () => {
    const p = pendenciasPcmso(
      pcmsoCompleto({ medico_responsavel: null, crm_medico: null }),
      [exame()]
    );
    expect(p.some((x) => /coordenador/i.test(x))).toBe(true);
    expect(p.some((x) => /CRM/i.test(x))).toBe(true);
  });

  it("conta exames sem risco associado", () => {
    const p = pendenciasPcmso(pcmsoCompleto(), [
      exame({ risco_catalogo_id: null, grupo_risco: null }),
      exame({ id: "x2", risco_catalogo_id: null, grupo_risco: null }),
      exame({ id: "x3" }),
    ]);
    expect(p.some((x) => /^2 exame/.test(x))).toBe(true);
  });

  it("aceita o texto livre antigo como risco, para não cobrar cadastro já feito", () => {
    const p = pendenciasPcmso(pcmsoCompleto(), [
      exame({ risco_catalogo_id: null, grupo_risco: "Ruído elevado" }),
    ]);
    expect(p.some((x) => /sem risco associado/i.test(x))).toBe(false);
  });

  it("conta exames sem justificativa técnica", () => {
    const p = pendenciasPcmso(pcmsoCompleto(), [exame({ justificativa_tecnica: null })]);
    expect(p.some((x) => /justificativa/i.test(x))).toBe(true);
  });
});

describe("montarHtmlPcmso", () => {
  const empresa = { nome: "Construtora Exemplo Ltda", cnpj: "12.345.678/0001-90" };

  it("identifica a organização com nome e CNPJ", () => {
    const html = montarHtmlPcmso({ pcmso: pcmsoCompleto(), exames: [exame()], empresa });
    expect(html).toContain("Construtora Exemplo Ltda");
    expect(html).toContain("12.345.678/0001-90");
  });

  it("traz as quatro seções da norma na ordem", () => {
    const html = montarHtmlPcmso({ pcmso: pcmsoCompleto(), exames: [exame()], empresa });
    const iObj = html.indexOf("Objetivo do programa");
    const iAgr = html.indexOf("Agravos à saúde");
    const iPla = html.indexOf("Planejamento de exames");
    const iCri = html.indexOf("Critérios de interpretação");
    expect(iObj).toBeGreaterThan(-1);
    expect(iAgr).toBeGreaterThan(iObj);
    expect(iPla).toBeGreaterThan(iAgr);
    expect(iCri).toBeGreaterThan(iPla);
  });

  it("marca visivelmente a seção obrigatória que ficou vazia, em vez de sair em branco", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto({ agravos_saude: null }),
      exames: [exame()],
      empresa,
    });
    expect(html).toContain("doc-aviso");
    expect(html).toContain("NR-07 item 7.5");
  });

  it("agrupa o quadro de exames por função", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [
        exame({ id: "a", funcao: { id: "f1", nome: "Eletricista" } }),
        exame({ id: "b", funcao: { id: "f2", nome: "Armador" } }),
      ],
      empresa,
    });
    expect(html).toContain("Função: Eletricista");
    expect(html).toContain("Função: Armador");
    // Ordenado alfabeticamente: Armador antes de Eletricista.
    expect(html.indexOf("Função: Armador")).toBeLessThan(html.indexOf("Função: Eletricista"));
  });

  it("mostra a faixa etária quando ela restringe a periodicidade", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame({ faixa_etaria: "MAIOR_45" })],
      empresa,
    });
    expect(html).toContain("Acima de 45 anos");
  });

  it("escapa HTML vindo dos campos de texto, para o documento não quebrar", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto({ titulo: 'PCMSO <script>alert("x")</script>' }),
      exames: [exame()],
      empresa,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("não quebra quando a empresa não carregou", () => {
    const html = montarHtmlPcmso({ pcmso: pcmsoCompleto(), exames: [exame()], empresa: null });
    expect(html).toContain("Programa de Controle Médico");
  });

  it("avisa quando não há nenhum exame previsto", () => {
    const html = montarHtmlPcmso({ pcmso: pcmsoCompleto(), exames: [], empresa });
    expect(html).toMatch(/Nenhum exame previsto/i);
  });
});

/**
 * GHE e quadro de funções.
 *
 * As duas seções são CONDICIONAIS: sem função cadastrada ou sem GHE, não saem. Por
 * isso a numeração das seções é calculada, e é ela que precisa de teste — buraco
 * de numeração num documento de conformidade se lê como página faltando.
 */
describe("montarHtmlPcmso — funções e GHE", () => {
  const funcoes = [
    { id: "f1", nome: "Mecânico", descricao: "Executa manutenção de equipamentos.", cbo: "9113-05" },
    { id: "f2", nome: "Recepcionista", descricao: "", cbo: "4221-05" },
  ];

  const ghe = {
    id: "g1",
    codigo: "GHE-01",
    nome: "Operacional",
    setor: "OPERACIONAL",
    area_influencia: "OFICINA",
    carga_horaria: "44 horas semanais",
    quantidade_trabalhadores: 2,
    status: "ativo",
  };

  it("sem função e sem GHE, a numeração não abre buraco", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
    });
    const numeros = [...html.matchAll(/class="doc-sec">(\d+)\./g)].map((m) => Number(m[1]));
    expect(numeros).toEqual([1, 2, 3, 4, 5]);
  });

  it("com as duas seções, a numeração continua sequencial", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto({ observacoes: "Sem ocorrências." }),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      funcoes,
      ghes: [ghe],
      funcoesPorGhe: new Map([["g1", funcoes]]),
    });
    const numeros = [...html.matchAll(/class="doc-sec">(\d+)\./g)].map((m) => Number(m[1]));
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(html).toContain("Funções avaliadas");
    expect(html).toContain("Exames por GHE");
  });

  it("com função e sem GHE, a numeração fecha em 7 sem pular", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto({ observacoes: "Sem ocorrências." }),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      funcoes,
    });
    const numeros = [...html.matchAll(/class="doc-sec">(\d+)\./g)].map((m) => Number(m[1]));
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(html).not.toContain("Exames por GHE");
  });

  it("o quadro mantém a função sem descrição e MARCA a lacuna", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      funcoes,
    });
    expect(html).toContain("Recepcionista");
    expect(html).toContain("descrição das atividades não cadastrada");
    expect(html).toContain("1 função está");
  });

  it("o campo função continua no documento junto do GHE", () => {
    // A exigência era acrescentar o grupo SEM remover a função: as duas seções
    // saem no mesmo PDF.
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame({ funcao: { id: "f1", nome: "Mecânico" } })],
      empresa: { nome: "Construtora X" },
      funcoes,
      ghes: [ghe],
      funcoesPorGhe: new Map([["g1", funcoes]]),
    });
    expect(html).toContain("Exames por GHE");
    expect(html).toContain("Planejamento de exames médicos");
    expect(html).toContain("por função");
  });

  it("inventário não consultado não vira 'nenhum risco'", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      ghes: [ghe],
      funcoesPorGhe: new Map([["g1", funcoes]]),
    });
    expect(html).toContain("não consultado nesta emissão");
    expect(html).not.toContain("Nenhum risco do inventário");
  });

  it("inventário consultado e vazio avisa que nenhum risco alcança o grupo", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      ghes: [ghe],
      funcoesPorGhe: new Map([["g1", funcoes]]),
      inventario: [],
    });
    expect(html).toContain("Nenhum risco do inventário");
  });

  it("GHE inativo não sai no documento", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      ghes: [{ ...ghe, status: "inativo" }],
      funcoesPorGhe: new Map([["g1", funcoes]]),
    });
    expect(html).not.toContain("Exames por GHE");
  });

  it("divergência entre quantidade declarada e ativos aparece no bloco do grupo", () => {
    const html = montarHtmlPcmso({
      pcmso: pcmsoCompleto(),
      exames: [exame()],
      empresa: { nome: "Construtora X" },
      ghes: [{ ...ghe, quantidade_trabalhadores: 2 }],
      funcoesPorGhe: new Map([["g1", funcoes]]),
      ativosPorFuncao: new Map([
        ["f1", 3],
        ["f2", 1],
      ]),
    });
    expect(html).toContain("2 declarado(s)");
    expect(html).toContain("4 ativo(s) no cadastro");
    expect(html).toContain("Confirme qual reflete o grupo hoje");
  });
});
