import { describe, it, expect } from "vitest";
import {
  calcularPontuacao,
  pontosDaResposta,
  pesoEfetivo,
  ehNaoConforme,
  ehNaoAplicavel,
  pendenciasDaAplicacao,
  textoDasPendencias,
  type RespostaParaPontuacao,
  type RespostaParaValidacao,
} from "@/utils/checklistPontuacao";

/**
 * O `peso_pontuacao` existia no banco, no tipo e no cadastro — e não entrava na
 * conta: o cálculo somava 1.0 fixo por item. "Extintor obstruído" pesava igual a
 * "quadro de avisos atualizado". Estes testes travam o peso na conta e as três
 * exigências do modelo que não exigiam nada.
 */

function resp(over: Partial<RespostaParaPontuacao> = {}): RespostaParaPontuacao {
  return {
    item_id: "i1",
    resposta_valor: "Conforme",
    peso_pontuacao: 1,
    ...over,
  };
}

describe("pesoEfetivo", () => {
  it("usa o peso informado", () => {
    expect(pesoEfetivo(10)).toBe(10);
    expect(pesoEfetivo(2.5)).toBe(2.5);
  });

  it("peso ausente vale 1", () => {
    expect(pesoEfetivo(null)).toBe(1);
    expect(pesoEfetivo(undefined)).toBe(1);
  });

  it("peso zero ou negativo vale 1, não zero", () => {
    // Peso zero deixaria o item fora da conta sem ninguem ter marcado "nao
    // aplicavel" — desvio invisivel e pior que desvio contado.
    expect(pesoEfetivo(0)).toBe(1);
    expect(pesoEfetivo(-5)).toBe(1);
  });

  it("valor não finito vale 1", () => {
    expect(pesoEfetivo(Number.NaN)).toBe(1);
    expect(pesoEfetivo(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("ehNaoAplicavel e ehNaoConforme", () => {
  it("reconhece as formas de N/A que o projeto usa", () => {
    expect(ehNaoAplicavel("NA")).toBe(true);
    expect(ehNaoAplicavel("N/A")).toBe(true);
    expect(ehNaoAplicavel("NaoAplicavel")).toBe(true);
  });

  it("reconhece não conformidade nos vocabulários dos vários tipos de resposta", () => {
    // Os tipos do modelo usam vocabularios diferentes; tratar so um faria o mesmo
    // desvio contar num modelo e nao contar em outro.
    expect(ehNaoConforme({ resposta_valor: "NaoConforme" })).toBe(true);
    expect(ehNaoConforme({ resposta_valor: "Nao" })).toBe(true);
    expect(ehNaoConforme({ resposta_valor: "NaoOK" })).toBe(true);
  });

  it("conforme não é não conforme", () => {
    expect(ehNaoConforme({ resposta_valor: "Conforme" })).toBe(false);
    expect(ehNaoConforme({ resposta_valor: "Sim" })).toBe(false);
    expect(ehNaoConforme({ resposta_valor: "OK" })).toBe(false);
  });

  it("a marcação explícita da tela tem prioridade", () => {
    // Escala, numero e texto nao tem valor "nao conforme" que se possa adivinhar.
    expect(ehNaoConforme({ resposta_valor: "3", is_nao_conforme: true })).toBe(true);
    expect(ehNaoConforme({ resposta_valor: "Texto livre", is_nao_conforme: true })).toBe(true);
  });

  it("N/A não é não conforme, mesmo com a marcação ausente", () => {
    expect(ehNaoConforme({ resposta_valor: "NA" })).toBe(false);
  });
});

describe("calcularPontuacao — o peso entra na conta", () => {
  it("item de peso alto derruba o índice mais que um de peso baixo", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme", peso_pontuacao: 1 }),
      resp({ item_id: "b", resposta_valor: "NaoConforme", peso_pontuacao: 9 }),
    ]);

    // Sem peso, 1 de 2 seria 50%. Com peso, 1 de 10 é 10%.
    expect(r.pontuacaoObtida).toBe(1);
    expect(r.pontuacaoMaxima).toBe(10);
    expect(r.percentualConformidade).toBe(10);
  });

  it("sem pesos cadastrados o resultado é o percentual simples", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme", peso_pontuacao: null }),
      resp({ item_id: "b", resposta_valor: "NaoConforme", peso_pontuacao: null }),
    ]);
    expect(r.percentualConformidade).toBe(50);
  });

  it("conta os itens por categoria", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme" }),
      resp({ item_id: "b", resposta_valor: "Conforme" }),
      resp({ item_id: "c", resposta_valor: "NaoConforme" }),
      resp({ item_id: "d", resposta_valor: "NA" }),
    ]);

    expect(r.totalConforme).toBe(2);
    expect(r.totalNaoConforme).toBe(1);
    expect(r.totalNa).toBe(1);
    expect(r.totalItens).toBe(4);
  });

  it("N/A sai do denominador, com qualquer peso", () => {
    // 5 conformes e 35 N/A nao sao 100% de 40 itens: sao 5 itens verificados.
    const r = calcularPontuacao([
      ...Array.from({ length: 5 }, (_, i) =>
        resp({ item_id: `c${i}`, resposta_valor: "Conforme", peso_pontuacao: 2 })
      ),
      ...Array.from({ length: 35 }, (_, i) =>
        resp({ item_id: `n${i}`, resposta_valor: "NA", peso_pontuacao: 100 })
      ),
    ]);

    expect(r.pontuacaoMaxima).toBe(10);
    expect(r.totalNa).toBe(35);
    expect(r.percentualConformidade).toBe(100);
  });

  it("nada avaliado devolve nulo, não 0% nem 100%", () => {
    const r = calcularPontuacao([resp({ resposta_valor: "NA" })]);
    expect(r.percentualConformidade).toBeNull();
  });

  it("lista vazia devolve nulo", () => {
    expect(calcularPontuacao([]).percentualConformidade).toBeNull();
  });

  it("item em branco não conta como conforme nem como não conforme", () => {
    // Contar item nao respondido como qualquer um dos dois seria inventar resposta.
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme" }),
      resp({ item_id: "b", resposta_valor: "" }),
      resp({ item_id: "c", resposta_valor: null }),
      resp({ item_id: "d", resposta_valor: "   " }),
    ]);

    expect(r.totalItens).toBe(1);
    expect(r.totalConforme).toBe(1);
    expect(r.totalNaoConforme).toBe(0);
  });

  it("resposta sem item_id é descartada", () => {
    const r = calcularPontuacao([resp({ item_id: "" })]);
    expect(r.totalItens).toBe(0);
  });

  it("percentual sai com uma casa decimal, sem dízima", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme" }),
      resp({ item_id: "b", resposta_valor: "Conforme" }),
      resp({ item_id: "c", resposta_valor: "NaoConforme" }),
    ]);
    expect(r.percentualConformidade).toBe(66.7);
  });

  it("peso fracionário não gera lixo de ponto flutuante", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme", peso_pontuacao: 0.1 }),
      resp({ item_id: "b", resposta_valor: "Conforme", peso_pontuacao: 0.2 }),
    ]);
    expect(r.pontuacaoObtida).toBe(0.3);
  });

  it("tudo não conforme é 0%, e isso é diferente de nulo", () => {
    const r = calcularPontuacao([resp({ resposta_valor: "NaoConforme" })]);
    expect(r.percentualConformidade).toBe(0);
  });
});

describe("pontosDaResposta", () => {
  it("conforme vale o peso do item", () => {
    expect(pontosDaResposta(resp({ peso_pontuacao: 7 }))).toBe(7);
  });

  it("não conforme vale zero", () => {
    expect(pontosDaResposta(resp({ resposta_valor: "NaoConforme", peso_pontuacao: 7 }))).toBe(0);
  });

  it("N/A vale zero", () => {
    expect(pontosDaResposta(resp({ resposta_valor: "NA", peso_pontuacao: 7 }))).toBe(0);
  });
});

describe("pendenciasDaAplicacao — as exigências que não exigiam nada", () => {
  const item = (over: Record<string, unknown> = {}) => ({
    id: "i1",
    titulo: "Extintor desobstruído e sinalizado",
    obrigatorio: false,
    ...over,
  });

  function respostas(
    over: Partial<RespostaParaValidacao> = {}
  ): Record<string, RespostaParaValidacao> {
    return {
      i1: {
        item_id: "i1",
        resposta_valor: "NaoConforme",
        comentario: "Obstruído por paletes",
        quantidadeEvidencias: 1,
        temPlanoAcao: true,
        ...over,
      },
    };
  }

  it("não conformidade completa não acusa pendência", () => {
    const p = pendenciasDaAplicacao({
      itens: [
        item({
          exigir_comentario_nao_conforme: true,
          exigir_foto_nao_conforme: true,
          gerar_plano_acao_nao_conforme: true,
        }),
      ],
      respostas: respostas(),
    });
    expect(p).toEqual([]);
  });

  it("exige o comentário quando o modelo pede", () => {
    const p = pendenciasDaAplicacao({
      itens: [item({ exigir_comentario_nao_conforme: true })],
      respostas: respostas({ comentario: "   " }),
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("comentário");
  });

  it("exige a foto quando o modelo pede", () => {
    const p = pendenciasDaAplicacao({
      itens: [item({ exigir_foto_nao_conforme: true })],
      respostas: respostas({ quantidadeEvidencias: 0 }),
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("foto");
  });

  it("exige o plano de ação quando o modelo pede", () => {
    const p = pendenciasDaAplicacao({
      itens: [item({ gerar_plano_acao_nao_conforme: true })],
      respostas: respostas({ temPlanoAcao: false }),
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("plano de ação");
  });

  it("as três faltando geram três pendências, não uma", () => {
    // Quem esta na obra precisa saber tudo o que falta, nao a primeira coisa.
    const p = pendenciasDaAplicacao({
      itens: [
        item({
          exigir_comentario_nao_conforme: true,
          exigir_foto_nao_conforme: true,
          gerar_plano_acao_nao_conforme: true,
        }),
      ],
      respostas: respostas({
        comentario: null,
        quantidadeEvidencias: 0,
        temPlanoAcao: false,
      }),
    });
    expect(p).toHaveLength(3);
  });

  it("item CONFORME não é cobrado pelas exigências de não conformidade", () => {
    const p = pendenciasDaAplicacao({
      itens: [
        item({
          exigir_comentario_nao_conforme: true,
          exigir_foto_nao_conforme: true,
          gerar_plano_acao_nao_conforme: true,
        }),
      ],
      respostas: respostas({
        resposta_valor: "Conforme",
        comentario: null,
        quantidadeEvidencias: 0,
        temPlanoAcao: false,
      }),
    });
    expect(p).toEqual([]);
  });

  it("N/A também não é cobrado", () => {
    const p = pendenciasDaAplicacao({
      itens: [item({ exigir_foto_nao_conforme: true })],
      respostas: respostas({ resposta_valor: "NA", quantidadeEvidencias: 0 }),
    });
    expect(p).toEqual([]);
  });

  it("item obrigatório sem resposta é a pendência, e vem sozinha", () => {
    // Listar as condicionais junto faria a mensagem comecar pelo detalhe.
    const p = pendenciasDaAplicacao({
      itens: [
        item({
          obrigatorio: true,
          exigir_foto_nao_conforme: true,
          gerar_plano_acao_nao_conforme: true,
        }),
      ],
      respostas: { i1: { item_id: "i1", resposta_valor: "" } },
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("obrigatório");
  });

  it("item não obrigatório sem resposta não gera pendência", () => {
    const p = pendenciasDaAplicacao({
      itens: [item({ obrigatorio: false, exigir_foto_nao_conforme: true })],
      respostas: {},
    });
    expect(p).toEqual([]);
  });

  it("item sem exigência nenhuma nunca gera pendência", () => {
    const p = pendenciasDaAplicacao({
      itens: [item()],
      respostas: respostas({ comentario: null, quantidadeEvidencias: 0, temPlanoAcao: false }),
    });
    expect(p).toEqual([]);
  });

  it("cada item pendente aparece com o próprio título", () => {
    const p = pendenciasDaAplicacao({
      itens: [
        item({ id: "a", titulo: "Extintor", exigir_foto_nao_conforme: true }),
        item({ id: "b", titulo: "Guarda-corpo", exigir_foto_nao_conforme: true }),
      ],
      respostas: {
        a: { item_id: "a", resposta_valor: "NaoConforme", quantidadeEvidencias: 0 },
        b: { item_id: "b", resposta_valor: "NaoConforme", quantidadeEvidencias: 0 },
      },
    });
    expect(p.map((x) => x.titulo)).toEqual(["Extintor", "Guarda-corpo"]);
  });
});

describe("textoDasPendencias", () => {
  const pendencia = (titulo: string) => ({ itemId: titulo, titulo, motivo: "sem foto" });

  it("lista vazia devolve string vazia", () => {
    expect(textoDasPendencias([])).toBe("");
  });

  it("cita o título e o motivo", () => {
    expect(textoDasPendencias([pendencia("Extintor")])).toBe("Extintor (sem foto)");
  });

  it("diz quantos sobraram em vez de cortar em silêncio", () => {
    const lista = ["A", "B", "C", "D", "E"].map(pendencia);
    const texto = textoDasPendencias(lista);
    expect(texto).toContain("e mais 2");
  });

  it("exatamente no limite não anuncia resto", () => {
    const lista = ["A", "B", "C"].map(pendencia);
    expect(textoDasPendencias(lista)).not.toContain("e mais");
  });
});

describe("item crítico — o veredito é separado do percentual", () => {
  it("não conformidade em item crítico reprova o checklist", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "NaoConforme", critico: true }),
    ]);
    expect(r.reprovadoPorItemCritico).toBe(true);
    expect(r.itensCriticosNaoConformes).toBe(1);
  });

  it("reprova mesmo com o percentual altíssimo", () => {
    // Trinta e nove conformes e o extintor obstruido: 97,5% de conformidade, e o
    // canteiro nao pode operar. O numero esta certo, a conclusao seria errada.
    const r = calcularPontuacao([
      ...Array.from({ length: 39 }, (_, i) =>
        resp({ item_id: `c${i}`, resposta_valor: "Conforme" })
      ),
      resp({ item_id: "critico", resposta_valor: "NaoConforme", critico: true }),
    ]);

    expect(r.percentualConformidade).toBe(97.5);
    expect(r.reprovadoPorItemCritico).toBe(true);
  });

  it("o percentual NÃO é zerado pela reprovação", () => {
    // Zerar esconderia quantos itens estavam certos, e a folha precisa dizer as
    // duas coisas.
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme" }),
      resp({ item_id: "b", resposta_valor: "NaoConforme", critico: true }),
    ]);
    expect(r.percentualConformidade).toBe(50);
    expect(r.reprovadoPorItemCritico).toBe(true);
  });

  it("item crítico CONFORME não reprova nada", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme", critico: true }),
    ]);
    expect(r.reprovadoPorItemCritico).toBe(false);
    expect(r.itensCriticosNaoConformes).toBe(0);
  });

  it("item crítico marcado N/A não reprova", () => {
    // "Nao se aplica" e uma decisao de quem inspeciona: o item nao existe naquele
    // contexto. Reprovar por isso puniria a resposta correta.
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "NA", critico: true }),
    ]);
    expect(r.reprovadoPorItemCritico).toBe(false);
  });

  it("item não crítico não conforme não reprova", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "NaoConforme", critico: false }),
    ]);
    expect(r.reprovadoPorItemCritico).toBe(false);
  });

  it("crítico ausente no dado conta como não crítico", () => {
    const r = calcularPontuacao([resp({ resposta_valor: "NaoConforme" })]);
    expect(r.reprovadoPorItemCritico).toBe(false);
  });

  it("conta quantos críticos falharam, não só se algum falhou", () => {
    // Um ja reprova; o numero diz o tamanho do problema.
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "NaoConforme", critico: true }),
      resp({ item_id: "b", resposta_valor: "NaoConforme", critico: true }),
      resp({ item_id: "c", resposta_valor: "NaoConforme", critico: false }),
    ]);
    expect(r.itensCriticosNaoConformes).toBe(2);
    expect(r.totalNaoConforme).toBe(3);
  });

  it("o item crítico continua pesando na nota normalmente", () => {
    // O veto e adicional, nao substituto: peso gradua, critico veta.
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "Conforme", peso_pontuacao: 1 }),
      resp({ item_id: "b", resposta_valor: "NaoConforme", critico: true, peso_pontuacao: 9 }),
    ]);
    expect(r.pontuacaoMaxima).toBe(10);
    expect(r.percentualConformidade).toBe(10);
  });

  it("item crítico em branco não reprova nem aprova — é pendência", () => {
    const r = calcularPontuacao([
      resp({ item_id: "a", resposta_valor: "", critico: true }),
    ]);
    expect(r.reprovadoPorItemCritico).toBe(false);
    expect(r.totalItens).toBe(0);
  });
});

describe("pendenciasDaAplicacao — item crítico não pode ficar em branco", () => {
  it("crítico sem resposta é pendência, mesmo não sendo obrigatório", () => {
    // Ele decide o veredito da aplicacao inteira: em branco deixaria a conclusao
    // indefinida.
    const p = pendenciasDaAplicacao({
      itens: [{ id: "i1", titulo: "Extintor", obrigatorio: false, critico: true }],
      respostas: {},
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("item crítico sem resposta");
  });

  it("a mensagem explica por que ele não pode ficar em branco", () => {
    const p = pendenciasDaAplicacao({
      itens: [{ id: "i1", titulo: "Extintor", critico: true }],
      respostas: {},
    });
    expect(p[0].motivo).toContain("decide a aprovação");
  });

  it("crítico respondido não gera pendência", () => {
    const p = pendenciasDaAplicacao({
      itens: [{ id: "i1", titulo: "Extintor", critico: true }],
      respostas: { i1: { item_id: "i1", resposta_valor: "Conforme" } },
    });
    expect(p).toEqual([]);
  });

  it("crítico não conforme com tudo preenchido não gera pendência — reprova, mas está completo", () => {
    const p = pendenciasDaAplicacao({
      itens: [
        {
          id: "i1",
          titulo: "Extintor",
          critico: true,
          exigir_comentario_nao_conforme: true,
          exigir_foto_nao_conforme: true,
          gerar_plano_acao_nao_conforme: true,
        },
      ],
      respostas: {
        i1: {
          item_id: "i1",
          resposta_valor: "NaoConforme",
          comentario: "Obstruído",
          quantidadeEvidencias: 1,
          temPlanoAcao: true,
        },
      },
    });
    expect(p).toEqual([]);
  });

  it("crítico em branco tem prioridade sobre a cobrança de obrigatório", () => {
    // Uma pendencia por item, com o motivo mais especifico.
    const p = pendenciasDaAplicacao({
      itens: [{ id: "i1", titulo: "Extintor", obrigatorio: true, critico: true }],
      respostas: { i1: { item_id: "i1", resposta_valor: "" } },
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("crítico");
  });
});
