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
    expect(html).toContain("pcmso-pendente");
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
