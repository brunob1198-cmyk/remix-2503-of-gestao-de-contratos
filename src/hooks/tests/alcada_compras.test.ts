import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TIPOS_COMPRA,
  TIPO_COMPRA_LABEL,
  TIPO_COMPRA_AJUDA,
  alcadasQueCobrem,
  avaliarAlcada,
  avisosDeCobertura,
  rotuloTipoCompra,
  textoDaFaixa,
  type Alcada,
} from "@/lib/alcadaCompras";

/**
 * A autorização para aprovar compra era um booleano por usuário: quem tinha a
 * marcação aprovava R$ 200 em parafusos e R$ 400 mil em concreto pela mesma
 * checagem.
 *
 * O que estes testes protegem é a distinção que é fácil de errar aqui: **"sem regra"
 * e "regra que não autoriza" são estados diferentes.**
 *
 * - Tabela vazia tratada como "ninguém aprova" travaria toda compra no instante da
 *   migration.
 * - Valor fora de todas as faixas tratado como "pode aprovar" transformaria a
 *   ausência de uma faixa em permissão implícita — e a faixa que costuma faltar é a
 *   dos valores altos.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260831100000_alcadas_de_aprovacao_compras.sql"),
  "utf8"
);

const EU = "user-1";
const OUTRO = "user-2";

function alcada(over: Partial<Alcada> = {}): Alcada {
  return {
    id: "a1",
    nome: "Alçada 1",
    valor_minimo: 0,
    valor_maximo: 10000,
    tipo_compra: null,
    ativo: true,
    aprovadores: [EU],
    ...over,
  };
}

describe("sem regra cadastrada, vale a regra antiga — e a tela diz isso", () => {
  it("tabela vazia não trava a aprovação", () => {
    const r = avaliarAlcada({
      alcadas: [],
      valor: 500000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });

    expect(r.situacao).toBe("SEM_REGRAS");
    expect(r.podeAprovar).toBe(true);
  });

  it("e a mensagem avisa que não há controle de valor", () => {
    // Sem isso, o usuário acharia que existe controle de alçada onde não existe.
    const r = avaliarAlcada({
      alcadas: [],
      valor: 500000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.mensagem).toContain("Nenhuma alçada cadastrada");
    expect(r.mensagem).toContain("qualquer valor");
  });

  it("sem alçada e sem a permissão antiga, continua sem aprovar", () => {
    const r = avaliarAlcada({
      alcadas: [],
      valor: 100,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: false,
    });
    expect(r.podeAprovar).toBe(false);
  });

  it("alçada inativa não conta como regra cadastrada", () => {
    const r = avaliarAlcada({
      alcadas: [alcada({ ativo: false })],
      valor: 5000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.situacao).toBe("SEM_REGRAS");
  });

  it("o banco também mantém a regra antiga com a tabela vazia", () => {
    expect(SQL).toContain("IF NOT v_tem_alcada THEN");
  });
});

describe("valor fora de todas as faixas é recusado, não liberado", () => {
  it("acima do maior teto ninguém aprova", () => {
    const r = avaliarAlcada({
      alcadas: [alcada({ valor_maximo: 10000 })],
      valor: 50000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });

    expect(r.situacao).toBe("SEM_FAIXA_PARA_O_VALOR");
    expect(r.podeAprovar).toBe(false);
    expect(r.mensagem).toContain("Cadastre uma alçada");
  });

  it("abaixo do piso da única faixa também não é liberado", () => {
    const r = avaliarAlcada({
      alcadas: [alcada({ valor_minimo: 10000, valor_maximo: null })],
      valor: 500,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.podeAprovar).toBe(false);
  });

  it("sem valor não há o que aprovar", () => {
    // Aprovar sem valor é exatamente o que a alçada existe para impedir.
    const r = avaliarAlcada({
      alcadas: [alcada()],
      valor: 0,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.situacao).toBe("SEM_VALOR");
    expect(r.podeAprovar).toBe(false);
  });

  it("o banco recusa aprovar sem cotação vencedora", () => {
    expect(SQL).toContain("Não há cotação vencedora com valor");
  });
});

describe("quem aprova é quem está na alçada da faixa", () => {
  it("aprovador da faixa aprova", () => {
    const r = avaliarAlcada({
      alcadas: [alcada({ valor_maximo: 10000, aprovadores: [EU] })],
      valor: 5000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.situacao).toBe("AUTORIZADO");
    expect(r.podeAprovar).toBe(true);
  });

  it("quem não está na alçada não aprova, mesmo com a permissão antiga", () => {
    const r = avaliarAlcada({
      alcadas: [alcada({ aprovadores: [OUTRO] })],
      valor: 5000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.situacao).toBe("FORA_DA_ALCADA");
    expect(r.podeAprovar).toBe(false);
    expect(r.mensagem).toContain("acima da sua alçada");
  });

  it("estar na alçada não substitui a permissão de aprovar compra", () => {
    // São duas perguntas: "pode aprovar compra?" e "pode aprovar ESTE valor?".
    const r = avaliarAlcada({
      alcadas: [alcada({ aprovadores: [EU] })],
      valor: 5000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: false,
    });
    expect(r.podeAprovar).toBe(false);
    expect(r.mensagem).toContain("não tem a permissão de aprovar compras");
  });

  it("usuário desconhecido não aprova", () => {
    const r = avaliarAlcada({
      alcadas: [alcada()],
      valor: 5000,
      usuarioId: null,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.podeAprovar).toBe(false);
  });

  it("a tela mostra quais alçadas cobrem o valor, para saber a quem encaminhar", () => {
    const r = avaliarAlcada({
      alcadas: [alcada({ nome: "Diretoria", aprovadores: [OUTRO] })],
      valor: 5000,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.alcadasDaFaixa.map((a) => a.nome)).toEqual(["Diretoria"]);
  });
});

describe("a alçada específica do tipo tem precedência sobre a genérica", () => {
  const generica = alcada({ id: "g", nome: "Geral", tipo_compra: null, aprovadores: [EU] });
  const deServico = alcada({
    id: "s",
    nome: "Serviço",
    tipo_compra: "SERVICO",
    aprovadores: [OUTRO],
  });

  it("compra de serviço cai na alçada de serviço, e não na genérica", () => {
    // Sem a precedência, cadastrar regra específica não teria efeito: a genérica
    // autorizaria em paralelo e a específica seria decorativa.
    const r = avaliarAlcada({
      alcadas: [generica, deServico],
      valor: 5000,
      tipoCompra: "SERVICO",
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.podeAprovar).toBe(false);
    expect(r.alcadasDaFaixa.map((a) => a.nome)).toEqual(["Serviço"]);
  });

  it("compra de material cai na genérica", () => {
    const r = avaliarAlcada({
      alcadas: [generica, deServico],
      valor: 5000,
      tipoCompra: "MATERIAL",
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.podeAprovar).toBe(true);
  });

  it("requisição sem tipo classificado cai na genérica", () => {
    // Toda requisição anterior à migration tem tipo nulo.
    const r = avaliarAlcada({
      alcadas: [generica, deServico],
      valor: 5000,
      tipoCompra: null,
      usuarioId: EU,
      podeAprovarPelaRegraAntiga: true,
    });
    expect(r.podeAprovar).toBe(true);
  });

  it("alcadasQueCobrem respeita a faixa e a precedência", () => {
    const alcadas = [generica, deServico, alcada({ id: "x", valor_minimo: 90000, valor_maximo: null })];
    expect(alcadasQueCobrem(alcadas, 5000, "SERVICO").map((a) => a.id)).toEqual(["s"]);
    expect(alcadasQueCobrem(alcadas, 5000, "MATERIAL").map((a) => a.id)).toEqual(["g"]);
    expect(alcadasQueCobrem(alcadas, 200000, "MATERIAL").map((a) => a.id)).toEqual(["x"]);
  });
});

describe("avisos de cobertura: alçada malcadastrada não dá erro, só deixa de autorizar", () => {
  it("avisa quando não existe alçada sem teto", () => {
    // Sem ela, compra acima do maior teto não tem aprovador possível — e o efeito
    // só apareceria no dia em que alguém precisasse aprovar.
    const avisos = avisosDeCobertura([alcada({ valor_maximo: 10000 })]);
    expect(avisos.some((a) => a.problema === "SEM_TETO_AUSENTE")).toBe(true);
    expect(avisos.find((a) => a.problema === "SEM_TETO_AUSENTE")?.mensagem).toContain("sem teto");
  });

  it("não avisa quando existe alçada sem teto", () => {
    const avisos = avisosDeCobertura([
      alcada({ id: "1", valor_maximo: 10000 }),
      alcada({ id: "2", valor_minimo: 10000, valor_maximo: null }),
    ]);
    expect(avisos.some((a) => a.problema === "SEM_TETO_AUSENTE")).toBe(false);
  });

  it("avisa alçada sem nenhum aprovador", () => {
    // Pior que não existir, porque parece configurada.
    const avisos = avisosDeCobertura([
      alcada({ nome: "Diretoria", valor_maximo: null, aprovadores: [] }),
    ]);
    expect(avisos.some((a) => a.problema === "SEM_APROVADOR")).toBe(true);
    expect(avisos.find((a) => a.problema === "SEM_APROVADOR")?.mensagem).toContain("Diretoria");
  });

  it("avisa buraco entre faixas", () => {
    const avisos = avisosDeCobertura([
      alcada({ id: "1", nome: "A", valor_minimo: 0, valor_maximo: 10000 }),
      alcada({ id: "2", nome: "B", valor_minimo: 50000, valor_maximo: null }),
    ]);
    const buraco = avisos.find((a) => a.problema === "BURACO_NA_FAIXA");
    expect(buraco).toBeTruthy();
    expect(buraco?.mensagem).toContain("10.000");
    expect(buraco?.mensagem).toContain("50.000");
  });

  it("avisa sobreposição, sem tratá-la como erro", () => {
    // Sobreposição não impede aprovar; só torna difícil prever quem aprova.
    const avisos = avisosDeCobertura([
      alcada({ id: "1", nome: "A", valor_minimo: 0, valor_maximo: 20000 }),
      alcada({ id: "2", nome: "B", valor_minimo: 10000, valor_maximo: null }),
    ]);
    expect(avisos.some((a) => a.problema === "FAIXA_SOBREPOSTA")).toBe(true);
  });

  it("faixas encostadas não geram aviso", () => {
    const avisos = avisosDeCobertura([
      alcada({ id: "1", nome: "A", valor_minimo: 0, valor_maximo: 10000 }),
      alcada({ id: "2", nome: "B", valor_minimo: 10000, valor_maximo: null }),
    ]);
    expect(avisos.some((a) => a.problema === "BURACO_NA_FAIXA")).toBe(false);
    expect(avisos.some((a) => a.problema === "FAIXA_SOBREPOSTA")).toBe(false);
  });

  it("tabela vazia não gera aviso nenhum", () => {
    expect(avisosDeCobertura([])).toEqual([]);
  });
});

describe("rótulos e leitura da faixa", () => {
  it("cada tipo de compra tem rótulo e explicação", () => {
    // "EPI" é sigla: o rótulo ser igual ao código é o certo aqui, e não descuido.
    const SIGLAS = new Set(["EPI"]);

    for (const t of TIPOS_COMPRA) {
      expect(TIPO_COMPRA_LABEL[t]).toBeTruthy();
      if (!SIGLAS.has(t)) expect(TIPO_COMPRA_LABEL[t], t).not.toBe(t);
      expect(TIPO_COMPRA_AJUDA[t].length, t).toBeGreaterThan(20);
    }
  });

  it("tipo nulo é dito, e não deixado em branco", () => {
    expect(rotuloTipoCompra(null)).toBe("Não classificada");
  });

  it("tipo desconhecido sai como está, em vez de sumir", () => {
    expect(rotuloTipoCompra("INVENTADO")).toBe("INVENTADO");
  });

  it("a faixa se lê em português", () => {
    expect(textoDaFaixa({ valor_minimo: 0, valor_maximo: 10000 })).toContain("Até");
    expect(textoDaFaixa({ valor_minimo: 10000, valor_maximo: null })).toContain("Acima de");
    expect(textoDaFaixa({ valor_minimo: 0, valor_maximo: null })).toBe("Qualquer valor");
    expect(textoDaFaixa({ valor_minimo: 1000, valor_maximo: 5000 })).toContain(" a ");
  });
});

describe("a trava do banco", () => {
  it("só age na entrada em APPROVED", () => {
    // Qualquer outra alteração da requisição continua livre.
    expect(SQL).toContain("NEW.workflow_status <> 'APPROVED'");
    expect(SQL).toContain("COALESCE(OLD.workflow_status, '') = 'APPROVED'");
  });

  it("confere o valor da cotação vencedora, e não o da requisição", () => {
    expect(SQL).toContain("FROM public.cotacoes");
    expect(SQL).toContain("status = 'aprovada'");
  });

  it("recusa valor sem faixa antes de checar o usuário", () => {
    // Se checasse só o usuário, valor sem faixa passaria para quem estivesse em
    // qualquer alçada.
    expect(SQL.indexOf("Nenhuma alçada cobre")).toBeLessThan(SQL.indexOf("não tem alçada para aprovar"));
  });

  it("mexer nas alçadas é só para admin", () => {
    // Administrar quem pode gastar o dinheiro da empresa.
    expect(SQL).toContain("has_role(auth.uid(), 'admin')");
  });

  it("todo usuário da empresa pode VER as alçadas", () => {
    // Quem submete precisa saber quem vai poder aprovar.
    expect(SQL).toContain("sc_alcadas_select");
  });

  it("a faixa não pode ter máximo menor que o mínimo", () => {
    expect(SQL).toContain("valor_maximo IS NULL OR valor_maximo > valor_minimo");
  });

  it("o mesmo aprovador não entra duas vezes na mesma alçada", () => {
    expect(SQL).toContain("UNIQUE (alcada_id, user_id)");
  });
});
