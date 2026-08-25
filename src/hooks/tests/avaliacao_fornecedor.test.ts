import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CRITERIOS_AVALIACAO,
  PONTOS_POR_ESTRELA,
  forcaDoScore,
  notaSugeridaDePrazo,
  pontosDaNota,
  prazoDoPedido,
  scoreDaAvaliacao,
  textoDaForca,
  textoDoPrazo,
} from "@/lib/avaliacaoFornecedor";

/**
 * O modal de avaliação dizia "Avalie o fornecedor para atualizar o seu Score" e não
 * atualizava nada: gravava em `avaliacoes_fornecedor` e nunca tocava nas colunas de
 * score. O gatilho que recalcula o score ponderado já existia — faltava alguém
 * alimentá-lo.
 *
 * Estes testes travam as três coisas que podem voltar a dar errado:
 *
 * 1. A **escala**. O modal coleta 1 a 5 estrelas; a tela de fornecedores classifica
 *    o score em faixas de 0 a 100. Gravar a média das estrelas direto deixaria todo
 *    fornecedor entre 1 e 5 numa escala lida como 0 a 100 — todos péssimos, para
 *    sempre.
 *
 * 2. O **prazo medido**, que é fato, ao lado da nota de prazo, que é opinião.
 *
 * 3. Que score de uma avaliação **não seja tratado como score de vinte**.
 */

const SQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260830100000_fornecedor_avaliacao_e_preferido.sql"
  ),
  "utf8"
);

describe("a escala: estrela vale 20 pontos", () => {
  it("cinco estrelas valem 100", () => {
    expect(pontosDaNota(5)).toBe(100);
  });

  it("uma estrela vale 20, e não 1", () => {
    // Se valesse 1, o fornecedor nota mínima e o nota máxima cairiam os dois na
    // faixa vermelha da tela, que começa abaixo de 40.
    expect(pontosDaNota(1)).toBe(20);
  });

  it("a conversão é a mesma no banco e na tela", () => {
    expect(PONTOS_POR_ESTRELA).toBe(20);
    expect(SQL).toContain("* 20");
  });

  it("nota fora da faixa não estoura a escala", () => {
    expect(pontosDaNota(9)).toBe(100);
    expect(pontosDaNota(-3)).toBe(0);
  });

  it("o banco recusa nota fora de 1 a 5", () => {
    // Sem o CHECK, uma nota 50 gravada por engano viraria 1000 pontos.
    expect(SQL).toContain(">= 1 AND");
    expect(SQL).toContain("<= 5");
  });
});

describe("os pesos são os do banco, e aparecem na tela", () => {
  it("os quatro critérios somam 100%", () => {
    const soma = CRITERIOS_AVALIACAO.reduce((s, c) => s + c.peso, 0);
    expect(soma).toBeCloseTo(1, 6);
  });

  it("prazo pesa o dobro de qualidade", () => {
    const prazo = CRITERIOS_AVALIACAO.find((c) => c.criterio === "PRAZO");
    const qualidade = CRITERIOS_AVALIACAO.find((c) => c.criterio === "QUALIDADE");
    expect(prazo?.peso).toBe(0.4);
    expect(qualidade?.peso).toBe(0.2);
  });

  it("cada critério tem pergunta e as cinco âncoras", () => {
    // "3 estrelas" não quer dizer nada sem referência: dois compradores dão notas
    // diferentes para a mesma entrega e a média deixa de ser comparável.
    for (const c of CRITERIOS_AVALIACAO) {
      expect(c.pergunta.length, c.criterio).toBeGreaterThan(20);
      for (const n of [1, 2, 3, 4, 5] as const) {
        expect(c.ancoras[n].length, `${c.criterio} nota ${n}`).toBeGreaterThan(10);
      }
    }
  });

  it("as âncoras de um critério são distintas entre si", () => {
    for (const c of CRITERIOS_AVALIACAO) {
      const textos = Object.values(c.ancoras);
      expect(new Set(textos).size, c.criterio).toBe(textos.length);
    }
  });

  it("nota máxima em tudo dá score 100", () => {
    const r = scoreDaAvaliacao({ PRAZO: 5, PRECO: 5, QUALIDADE: 5, RESPONSIVIDADE: 5 });
    expect(r).toBe(100);
  });

  it("o peso muda o score: prazo ruim derruba mais que atendimento ruim", () => {
    const prazoRuim = scoreDaAvaliacao({ PRAZO: 1, PRECO: 5, QUALIDADE: 5, RESPONSIVIDADE: 5 });
    const atendimentoRuim = scoreDaAvaliacao({ PRAZO: 5, PRECO: 5, QUALIDADE: 5, RESPONSIVIDADE: 1 });
    expect(prazoRuim).toBeLessThan(atendimentoRuim);
  });

  it("nota não preenchida conta como zero no cálculo da prévia", () => {
    // A prévia é só para a pessoa ver o efeito; a tela exige as quatro notas antes
    // de salvar, para que zero nunca chegue ao banco como se fosse avaliação.
    const r = scoreDaAvaliacao({ PRAZO: 0, PRECO: 5, QUALIDADE: 5, RESPONSIVIDADE: 5 });
    expect(r).toBeLessThan(100);
  });
});

describe("o prazo medido, ao lado do prazo opinado", () => {
  it("calcula o atraso a partir do pedido", () => {
    const r = prazoDoPedido({
      prazo_entrega_dias: 10,
      data_emissao: "2026-03-01",
      data_entrega_real: "2026-03-15",
    });
    expect(r.diasPrometidos).toBe(10);
    expect(r.diasEntregues).toBe(14);
    expect(r.atrasoDias).toBe(4);
  });

  it("adiantamento sai como atraso negativo", () => {
    const r = prazoDoPedido({
      prazo_entrega_dias: 10,
      data_emissao: "2026-03-01",
      data_entrega_real: "2026-03-08",
    });
    expect(r.atrasoDias).toBe(-3);
    expect(textoDoPrazo(r)).toContain("Adiantou 3");
  });

  it("sem os dois lados não afirma atraso nenhum", () => {
    // Zero seria "entregou no prazo", que é conclusão diferente de "não sei".
    expect(prazoDoPedido({ prazo_entrega_dias: 10 }).atrasoDias).toBeNull();
    expect(prazoDoPedido({ data_emissao: "2026-03-01", data_entrega_real: "2026-03-05" }).atrasoDias).toBeNull();
    expect(prazoDoPedido({}).atrasoDias).toBeNull();
  });

  it("prazo zero no pedido é ausência de prazo, não prazo de zero dias", () => {
    const r = prazoDoPedido({ prazo_entrega_dias: 0, data_emissao: "2026-03-01", data_entrega_real: "2026-03-05" });
    expect(r.diasPrometidos).toBeNull();
    expect(r.atrasoDias).toBeNull();
  });

  it("data inválida não vira NaN no texto", () => {
    const r = prazoDoPedido({ prazo_entrega_dias: 5, data_emissao: "lixo", data_entrega_real: "mais lixo" });
    expect(r.diasEntregues).toBeNull();
    expect(textoDoPrazo(r)).not.toContain("NaN");
  });

  it("o texto diz o que faltou, em vez de calar", () => {
    expect(textoDoPrazo(prazoDoPedido({}))).toContain("não há atraso a medir");
    expect(textoDoPrazo(prazoDoPedido({ prazo_entrega_dias: 7 }))).toContain("não há data de entrega");
  });

  it("entrega no dia sai como no prazo, e não como atraso zero", () => {
    const r = prazoDoPedido({
      prazo_entrega_dias: 7,
      data_emissao: "2026-03-01",
      data_entrega_real: "2026-03-08",
    });
    expect(r.atrasoDias).toBe(0);
    expect(textoDoPrazo(r)).toContain("exatamente no prazo");
  });
});

describe("a nota sugerida vem do atraso, e é só sugestão", () => {
  it("adiantou sugere 5, no prazo sugere 4", () => {
    expect(notaSugeridaDePrazo({ diasPrometidos: 10, diasEntregues: 8, atrasoDias: -2 })).toBe(5);
    expect(notaSugeridaDePrazo({ diasPrometidos: 10, diasEntregues: 10, atrasoDias: 0 })).toBe(4);
  });

  it("quanto maior o atraso, menor a sugestão", () => {
    const notas = [1, 3, 8, 30].map((atraso) =>
      notaSugeridaDePrazo({ diasPrometidos: 10, diasEntregues: 10 + atraso, atrasoDias: atraso })
    );
    // Monotônica: cada atraso maior não pode sugerir nota maior que o anterior.
    for (let i = 1; i < notas.length; i++) {
      expect(notas[i]!).toBeLessThanOrEqual(notas[i - 1]!);
    }
    expect(notas[notas.length - 1]).toBe(1);
  });

  it("sem atraso medido não há sugestão", () => {
    // Sugerir nota sem base seria inventar o fato que a sugestão deveria refletir.
    expect(notaSugeridaDePrazo({ diasPrometidos: null, diasEntregues: null, atrasoDias: null })).toBeNull();
  });
});

describe("score de uma avaliação não é score de vinte", () => {
  it("sem avaliação é estado próprio", () => {
    expect(forcaDoScore(0)).toBe("SEM_AVALIACAO");
    expect(forcaDoScore(null)).toBe("SEM_AVALIACAO");
    expect(forcaDoScore(undefined)).toBe("SEM_AVALIACAO");
  });

  it("uma ou duas avaliações é indício fraco", () => {
    expect(forcaDoScore(1)).toBe("INDICIO_FRACO");
    expect(forcaDoScore(2)).toBe("INDICIO_FRACO");
  });

  it("de três em diante é consolidado", () => {
    expect(forcaDoScore(3)).toBe("CONSOLIDADO");
    expect(forcaDoScore(40)).toBe("CONSOLIDADO");
  });

  it("o texto sem avaliação avisa que o score não vem do histórico", () => {
    // É o caso do score digitado à mão no cadastro ou importado por planilha.
    expect(textoDaForca(0)).toContain("não do histórico");
  });

  it("o texto diz quantas avaliações sustentam o número", () => {
    expect(textoDaForca(1)).toContain("1 avaliação");
    expect(textoDaForca(12)).toContain("12 avaliações");
  });
});

describe("a migration liga a avaliação ao score", () => {
  it("recalcula a partir de todas as avaliações, e não incrementalmente", () => {
    // Cálculo incremental erra para sempre se uma avaliação for corrigida ou
    // apagada, e não há como descobrir depois que errou.
    expect(SQL).toContain("recalcular_score_fornecedor");
    expect(SQL).toContain("AVG(nota_prazo)");
  });

  it("o gatilho cobre inserção, alteração e exclusão", () => {
    expect(SQL).toContain("AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes_fornecedor");
  });

  it("avaliação movida de fornecedor recalcula os dois", () => {
    expect(SQL).toContain("OLD.fornecedor_id <> NEW.fornecedor_id");
  });

  it("não duplica a conta do score ponderado", () => {
    // O gatilho `tr_calculate_supplier_score` já faz essa conta. Duas
    // implementações dariam duas respostas para a mesma pergunta.
    expect(SQL).not.toContain("* 0.4");
    expect(SQL).toContain("tr_calculate_supplier_score");
  });

  it("recalcula o que já existia", () => {
    // Avaliações lançadas antes da migration nunca chegaram ao score.
    expect(SQL).toContain("SELECT DISTINCT fornecedor_id FROM public.avaliacoes_fornecedor");
  });

  it("não zera o score de quem não tem avaliação", () => {
    // Score digitado à mão ou importado por planilha é informação que alguém pôs
    // ali de propósito.
    expect(SQL).toContain("Só toca em fornecedor QUE TEM avaliação");
  });

  it("guarda quantas avaliações sustentam o score", () => {
    expect(SQL).toContain("avaliacoes_total");
  });

  it("cria o fornecedor preferido com índice parcial", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS preferido boolean NOT NULL DEFAULT false");
    expect(SQL).toContain("WHERE preferido = true");
  });

  it("documenta que preferido não é o mesmo que score alto", () => {
    expect(SQL).toContain("preferido é decisão de quem compra");
  });
});
