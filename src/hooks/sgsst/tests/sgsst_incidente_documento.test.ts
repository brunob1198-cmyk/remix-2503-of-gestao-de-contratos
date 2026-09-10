import { describe, it, expect } from "vitest";
import {
  acoesEmAbertoDoIncidente,
  diasTotais,
  exigeInvestigacao,
  houveLesao,
  montarHtmlIncidente,
  pendenciasIncidente,
  tipoContradizOsDias,
  type IncidenteDocumentoDados,
} from "@/lib/incidenteDocumento";
import type {
  SgsstIncidente,
  SgsstIncidenteAcao,
  SgsstIncidenteInvestigacao,
} from "@/hooks/sgsst/useSgsstIncidentes";

/**
 * O que estes testes protegem, em ordem de importancia:
 *
 * 1. Que o relatorio NAO esconda contradicao do registro. Documento de acidente
 *    que sai bonito com o dado incoerente e pior que documento nenhum: da
 *    aparencia de conformidade ao que nao esta conforme.
 * 2. Que dias debitados entrem na conta. A NBR 14280 debita 6.000 dias por obito;
 *    somar so os perdidos faria um obito pesar menos que um afastamento de 30 dias.
 * 3. Que a decisao de "houve lesao" venha dos DIAS e nao do rotulo escolhido no
 *    cadastro -- encontrado num registro real, "Quase Acidente" com 7 dias perdidos.
 */

const INCIDENTE: SgsstIncidente = {
  id: "inc1",
  empresa_id: "e1",
  projeto_id: "pj1",
  codigo: "ACID-AIVX-001",
  tipo: "Acidente com Afastamento",
  titulo: "ACIDENTE AIVX 001",
  descricao: "Queda durante montagem",
  local_ocorrencia: "Sala aivx Sede",
  data_ocorrencia: "2026-09-03",
  hora_ocorrencia: "16:09",
  gravidade: "ALTA",
  status: "REGISTRADO",
  dias_perdidos: 7,
  dias_debitados: 3,
  data_afastamento: "2026-09-03",
  data_retorno: "2026-09-10",
  cat_emitida: true,
  projeto: { id: "pj1", codigo: "0010.25", nome: "O&M Araguaia FO" },
  responsavel_registro: { id: "u1", nome: "BRUNO SOUZA DA SILVA" },
};

const INVESTIGACAO: SgsstIncidenteInvestigacao = {
  id: "invg1",
  empresa_id: "e1",
  incidente_id: "inc1",
  descricao_investigacao: "Entrevista com a equipe e inspecao do andaime.",
  fatos_observados: "Guarda-corpo ausente no vao norte.",
  causas_imediatas: "Trabalho em altura sem guarda-corpo.",
  causas_basicas: "Andaime liberado sem checklist de montagem.",
  causas_raiz: "Nao havia rotina de liberacao de andaime por pessoa habilitada.",
  conclusao: "Implantar liberacao formal de andaime.",
  responsavel: { id: "u2", nome: "RODRIGO TIAGO SANTOS" },
};

const acao = (over: Partial<SgsstIncidenteAcao> = {}): SgsstIncidenteAcao => ({
  id: "a1",
  empresa_id: "e1",
  incidente_id: "inc1",
  descricao: "Instalar guarda-corpo em todos os vaos",
  tipo: "CORRETIVA",
  prioridade: "ALTA",
  status: "ABERTA",
  prazo: "2026-09-20",
  responsavel: { id: "u2", nome: "RODRIGO TIAGO SANTOS" },
  ...over,
});

const dados = (over: Partial<IncidenteDocumentoDados> = {}): IncidenteDocumentoDados => ({
  incidente: INCIDENTE,
  envolvidos: [],
  investigacao: INVESTIGACAO,
  acoes: [acao()],
  empresa: { nome: "AIVX Tech", cnpj: "00.000.000/0001-00" },
  ...over,
});

describe("houveLesao", () => {
  it("dias perdidos caracterizam lesao", () => {
    expect(houveLesao({ ...INCIDENTE, dias_perdidos: 3, dias_debitados: 0 })).toBe(true);
  });

  it("dias DEBITADOS tambem caracterizam, mesmo sem dias perdidos", () => {
    // Obito e invalidez entram como debitados. Sem esta linha, o caso mais grave
    // de todos passaria como "sem lesao".
    expect(houveLesao({ ...INCIDENTE, dias_perdidos: 0, dias_debitados: 6000 })).toBe(true);
  });

  it("zero e nulo nao caracterizam", () => {
    expect(houveLesao({ ...INCIDENTE, dias_perdidos: 0, dias_debitados: 0 })).toBe(false);
    expect(houveLesao({ ...INCIDENTE, dias_perdidos: null, dias_debitados: null })).toBe(false);
  });

  it("valor negativo nao inventa lesao", () => {
    expect(houveLesao({ ...INCIDENTE, dias_perdidos: -5, dias_debitados: 0 })).toBe(false);
  });
});

describe("diasTotais", () => {
  it("soma perdidos e debitados", () => {
    expect(diasTotais({ ...INCIDENTE, dias_perdidos: 7, dias_debitados: 3 })).toBe(10);
  });

  it("ignora nulo e negativo em vez de propagar NaN", () => {
    expect(diasTotais({ ...INCIDENTE, dias_perdidos: null, dias_debitados: 5 })).toBe(5);
    expect(diasTotais({ ...INCIDENTE, dias_perdidos: -2, dias_debitados: 5 })).toBe(5);
  });
});

describe("tipoContradizOsDias", () => {
  it("quase acidente com dias lancados e contradicao", () => {
    // Registro real do usuario: tipo "Quase Acidente", 7 perdidos e 3 debitados.
    expect(
      tipoContradizOsDias({ ...INCIDENTE, tipo: "Quase Acidente", dias_perdidos: 7 })
    ).toBe(true);
  });

  it("quase acidente sem dias esta coerente", () => {
    expect(
      tipoContradizOsDias({
        ...INCIDENTE,
        tipo: "Quase Acidente",
        dias_perdidos: 0,
        dias_debitados: 0,
      })
    ).toBe(false);
  });

  it("acidente com dias nao e contradicao alguma", () => {
    expect(tipoContradizOsDias(INCIDENTE)).toBe(false);
  });
});

describe("exigeInvestigacao", () => {
  it.each(["Acidente", "Acidente com Afastamento", "Acidente sem Afastamento"] as const)(
    "%s exige investigacao pelo tipo",
    (tipo) => {
      expect(
        exigeInvestigacao({ ...INCIDENTE, tipo, dias_perdidos: 0, dias_debitados: 0 })
      ).toBe(true);
    }
  );

  it("quase acidente COM lesao exige, apesar do tipo", () => {
    // Os dias mandam mais que o rotulo: se houve afastamento, houve acidente.
    expect(
      exigeInvestigacao({ ...INCIDENTE, tipo: "Quase Acidente", dias_perdidos: 7 })
    ).toBe(true);
  });

  it("quase acidente sem lesao nao exige", () => {
    expect(
      exigeInvestigacao({
        ...INCIDENTE,
        tipo: "Quase Acidente",
        dias_perdidos: 0,
        dias_debitados: 0,
      })
    ).toBe(false);
  });
});

describe("acoesEmAbertoDoIncidente", () => {
  it("concluida e cancelada nao ficam em aberto", () => {
    const lista = [
      acao({ id: "1", status: "ABERTA" }),
      acao({ id: "2", status: "EM_ANDAMENTO" }),
      acao({ id: "3", status: "CONCLUIDA" }),
      acao({ id: "4", status: "CANCELADA" }),
    ];
    expect(acoesEmAbertoDoIncidente(lista).map((a) => a.id)).toEqual(["1", "2"]);
  });
});

describe("pendenciasIncidente", () => {
  const HOJE = new Date("2026-09-10T12:00:00");

  it("cobra a contradicao entre tipo e dias na PRIMEIRA linha", () => {
    // Ordem importa: quem le a primeira linha ja sabe se pode mandar o relatorio.
    const p = pendenciasIncidente(
      dados({ incidente: { ...INCIDENTE, tipo: "Quase Acidente" } }),
      HOJE
    );
    expect(p[0]).toContain("Quase Acidente");
    expect(p[0]).toContain("10 dia(s)");
  });

  it("cobra acidente sem investigacao citando a norma", () => {
    const p = pendenciasIncidente(dados({ investigacao: null }), HOJE);
    expect(p.some((x) => x.includes("1.5.5.5"))).toBe(true);
  });

  it("cobra causa raiz ausente", () => {
    const p = pendenciasIncidente(
      dados({ investigacao: { ...INVESTIGACAO, causas_raiz: "   " } }),
      HOJE
    );
    expect(p.some((x) => x.includes("Causa raiz"))).toBe(true);
  });

  it("cobra afastamento sem CAT com o prazo legal", () => {
    const p = pendenciasIncidente(
      dados({ incidente: { ...INCIDENTE, cat_emitida: false }, cats: [] }),
      HOJE
    );
    const linha = p.find((x) => x.includes("sem CAT"));
    expect(linha).toBeDefined();
    expect(linha).toContain("primeiro dia útil");
  });

  it("cobra a chave marcada sem CAT registrada", () => {
    // cat_emitida = true e nenhuma CAT: declaracao sem documento.
    const p = pendenciasIncidente(dados({ cats: [] }), HOJE);
    expect(p.some((x) => x.includes("declaração, não documento"))).toBe(true);
  });

  it("NAO cobra CAT quando ha CAT vinculada", () => {
    const p = pendenciasIncidente(
      dados({ cats: [{ id: "c1" } as never] }),
      HOJE
    );
    expect(p.some((x) => x.includes("CAT"))).toBe(false);
  });

  it("cobra afastamento sem vitima entre os envolvidos", () => {
    const p = pendenciasIncidente(
      dados({
        envolvidos: [
          {
            id: "en1",
            empresa_id: "e1",
            incidente_id: "inc1",
            tipo_envolvimento: "Testemunha",
          } as never,
        ],
      }),
      HOJE
    );
    expect(p.some((x) => x.includes("vítima"))).toBe(true);
  });

  it("cobra acao com prazo vencido", () => {
    const p = pendenciasIncidente(dados({ acoes: [acao({ prazo: "2026-09-01" })] }), HOJE);
    expect(p.some((x) => x.includes("prazo vencido"))).toBe(true);
  });

  it("acao concluida com prazo antigo NAO conta como vencida", () => {
    const p = pendenciasIncidente(
      dados({ acoes: [acao({ prazo: "2026-09-01", status: "CONCLUIDA" })] }),
      HOJE
    );
    expect(p.some((x) => x.includes("prazo vencido"))).toBe(false);
  });

  it("cobra encerramento com acao em aberto", () => {
    const p = pendenciasIncidente(
      dados({ incidente: { ...INCIDENTE, status: "ENCERRADO" } }),
      HOJE
    );
    expect(p.some((x) => x.includes("encerrada com"))).toBe(true);
  });

  it("registro completo nao gera pendencia inventada", () => {
    const p = pendenciasIncidente(
      dados({
        acoes: [acao({ status: "CONCLUIDA", data_conclusao: "2026-09-08" })],
        cats: [{ id: "c1" } as never],
        envolvidos: [
          {
            id: "en1",
            empresa_id: "e1",
            incidente_id: "inc1",
            tipo_envolvimento: "Vítima",
          } as never,
        ],
      }),
      HOJE
    );
    expect(p).toEqual([]);
  });
});

describe("montarHtmlIncidente", () => {
  it("imprime o aviso de contradicao no documento", () => {
    // Nao basta avisar na tela: o documento e o que circula.
    const html = montarHtmlIncidente(
      dados({ incidente: { ...INCIDENTE, tipo: "Quase Acidente" } })
    );
    expect(html).toContain("Classificação em desacordo");
  });

  it("mostra perdidos, debitados e o total", () => {
    const html = montarHtmlIncidente(dados());
    expect(html).toContain("Dias perdidos");
    expect(html).toContain("Dias debitados");
    expect(html).toContain("Total computado");
    expect(html).toContain(">10<");
  });

  it("explica o que sao dias debitados, com o numero da NBR", () => {
    // O relatorio e lido por quem nao conhece a norma.
    const html = montarHtmlIncidente(dados());
    expect(html).toContain("NBR 14280");
    expect(html).toContain("6.000");
  });

  it("nomeia os tres elos da cadeia de causas", () => {
    const html = montarHtmlIncidente(dados());
    expect(html).toContain("1. Causa imediata");
    expect(html).toContain("2. Causa básica");
    expect(html).toContain("3. Causa raiz");
  });

  it("marca o elo faltante em vez de omitir a secao", () => {
    // Secao em branco cobra; ausencia da secao esconde.
    const html = montarHtmlIncidente(
      dados({ investigacao: { ...INVESTIGACAO, causas_raiz: null } })
    );
    expect(html).toContain("3. Causa raiz");
    expect(html).toContain("não identificada");
  });

  it("sem investigacao, sai a secao vazia citando a norma", () => {
    const html = montarHtmlIncidente(dados({ investigacao: null }));
    expect(html).toContain("Nenhuma investigação registrada");
    expect(html).toContain("1.5.5.5");
  });

  it("escapa conteudo do usuario", () => {
    const html = montarHtmlIncidente(
      dados({ incidente: { ...INCIDENTE, titulo: '<script>alert("x")</script>' } })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("lista a CAT vinculada quando existe", () => {
    const html = montarHtmlIncidente(
      dados({
        cats: [
          {
            id: "c1",
            numero_cat: "123456",
            tipo_cat: "INICIAL",
            data_acidente: "2026-09-03",
            data_emissao: "2026-09-04",
            dias_afastamento: 7,
            houve_obito: false,
          } as never,
        ],
      })
    );
    expect(html).toContain("Comunicação de Acidente de Trabalho");
    expect(html).toContain("123456");
  });

  it("diz que nao ha foto do local em vez de calar", () => {
    const html = montarHtmlIncidente(dados());
    expect(html).toContain("Nenhuma foto do local anexada");
  });
});

describe("montarHtmlIncidente — coerencia com pendenciasIncidente", () => {
  /**
   * Guarda contra a divergencia que eu mesmo introduzi: a lista de pendencias
   * acusava "CAT marcada sem registro" e o documento nao imprimia aviso algum.
   * Contradicao que aparece na tela e desaparece no papel e pior que nenhuma das
   * duas, porque o papel e o que circula.
   */
  it("imprime aviso para a chave de CAT sem CAT registrada", () => {
    const html = montarHtmlIncidente(dados({ cats: [] }));
    expect(html).toContain("sem CAT registrada no sistema");
  });

  it("nao imprime esse aviso quando ha CAT vinculada", () => {
    const html = montarHtmlIncidente(dados({ cats: [{ id: "c1" } as never] }));
    expect(html).not.toContain("sem CAT registrada no sistema");
  });
});
