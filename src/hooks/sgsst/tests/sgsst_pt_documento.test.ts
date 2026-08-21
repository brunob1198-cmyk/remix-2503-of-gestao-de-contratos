import { describe, it, expect } from "vitest";
import {
  montarHtmlPt,
  pendenciasPt,
  exigeAvaliacaoAtmosferica,
  type PtDocumentoDados,
} from "@/lib/ptDocumento";
import type {
  SgsstPt,
  SgsstPtChecklistItem,
  SgsstPtParticipante,
  SgsstPtRisco,
  SgsstPtMedida,
  SgsstPtMedicaoAtmosfera,
} from "@/hooks/sgsst/useSgsstPt";

/**
 * A PT é o único documento deste sistema em que o erro custa vida. Estes testes
 * cobram as duas coisas que não podem sair erradas numa folha afixada no local
 * da atividade: o veredito de liberação, e o aviso de que uma PT não aprovada não
 * autoriza nada.
 */

const HOJE = new Date(2026, 7, 21); // 21/08/2026

const PT: SgsstPt = {
  id: "pt1",
  empresa_id: "e1",
  projeto_id: "pj1",
  codigo: "PT-2026-0031",
  titulo: "Limpeza interna do reservatório R-02",
  tipo: "Espaço Confinado",
  atividade: "Remoção de sedimento no interior do reservatório",
  local_execucao: "Casa de bombas — subsolo",
  data_inicio: "2026-08-21T07:00:00.000Z",
  validade_fim: "2026-08-21T17:00:00.000Z",
  status: "APROVADA",
  ventilacao_adotada: "Exaustão mecânica contínua, 2 sopradores de 8 pol.",
  bloqueio_energias: true,
  plano_resgate: "Tripé com talha, equipe de resgate no local, SAMU acionável em 8 min.",
  projeto: { id: "pj1", codigo: "OBR-01", nome: "Estação de Tratamento Norte" },
  area: { id: "a1", nome: "Reservatórios" },
  responsavel: { id: "u1", nome: "Marina Reis" },
  apr: { id: "apr1", codigo: "APR-014", titulo: "Entrada em espaço confinado" },
};

const RISCO: SgsstPtRisco = {
  id: "r1",
  empresa_id: "e1",
  pt_id: "pt1",
  perigo: "Atmosfera com deficiência de oxigênio",
  risco: "Asfixia",
  consequencia: "Óbito",
  probabilidade: 3,
  severidade: 5,
  classificacao: "CRÍTICO",
};

const MEDIDA: SgsstPtMedida = {
  id: "md1",
  empresa_id: "e1",
  pt_risco_id: "r1",
  descricao: "Exaustão mecânica contínua durante toda a permanência",
  tipo: "Engenharia",
  status: "implementado",
  responsavel: { id: "u1", nome: "Marina Reis" },
};

const CHECKLIST: SgsstPtChecklistItem[] = [
  {
    id: "c1",
    empresa_id: "e1",
    pt_id: "pt1",
    item: "Espaço isolado e sinalizado",
    obrigatorio: true,
    resposta: "Conforme",
  },
  {
    id: "c2",
    empresa_id: "e1",
    pt_id: "pt1",
    item: "Detector de gases calibrado",
    obrigatorio: true,
    resposta: "Conforme",
  },
];

const EXECUTANTE: SgsstPtParticipante = {
  id: "p1",
  empresa_id: "e1",
  pt_id: "pt1",
  responsabilidade: "Executante",
  confirmacao: true,
  colaborador_dados: { id: "c1", profile: { nome: "José da Silva" } },
  funcao: { id: "f1", nome: "Montador" },
};

const VIGIA: SgsstPtParticipante = {
  id: "p2",
  empresa_id: "e1",
  pt_id: "pt1",
  responsabilidade: "Vigia",
  confirmacao: true,
  colaborador_dados: { id: "c2", profile: { nome: "Ana Pereira" } },
  funcao: { id: "f2", nome: "Auxiliar" },
};

const MEDICAO_BOA: SgsstPtMedicaoAtmosfera = {
  id: "m1",
  empresa_id: "e1",
  pt_id: "pt1",
  medido_em: "2026-08-21T06:40:00.000Z",
  momento: "ANTES_ENTRADA",
  oxigenio_percentual: 20.9,
  causa_variacao_conhecida: false,
  inflamaveis_percentual_lie: 0,
  equipamento: "MSA Altair 4XR",
  numero_serie: "AX-7781",
  calibracao_validade: "2026-12-01",
  medido_por_nome: "Carlos Andrade",
};

function dados(over: Partial<PtDocumentoDados> = {}): PtDocumentoDados {
  return {
    pt: PT,
    riscos: [RISCO],
    medidas: [MEDIDA],
    checklist: CHECKLIST,
    participantes: [EXECUTANTE, VIGIA],
    medicoes: [MEDICAO_BOA],
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("montarHtmlPt — o que a folha do local precisa dizer", () => {
  it("identifica a atividade, o local e a janela de validade", () => {
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("Limpeza interna do reservatório R-02");
    expect(html).toContain("Casa de bombas");
    expect(html).toContain("PT-2026-0031");
  });

  it("traz a obra e a APR vinculada", () => {
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("Estação de Tratamento Norte");
    expect(html).toContain("APR-014");
  });

  it("lista os riscos com a classificação", () => {
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("Asfixia");
    expect(html).toContain("CRÍTICO");
  });

  it("dá uma linha de assinatura para cada pessoa da equipe", () => {
    // A norma pede ciencia dos riscos de cada um. Um bloco unico no pe da folha
    // nao comprova quem foi informado.
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("José da Silva");
    expect(html).toContain("Ana Pereira");
    // Conta so os atributos, nao as ocorrencias na folha de estilos embutida —
    // a primeira versao deste teste contou a regra CSS como se fosse uma linha.
    const linhas = html.match(/class="doc-assin-linha"/g) ?? [];
    expect(linhas).toHaveLength(2);
  });

  it("diz que a folha deve ficar no local durante a execução", () => {
    expect(montarHtmlPt(dados(), HOJE)).toContain("permanecer no local");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlPt(
      dados({ pt: { ...PT, atividade: '<script>alert("x")</script>' } }),
      HOJE
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlPt(dados(), HOJE);
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("montarHtmlPt — medidas de controle", () => {
  it("imprime a medida ao lado do risco", () => {
    // Risco sem a medida ao lado informa o perigo e nao diz o que fazer — e a
    // folha existe justamente para quem vai executar.
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("Medidas de controle");
    expect(html).toContain("Exaustão mecânica contínua durante toda a permanência");
    expect(html).toContain("Engenharia");
  });

  it("risco sem medida sai marcado, não em branco", () => {
    const html = montarHtmlPt(dados({ medidas: [] }), HOJE);
    expect(html).toContain("Nenhuma medida de controle definida");
    expect(html).toContain("doc-inapto");
  });

  it("ordena as medidas pela hierarquia de controle da NR-01", () => {
    // Protecao coletiva antes do EPI: e a ordem que a norma estabelece, e a que
    // quem le a folha precisa ver.
    const html = montarHtmlPt(
      dados({
        medidas: [
          { ...MEDIDA, id: "md2", tipo: "EPI", descricao: "Cinto tipo paraquedista" },
          { ...MEDIDA, id: "md3", tipo: "Eliminação", descricao: "Suprimir a entrada" },
        ],
      }),
      HOJE
    );
    expect(html.indexOf("Suprimir a entrada")).toBeLessThan(
      html.indexOf("Cinto tipo paraquedista")
    );
  });

  it("medida de outro risco não aparece neste", () => {
    const html = montarHtmlPt(
      dados({ medidas: [{ ...MEDIDA, pt_risco_id: "outro" }] }),
      HOJE
    );
    expect(html).toContain("Nenhuma medida de controle definida");
  });

  it("acusa risco sem medida como pendência", () => {
    const p = pendenciasPt(dados({ medidas: [] }), HOJE);
    expect(p.join(" ")).toContain("sem medida de controle");
  });
});

describe("montarHtmlPt — status que não autoriza", () => {
  it.each(["RASCUNHO", "EM_ANALISE", "REJEITADA", "SUSPENSA", "CANCELADA"] as const)(
    "%s sai com aviso de que não autoriza o trabalho",
    (status) => {
      const html = montarHtmlPt(dados({ pt: { ...PT, status } }), HOJE);
      expect(html).toContain("NÃO autoriza a execução do trabalho");
      expect(html).toContain("doc-aviso");
    }
  );

  it("PT aprovada não recebe esse aviso", () => {
    expect(montarHtmlPt(dados(), HOJE)).not.toContain("NÃO autoriza a execução");
  });

  it("PT em execução também não recebe — ela está justamente autorizando", () => {
    const html = montarHtmlPt(dados({ pt: { ...PT, status: "EM_EXECUCAO" } }), HOJE);
    expect(html).not.toContain("NÃO autoriza a execução");
  });
});

describe("montarHtmlPt — avaliação atmosférica", () => {
  it("imprime o veredito de liberação, não só os números", () => {
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("Entrada LIBERADA");
  });

  it("sem medição, diz que a norma proíbe a entrada", () => {
    const html = montarHtmlPt(dados({ medicoes: [] }), HOJE);
    expect(html).toContain("Nenhuma medição registrada");
    expect(html).toContain("Entrada NÃO liberada");
  });

  it("oxigênio abaixo da faixa reprova a entrada no documento", () => {
    const html = montarHtmlPt(
      dados({ medicoes: [{ ...MEDICAO_BOA, oxigenio_percentual: 18 }] }),
      HOJE
    );
    expect(html).toContain("Entrada NÃO liberada");
  });

  it("sem vigia designado, a entrada não é liberada", () => {
    const html = montarHtmlPt(dados({ participantes: [EXECUTANTE] }), HOJE);
    expect(html).toContain("Entrada NÃO liberada");
    expect(html).toContain("Vigia");
  });

  it("imprime os critérios da norma, para quem lê poder conferir", () => {
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("19.5");
    expect(html).toContain("33.5.15.2");
  });

  it("marca qual medição é a vigente quando há várias", () => {
    const html = montarHtmlPt(
      dados({
        medicoes: [
          MEDICAO_BOA,
          {
            ...MEDICAO_BOA,
            id: "m2",
            medido_em: "2026-08-21T06:10:00.000Z",
            oxigenio_percentual: 20.5,
          },
        ],
      }),
      HOJE
    );
    expect(html).toContain("(vigente)");
    expect((html.match(/\(vigente\)/g) ?? []).length).toBe(1);
  });

  it("mostra ventilação, bloqueio e plano de resgate", () => {
    const html = montarHtmlPt(dados(), HOJE);
    expect(html).toContain("Exaustão mecânica");
    expect(html).toContain("Tripé com talha");
    expect(html).toContain("Executado");
  });

  it("plano de resgate ausente sai marcado, não em branco", () => {
    const html = montarHtmlPt(dados({ pt: { ...PT, plano_resgate: null } }), HOJE);
    expect(html).toContain("não descrito");
    expect(html).toContain("doc-falta");
  });

  it("bloqueio de energias não informado é diferente de não executado", () => {
    const naoInformado = montarHtmlPt(
      dados({ pt: { ...PT, bloqueio_energias: null } }),
      HOJE
    );
    expect(naoInformado).toContain("não informado");

    const naoExecutado = montarHtmlPt(
      dados({ pt: { ...PT, bloqueio_energias: false } }),
      HOJE
    );
    expect(naoExecutado).toContain("não executado");
  });
});

describe("exigeAvaliacaoAtmosferica", () => {
  it("espaço confinado sempre exige", () => {
    expect(exigeAvaliacaoAtmosferica(dados({ medicoes: [] }))).toBe(true);
  });

  it("outro tipo de PT não exige", () => {
    const r = exigeAvaliacaoAtmosferica(
      dados({ pt: { ...PT, tipo: "Trabalho em Altura" }, medicoes: [] })
    );
    expect(r).toBe(false);
  });

  it("outro tipo COM medição registrada exige", () => {
    // Se alguem mediu, o resultado tem de sair impresso — medicao registrada e
    // ignorada no documento e pior que medicao nao feita.
    const r = exigeAvaliacaoAtmosferica(dados({ pt: { ...PT, tipo: "Trabalho a Quente" } }));
    expect(r).toBe(true);
  });

  it("PT de altura não imprime a seção da NR-33", () => {
    const html = montarHtmlPt(
      dados({ pt: { ...PT, tipo: "Trabalho em Altura" }, medicoes: [] }),
      HOJE
    );
    expect(html).not.toContain("Avaliação atmosférica");
  });
});

describe("pendenciasPt", () => {
  it("PT completa e liberada não acusa pendência", () => {
    expect(pendenciasPt(dados(), HOJE)).toEqual([]);
  });

  it("status que não autoriza é a primeira e mais séria pendência", () => {
    const p = pendenciasPt(dados({ pt: { ...PT, status: "RASCUNHO" } }), HOJE);
    expect(p[0]).toContain("não autoriza");
  });

  it("acusa PT sem fim de validade", () => {
    const p = pendenciasPt(dados({ pt: { ...PT, validade_fim: null } }), HOJE);
    expect(p.join(" ")).toContain("Sem fim de validade");
  });

  it("acusa equipe vazia", () => {
    const p = pendenciasPt(dados({ participantes: [] }), HOJE);
    expect(p.join(" ")).toContain("Nenhum participante");
  });

  it("acusa PT sem risco levantado", () => {
    const p = pendenciasPt(dados({ riscos: [] }), HOJE);
    expect(p.join(" ")).toContain("Nenhum risco levantado");
  });

  it("acusa item obrigatório do checklist ainda pendente", () => {
    const p = pendenciasPt(
      dados({ checklist: [{ ...CHECKLIST[0], resposta: "Pendente" }] }),
      HOJE
    );
    expect(p.join(" ")).toContain("obrigatório(s) do checklist");
  });

  it("item não obrigatório pendente não vira pendência", () => {
    const p = pendenciasPt(
      dados({
        checklist: [{ ...CHECKLIST[0], obrigatorio: false, resposta: "Pendente" }],
      }),
      HOJE
    );
    expect(p).toEqual([]);
  });

  it("acusa item em não conformidade, obrigatório ou não", () => {
    const p = pendenciasPt(
      dados({
        checklist: [{ ...CHECKLIST[0], obrigatorio: false, resposta: "Não Conforme" }],
      }),
      HOJE
    );
    expect(p.join(" ")).toContain("não conformidade");
  });

  it("acusa os impedimentos da NR-33 junto dos demais", () => {
    const p = pendenciasPt(dados({ medicoes: [], participantes: [EXECUTANTE] }), HOJE);
    const texto = p.join(" ");
    expect(texto).toContain("avaliação atmosférica");
    expect(texto).toContain("Vigia");
  });

  it("PT de altura não é cobrada por medição atmosférica", () => {
    const p = pendenciasPt(
      dados({ pt: { ...PT, tipo: "Trabalho em Altura" }, medicoes: [] }),
      HOJE
    );
    expect(p.join(" ")).not.toContain("atmosférica");
  });

  it("equipamento com calibração vencida entra como impedimento", () => {
    const p = pendenciasPt(
      dados({ medicoes: [{ ...MEDICAO_BOA, calibracao_validade: "2026-01-01" }] }),
      HOJE
    );
    expect(p.join(" ").toLowerCase()).toContain("calibra");
  });
});
