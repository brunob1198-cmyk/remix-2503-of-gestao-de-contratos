import { describe, it, expect } from "vitest";
import {
  montarHtmlCertificado,
  pendenciasCertificado,
  cargaHoraria,
  type CertificadoDados,
} from "@/lib/certificadoDocumento";
import type {
  SgsstTreinamento,
  SgsstTreinamentoTurma,
  SgsstTreinamentoParticipante,
} from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * O certificado era o único documento obrigatório do SGSST sem emissão. A NR-01
 * item 1.7 lista seis itens, e estes testes cobram cada um — além de cobrar que
 * campo faltante saia MARCADO e não omitido: lacuna invisível passa na
 * conferência e cai na fiscalização.
 */

const TREINAMENTO: SgsstTreinamento = {
  id: "t1",
  empresa_id: "e1",
  codigo: "NR35",
  nome: "NR-35 — Trabalho em Altura",
  categoria: "NR",
  carga_horaria: 8,
  validade_meses: 24,
  obrigatorio: true,
  status: "ATIVO",
  conteudo_programatico:
    "Normas e regulamentações\nAnálise de risco e condições impeditivas\nSistemas de proteção contra quedas",
  base_legal: "NR-35 item 35.3.2",
};

const TURMA: SgsstTreinamentoTurma = {
  id: "tu1",
  empresa_id: "e1",
  treinamento_id: "t1",
  codigo_turma: "T-2026-014",
  data_inicial: "2026-03-10",
  data_final: "2026-03-11",
  carga_horaria: 8,
  instrutor: "Carlos Andrade",
  instrutor_qualificacao: "Engenheiro de Segurança do Trabalho — CREA 45678",
  tipo_treinamento: "INICIAL",
  responsavel_tecnico: "Marina Reis",
  registro_responsavel: "CREA 12345",
  empresa_nome: "Construtora Exemplo LTDA",
  empresa_cnpj: "12.345.678/0001-99",
  local: "Centro de Treinamento — Obra Norte",
  modalidade: "PRESENCIAL",
  status: "CONCLUIDA",
  treinamento: TREINAMENTO,
};

const PARTICIPANTE: SgsstTreinamentoParticipante = {
  id: "p1",
  empresa_id: "e1",
  turma_id: "tu1",
  colaborador_id: "c1",
  presenca: true,
  percentual_presenca: 100,
  resultado: "APROVADO",
  aprovacao: true,
  data_conclusao: "2026-03-11",
  validade: "2028-03-11",
  certificado: "CERT-2026-0014",
};

function dados(over: Partial<CertificadoDados> = {}): CertificadoDados {
  return {
    participante: PARTICIPANTE,
    turma: TURMA,
    nomeTrabalhador: "José da Silva",
    cpfTrabalhador: "123.456.789-00",
    funcaoTrabalhador: "Montador",
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("os seis itens que a NR-01 1.7 exige", () => {
  it("1. nome e área de assinatura do trabalhador", () => {
    const html = montarHtmlCertificado(dados());
    expect(html).toContain("José da Silva");
    expect(html).toContain("Assinatura do trabalhador");
  });

  it("2. conteúdo programático, linha por linha", () => {
    const html = montarHtmlCertificado(dados());
    expect(html).toContain("Conteúdo programático");
    expect(html).toContain("Análise de risco e condições impeditivas");
    expect(html).toContain("Sistemas de proteção contra quedas");
  });

  it("3. carga horária", () => {
    expect(montarHtmlCertificado(dados())).toContain("8 horas");
  });

  it("4. data e local do treinamento", () => {
    const html = montarHtmlCertificado(dados());
    expect(html).toContain("10/03/2026");
    expect(html).toContain("11/03/2026");
    expect(html).toContain("Centro de Treinamento");
  });

  it("5. nome E qualificação do instrutor", () => {
    const html = montarHtmlCertificado(dados());
    expect(html).toContain("Carlos Andrade");
    expect(html).toContain("CREA 45678");
  });

  it("6. área de assinatura do responsável técnico", () => {
    const html = montarHtmlCertificado(dados());
    expect(html).toContain("Marina Reis");
    expect(html).toContain("Responsável técnico pelo treinamento");
    expect(html).toContain("CREA 12345");
  });
});

describe("montarHtmlCertificado", () => {
  it("identifica a organização pelo dado congelado na turma", () => {
    // Nao da empresa atual: renomear a empresa nao pode alterar certificado ja
    // emitido.
    const html = montarHtmlCertificado(dados());
    expect(html).toContain("Construtora Exemplo LTDA");
    expect(html).toContain("12.345.678/0001-99");
  });

  it("mostra o tipo do treinamento pela classificação da norma", () => {
    expect(montarHtmlCertificado(dados())).toContain("Inicial");

    const periodico = montarHtmlCertificado(
      dados({ turma: { ...TURMA, tipo_treinamento: "PERIODICO" } })
    );
    expect(periodico).toContain("Periódico");
  });

  it("turma de um dia não imprime período repetido", () => {
    const html = montarHtmlCertificado(
      dados({ turma: { ...TURMA, data_final: "2026-03-10" } })
    );
    expect(html).not.toContain("10/03/2026 a 10/03/2026");
    expect(html).toContain("10/03/2026");
  });

  it("turma sem data final imprime só a inicial", () => {
    const html = montarHtmlCertificado(dados({ turma: { ...TURMA, data_final: null } }));
    // Busca no formato do intervalo, e nao por " a " solto: a preposicao aparece
    // no texto corrido do documento e a primeira versao deste teste caiu nisso.
    expect(html).not.toMatch(/\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain("10/03/2026");
  });

  it("cita a base legal quando o curso tem", () => {
    expect(montarHtmlCertificado(dados())).toContain("NR-35 item 35.3.2");
  });

  it("treinamento sem base legal não imprime a linha vazia", () => {
    const html = montarHtmlCertificado(
      dados({ turma: { ...TURMA, treinamento: { ...TREINAMENTO, base_legal: null } } })
    );
    expect(html).not.toContain("Base legal");
  });

  it("mostra a validade, ou diz que não expira", () => {
    expect(montarHtmlCertificado(dados())).toContain("11/03/2028");

    const semValidade = montarHtmlCertificado(
      dados({ participante: { ...PARTICIPANTE, validade: null } })
    );
    expect(semValidade).toContain("não expira");
  });

  it("marca conteúdo programático ausente, com a razão", () => {
    const html = montarHtmlCertificado(
      dados({
        turma: { ...TURMA, treinamento: { ...TREINAMENTO, conteudo_programatico: null } },
      })
    );
    // Frases curtas de propósito: o texto do aviso quebra linha no fonte, então
    // procurar a frase inteira contígua falha por formatação, não por conteúdo.
    expect(html).toContain("Conteúdo programático não preenchido");
    expect(html).toContain("NR-01 1.7");
    expect(html).toContain("doc-aviso");
  });

  it("marca qualificação do instrutor ausente em vez de deixar em branco", () => {
    const html = montarHtmlCertificado(
      dados({ turma: { ...TURMA, instrutor_qualificacao: null } })
    );
    expect(html).toContain("não informada");
    expect(html).toContain("doc-falta");
  });

  it("avisa em destaque quando o participante não foi aprovado", () => {
    // Certificado pressupoe aprovacao. Emitir sem avisar transformaria
    // participacao em capacitacao.
    const html = montarHtmlCertificado(
      dados({
        participante: { ...PARTICIPANTE, aprovacao: false, resultado: "REPROVADO" },
      })
    );
    expect(html).toContain("não está aprovado");
    expect(html).toContain("participação, não a capacitação");
  });

  it("aprovado não recebe o aviso de reprovação", () => {
    expect(montarHtmlCertificado(dados())).not.toContain("não está aprovado");
  });

  it("resultado pendente também recebe o aviso", () => {
    const html = montarHtmlCertificado(
      dados({ participante: { ...PARTICIPANTE, aprovacao: true, resultado: "PENDENTE" } })
    );
    expect(html).toContain("não está aprovado");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlCertificado(
      dados({ nomeTrabalhador: '<script>alert("x")</script>' })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlCertificado(dados());
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("cargaHoraria", () => {
  it("a da turma manda sobre a do curso", () => {
    // Turma pode ter carga diferente da ementa — o certificado precisa dizer o
    // que de fato foi ministrado.
    const r = cargaHoraria(dados({ turma: { ...TURMA, carga_horaria: 12 } }));
    expect(r).toBe(12);
  });

  it("sem carga na turma, usa a do curso", () => {
    const r = cargaHoraria(dados({ turma: { ...TURMA, carga_horaria: null } }));
    expect(r).toBe(8);
  });

  it("sem nenhuma das duas, devolve null em vez de inventar 8", () => {
    const r = cargaHoraria(
      dados({
        turma: {
          ...TURMA,
          carga_horaria: null,
          treinamento: { ...TREINAMENTO, carga_horaria: 0 },
        },
      })
    );
    expect(r).toBeFalsy();
  });
});

describe("pendenciasCertificado", () => {
  it("certificado completo não acusa pendência", () => {
    expect(pendenciasCertificado(dados())).toEqual([]);
  });

  it("participante não aprovado é a primeira e mais séria pendência", () => {
    const p = pendenciasCertificado(
      dados({ participante: { ...PARTICIPANTE, aprovacao: false, resultado: "REPROVADO" } })
    );
    expect(p[0]).toContain("não está aprovado");
  });

  it("acusa conteúdo programático ausente", () => {
    const p = pendenciasCertificado(
      dados({
        turma: { ...TURMA, treinamento: { ...TREINAMENTO, conteudo_programatico: "  " } },
      })
    );
    expect(p.join(" ")).toContain("Conteúdo programático");
  });

  it("acusa qualificação do instrutor e responsável técnico", () => {
    const p = pendenciasCertificado(
      dados({
        turma: { ...TURMA, instrutor_qualificacao: null, responsavel_tecnico: null },
      })
    );
    expect(p.join(" ")).toContain("Qualificação do instrutor");
    expect(p.join(" ")).toContain("Responsável técnico");
  });

  it("acusa local ausente", () => {
    const p = pendenciasCertificado(dados({ turma: { ...TURMA, local: null } }));
    expect(p.join(" ")).toContain("Local do treinamento");
  });

  it("acusa certificado sem numeração", () => {
    const p = pendenciasCertificado(
      dados({ participante: { ...PARTICIPANTE, certificado: null } })
    );
    expect(p.join(" ")).toContain("sem numeração");
  });

  it("acusa data de conclusão ausente", () => {
    const p = pendenciasCertificado(
      dados({ participante: { ...PARTICIPANTE, data_conclusao: null } })
    );
    expect(p.join(" ")).toContain("Data de conclusão");
  });

  it("acusa organização ausente na turma", () => {
    const p = pendenciasCertificado(dados({ turma: { ...TURMA, empresa_nome: null } }));
    expect(p.join(" ")).toContain("organização");
  });

  it("turma vazia acusa várias pendências de uma vez", () => {
    const p = pendenciasCertificado(
      dados({
        turma: {
          ...TURMA,
          local: null,
          instrutor: null,
          instrutor_qualificacao: null,
          responsavel_tecnico: null,
          carga_horaria: null,
          empresa_nome: null,
          treinamento: { ...TREINAMENTO, carga_horaria: 0, conteudo_programatico: null },
        },
      })
    );
    expect(p.length).toBeGreaterThanOrEqual(6);
  });
});
