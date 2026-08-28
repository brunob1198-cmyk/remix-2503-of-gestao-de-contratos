import { describe, it, expect } from "vitest";
import {
  proximoCodigoGhe,
  codigoEmUso,
  cabecalhoDoGhe,
  matrizExamesDoGhe,
  riscosDoGhe,
  divergenciaDeQuantidade,
  quadroDeFuncoes,
  pendenciasDoGhe,
  OCASIOES_EXAME,
  type ExamePrevistoGhe,
  type RiscoDoInventario,
} from "@/utils/sgsstGhe";

const exame = (p: Partial<ExamePrevistoGhe>): ExamePrevistoGhe => ({
  id: p.id ?? "e1",
  nome_exame: p.nome_exame ?? "Audiometria",
  tipo_exame: p.tipo_exame ?? "Admissional",
  periodicidade_meses: p.periodicidade_meses ?? null,
  funcao_id: p.funcao_id ?? null,
  ghe_id: p.ghe_id ?? null,
});

const risco = (p: Partial<RiscoDoInventario>): RiscoDoInventario => ({
  id: p.id ?? "r1",
  ghe_id: p.ghe_id ?? null,
  categoria: p.categoria ?? "Físico",
  agente: p.agente ?? "Ruído contínuo",
  danos_saude: p.danos_saude ?? "Perda auditiva induzida por ruído",
  funcaoIds: p.funcaoIds ?? [],
});

describe("proximoCodigoGhe", () => {
  it("começa em GHE-01 quando não há nenhum", () => {
    expect(proximoCodigoGhe([])).toBe("GHE-01");
  });

  it("continua do MAIOR número, não da quantidade de grupos", () => {
    // Com GHE-01 e GHE-07 existindo, sugerir GHE-03 (quantidade + 1) faria o
    // código voltar a um número que pode ter sido usado e excluído — e um código
    // citado em documento emitido passaria a apontar para outro grupo.
    expect(proximoCodigoGhe(["GHE-01", "GHE-07"])).toBe("GHE-08");
  });

  it("aceita formato próprio da empresa e aproveita o número final", () => {
    expect(proximoCodigoGhe(["ADM-02", "OPER-05"])).toBe("GHE-06");
  });

  it("ignora código sem número em vez de quebrar", () => {
    expect(proximoCodigoGhe(["ADMINISTRATIVO", "GHE-02"])).toBe("GHE-03");
  });
});

describe("codigoEmUso", () => {
  const existentes = [
    { id: "a", codigo: "GHE-01" },
    { id: "b", codigo: "ghe-02" },
  ];

  it("compara sem caixa e sem espaço, como o índice único do banco", () => {
    expect(codigoEmUso(" ghe-01 ", existentes)).toBe(true);
    expect(codigoEmUso("GHE-02", existentes)).toBe(true);
  });

  it("não acusa conflito do grupo consigo mesmo ao editar", () => {
    // Sem isto, renomear o NOME do grupo sem tocar no código travaria a gravação.
    expect(codigoEmUso("GHE-01", existentes, "a")).toBe(false);
  });

  it("código vazio não é conflito — é campo obrigatório, tratado no formulário", () => {
    expect(codigoEmUso("", existentes)).toBe(false);
  });
});

describe("cabecalhoDoGhe", () => {
  it("omite o campo vazio em vez de imprimir rótulo sem valor", () => {
    const linhas = cabecalhoDoGhe({
      id: "g1",
      codigo: "GHE-01",
      nome: "Administrativo",
      setor: "ADMINISTRATIVO",
      area_influencia: "   ",
      carga_horaria: "44 horas semanais",
    });
    expect(linhas.map((l) => l.rotulo)).toEqual(["Setor", "Carga horária"]);
  });
});

describe("matrizExamesDoGhe", () => {
  it("distingue não carregado de vazio", () => {
    expect(matrizExamesDoGhe({ exames: null, gheId: "g1", funcaoIdsDoGhe: [] }).situacao).toBe(
      "DESCONHECIDO"
    );
    expect(matrizExamesDoGhe({ exames: [], gheId: "g1", funcaoIdsDoGhe: [] }).situacao).toBe(
      "SEM_EXAME"
    );
  });

  it("reúne exame do grupo e exame de função do grupo na mesma linha", () => {
    const r = matrizExamesDoGhe({
      exames: [
        exame({ id: "1", ghe_id: "g1", tipo_exame: "Admissional" }),
        exame({ id: "2", funcao_id: "f1", tipo_exame: "Periódico", periodicidade_meses: 12 }),
      ],
      gheId: "g1",
      funcaoIdsDoGhe: ["f1"],
    });
    if (r.situacao !== "OK") throw new Error(r.situacao);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].celulas.Admissional.origens).toEqual(["GRUPO"]);
    expect(r.linhas[0].celulas["Periódico"].origens).toEqual(["FUNCAO"]);
    expect(r.linhas[0].celulas["Periódico"].periodicidade).toBe("12 meses");
  });

  it("não puxa exame de função que não está no grupo", () => {
    const r = matrizExamesDoGhe({
      exames: [exame({ funcao_id: "outra" })],
      gheId: "g1",
      funcaoIdsDoGhe: ["f1"],
    });
    expect(r.situacao).toBe("SEM_EXAME");
  });

  it("periodicidades conflitantes: vence a menor", () => {
    // Duas previsões para o mesmo exame no mesmo grupo, uma anual e uma
    // semestral. Cumprir a semestral atende as duas; cumprir a anual deixa uma
    // previsão descumprida.
    const r = matrizExamesDoGhe({
      exames: [
        exame({ id: "1", ghe_id: "g1", tipo_exame: "Periódico", periodicidade_meses: 12 }),
        exame({ id: "2", funcao_id: "f1", tipo_exame: "Periódico", periodicidade_meses: 6 }),
      ],
      gheId: "g1",
      funcaoIdsDoGhe: ["f1"],
    });
    if (r.situacao !== "OK") throw new Error(r.situacao);
    expect(r.linhas[0].celulas["Periódico"].periodicidade).toBe("6 meses");
    // A ordem inversa tem de dar o mesmo resultado.
    const inverso = matrizExamesDoGhe({
      exames: [
        exame({ id: "2", funcao_id: "f1", tipo_exame: "Periódico", periodicidade_meses: 6 }),
        exame({ id: "1", ghe_id: "g1", tipo_exame: "Periódico", periodicidade_meses: 12 }),
      ],
      gheId: "g1",
      funcaoIdsDoGhe: ["f1"],
    });
    if (inverso.situacao !== "OK") throw new Error(inverso.situacao);
    expect(inverso.linhas[0].celulas["Periódico"].periodicidade).toBe("6 meses");
  });

  it("tipo desconhecido cai em Outros em vez de desaparecer", () => {
    const r = matrizExamesDoGhe({
      exames: [exame({ ghe_id: "g1", tipo_exame: "Toxicológico" })],
      gheId: "g1",
      funcaoIdsDoGhe: [],
    });
    if (r.situacao !== "OK") throw new Error(r.situacao);
    expect(r.linhas[0].celulas.Outros.previsto).toBe(true);
  });

  it("ocasioesUsadas traz só as colunas com marcação, na ordem do documento", () => {
    const r = matrizExamesDoGhe({
      exames: [
        exame({ id: "1", ghe_id: "g1", tipo_exame: "Demissional" }),
        exame({ id: "2", ghe_id: "g1", tipo_exame: "Admissional" }),
      ],
      gheId: "g1",
      funcaoIdsDoGhe: [],
    });
    if (r.situacao !== "OK") throw new Error(r.situacao);
    expect(r.ocasioesUsadas).toEqual(["Admissional", "Demissional"]);
    expect(r.ocasioesUsadas.length).toBeLessThan(OCASIOES_EXAME.length);
  });

  it("exame sem nome não cria linha fantasma", () => {
    const r = matrizExamesDoGhe({
      exames: [exame({ ghe_id: "g1", nome_exame: "   " })],
      gheId: "g1",
      funcaoIdsDoGhe: [],
    });
    expect(r.situacao).toBe("SEM_EXAME");
  });
});

describe("riscosDoGhe", () => {
  it("distingue não carregado de vazio", () => {
    expect(riscosDoGhe({ inventario: null, gheId: "g1", funcaoIdsDoGhe: [] }).situacao).toBe(
      "DESCONHECIDO"
    );
    expect(riscosDoGhe({ inventario: [], gheId: "g1", funcaoIdsDoGhe: [] }).situacao).toBe(
      "SEM_RISCO"
    );
  });

  it("alcança pelo grupo e pelas funções, sem duplicar o mesmo agente", () => {
    const r = riscosDoGhe({
      inventario: [
        risco({ id: "1", ghe_id: "g1" }),
        risco({ id: "2", funcaoIds: ["f1"] }),
      ],
      gheId: "g1",
      funcaoIdsDoGhe: ["f1"],
    });
    if (r.situacao !== "OK") throw new Error(r.situacao);
    expect(r.riscos).toHaveLength(1);
    expect(r.riscos[0].origens.sort()).toEqual(["FUNCAO", "GRUPO"]);
  });

  it("aproveita a descrição de dano que existe quando a primeira leitura veio vazia", () => {
    const r = riscosDoGhe({
      inventario: [
        risco({ id: "1", ghe_id: "g1", danos_saude: "" }),
        risco({ id: "2", ghe_id: "g1", danos_saude: "Perda auditiva" }),
      ],
      gheId: "g1",
      funcaoIdsDoGhe: [],
    });
    if (r.situacao !== "OK") throw new Error(r.situacao);
    expect(r.riscos[0].danos).toBe("Perda auditiva");
  });
});

describe("divergenciaDeQuantidade", () => {
  it("silencia quando falta um dos dois números", () => {
    expect(divergenciaDeQuantidade({ declarada: null, contada: 5 }).aviso).toBe("");
    expect(divergenciaDeQuantidade({ declarada: 5, contada: null }).aviso).toBe("");
  });

  it("zero declarado é declaração, não ausência", () => {
    // `typeof 0 === "number"`: um grupo declarado com zero trabalhadores é
    // informação (grupo previsto e ainda não provido). Tratar 0 como "não
    // informado" apagaria a diferença.
    const d = divergenciaDeQuantidade({ declarada: 0, contada: 3 });
    expect(d.declarada).toBe(0);
    expect(d.aviso).toContain("(0)");
  });

  it("não avisa quando batem", () => {
    expect(divergenciaDeQuantidade({ declarada: 4, contada: 4 }).aviso).toBe("");
  });
});

describe("quadroDeFuncoes", () => {
  it("mantém no quadro a função SEM descrição, com a descrição vazia", () => {
    // Omitir a função sem texto faria o documento parecer completo com uma função
    // de menos — o oposto do que o quadro serve para mostrar.
    const q = quadroDeFuncoes({
      funcoes: [
        { id: "f1", nome: "Recepcionista", descricao: "Recebe e orienta visitantes." },
        { id: "f2", nome: "Estagiário", descricao: "  " },
      ],
    });
    expect(q).toHaveLength(2);
    expect(q.find((l) => l.nome === "Estagiário")?.descricao).toBe("");
  });

  it("numera na ordem alfabética apresentada", () => {
    const q = quadroDeFuncoes({
      funcoes: [
        { id: "f1", nome: "Vigia" },
        { id: "f2", nome: "Auxiliar" },
      ],
    });
    expect(q.map((l) => [l.ordem, l.nome])).toEqual([
      [1, "Auxiliar"],
      [2, "Vigia"],
    ]);
  });

  it("mostra os GHEs da função quando informados", () => {
    const q = quadroDeFuncoes({
      funcoes: [{ id: "f1", nome: "Eletricista" }],
      ghesPorFuncao: new Map([["f1", ["GHE-02", "GHE-05"]]]),
    });
    expect(q[0].ghes).toEqual(["GHE-02", "GHE-05"]);
  });
});

describe("pendenciasDoGhe", () => {
  const ghe = {
    id: "g1",
    codigo: "GHE-01",
    nome: "Operacional",
    setor: "OPERACIONAL",
    area_influencia: "OFICINA",
    carga_horaria: "44 horas semanais",
    quantidade_trabalhadores: 3,
  };

  it("grupo completo não gera pendência", () => {
    const p = pendenciasDoGhe({
      ghe,
      funcoes: [{ id: "f1", nome: "Mecânico", descricao: "Executa manutenção." }],
      matriz: { situacao: "OK", linhas: [], ocasioesUsadas: [] },
      riscos: { situacao: "OK", riscos: [] },
    });
    expect(p).toEqual([]);
  });

  it("não acusa lacuna quando a origem não carregou", () => {
    // DESCONHECIDO não vira pendência: seria afirmar que falta levantamento sem
    // ter conseguido olhar.
    const p = pendenciasDoGhe({
      ghe,
      funcoes: [{ id: "f1", nome: "Mecânico", descricao: "Executa manutenção." }],
      matriz: { situacao: "DESCONHECIDO" },
      riscos: { situacao: "DESCONHECIDO" },
    });
    expect(p).toEqual([]);
  });

  it("acusa quando carregou e está vazio", () => {
    const p = pendenciasDoGhe({
      ghe,
      funcoes: [{ id: "f1", nome: "Mecânico", descricao: "Executa manutenção." }],
      matriz: { situacao: "SEM_EXAME" },
      riscos: { situacao: "SEM_RISCO" },
    });
    expect(p.join(" ")).toContain("Nenhum risco do inventário");
    expect(p.join(" ")).toContain("Nenhum exame previsto");
  });

  it("nomeia as funções sem descrição detalhada", () => {
    const p = pendenciasDoGhe({
      ghe,
      funcoes: [
        { id: "f1", nome: "Mecânico", descricao: "" },
        { id: "f2", nome: "Soldador", descricao: null },
      ],
      matriz: { situacao: "OK", linhas: [], ocasioesUsadas: [] },
      riscos: { situacao: "OK", riscos: [] },
    });
    const texto = p.join(" ");
    expect(texto).toContain("2 funções sem descrição");
    expect(texto).toContain("Mecânico, Soldador");
  });

  it("grupo sem função é a pendência mais grave e aparece", () => {
    const p = pendenciasDoGhe({
      ghe,
      funcoes: [],
      matriz: { situacao: "OK", linhas: [], ocasioesUsadas: [] },
      riscos: { situacao: "OK", riscos: [] },
    });
    expect(p[0]).toContain("Nenhuma função vinculada");
  });

  it("quantidade não declarada gera pendência; zero declarado não", () => {
    const semDeclarar = pendenciasDoGhe({
      ghe: { ...ghe, quantidade_trabalhadores: null },
      funcoes: [{ id: "f1", nome: "Mecânico", descricao: "x" }],
      matriz: { situacao: "OK", linhas: [], ocasioesUsadas: [] },
      riscos: { situacao: "OK", riscos: [] },
    });
    expect(semDeclarar.join(" ")).toContain("não declarada");

    const zero = pendenciasDoGhe({
      ghe: { ...ghe, quantidade_trabalhadores: 0 },
      funcoes: [{ id: "f1", nome: "Mecânico", descricao: "x" }],
      matriz: { situacao: "OK", linhas: [], ocasioesUsadas: [] },
      riscos: { situacao: "OK", riscos: [] },
    });
    expect(zero.join(" ")).not.toContain("não declarada");
  });
});
