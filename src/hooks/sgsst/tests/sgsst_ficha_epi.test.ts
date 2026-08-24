import { describe, it, expect } from "vitest";
import {
  montarHtmlFichaEpi,
  pendenciasFichaEpi,
  entregaComCaVencido,
  saldoEmPosse,
  type FichaEpiDados,
} from "@/lib/fichaEpiDocumento";
import type {
  SgsstEpi,
  SgsstEpiEntrega,
  SgsstEpiDevolucao,
} from "@/hooks/sgsst/useSgsstEpis";

/**
 * A ficha de EPI é o documento mais contestado do SGSST: quando o fornecimento é
 * questionado, é ela que se apresenta. Estes testes cobram o que faz dela prova —
 * uma assinatura por entrega, o CA em cada linha — e o que faz dela prova honesta:
 * entrega com CA vencido sai marcada, não escondida.
 */

const LUVA: SgsstEpi = {
  id: "epi1",
  empresa_id: "e1",
  codigo: "EPI-014",
  nome: "Luva de raspa cano longo",
  categoria: "Proteção das Mãos",
  ca: "31469",
  validade_ca: "2027-05-30",
  unidade_medida: "PAR",
  estoque_atual: 40,
  estoque_minimo: 10,
  status: "ATIVO",
};

const ENTREGA: SgsstEpiEntrega = {
  id: "en1",
  empresa_id: "e1",
  colaborador_id: "c1",
  epi_id: "epi1",
  quantidade: 2,
  data_entrega: "2026-03-10",
  motivo: "PRIMEIRA_ENTREGA",
  tamanho_modelo: "Tam. G",
  confirmacao_recebimento: true,
  orientacao_uso: true,
  epi: LUVA,
  responsavel: { id: "u1", nome: "Ana Técnica" },
};

const DEVOLUCAO: SgsstEpiDevolucao = {
  id: "dv1",
  empresa_id: "e1",
  entrega_id: "en1",
  quantidade_devolvida: 1,
  data_devolucao: "2026-06-01",
  condicao_epi: "DANIFICADO",
  motivo: "Rasgo na costura",
  responsavel: { id: "u1", nome: "Ana Técnica" },
};

function dados(over: Partial<FichaEpiDados> = {}): FichaEpiDados {
  return {
    entregas: [ENTREGA],
    devolucoes: [],
    nomeTrabalhador: "José da Silva",
    cpfTrabalhador: "123.456.789-00",
    funcaoTrabalhador: "Montador",
    matriculaTrabalhador: "0451",
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("montarHtmlFichaEpi — o que faz da ficha uma prova", () => {
  it("identifica o trabalhador e a organização", () => {
    const html = montarHtmlFichaEpi(dados());
    expect(html).toContain("José da Silva");
    expect(html).toContain("123.456.789-00");
    expect(html).toContain("Construtora Exemplo LTDA");
  });

  it("traz o número do CA em cada linha", () => {
    // EPI sem CA nao e EPI para a norma (NR-06 6.2). Uma ficha que lista "luva"
    // sem o CA nao comprova entrega de equipamento aprovado.
    expect(montarHtmlFichaEpi(dados())).toContain("31469");
  });

  it("dá uma linha de assinatura por entrega, não uma no pé da folha", () => {
    const html = montarHtmlFichaEpi(
      dados({
        entregas: [ENTREGA, { ...ENTREGA, id: "en2", data_entrega: "2026-05-02" }],
      })
    );
    const linhas = html.match(/class="doc-assin-linha"/g) ?? [];
    expect(linhas).toHaveLength(2);
  });

  it("mostra o tamanho ou modelo entregue", () => {
    expect(montarHtmlFichaEpi(dados())).toContain("Tam. G");
  });

  it("traz o termo de responsabilidade do trabalhador", () => {
    const html = montarHtmlFichaEpi(dados());
    expect(html).toContain("Termo de responsabilidade");
    expect(html).toContain("guarda e conservação");
  });

  it("registra quem entregou", () => {
    expect(montarHtmlFichaEpi(dados())).toContain("Ana Técnica");
  });

  it("EPI sem CA sai marcado em vez de em branco", () => {
    const html = montarHtmlFichaEpi(
      dados({ entregas: [{ ...ENTREGA, epi: { ...LUVA, ca: "" } }] })
    );
    expect(html).toContain("sem CA");
    expect(html).toContain("doc-falta");
  });

  it("ficha sem nenhuma entrega diz que não comprova nada", () => {
    const html = montarHtmlFichaEpi(dados({ entregas: [] }));
    expect(html).toContain("Nenhuma entrega registrada");
    expect(html).toContain("doc-aviso");
  });

  it("ordena da entrega mais antiga para a mais recente", () => {
    const html = montarHtmlFichaEpi(
      dados({
        entregas: [
          { ...ENTREGA, id: "en2", data_entrega: "2026-07-01" },
          { ...ENTREGA, id: "en1", data_entrega: "2026-01-15" },
        ],
      })
    );
    expect(html.indexOf("15/01/2026")).toBeLessThan(html.indexOf("01/07/2026"));
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlFichaEpi(
      dados({ nomeTrabalhador: '<script>alert("x")</script>' })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlFichaEpi(dados({ devolucoes: [DEVOLUCAO] }));
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("entregaComCaVencido", () => {
  it("compara a validade do CA com a data da entrega", () => {
    const r = entregaComCaVencido({
      ...ENTREGA,
      data_entrega: "2026-03-10",
      epi: { ...LUVA, validade_ca: "2026-01-01" },
    });
    expect(r).toBe(true);
  });

  it("CA válido na data da entrega não é vencido", () => {
    expect(entregaComCaVencido(ENTREGA)).toBe(false);
  });

  it("CA que vence depois da entrega não é vencido, mesmo que já tenha vencido hoje", () => {
    // A pergunta e sobre a data do fornecimento, nao sobre hoje. Marcar pelo
    // presente acusaria de irregular uma entrega que era regular quando ocorreu.
    const r = entregaComCaVencido({
      ...ENTREGA,
      data_entrega: "2020-02-01",
      epi: { ...LUVA, validade_ca: "2021-01-01" },
    });
    expect(r).toBe(false);
  });

  it("sem validade cadastrada não afirma nada", () => {
    const r = entregaComCaVencido({ ...ENTREGA, epi: { ...LUVA, validade_ca: null } });
    expect(r).toBe(false);
  });

  it("marca a entrega irregular no documento", () => {
    const html = montarHtmlFichaEpi(
      dados({
        entregas: [{ ...ENTREGA, epi: { ...LUVA, validade_ca: "2026-01-01" } }],
      })
    );
    expect(html).toContain("CA vencido em");
    expect(html).toContain("doc-inapto");
  });
});

describe("saldoEmPosse", () => {
  it("sem devolução, o saldo é a quantidade entregue", () => {
    expect(saldoEmPosse(ENTREGA, [])).toBe(2);
  });

  it("desconta a devolução parcial", () => {
    expect(saldoEmPosse(ENTREGA, [DEVOLUCAO])).toBe(1);
  });

  it("soma várias devoluções da mesma entrega", () => {
    const r = saldoEmPosse(ENTREGA, [
      DEVOLUCAO,
      { ...DEVOLUCAO, id: "dv2", quantidade_devolvida: 1 },
    ]);
    expect(r).toBe(0);
  });

  it("devolução de outra entrega não afeta o saldo", () => {
    const r = saldoEmPosse(ENTREGA, [{ ...DEVOLUCAO, entrega_id: "outra" }]);
    expect(r).toBe(2);
  });

  it("devolução maior que a entrega não vira saldo negativo", () => {
    // Erro de lancamento nao deve aparecer na ficha como divida do trabalhador.
    const r = saldoEmPosse(ENTREGA, [{ ...DEVOLUCAO, quantidade_devolvida: 9 }]);
    expect(r).toBe(0);
  });

  it("o total em posse aparece no rodapé da tabela", () => {
    const html = montarHtmlFichaEpi(
      dados({
        entregas: [ENTREGA, { ...ENTREGA, id: "en2", quantidade: 3 }],
        devolucoes: [DEVOLUCAO],
      })
    );
    expect(html).toContain("Total sob responsabilidade");
    // 2 - 1 devolvido, mais 3 = 4
    expect(html).toContain("<strong>4</strong>");
  });
});

describe("montarHtmlFichaEpi — devoluções", () => {
  it("a seção só aparece quando há devolução", () => {
    expect(montarHtmlFichaEpi(dados())).not.toContain("Devoluções");
    expect(montarHtmlFichaEpi(dados({ devolucoes: [DEVOLUCAO] }))).toContain("Devoluções");
  });

  it("mostra a condição do equipamento devolvido", () => {
    const html = montarHtmlFichaEpi(dados({ devolucoes: [DEVOLUCAO] }));
    expect(html).toContain("Danificado");
    expect(html).toContain("Rasgo na costura");
  });
});

describe("orientação de uso e previsão de troca", () => {
  it("entrega com orientação registrada sai como Sim", () => {
    expect(montarHtmlFichaEpi(dados())).toContain("Orientado");
  });

  it("entrega sem orientação sai marcada, não em branco", () => {
    // NR-06 6.6.1 "d". Em branco leria como "nao se aplica".
    const html = montarHtmlFichaEpi(
      dados({ entregas: [{ ...ENTREGA, orientacao_uso: false }] })
    );
    expect(html).toContain("Não registrada");
    expect(html).toContain("doc-inapto");
  });

  it("acusa a falta de orientação como pendência, citando a norma", () => {
    const p = pendenciasFichaEpi(
      dados({ entregas: [{ ...ENTREGA, orientacao_uso: false }] })
    );
    expect(p.join(" ")).toContain("orientação de uso");
    expect(p.join(" ")).toContain('6.6.1 alínea "d"');
  });

  it("EPI sem vida útil cadastrada mostra sem prazo, não uma data inventada", () => {
    const html = montarHtmlFichaEpi(dados(), new Date(2026, 7, 22));
    expect(html).toContain("sem prazo");
  });

  it("com vida útil, calcula a troca a partir da entrega", () => {
    // Entrega 10/03/2026 + 12 meses = 10/03/2027.
    const html = montarHtmlFichaEpi(
      dados({ entregas: [{ ...ENTREGA, epi: { ...LUVA, vida_util_meses: 12 } }] }),
      new Date(2026, 7, 22)
    );
    expect(html).toContain("10/03/2027");
  });

  it("troca já vencida sai destacada", () => {
    const html = montarHtmlFichaEpi(
      dados({
        entregas: [
          { ...ENTREGA, data_entrega: "2024-01-10", epi: { ...LUVA, vida_util_meses: 6 } },
        ],
      }),
      new Date(2026, 7, 22)
    );
    expect(html).toContain("(vencida)");
  });

  it("a coluna da troca é separada da do CA — são perguntas diferentes", () => {
    const html = montarHtmlFichaEpi(dados());
    expect(html).toContain("Troca prevista");
    expect(html).toContain("<th>CA</th>");
  });
});

describe("pendenciasFichaEpi", () => {
  it("ficha completa não acusa pendência", () => {
    expect(pendenciasFichaEpi(dados())).toEqual([]);
  });

  it("acusa ficha sem entrega alguma", () => {
    const p = pendenciasFichaEpi(dados({ entregas: [] }));
    expect(p.join(" ")).toContain("Nenhuma entrega registrada");
  });

  it("acusa CPF ausente — a ficha precisa dizer quem recebeu", () => {
    const p = pendenciasFichaEpi(dados({ cpfTrabalhador: null }));
    expect(p.join(" ")).toContain("CPF");
  });

  it("acusa EPI sem CA citando a norma", () => {
    const p = pendenciasFichaEpi(
      dados({ entregas: [{ ...ENTREGA, epi: { ...LUVA, ca: "  " } }] })
    );
    expect(p.join(" ")).toContain("sem número de CA");
    expect(p.join(" ")).toContain("6.2");
  });

  it("acusa entrega feita com CA vencido", () => {
    const p = pendenciasFichaEpi(
      dados({ entregas: [{ ...ENTREGA, epi: { ...LUVA, validade_ca: "2026-01-01" } }] })
    );
    expect(p.join(" ")).toContain("CA já vencido");
  });

  it("acusa entrega sem responsável pelo fornecimento", () => {
    const p = pendenciasFichaEpi(dados({ entregas: [{ ...ENTREGA, responsavel: null }] }));
    expect(p.join(" ")).toContain("sem responsável");
  });

  it("acusa organização ausente", () => {
    const p = pendenciasFichaEpi(dados({ empresa: null }));
    expect(p.join(" ")).toContain("organização");
  });
});
