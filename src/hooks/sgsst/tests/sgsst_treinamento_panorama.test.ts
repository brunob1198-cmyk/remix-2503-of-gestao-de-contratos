import { describe, it, expect } from "vitest";
import {
  montarPanorama,
  agruparPorTreinamento,
  diasEntre,
  JANELA_PANORAMA_DIAS,
  type MatriculaPanorama,
  type PendenciaDaFuncao,
} from "@/utils/sgsstTreinamentoPanorama";

/**
 * O panorama junta duas listas que respondiam metade da pergunta cada. O risco
 * do cruzamento é justamente o inverso do que ele resolve: contar duas vezes o
 * mesmo par colaborador × treinamento, ou apagar a leitura mais grave das duas.
 * É isso que estes testes cobram.
 */

const HOJE = new Date(2026, 7, 20); // 20/08/2026, meio-dia local irrelevante

const PENDENCIA: PendenciaDaFuncao = {
  colaboradorId: "c1",
  colaborador: "José da Silva",
  funcaoNome: "Montador",
  obra: "Obra Norte",
  treinamentoId: "t1",
  treinamentoNome: "NR-35 — Trabalho em Altura",
  situacao: "NUNCA_FEITO",
};

const MATRICULA: MatriculaPanorama = {
  colaboradorId: "c2",
  colaborador: "Maria Souza",
  funcaoNome: "Eletricista",
  obra: "Obra Sul",
  treinamentoId: "t2",
  treinamentoNome: "NR-10 — Eletricidade",
  resultado: "APROVADO",
  validade: "2026-09-15", // dentro da janela
};

function panorama(
  pendencias: PendenciaDaFuncao[] = [],
  matriculas: MatriculaPanorama[] = []
) {
  return montarPanorama({ pendencias, matriculas, hoje: HOJE });
}

describe("montarPanorama — junta as duas metades", () => {
  it("traz quem nunca fez e quem está vencendo na mesma lista", () => {
    const r = panorama([PENDENCIA], [MATRICULA]);
    expect(r.linhas).toHaveLength(2);
    expect(r.resumo.nuncaFeito).toBe(1);
    expect(r.resumo.aVencer).toBe(1);
  });

  it("não conta o mesmo par duas vezes quando as duas fontes o descrevem", () => {
    // Matricula sem aprovacao para o mesmo par que a matriz aponta como nunca
    // feito: e a mesma realidade vista de dois lugares.
    const r = panorama(
      [PENDENCIA],
      [
        {
          ...MATRICULA,
          colaboradorId: "c1",
          colaborador: "José da Silva",
          treinamentoId: "t1",
          treinamentoNome: "NR-35 — Trabalho em Altura",
          resultado: "APROVADO",
          validade: "2026-09-01",
        },
      ]
    );

    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].situacao).toBe("NUNCA_FEITO");
  });

  it("a leitura da função vence o empate, porque é a mais severa", () => {
    const r = panorama(
      [{ ...PENDENCIA, situacao: "VENCIDO", vencimento: "2026-06-01" }],
      [
        {
          ...MATRICULA,
          colaboradorId: "c1",
          colaborador: "José da Silva",
          treinamentoId: "t1",
          treinamentoNome: "NR-35 — Trabalho em Altura",
          validade: "2026-10-01",
        },
      ]
    );

    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].situacao).toBe("VENCIDO");
    expect(r.linhas[0].vencimento).toBe("2026-06-01");
  });

  it("marca quem veio da função como exigido, e quem veio da matrícula como não", () => {
    const r = panorama([PENDENCIA], [MATRICULA]);
    const daFuncao = r.linhas.find((l) => l.colaboradorId === "c1");
    const daMatricula = r.linhas.find((l) => l.colaboradorId === "c2");

    expect(daFuncao?.exigidoPelaFuncao).toBe(true);
    expect(daMatricula?.exigidoPelaFuncao).toBe(false);
  });
});

describe("montarPanorama — o que entra e o que não entra", () => {
  it("matrícula sem aprovação não entra como vencimento", () => {
    // Presenca sem aprovacao nao capacita: nao existe validade a vencer.
    const r = panorama([], [{ ...MATRICULA, resultado: "PENDENTE" }]);
    expect(r.linhas).toHaveLength(0);
  });

  it("reprovado também fica fora", () => {
    const r = panorama([], [{ ...MATRICULA, resultado: "REPROVADO" }]);
    expect(r.linhas).toHaveLength(0);
  });

  it("treinamento sem validade não expira e não entra", () => {
    const r = panorama([], [{ ...MATRICULA, validade: null }]);
    expect(r.linhas).toHaveLength(0);
  });

  it("validade além da janela não entra", () => {
    const r = panorama([], [{ ...MATRICULA, validade: "2028-01-01" }]);
    expect(r.linhas).toHaveLength(0);
  });

  it("validade no último dia da janela entra", () => {
    const limite = new Date(HOJE);
    limite.setDate(limite.getDate() + JANELA_PANORAMA_DIAS);
    const iso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(
      limite.getDate()
    ).padStart(2, "0")}`;

    const r = panorama([], [{ ...MATRICULA, validade: iso }]);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].situacao).toBe("A_VENCER");
  });

  it("validade já passada entra como vencido, não como a vencer", () => {
    const r = panorama([], [{ ...MATRICULA, validade: "2026-05-10" }]);
    expect(r.linhas[0].situacao).toBe("VENCIDO");
    expect(r.linhas[0].diasParaVencer).toBeLessThan(0);
  });

  it("vence hoje conta como a vencer, não como vencido", () => {
    // Ainda vale hoje. Tratar como vencido anteciparia a perda da validade em um
    // dia, e o certificado do trabalhador diz o contrario.
    const r = panorama([], [{ ...MATRICULA, validade: "2026-08-20" }]);
    expect(r.linhas[0].situacao).toBe("A_VENCER");
    expect(r.linhas[0].diasParaVencer).toBe(0);
  });

  it("janela customizada é respeitada", () => {
    const r = montarPanorama({
      pendencias: [],
      matriculas: [{ ...MATRICULA, validade: "2026-09-15" }],
      hoje: HOJE,
      janelaDias: 10,
    });
    expect(r.linhas).toHaveLength(0);
  });
});

describe("montarPanorama — ordem e resumo", () => {
  it("nunca feito vem antes de vencido, que vem antes de a vencer", () => {
    const r = panorama(
      [
        { ...PENDENCIA, colaboradorId: "a", colaborador: "A" },
        {
          ...PENDENCIA,
          colaboradorId: "b",
          colaborador: "B",
          situacao: "VENCIDO",
          vencimento: "2026-01-01",
        },
      ],
      [{ ...MATRICULA, colaboradorId: "z", colaborador: "Z" }]
    );

    expect(r.linhas.map((l) => l.situacao)).toEqual(["NUNCA_FEITO", "VENCIDO", "A_VENCER"]);
  });

  it("dentro da mesma situação, o mais urgente primeiro", () => {
    const r = panorama(
      [],
      [
        { ...MATRICULA, colaboradorId: "x", colaborador: "X", validade: "2026-10-30" },
        { ...MATRICULA, colaboradorId: "y", colaborador: "Y", validade: "2026-08-25" },
      ]
    );

    expect(r.linhas.map((l) => l.colaborador)).toEqual(["Y", "X"]);
  });

  it("conta pessoas distintas, não linhas", () => {
    const r = panorama([
      { ...PENDENCIA, treinamentoId: "t1", treinamentoNome: "NR-35" },
      { ...PENDENCIA, treinamentoId: "t9", treinamentoNome: "NR-18" },
    ]);

    expect(r.linhas).toHaveLength(2);
    expect(r.resumo.colaboradoresAfetados).toBe(1);
    expect(r.resumo.treinamentosAProgramar).toBe(2);
  });

  it("lista vazia devolve resumo zerado sem quebrar", () => {
    const r = panorama();
    expect(r.linhas).toEqual([]);
    expect(r.resumo.colaboradoresAfetados).toBe(0);
    expect(r.resumo.treinamentosAProgramar).toBe(0);
  });
});

describe("agruparPorTreinamento", () => {
  it("soma as situações por treinamento", () => {
    const { linhas } = panorama(
      [
        { ...PENDENCIA, colaboradorId: "a", colaborador: "A" },
        { ...PENDENCIA, colaboradorId: "b", colaborador: "B" },
      ],
      [
        {
          ...MATRICULA,
          colaboradorId: "c",
          colaborador: "C",
          treinamentoId: "t1",
          treinamentoNome: "NR-35 — Trabalho em Altura",
        },
      ]
    );

    const grupos = agruparPorTreinamento(linhas);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].total).toBe(3);
    expect(grupos[0].nuncaFeito).toBe(2);
    expect(grupos[0].aVencer).toBe(1);
  });

  it("o treinamento com mais gente pendente vem primeiro", () => {
    const { linhas } = panorama([
      { ...PENDENCIA, colaboradorId: "a", colaborador: "A", treinamentoId: "t1", treinamentoNome: "NR-35" },
      { ...PENDENCIA, colaboradorId: "b", colaborador: "B", treinamentoId: "t1", treinamentoNome: "NR-35" },
      { ...PENDENCIA, colaboradorId: "c", colaborador: "C", treinamentoId: "t2", treinamentoNome: "NR-10" },
    ]);

    const grupos = agruparPorTreinamento(linhas);
    expect(grupos[0].treinamentoNome).toBe("NR-35");
    expect(grupos[0].total).toBe(2);
  });

  it("prazo mais curto do grupo é o que define a urgência da turma", () => {
    const { linhas } = panorama(
      [],
      [
        { ...MATRICULA, colaboradorId: "a", colaborador: "A", validade: "2026-10-20" },
        { ...MATRICULA, colaboradorId: "b", colaborador: "B", validade: "2026-08-25" },
      ]
    );

    const grupos = agruparPorTreinamento(linhas);
    expect(grupos[0].prazoMaisCurto).toBe(5);
  });

  it("grupo só de nunca-feito não tem prazo", () => {
    const { linhas } = panorama([PENDENCIA]);
    expect(agruparPorTreinamento(linhas)[0].prazoMaisCurto).toBeNull();
  });
});

describe("diasEntre", () => {
  it("ignora a hora do dia", () => {
    const manha = new Date(2026, 7, 20, 7, 0, 0);
    const noite = new Date(2026, 7, 20, 23, 30, 0);
    expect(diasEntre(manha, noite)).toBe(0);
  });

  it("atravessa o horário de verão sem perder um dia", () => {
    // Uma diferenca de 1 dia calculada em milissegundos pode dar 0,96 dia quando
    // o relogio muda no meio. O arredondamento existe para isso.
    const antes = new Date(2026, 9, 17, 12, 0, 0);
    const depois = new Date(2026, 9, 18, 12, 0, 0);
    expect(diasEntre(antes, depois)).toBe(1);
  });

  it("conta negativo para o passado", () => {
    expect(diasEntre(new Date(2026, 7, 20), new Date(2026, 7, 10))).toBe(-10);
  });
});
