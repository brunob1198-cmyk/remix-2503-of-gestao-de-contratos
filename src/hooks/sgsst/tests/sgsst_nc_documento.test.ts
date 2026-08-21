import { describe, it, expect } from "vitest";
import {
  montarHtmlNc,
  pendenciasNc,
  acoesEmAberto,
  acoesAtrasadas,
  concluidaSemVerificacao,
  type NcDocumentoDados,
} from "@/lib/ncDocumento";
import type {
  SgsstNaoConformidade,
  SgsstNaoConformidadeAcao,
} from "@/hooks/sgsst/useSgsstNaoConformidades";

/**
 * O ciclo de uma não conformidade fecha na verificação de eficácia, e é aí que ele
 * mais costuma vazar: a NC é marcada como concluída sem ninguém confirmar que a
 * ação resolveu. Estes testes cobram essa contradição e o cálculo de atraso.
 */

const HOJE = new Date(2026, 7, 21); // 21/08/2026

const NC: SgsstNaoConformidade = {
  id: "nc1",
  empresa_id: "e1",
  projeto_id: "pj1",
  codigo: "NC-2026-0077",
  titulo: "Guarda-corpo removido no vão da escada",
  descricao:
    "Guarda-corpo do patamar intermediário retirado para passagem de material e não recolocado.",
  origem_tipo: "INSPECAO",
  data_identificacao: "2026-08-10",
  criticidade: "ALTA",
  prazo: "2026-08-25",
  status: "EM_TRATAMENTO",
  causa: "Procedimento de passagem de material não prevê recolocação da proteção.",
  projeto: { id: "pj1", codigo: "OBR-03", nome: "Residencial Aurora" },
  area: { id: "a1", nome: "Bloco C" },
  responsavel: { id: "u1", nome: "Marina Reis" },
};

function acao(over: Partial<SgsstNaoConformidadeAcao> = {}): SgsstNaoConformidadeAcao {
  return {
    id: "a1",
    empresa_id: "e1",
    nao_conformidade_id: "nc1",
    descricao: "Recolocar o guarda-corpo e travar com dispositivo",
    tipo: "CORRETIVA",
    prazo: "2026-08-22",
    prioridade: "ALTA",
    status: "EM_ANDAMENTO",
    responsavel: { id: "u2", nome: "Carlos Andrade" },
    ...over,
  };
}

function dados(over: Partial<NcDocumentoDados> = {}): NcDocumentoDados {
  return {
    nc: NC,
    acoes: [acao()],
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("montarHtmlNc", () => {
  it("identifica a NC, a origem e a criticidade", () => {
    const html = montarHtmlNc(dados(), HOJE);
    expect(html).toContain("Guarda-corpo removido no vão da escada");
    expect(html).toContain("Inspeção de segurança");
    expect(html).toContain("Alta");
  });

  it("traz a descrição do desvio e a análise de causa", () => {
    const html = montarHtmlNc(dados(), HOJE);
    expect(html).toContain("não recolocado");
    expect(html).toContain("não prevê recolocação da proteção");
  });

  it("lista o plano de ação com prazo e responsável", () => {
    const html = montarHtmlNc(dados(), HOJE);
    expect(html).toContain("Recolocar o guarda-corpo");
    expect(html).toContain("Carlos Andrade");
    expect(html).toContain("22/08/2026");
  });

  it("cita a norma do plano de ação", () => {
    expect(montarHtmlNc(dados(), HOJE)).toContain("1.5.5.2");
  });

  it("causa ausente sai como aviso, não em branco", () => {
    const html = montarHtmlNc(dados({ nc: { ...NC, causa: null } }), HOJE);
    expect(html).toContain("Causa não registrada");
    expect(html).toContain("doc-aviso");
  });

  it("sem ação definida, aponta a exigência da norma", () => {
    const html = montarHtmlNc(dados({ acoes: [] }), HOJE);
    expect(html).toContain("Nenhuma ação definida");
    expect(html).toContain("1.5.5.2");
  });

  it("ordena as ações pelo prazo, e as sem prazo por último", () => {
    const html = montarHtmlNc(
      dados({
        acoes: [
          acao({ id: "x", prazo: null, descricao: "Ação sem prazo" }),
          acao({ id: "y", prazo: "2026-08-22", descricao: "Ação com prazo curto" }),
        ],
      }),
      HOJE
    );
    expect(html.indexOf("Ação com prazo curto")).toBeLessThan(
      html.indexOf("Ação sem prazo")
    );
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlNc(
      dados({ nc: { ...NC, titulo: '<script>alert("x")</script>' } }),
      HOJE
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlNc(dados(), HOJE);
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("concluidaSemVerificacao — o furo do ciclo", () => {
  it("NC concluída sem verificação é contradição", () => {
    expect(
      concluidaSemVerificacao({ ...NC, status: "CONCLUIDA", resultado_verificacao: null })
    ).toBe(true);
  });

  it("NC concluída COM verificação está coerente", () => {
    expect(
      concluidaSemVerificacao({
        ...NC,
        status: "CONCLUIDA",
        resultado_verificacao: "ACEITA",
      })
    ).toBe(false);
  });

  it("NC ainda em tratamento não é cobrada por verificação", () => {
    // Verificar antes de a acao terminar nao faz sentido — a cobranca so aparece
    // quando o status afirma que acabou.
    expect(concluidaSemVerificacao(NC)).toBe(false);
  });

  it("o documento avisa em destaque", () => {
    const html = montarHtmlNc(
      dados({ nc: { ...NC, status: "CONCLUIDA", resultado_verificacao: null } }),
      HOJE
    );
    expect(html).toContain("concluída sem verificação de eficácia");
    expect(html).toContain("furo mais comum do ciclo");
  });

  it("NC verificada mostra o resultado e quem verificou", () => {
    const html = montarHtmlNc(
      dados({
        nc: {
          ...NC,
          status: "CONCLUIDA",
          resultado_verificacao: "ACEITA",
          verificador: { id: "u3", nome: "Ana Técnica" },
          data_verificacao: "2026-08-20",
        },
      }),
      HOJE
    );
    expect(html).toContain("eficácia confirmada");
    expect(html).toContain("Ana Técnica");
    expect(html).toContain("20/08/2026");
  });

  it("ação rejeitada aparece como reprovada, não como conclusão", () => {
    const html = montarHtmlNc(
      dados({ nc: { ...NC, resultado_verificacao: "REJEITADA" } }),
      HOJE
    );
    expect(html).toContain("não resolveu a causa");
    expect(html).toContain("doc-inapto");
  });

  it("sem verificação, a seção sai com campos para preencher à mão", () => {
    // Secao em branco cobra; ausencia da secao esconde.
    const html = montarHtmlNc(dados(), HOJE);
    expect(html).toContain("Verificação de eficácia");
    expect(html).toContain("ainda não registrada");
    expect(html).toContain("( ) Ação aceita");
  });
});

describe("acoesEmAberto e acoesAtrasadas", () => {
  it("concluída e cancelada não estão em aberto", () => {
    const lista = [
      acao({ id: "a", status: "ABERTA" }),
      acao({ id: "b", status: "EM_ANDAMENTO" }),
      acao({ id: "c", status: "CONCLUIDA" }),
      acao({ id: "d", status: "CANCELADA" }),
    ];
    expect(acoesEmAberto(lista).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("ação em aberto com prazo passado está atrasada", () => {
    const r = acoesAtrasadas([acao({ prazo: "2026-08-01" })], HOJE);
    expect(r).toHaveLength(1);
  });

  it("ação concluída fora do prazo não conta como atrasada", () => {
    // Ela foi entregue; cobrar atraso agora seria cobrar duas vezes.
    const r = acoesAtrasadas([acao({ prazo: "2026-08-01", status: "CONCLUIDA" })], HOJE);
    expect(r).toHaveLength(0);
  });

  it("ação que vence hoje ainda não está atrasada", () => {
    const r = acoesAtrasadas([acao({ prazo: "2026-08-21" })], HOJE);
    expect(r).toHaveLength(0);
  });

  it("ação sem prazo não pode atrasar — a falta do prazo é o problema", () => {
    const r = acoesAtrasadas([acao({ prazo: null })], HOJE);
    expect(r).toHaveLength(0);
  });

  it("o documento marca a ação vencida e avisa no alto", () => {
    const html = montarHtmlNc(dados({ acoes: [acao({ prazo: "2026-08-01" })] }), HOJE);
    expect(html).toContain("(vencido)");
    expect(html).toContain("1 ação(ões) com prazo vencido");
  });

  it("sem ação vencida, não há aviso", () => {
    expect(montarHtmlNc(dados(), HOJE)).not.toContain("com prazo vencido");
  });
});

describe("pendenciasNc", () => {
  it("NC completa e em tratamento não acusa pendência", () => {
    expect(pendenciasNc(dados(), HOJE)).toEqual([]);
  });

  it("concluída sem verificação é a primeira e mais séria pendência", () => {
    const p = pendenciasNc(
      dados({ nc: { ...NC, status: "CONCLUIDA", resultado_verificacao: null } }),
      HOJE
    );
    expect(p[0]).toContain("sem verificação de eficácia");
  });

  it("acusa plano de ação vazio citando a norma", () => {
    const p = pendenciasNc(dados({ acoes: [] }), HOJE);
    expect(p.join(" ")).toContain("1.5.5.2");
  });

  it("acusa ação sem responsável", () => {
    const p = pendenciasNc(dados({ acoes: [acao({ responsavel: null })] }), HOJE);
    expect(p.join(" ")).toContain("sem responsável designado");
  });

  it("acusa ação sem prazo", () => {
    const p = pendenciasNc(dados({ acoes: [acao({ prazo: null })] }), HOJE);
    expect(p.join(" ")).toContain("plano sem prazo não é plano");
  });

  it("acusa ação vencida", () => {
    const p = pendenciasNc(dados({ acoes: [acao({ prazo: "2026-01-01" })] }), HOJE);
    expect(p.join(" ")).toContain("prazo vencido");
  });

  it("acusa causa ausente explicando a consequência", () => {
    const p = pendenciasNc(dados({ nc: { ...NC, causa: "   " } }), HOJE);
    expect(p.join(" ")).toContain("a NC reaparece");
  });

  it("acusa responsável e prazo da NC ausentes", () => {
    const p = pendenciasNc(
      dados({ nc: { ...NC, responsavel: null, prazo: null } }),
      HOJE
    );
    expect(p.join(" ")).toContain("Responsável pelo tratamento");
    expect(p.join(" ")).toContain("Sem prazo de tratamento");
  });

  it("acusa organização ausente", () => {
    const p = pendenciasNc(dados({ empresa: null }), HOJE);
    expect(p.join(" ")).toContain("organização");
  });
});
