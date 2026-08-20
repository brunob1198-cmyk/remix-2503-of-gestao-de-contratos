import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  BASE_HHT,
  taxaFrequencia,
  taxaGravidade,
  percentualConformidade,
  variacaoPercentual,
  formatarTaxa,
  formatarPercentual,
  comAfastamento,
  eAcidente,
  consolidarIndicadores,
  consolidarInspecoes,
  consolidarPlanoAcao,
  type IncidenteIndicador,
  type MedidaIndicador,
} from "@/utils/sgsstIndicadores";

const HOJE = new Date("2026-08-20T00:00:00");

describe("constantes", () => {
  it("usa a base de um milhao de homens-hora da NBR 14280", () => {
    expect(BASE_HHT).toBe(1_000_000);
  });
});

describe("taxaFrequencia", () => {
  it("calcula pela formula da NBR 14280", () => {
    // 2 acidentes em 200.000 HHT = 10 por milhao.
    expect(taxaFrequencia(2, 200_000)).toBe(10);
  });

  it("zero acidente com HHT informado da taxa zero", () => {
    // Zero aqui e resposta: nao houve acidente.
    expect(taxaFrequencia(0, 200_000)).toBe(0);
  });

  it("sem HHT devolve null, nao zero", () => {
    // Zero seria lido como "nenhum acidente por milhao de horas", o oposto de
    // "nao sei".
    expect(taxaFrequencia(3, null)).toBeNull();
    expect(taxaFrequencia(3, undefined)).toBeNull();
    expect(taxaFrequencia(3, 0)).toBeNull();
  });

  it("HHT negativo nao produz taxa", () => {
    expect(taxaFrequencia(3, -100)).toBeNull();
  });
});

describe("taxaGravidade", () => {
  it("soma dias perdidos e debitados", () => {
    // 30 perdidos + 6000 debitados (obito) em 1.000.000 HHT = 6030.
    expect(taxaGravidade(30, 6000, 1_000_000)).toBe(6030);
  });

  it("ignorar dias debitados faria obito pesar menos que afastamento longo", () => {
    const comObito = taxaGravidade(0, 6000, 1_000_000);
    const afastamentoLongo = taxaGravidade(30, 0, 1_000_000);
    expect(comObito).toBeGreaterThan(afastamentoLongo as number);
  });

  it("sem HHT devolve null", () => {
    expect(taxaGravidade(30, 0, null)).toBeNull();
  });

  it("zero dia com HHT informado da gravidade zero", () => {
    expect(taxaGravidade(0, 0, 500_000)).toBe(0);
  });
});

describe("percentualConformidade", () => {
  it("calcula sobre os itens avaliados", () => {
    expect(percentualConformidade(8, 2)).toBe(80);
  });

  it("tudo conforme da 100%", () => {
    expect(percentualConformidade(5, 0)).toBe(100);
  });

  it("nada avaliado devolve null, nao 100%", () => {
    // 100% diria "tudo conforme" sobre inspecao que nao avaliou nada.
    expect(percentualConformidade(0, 0)).toBeNull();
  });
});

describe("variacaoPercentual", () => {
  it("calcula alta e queda", () => {
    expect(variacaoPercentual(12, 10)).toBeCloseTo(20);
    expect(variacaoPercentual(8, 10)).toBeCloseTo(-20);
  });

  it("de zero para zero e variacao zero", () => {
    expect(variacaoPercentual(0, 0)).toBe(0);
  });

  it("de zero para algo nao e calculavel", () => {
    // Nao existe percentual de aumento sobre base zero.
    expect(variacaoPercentual(5, 0)).toBeNull();
  });

  it("com null em qualquer lado devolve null", () => {
    expect(variacaoPercentual(null, 10)).toBeNull();
    expect(variacaoPercentual(10, null)).toBeNull();
  });
});

describe("formatacao", () => {
  it("formata taxa com duas casas e virgula", () => {
    expect(formatarTaxa(10.456)).toBe("10,46");
  });

  it("taxa nula sai como travessao", () => {
    expect(formatarTaxa(null)).toBe("—");
  });

  it("formata percentual com uma casa", () => {
    expect(formatarPercentual(66.666)).toBe("66,7%");
    expect(formatarPercentual(100)).toBe("100,0%");
  });

  it("arredonda como o toFixed do JS, inclusive nos casos de borda binaria", () => {
    // 82,35 nao e exatamente representavel em ponto flutuante e cai logo abaixo
    // de 82,35, entao toFixed(1) devolve 82,3 e nao 82,4. Documentado aqui para
    // ninguem tratar isso como bug depois: o desvio e de 0,1 ponto percentual
    // num indicador de acompanhamento, nao num limite de tolerancia.
    expect(formatarPercentual(82.35)).toBe("82,3%");
  });

  it("percentual nulo sai como travessao", () => {
    expect(formatarPercentual(null)).toBe("—");
  });
});

describe("comAfastamento", () => {
  it("reconhece pelo tipo declarado", () => {
    expect(
      comAfastamento({ tipo: "Acidente com Afastamento", data_ocorrencia: "2026-01-01" })
    ).toBe(true);
  });

  it("reconhece por dias perdidos mesmo com tipo genérico", () => {
    // Deixar de contar subestimaria a taxa — o erro que faz o indicador mentir
    // para melhor.
    expect(
      comAfastamento({ tipo: "Acidente", data_ocorrencia: "2026-01-01", dias_perdidos: 15 })
    ).toBe(true);
  });

  it("acidente sem afastamento e sem dias perdidos nao conta", () => {
    expect(
      comAfastamento({
        tipo: "Acidente sem Afastamento",
        data_ocorrencia: "2026-01-01",
        dias_perdidos: 0,
      })
    ).toBe(false);
  });

  it("dias perdidos nulo nao conta como afastamento", () => {
    expect(
      comAfastamento({ tipo: "Acidente", data_ocorrencia: "2026-01-01", dias_perdidos: null })
    ).toBe(false);
  });
});

describe("eAcidente", () => {
  it("quase acidente nao e acidente", () => {
    expect(eAcidente({ tipo: "Quase Acidente", data_ocorrencia: "2026-01-01" })).toBe(false);
  });

  it("incidente nao e acidente", () => {
    expect(eAcidente({ tipo: "Incidente", data_ocorrencia: "2026-01-01" })).toBe(false);
  });

  it("as tres formas de acidente contam", () => {
    for (const tipo of ["Acidente", "Acidente com Afastamento", "Acidente sem Afastamento"]) {
      expect(eAcidente({ tipo, data_ocorrencia: "2026-01-01" })).toBe(true);
    }
  });
});

describe("consolidarIndicadores", () => {
  const incidentes: IncidenteIndicador[] = [
    {
      tipo: "Acidente com Afastamento",
      data_ocorrencia: "2026-03-10",
      dias_perdidos: 12,
      cat_emitida: true,
    },
    {
      tipo: "Acidente sem Afastamento",
      data_ocorrencia: "2026-04-02",
      dias_perdidos: 0,
      cat_emitida: false,
    },
    { tipo: "Quase Acidente", data_ocorrencia: "2026-04-15" },
    { tipo: "Quase Acidente", data_ocorrencia: "2026-05-20" },
    { tipo: "Quase Acidente", data_ocorrencia: "2026-06-01" },
  ];

  it("separa acidentes com e sem afastamento", () => {
    const r = consolidarIndicadores({ incidentes, hht: 200_000 });
    expect(r.acidentesComAfastamento).toBe(1);
    expect(r.acidentesSemAfastamento).toBe(1);
    expect(r.quaseAcidentes).toBe(3);
  });

  it("calcula as tres taxas", () => {
    const r = consolidarIndicadores({ incidentes, hht: 200_000 });
    expect(r.taxaFrequencia).toBe(5); // 1 com afastamento
    expect(r.taxaFrequenciaTotal).toBe(10); // 2 acidentes
    expect(r.taxaGravidade).toBe(60); // 12 dias
  });

  it("sem HHT as taxas ficam nulas mas as contagens continuam", () => {
    const r = consolidarIndicadores({ incidentes, hht: null });
    expect(r.taxaFrequencia).toBeNull();
    expect(r.taxaGravidade).toBeNull();
    expect(r.acidentesComAfastamento).toBe(1);
    expect(r.hht).toBeNull();
  });

  it("acusa afastamento sem CAT", () => {
    const r = consolidarIndicadores({
      incidentes: [
        {
          tipo: "Acidente com Afastamento",
          data_ocorrencia: "2026-03-10",
          dias_perdidos: 5,
          cat_emitida: false,
        },
      ],
      hht: 100_000,
    });
    expect(r.afastamentosSemCat).toBe(1);
  });

  it("nao acusa CAT ausente em acidente sem afastamento", () => {
    const r = consolidarIndicadores({ incidentes, hht: 100_000 });
    // O sem afastamento tem cat_emitida false, mas nao entra na conta.
    expect(r.afastamentosSemCat).toBe(0);
  });

  it("razao de quase-acidente por acidente", () => {
    const r = consolidarIndicadores({ incidentes, hht: 200_000 });
    expect(r.razaoQuaseAcidente).toBeCloseTo(1.5);
  });

  it("sem acidente a razao e nula, nao infinita nem otima", () => {
    const r = consolidarIndicadores({
      incidentes: [{ tipo: "Quase Acidente", data_ocorrencia: "2026-01-01" }],
      hht: 100_000,
    });
    expect(r.razaoQuaseAcidente).toBeNull();
  });

  it("lista vazia nao quebra e nao inventa numero", () => {
    const r = consolidarIndicadores({ incidentes: [], hht: 100_000 });
    expect(r.taxaFrequencia).toBe(0);
    expect(r.razaoQuaseAcidente).toBeNull();
    expect(r.diasPerdidos).toBe(0);
  });

  it("preserva a origem do HHT para a tela qualificar a taxa", () => {
    const r = consolidarIndicadores({
      incidentes,
      hht: 200_000,
      origemHht: "DIARIO_OBRA",
    });
    expect(r.origemHht).toBe("DIARIO_OBRA");
  });
});

describe("consolidarInspecoes", () => {
  it("conta por resposta e calcula conformidade", () => {
    const r = consolidarInspecoes([
      { resposta: "CONFORME" },
      { resposta: "CONFORME" },
      { resposta: "NAO_CONFORME" },
      { resposta: "NAO_APLICAVEL" },
      { resposta: "PENDENTE" },
    ]);
    expect(r).toMatchObject({
      conformes: 2,
      naoConformes: 1,
      naoAplicaveis: 1,
      pendentes: 1,
    });
    expect(r.conformidade).toBeCloseTo(66.67, 1);
  });

  it("pendente e nao aplicavel ficam fora do denominador", () => {
    // Item pendente ainda nao foi avaliado; conta-lo como nao conforme puniria
    // inspecao em andamento.
    const r = consolidarInspecoes([
      { resposta: "CONFORME" },
      { resposta: "PENDENTE" },
      { resposta: "NAO_APLICAVEL" },
    ]);
    expect(r.conformidade).toBe(100);
  });

  it("nenhum item avaliado devolve conformidade nula", () => {
    const r = consolidarInspecoes([{ resposta: "PENDENTE" }]);
    expect(r.conformidade).toBeNull();
  });

  it("lista vazia nao quebra", () => {
    expect(consolidarInspecoes([]).conformidade).toBeNull();
  });
});

describe("consolidarPlanoAcao", () => {
  const medidas: MedidaIndicador[] = [
    {
      status: "implementado",
      prazo: "2026-06-01",
      data_implementacao: "2026-05-20",
      resultado_verificacao: "EFICAZ",
    },
    {
      status: "implementado",
      prazo: "2026-06-01",
      data_implementacao: "2026-07-10",
      resultado_verificacao: null,
    },
    { status: "pendente", prazo: "2026-07-01" },
    { status: "em_andamento", prazo: "2027-01-01" },
    { status: "cancelado", prazo: "2026-01-01" },
  ];

  it("conta implementadas e no prazo", () => {
    const r = consolidarPlanoAcao(medidas, HOJE);
    expect(r.implementadas).toBe(2);
    expect(r.noPrazo).toBe(1);
  });

  it("atrasada conta so o que continua aberto com prazo vencido", () => {
    // Medida entregue com atraso ja foi entregue; misturar as duas coisas
    // tiraria a utilidade do indicador para cobranca.
    const r = consolidarPlanoAcao(medidas, HOJE);
    expect(r.atrasadas).toBe(1); // a pendente de 2026-07-01
  });

  it("cancelada nao conta como atrasada nem entra no percentual", () => {
    const r = consolidarPlanoAcao(medidas, HOJE);
    // 2 implementadas de 4 consideradas (a cancelada sai).
    expect(r.percentualImplementado).toBe(50);
  });

  it("acusa implementada sem afericao", () => {
    const r = consolidarPlanoAcao(medidas, HOJE);
    expect(r.semAfericao).toBe(1);
  });

  it("conta ineficazes", () => {
    const r = consolidarPlanoAcao(
      [{ status: "implementado", resultado_verificacao: "INEFICAZ" }],
      HOJE
    );
    expect(r.ineficazes).toBe(1);
  });

  it("medida sem prazo nao e atraso e conta como no prazo", () => {
    const r = consolidarPlanoAcao(
      [{ status: "implementado", prazo: null, data_implementacao: "2026-01-01" }],
      HOJE
    );
    expect(r.noPrazo).toBe(1);
    expect(r.atrasadas).toBe(0);
  });

  it("implementada sem data de implementacao nao conta como no prazo", () => {
    // Sem a data nao da para afirmar que foi dentro do prazo.
    const r = consolidarPlanoAcao(
      [{ status: "implementado", prazo: "2026-06-01", data_implementacao: null }],
      HOJE
    );
    expect(r.implementadas).toBe(1);
    expect(r.noPrazo).toBe(0);
  });

  it("implementada exatamente no prazo conta como no prazo", () => {
    const r = consolidarPlanoAcao(
      [{ status: "implementado", prazo: "2026-06-01", data_implementacao: "2026-06-01" }],
      HOJE
    );
    expect(r.noPrazo).toBe(1);
  });

  it("lista vazia devolve percentual nulo, nao zero", () => {
    const r = consolidarPlanoAcao([], HOJE);
    expect(r.percentualImplementado).toBeNull();
    expect(r.total).toBe(0);
  });

  it("so canceladas devolve percentual nulo", () => {
    const r = consolidarPlanoAcao([{ status: "cancelado" }], HOJE);
    expect(r.percentualImplementado).toBeNull();
  });
});

/**
 * O teste de contrato de schema varre `.from("literal")`, e o hook de
 * indicadores monta a consulta com nome de tabela em variavel — ficou de fora.
 *
 * Isto pegou um erro real: eu havia escrito `inspecao.data_inspecao`, coluna que
 * nao existe (o nome e `data_planejada`). O typecheck passa, porque o cast
 * esconde, e o hook e resiliente — ele marcaria "Inspecoes" como indisponivel e
 * o indicador nunca funcionaria, em silencio.
 */
describe("colunas usadas pelos indicadores existem nas migrations", () => {
  const ROOT = resolve(__dirname, "../../../..");
  const DIR = resolve(ROOT, "supabase/migrations");

  const sqlCompleto = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(DIR, f), "utf8"))
    .join("\n")
    // Remove comentários de linha ANTES de parsear. Sem isto, um ";" escrito
    // dentro de um comentário encerra o statement aos olhos da regex e corta as
    // colunas que vêm depois — foi exatamente o que aconteceu na primeira
    // execução deste teste, com um "(fase 3 do PCMSO);" num comentário.
    .replace(/--[^\n]*/g, "");

  /** Extrai as colunas declaradas de uma tabela, somando CREATE e ALTER. */
  function colunasDe(tabela: string): Set<string> {
    const colunas = new Set<string>();

    // String.raw de propósito: num template literal comum, `\s` vira `s` (não é
    // escape reconhecido em JS), e a regex passa a casar a letra s em vez de
    // espaço. Foi assim que a primeira versão deste teste nasceu quebrada.
    const criacao = sqlCompleto.match(
      new RegExp(
        String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?` +
          tabela +
          String.raw`\s*\(([\s\S]*?)\r?\n\s*\);`,
        "i"
      )
    );

    if (criacao) {
      for (const linha of criacao[1].split("\n")) {
        const m = linha.trim().match(/^([a-z0-9_]+)\s+[a-z]/i);
        if (m && !/^(constraint|primary|unique|foreign|check)$/i.test(m[1])) {
          colunas.add(m[1].toLowerCase());
        }
      }
    }

    for (const alter of sqlCompleto.matchAll(
      new RegExp(
        String.raw`alter\s+table\s+(?:public\.)?` + tabela + String.raw`\s*([\s\S]*?);`,
        "gi"
      )
    )) {
      for (const add of alter[1].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi)) {
        colunas.add(add[1].toLowerCase());
      }
    }

    return colunas;
  }

  const dependencias: Record<string, string[]> = {
    sgsst_incidentes: [
      "tipo",
      "data_ocorrencia",
      "dias_perdidos",
      "dias_debitados",
      "cat_emitida",
      "projeto_id",
    ],
    sgsst_hht: ["horas", "origem", "projeto_id", "ano", "mes"],
    sgsst_inspecoes_itens: ["resposta", "inspecao_id"],
    sgsst_inspecoes: ["data_planejada", "status", "projeto_id"],
    sgsst_pgr_medidas_controle: [
      "status",
      "prazo",
      "data_implementacao",
      "resultado_verificacao",
    ],
    diario_equipe: ["horas", "diario_id"],
  };

  it("as tabelas dependentes foram encontradas (o teste nao passa por vacuidade)", () => {
    for (const tabela of Object.keys(dependencias)) {
      expect(colunasDe(tabela).size, `nenhuma coluna lida de ${tabela}`).toBeGreaterThan(3);
    }
  });

  it("toda coluna usada pelos indicadores existe", () => {
    const ausentes: string[] = [];

    for (const [tabela, colunas] of Object.entries(dependencias)) {
      const declaradas = colunasDe(tabela);
      for (const coluna of colunas) {
        if (!declaradas.has(coluna)) ausentes.push(`${tabela}.${coluna}`);
      }
    }

    expect(ausentes).toEqual([]);
  });
});
