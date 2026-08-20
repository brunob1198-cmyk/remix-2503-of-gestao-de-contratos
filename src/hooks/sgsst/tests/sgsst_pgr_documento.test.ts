import { describe, it, expect } from "vitest";
import { montarHtmlPgr, pendenciasPgr, type PgrDocumentoDados } from "@/lib/pgrDocumento";
import type {
  SgsstPgr,
  SgsstPgrInventario,
  SgsstPgrMedidaControle,
} from "@/hooks/sgsst/useSgsstPgr";

/**
 * O documento é a entrega do módulo: se um auditor pedir o PGR impresso, é isto
 * que sai. Um campo obrigatório saindo em branco esconde a falta de quem assina,
 * então os testes cobram que a ausência apareça marcada.
 */

const PGR_COMPLETO: SgsstPgr = {
  id: "pgr-1",
  empresa_id: "emp-1",
  projeto_id: "proj-1",
  titulo: "PGR Obra Norte",
  codigo: "PGR-2026-001",
  objetivo: "Gerenciar os riscos da obra",
  metodologia: "Identificação por observação direta e matriz 5x5",
  data_inicio: "2026-01-10",
  data_revisao: "2026-01-10",
  periodicidade_revisao_meses: 24,
  versao: 2,
  empresa_nome: "Construtora Exemplo LTDA",
  empresa_cnpj: "12.345.678/0001-99",
  responsavel_tecnico: "Maria Souza",
  registro_responsavel: "CREA 123456",
  status: "ATIVO",
  observacoes: "Sem ocorrências",
  projeto: { id: "proj-1", codigo: "OB01", nome: "Obra Norte" },
};

const ITEM_COMPLETO: SgsstPgrInventario = {
  id: "inv-1",
  empresa_id: "emp-1",
  pgr_id: "pgr-1",
  atividade: "Corte de concreto",
  perigo: "Poeira de sílica cristalina",
  consequencia: "Silicose",
  fonte_geradora: "Serra de corte",
  descricao_local: "Pavimento térreo sem exaustão",
  tipo_exposicao: "HABITUAL",
  tempo_exposicao: "4h/dia",
  trabalhadores_expostos: 6,
  probabilidade: 3,
  severidade: 4,
  nivel_risco: 12,
  classificacao: "ALTO",
  medidas_existentes: "Umidificação e PFF2",
  tecnica_avaliacao: "QUANTITATIVA",
  intensidade_medida: 0.08,
  unidade_medida: "mg/m³",
  limite_tolerancia_aplicado: 0.05,
  data_medicao: "2026-05-10",
  resultado_avaliacao: "ACIMA_LIMITE",
  status: "em_andamento",
};

const MEDIDA_COMPLETA: SgsstPgrMedidaControle = {
  id: "med-1",
  empresa_id: "emp-1",
  inventario_id: "inv-1",
  descricao: "Instalar sistema de exaustão local",
  tipo: "Engenharia",
  responsavel_id: "p-1",
  prazo: "2026-10-01",
  status: "implementado",
  forma_acompanhamento: "Inspeção mensal com checklist",
  data_verificacao: "2026-11-01",
  resultado_verificacao: "EFICAZ",
  responsavel: { id: "p-1", nome: "João Silva" },
  verificador: { id: "p-2", nome: "Ana Costa" },
};

function dados(over: Partial<PgrDocumentoDados> = {}): PgrDocumentoDados {
  return {
    pgr: PGR_COMPLETO,
    inventario: [ITEM_COMPLETO],
    medidasPorItem: { "inv-1": [MEDIDA_COMPLETA] },
    funcoesPorItem: {
      "inv-1": [
        {
          id: "if-1",
          inventario_id: "inv-1",
          funcao_id: "f-1",
          funcao: { id: "f-1", nome: "Serralheiro" },
        },
      ],
    },
    ...over,
  };
}

describe("montarHtmlPgr", () => {
  it("identifica a organizacao pelo dado congelado no PGR", () => {
    // Nao da empresa atual: se a empresa for renomeada, PGRs ja emitidos nao
    // podem passar a mostrar o nome novo.
    const html = montarHtmlPgr(dados());
    expect(html).toContain("Construtora Exemplo LTDA");
    expect(html).toContain("12.345.678/0001-99");
  });

  it("traz as secoes obrigatorias na ordem da norma", () => {
    const html = montarHtmlPgr(dados());
    const ordem = [
      "1. Objetivo",
      "2. Metodologia",
      "3. Panorama do inventário",
      "4. Inventário de riscos",
      "5. Plano de ação",
    ];
    const posicoes = ordem.map((t) => html.indexOf(t));
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("cita as referencias da norma nos titulos", () => {
    const html = montarHtmlPgr(dados());
    expect(html).toContain("1.5.7.3.2");
    expect(html).toContain("1.5.5.2");
    expect(html).toContain("20 anos");
  });

  it("mostra a versao do documento", () => {
    expect(montarHtmlPgr(dados())).toContain("Versão 2");
  });

  it("mostra a medicao com limite e conclusao", () => {
    const html = montarHtmlPgr(dados());
    expect(html).toContain("0,08 mg/m³");
    expect(html).toContain("LT 0,05");
    expect(html).toContain("Acima do limite");
  });

  it("identifica os grupos expostos pela funcao, nao so pela quantidade", () => {
    const html = montarHtmlPgr(dados());
    expect(html).toContain("Serralheiro");
    expect(html).toContain("6 trabalhador(es)");
  });

  it("marca grupos expostos ausentes em vez de sair em branco", () => {
    const html = montarHtmlPgr(
      dados({
        inventario: [{ ...ITEM_COMPLETO, grupos_expostos: null }],
        funcoesPorItem: {},
      })
    );
    expect(html).toContain("grupos expostos não identificados");
    expect(html).toContain("doc-falta");
  });

  it("aceita grupo em texto livre quando nao ha funcao vinculada", () => {
    const html = montarHtmlPgr(
      dados({
        inventario: [{ ...ITEM_COMPLETO, grupos_expostos: "Terceiros da empreiteira" }],
        funcoesPorItem: {},
      })
    );
    expect(html).toContain("Terceiros da empreiteira");
    expect(html).not.toContain("grupos expostos não identificados");
  });

  it("marca exposicao nao caracterizada", () => {
    const html = montarHtmlPgr(
      dados({ inventario: [{ ...ITEM_COMPLETO, tipo_exposicao: null }] })
    );
    expect(html).toContain("não caracterizada");
  });

  it("nao cobra medicao de item qualitativo", () => {
    const html = montarHtmlPgr(
      dados({
        inventario: [
          {
            ...ITEM_COMPLETO,
            tecnica_avaliacao: "QUALITATIVA",
            intensidade_medida: null,
            resultado_avaliacao: null,
            data_medicao: null,
          },
        ],
      })
    );
    expect(html).toContain("Avaliação qualitativa");
    expect(html).not.toContain("medição não informada");
  });

  it("cobra medicao de item quantitativo sem valor", () => {
    const html = montarHtmlPgr(
      dados({
        inventario: [{ ...ITEM_COMPLETO, intensidade_medida: null }],
      })
    );
    expect(html).toContain("medição não informada");
  });

  it("avisa quando o objetivo esta vazio, em vez de imprimir em branco", () => {
    const html = montarHtmlPgr(dados({ pgr: { ...PGR_COMPLETO, objetivo: null } }));
    expect(html).toContain("Objetivo não preenchido");
    expect(html).toContain("doc-aviso");
  });

  it("avisa quando a metodologia esta vazia", () => {
    const html = montarHtmlPgr(dados({ pgr: { ...PGR_COMPLETO, metodologia: null } }));
    expect(html).toContain("Metodologia não descrita");
  });

  it("avisa inventario vazio", () => {
    const html = montarHtmlPgr(dados({ inventario: [], medidasPorItem: {} }));
    expect(html).toContain("Inventário vazio");
  });

  it("avisa plano de acao vazio", () => {
    const html = montarHtmlPgr(dados({ medidasPorItem: {} }));
    expect(html).toContain("Nenhuma medida de controle registrada");
  });

  it("avisa revisao vencida com a referencia da norma", () => {
    const html = montarHtmlPgr(
      dados({ pgr: { ...PGR_COMPLETO, data_revisao: "2020-01-01" } })
    );
    expect(html).toContain("Revisão vencida");
    expect(html).toContain("1.5.4.4.5");
  });

  it("nao avisa revisao de PGR encerrado", () => {
    const html = montarHtmlPgr(
      dados({ pgr: { ...PGR_COMPLETO, data_revisao: "2020-01-01", status: "ENCERRADO" } })
    );
    expect(html).not.toContain("Revisão vencida");
  });

  it("ordena o inventario por nivel de risco, nao por ordem de digitacao", () => {
    const baixo = { ...ITEM_COMPLETO, id: "inv-2", perigo: "RISCO BAIXO", nivel_risco: 2 };
    const critico = { ...ITEM_COMPLETO, id: "inv-3", perigo: "RISCO CRITICO", nivel_risco: 25 };
    const html = montarHtmlPgr(
      dados({ inventario: [baixo, critico], medidasPorItem: {}, funcoesPorItem: {} })
    );
    expect(html.indexOf("RISCO CRITICO")).toBeLessThan(html.indexOf("RISCO BAIXO"));
  });

  it("mostra acompanhamento e afericao do plano de acao", () => {
    const html = montarHtmlPgr(dados());
    expect(html).toContain("Inspeção mensal com checklist");
    expect(html).toContain("Eficaz");
    expect(html).toContain("Ana Costa");
  });

  it("marca medida sem forma de acompanhamento", () => {
    const html = montarHtmlPgr(
      dados({
        medidasPorItem: { "inv-1": [{ ...MEDIDA_COMPLETA, forma_acompanhamento: null }] },
      })
    );
    expect(html).toContain("não definida");
  });

  it("marca medida nao aferida", () => {
    const html = montarHtmlPgr(
      dados({
        medidasPorItem: { "inv-1": [{ ...MEDIDA_COMPLETA, resultado_verificacao: null }] },
      })
    );
    expect(html).toContain("não aferida");
  });

  it("resume a conformidade e lista as alineas mais ausentes", () => {
    const html = montarHtmlPgr(
      dados({
        inventario: [
          { ...ITEM_COMPLETO, tipo_exposicao: null },
          { ...ITEM_COMPLETO, id: "inv-2", tipo_exposicao: null },
        ],
        medidasPorItem: {},
        funcoesPorItem: {},
      })
    );
    expect(html).toContain("incompletos");
    expect(html).toContain("Caracterização da exposição");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlPgr(
      dados({ pgr: { ...PGR_COMPLETO, objetivo: '<script>alert("x")</script>' } })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlPgr(dados());
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("pendenciasPgr", () => {
  it("PGR completo nao acusa pendencia", () => {
    expect(pendenciasPgr(dados())).toEqual([]);
  });

  it("acusa metodologia ausente", () => {
    const p = pendenciasPgr(dados({ pgr: { ...PGR_COMPLETO, metodologia: null } }));
    expect(p.join(" ")).toContain("Metodologia");
  });

  it("acusa responsavel tecnico ausente", () => {
    const p = pendenciasPgr(
      dados({ pgr: { ...PGR_COMPLETO, responsavel_tecnico: null, responsavel: null } })
    );
    expect(p.join(" ")).toContain("Responsável técnico");
  });

  it("aceita o responsavel do join quando nao ha responsavel tecnico digitado", () => {
    const p = pendenciasPgr(
      dados({
        pgr: {
          ...PGR_COMPLETO,
          responsavel_tecnico: null,
          responsavel: { id: "p-9", nome: "Carlos Eng" },
        },
      })
    );
    expect(p.join(" ")).not.toContain("Responsável técnico");
  });

  it("inventario vazio interrompe a lista: nao faz sentido cobrar o resto", () => {
    const p = pendenciasPgr(dados({ inventario: [], medidasPorItem: {} }));
    expect(p).toContain("Inventário de riscos vazio");
    expect(p.join(" ")).not.toContain("plano de ação");
  });

  it("acusa risco alto sem nenhuma medida — a pendencia mais grave", () => {
    // O programa reconhece o risco e nao faz nada a respeito.
    const p = pendenciasPgr(dados({ medidasPorItem: {} }));
    expect(p.join(" ")).toContain("sem nenhuma medida no plano de ação");
  });

  it("nao acusa risco baixo sem medida", () => {
    const p = pendenciasPgr(
      dados({
        inventario: [{ ...ITEM_COMPLETO, classificacao: "BAIXO", nivel_risco: 2 }],
        medidasPorItem: {},
      })
    );
    expect(p.join(" ")).not.toContain("sem nenhuma medida");
  });

  it("acusa medida sem forma de acompanhamento", () => {
    const p = pendenciasPgr(
      dados({
        medidasPorItem: { "inv-1": [{ ...MEDIDA_COMPLETA, forma_acompanhamento: null }] },
      })
    );
    expect(p.join(" ")).toContain("sem forma de acompanhamento");
  });

  it("acusa medida implementada sem afericao", () => {
    const p = pendenciasPgr(
      dados({
        medidasPorItem: { "inv-1": [{ ...MEDIDA_COMPLETA, resultado_verificacao: null }] },
      })
    );
    expect(p.join(" ")).toContain("sem aferição de resultado");
  });

  it("nao cobra afericao de medida ainda pendente", () => {
    // Cobrar resultado de medida que nao foi implantada seria cobranca indevida.
    const p = pendenciasPgr(
      dados({
        medidasPorItem: {
          "inv-1": [{ ...MEDIDA_COMPLETA, status: "pendente", resultado_verificacao: null }],
        },
      })
    );
    expect(p.join(" ")).not.toContain("sem aferição de resultado");
  });

  it("acusa revisao vencida", () => {
    const p = pendenciasPgr(dados({ pgr: { ...PGR_COMPLETO, data_revisao: "2020-01-01" } }));
    expect(p.join(" ")).toContain("Revisão vencida");
  });

  it("acusa item de inventario incompleto", () => {
    const p = pendenciasPgr(
      dados({ inventario: [{ ...ITEM_COMPLETO, consequencia: null }] })
    );
    expect(p.join(" ")).toContain("incompletos pela NR-01");
  });
});
