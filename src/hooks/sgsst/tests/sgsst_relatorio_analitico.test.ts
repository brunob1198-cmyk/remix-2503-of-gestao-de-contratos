import { describe, it, expect } from "vitest";
import {
  percentualAlterados,
  prevalenciaPor100,
  variacao,
  type ResumoAnual,
} from "@/hooks/sgsst/useSgsstRelatorioAnalitico";
import { montarHtmlRelatorioAnalitico } from "@/lib/relatorioAnaliticoDocumento";

/**
 * O relatório analítico é obrigação anual e vira número numa auditoria. Erro de
 * cálculo aqui é pior que erro de tela: passa despercebido e vai assinado.
 */

function resumo(over: Partial<ResumoAnual> = {}): ResumoAnual {
  return {
    ano: 2026,
    examesClinicos: 10,
    examesComplementares: 30,
    complementaresPorTipo: [
      { chave: "Audiometria", total: 20 },
      { chave: "Espirometria", total: 10 },
    ],
    resultadosNormais: 30,
    resultadosAlterados: 8,
    resultadosInconclusivos: 2,
    resultadosNaoClassificados: 0,
    alteradosPorSetor: [{ chave: "Obra Norte", total: 8 }],
    asosPorAptidao: [{ chave: "APTO", total: 25 }],
    cats: 2,
    catsPorTipo: [{ chave: "INICIAL", total: 2 }],
    catsPorSetor: [{ chave: "Obra Norte", total: 2 }],
    diasAfastamento: 15,
    obitos: 0,
    trabalhadoresAtivos: 100,
    ...over,
  };
}

describe("percentualAlterados", () => {
  it("calcula sobre os classificados", () => {
    // 8 alterados de 40 classificados = 20%
    expect(percentualAlterados(resumo())).toBeCloseTo(20, 5);
  });

  it("ignora os não classificados no denominador", () => {
    // Acrescentar 60 não classificados não pode diluir o percentual: se contasse,
    // o número cairia para 8% e o relatório subestimaria o problema.
    const r = resumo({ resultadosNaoClassificados: 60 });
    expect(percentualAlterados(r)).toBeCloseTo(20, 5);
  });

  it("devolve null quando nada foi classificado, em vez de dividir por zero", () => {
    const r = resumo({
      resultadosNormais: 0,
      resultadosAlterados: 0,
      resultadosInconclusivos: 0,
      resultadosNaoClassificados: 12,
    });
    expect(percentualAlterados(r)).toBeNull();
  });

  it("chega a 100% quando tudo está alterado", () => {
    const r = resumo({ resultadosNormais: 0, resultadosAlterados: 5, resultadosInconclusivos: 0 });
    expect(percentualAlterados(r)).toBeCloseTo(100, 5);
  });
});

describe("prevalenciaPor100", () => {
  it("expressa alterados por 100 trabalhadores ativos", () => {
    // 8 alterados em 100 ativos = 8 por 100
    expect(prevalenciaPor100(resumo())).toBeCloseTo(8, 5);
  });

  it("escala corretamente com base menor", () => {
    expect(prevalenciaPor100(resumo({ trabalhadoresAtivos: 50 }))).toBeCloseTo(16, 5);
  });

  it("devolve null sem trabalhador ativo, em vez de infinito", () => {
    expect(prevalenciaPor100(resumo({ trabalhadoresAtivos: 0 }))).toBeNull();
  });
});

describe("variacao", () => {
  it("calcula a variação percentual entre anos", () => {
    expect(variacao(120, 100)).toBeCloseTo(20, 5);
    expect(variacao(80, 100)).toBeCloseTo(-20, 5);
  });

  it("trata zero para zero como estável, não como indefinido", () => {
    expect(variacao(0, 0)).toBe(0);
  });

  it("devolve null quando o ano anterior era zero e agora não é", () => {
    // Não existe "aumento percentual" a partir de zero; forçar um número seria
    // inventar informação para o documento.
    expect(variacao(5, 0)).toBeNull();
  });
});

describe("montarHtmlRelatorioAnalitico", () => {
  const empresa = { nome: "Construtora Exemplo Ltda", cnpj: "12.345.678/0001-90" };
  const base = {
    relatorio: { atual: resumo(), anterior: resumo({ ano: 2025 }) },
    empresa,
  };

  it("identifica a organização e o exercício", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro(base);
    expect(html).toContain("Construtora Exemplo Ltda");
    expect(html).toContain("12.345.678/0001-90");
    expect(html).toContain("Exercício 2026");
  });

  it("traz as seis alíneas do item 7.6.2, na ordem", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro(base);
    const ordem = [
      "a) Exames clínicos",
      "b) Exames complementares",
      "c) Estatística dos resultados",
      "d) Incidência por setor",
      "e) Comunicações de Acidente",
      "f) Comparação com o exercício anterior",
    ];
    let pos = -1;
    for (const secao of ordem) {
      const i = html.indexOf(secao);
      expect(i, `seção ausente: ${secao}`).toBeGreaterThan(-1);
      expect(i, `seção fora de ordem: ${secao}`).toBeGreaterThan(pos);
      pos = i;
    }
  });

  it("alerta quando há exame realizado sem classificação", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro({
      ...base,
      relatorio: { atual: resumo({ resultadosNaoClassificados: 7 }), anterior: resumo({ ano: 2025 }) },
    });
    expect(html).toContain("ra-alerta");
    expect(html).toMatch(/7 exame\(s\) realizado\(s\) sem classificação/);
  });

  it("avisa quando o exercício não tem dado nenhum", () => {
    const vazio = resumo({
      examesClinicos: 0,
      examesComplementares: 0,
      complementaresPorTipo: [],
      resultadosNormais: 0,
      resultadosAlterados: 0,
      resultadosInconclusivos: 0,
      resultadosNaoClassificados: 0,
      alteradosPorSetor: [],
      asosPorAptidao: [],
      cats: 0,
      catsPorTipo: [],
      catsPorSetor: [],
      diasAfastamento: 0,
      obitos: 0,
    });
    const html = montarHtmlRelatorioAnaliticoSeguro({
      ...base,
      relatorio: { atual: vazio, anterior: resumo({ ano: 2025 }) },
    });
    expect(html).toMatch(/Não há exames realizados nem CATs/i);
  });

  it("destaca óbito comunicado", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro({
      ...base,
      relatorio: { atual: resumo({ obitos: 1 }), anterior: resumo({ ano: 2025 }) },
    });
    expect(html).toMatch(/1 óbito\(s\) comunicado\(s\)/);
    expect(html).toContain("ra-pior");
  });

  it("mostra a comparação com o ano anterior lado a lado", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro({
      ...base,
      relatorio: {
        atual: resumo({ resultadosAlterados: 12 }),
        anterior: resumo({ ano: 2025, resultadosAlterados: 8 }),
      },
    });
    expect(html).toContain("2025");
    // 8 → 12 é alta de 50%, e alta em indicador de saúde é piora.
    expect(html).toContain("ra-pior");
    expect(html).toMatch(/50,0%/);
  });

  it("lembra a exigência de apresentar o relatório à SST", () => {
    expect(montarHtmlRelatorioAnaliticoSeguro(base)).toMatch(/7\.6\.5/);
  });

  it("escapa HTML dos nomes vindos do banco", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro({
      ...base,
      relatorio: {
        atual: resumo({ alteradosPorSetor: [{ chave: "<script>x</script>", total: 1 }] }),
        anterior: resumo({ ano: 2025 }),
      },
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("não quebra quando a empresa não carregou", () => {
    const html = montarHtmlRelatorioAnaliticoSeguro({ ...base, empresa: null });
    expect(html).toContain("Relatório Analítico do PCMSO");
  });
});

/** Wrapper só para deixar as chamadas dos testes mais curtas. */
function montarHtmlRelatorioAnaliticoSeguro(
  dados: Parameters<typeof montarHtmlRelatorioAnalitico>[0]
): string {
  return montarHtmlRelatorioAnalitico(dados);
}
