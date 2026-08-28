import { describe, it, expect } from "vitest";
import {
  podeEmitirGuia,
  grupoDaGuia,
  ocasioesDoGrupo,
  pendenciasDaGuia,
  SIGNIFICADO_DO_STATUS,
  type ExameParaGuia,
} from "@/utils/sgsstGuiaExame";
import { montarHtmlGuiaExame, type GuiaExameDados } from "@/lib/guiaExameDocumento";

const exame = (p: Partial<ExameParaGuia>): ExameParaGuia => ({
  id: p.id ?? "e1",
  colaborador_id: p.colaborador_id ?? "c1",
  nome_exame: p.nome_exame ?? "Audiometria",
  tipo: p.tipo ?? "Admissional",
  natureza: p.natureza ?? "COMPLEMENTAR",
  status: p.status ?? "PENDENTE",
  data_solicitacao: p.data_solicitacao ?? "2026-08-28",
  data_agendada: p.data_agendada ?? null,
  hora_agendada: p.hora_agendada ?? null,
  clinica_id: p.clinica_id ?? null,
  observacoes: p.observacoes ?? null,
});

describe("podeEmitirGuia", () => {
  it("libera antes de o exame acontecer", () => {
    expect(podeEmitirGuia("PENDENTE").pode).toBe(true);
    expect(podeEmitirGuia("AGENDADO").pode).toBe(true);
  });

  it("bloqueia depois de realizado, apontando o ASO", () => {
    const r = podeEmitirGuia("REALIZADO");
    // `pode === false` estreita a união pelo discriminante; o `if (r.pode)`
    // sozinho não bastava para o compilador enxergar `motivo`.
    if (r.pode !== false) throw new Error("deveria bloquear");
    expect(r.motivo).toContain("ASO");
  });

  it("bloqueia cancelado", () => {
    expect(podeEmitirGuia("CANCELADO").pode).toBe(false);
  });
});

describe("SIGNIFICADO_DO_STATUS", () => {
  it("explica os quatro status", () => {
    expect(Object.keys(SIGNIFICADO_DO_STATUS)).toEqual([
      "PENDENTE",
      "AGENDADO",
      "REALIZADO",
      "CANCELADO",
    ]);
  });

  it("diz que só há resultado a partir de REALIZADO", () => {
    expect(SIGNIFICADO_DO_STATUS.REALIZADO).toContain("resultado");
  });
});

describe("grupoDaGuia", () => {
  it("reúne todos os exames pendentes do MESMO trabalhador", () => {
    const g = grupoDaGuia(
      [
        exame({ id: "1", colaborador_id: "c1", nome_exame: "Audiometria" }),
        exame({ id: "2", colaborador_id: "c1", nome_exame: "Espirometria" }),
        exame({ id: "3", colaborador_id: "c2", nome_exame: "Audiometria" }),
      ],
      "c1"
    );
    expect(g?.exames.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("o exame CLÍNICO vem primeiro — é a consulta que orienta os complementares", () => {
    const g = grupoDaGuia(
      [
        exame({ id: "1", nome_exame: "Audiometria", natureza: "COMPLEMENTAR" }),
        exame({ id: "2", nome_exame: "Avaliação clínica", natureza: "CLINICO" }),
      ],
      "c1"
    );
    expect(g?.exames[0].nome_exame).toBe("Avaliação clínica");
  });

  it("exclui exame já realizado ou cancelado", () => {
    const g = grupoDaGuia(
      [
        exame({ id: "1", status: "REALIZADO" }),
        exame({ id: "2", status: "CANCELADO" }),
        exame({ id: "3", status: "AGENDADO" }),
      ],
      "c1"
    );
    expect(g?.exames.map((e) => e.id)).toEqual(["3"]);
  });

  it("devolve null quando não sobra nada a encaminhar", () => {
    expect(grupoDaGuia([exame({ status: "REALIZADO" })], "c1")).toBeNull();
  });

  it("só afirma a clínica quando TODOS os exames concordam", () => {
    const iguais = grupoDaGuia(
      [
        exame({ id: "1", clinica_id: "cl1" }),
        exame({ id: "2", clinica_id: "cl1" }),
      ],
      "c1"
    );
    expect(iguais?.clinicaId).toBe("cl1");

    // Divergindo, não afirma nenhuma: mandar o trabalhador ao endereço errado é
    // pior que não informar endereço.
    const divergentes = grupoDaGuia(
      [
        exame({ id: "1", clinica_id: "cl1" }),
        exame({ id: "2", clinica_id: "cl2" }),
      ],
      "c1"
    );
    expect(divergentes?.clinicaId).toBeNull();
  });
});

describe("pendenciasDaGuia", () => {
  const grupo = grupoDaGuia([exame({})], "c1")!;

  it("guia completa não gera pendência", () => {
    const p = pendenciasDaGuia({
      grupo,
      riscosDaFuncao: [{}],
      temFuncao: true,
      temClinica: true,
      temMedicoCoordenador: true,
    });
    expect(p).toEqual([]);
  });

  it("não acusa 'função sem risco' enquanto os riscos não carregaram", () => {
    const p = pendenciasDaGuia({
      grupo,
      riscosDaFuncao: null,
      temFuncao: true,
      temClinica: true,
      temMedicoCoordenador: true,
    });
    expect(p.join(" ")).not.toContain("não tem risco");
  });

  it("acusa função sem risco quando consultou e veio vazio", () => {
    const p = pendenciasDaGuia({
      grupo,
      riscosDaFuncao: [],
      temFuncao: true,
      temClinica: true,
      temMedicoCoordenador: true,
    });
    expect(p.join(" ")).toContain("7.4.2");
  });

  it("avisa quando a guia mistura ocasiões", () => {
    const misto = grupoDaGuia(
      [
        exame({ id: "1", tipo: "Admissional" }),
        exame({ id: "2", tipo: "Periódico" }),
      ],
      "c1"
    )!;
    expect(ocasioesDoGrupo(misto)).toHaveLength(2);
    const p = pendenciasDaGuia({
      grupo: misto,
      riscosDaFuncao: [{}],
      temFuncao: true,
      temClinica: true,
      temMedicoCoordenador: true,
    });
    expect(p.join(" ")).toContain("mais de uma ocasião");
  });
});

/** Só o corpo do documento: os blocos <style> são compartilhados com o ASO. */
function corpoSemEstilo(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "");
}

/** Espaço normalizado: o HTML quebra frases entre linhas. */
function umaLinha(html: string): string {
  return html.replace(/\s+/g, " ");
}

describe("montarHtmlGuiaExame", () => {
  const base = (over: Partial<GuiaExameDados> = {}): GuiaExameDados => ({
    grupo: grupoDaGuia([exame({ nome_exame: "Audiometria" })], "c1")!,
    trabalhador: {
      nome: "BRUNO SOUZA DA SILVA",
      cpf: "000.000.000-00",
      funcaoNome: "Montador de Estruturas",
    },
    empresa: { nome: "AIVX", cnpj: "58.106.347/0001-01" },
    riscos: [{ categoria: "Físico", agente: "Ruído contínuo", exposicao: "HABITUAL" }],
    pcmso: { medicoResponsavel: "Dra. Ana Prado", crmMedico: "CRM 123" },
    ...over,
  });

  it("NUNCA traz aptidão, resultado ou conclusão", () => {
    // A regra central: a guia é o pedido, não a resposta. Campo de aptidão em
    // papel emitido pelo empregador é exatamente o que não pode existir.
    //
    // A checagem ignora os blocos <style>: a folha é compartilhada com o ASO e
    // declara `.doc-apto` / `.doc-inapto`. Classe declarada e não usada não sai no
    // papel, e checar o HTML cru acusaria um problema que não existe.
    const corpo = corpoSemEstilo(montarHtmlGuiaExame(base())).toLowerCase();

    expect(corpo).not.toMatch(/\bapto\b/);
    expect(corpo).not.toMatch(/\binapto\b/);
    expect(corpo).not.toContain("conclusão de aptidão");
    expect(corpo).not.toContain("resultado do exame");
  });

  it("diz explicitamente que não é o ASO", () => {
    // Normaliza o espaço porque o HTML quebra a frase entre linhas.
    const texto = umaLinha(montarHtmlGuiaExame(base()));
    expect(texto).toContain("não atesta aptidão");
    expect(texto).toContain("ASO");
  });

  it("leva os riscos, que é o que o médico precisa para definir o escopo", () => {
    const html = montarHtmlGuiaExame(base());
    expect(html).toContain("Ruído contínuo");
    expect(html).toContain("7.4.2");
  });

  it("riscos não consultados não viram 'função sem risco'", () => {
    const html = montarHtmlGuiaExame(base({ riscos: null }));
    expect(html).toContain("não consultados nesta emissão");
    expect(html).not.toContain("Nenhum risco ocupacional está vinculado");
  });

  it("riscos consultados e vazios avisam, sem inventar escopo", () => {
    const html = montarHtmlGuiaExame(base({ riscos: [] }));
    expect(html).toContain("Nenhum risco ocupacional está vinculado");
  });

  it("sem clínica, avisa em vez de sair com endereço em branco", () => {
    const html = montarHtmlGuiaExame(base({ clinica: null }));
    expect(html).toContain("Clínica de destino não definida");
  });

  it("lista todos os exames solicitados", () => {
    const html = montarHtmlGuiaExame(
      base({
        grupo: grupoDaGuia(
          [
            exame({ id: "1", nome_exame: "Audiometria" }),
            exame({ id: "2", nome_exame: "Espirometria" }),
          ],
          "c1"
        )!,
      })
    );
    expect(html).toContain("Audiometria");
    expect(html).toContain("Espirometria");
    expect(html).toContain("2 exame(s) solicitado(s)");
  });

  it("função ausente é marcada, não omitida", () => {
    const html = montarHtmlGuiaExame(
      base({ trabalhador: { nome: "Fulano", funcaoNome: null } })
    );
    expect(html).toContain("função não cadastrada");
  });
});
