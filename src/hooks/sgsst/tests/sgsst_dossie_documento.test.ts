import { describe, it, expect } from "vitest";
import {
  montarHtmlDossie,
  pendenciasDossie,
  asoVigente,
  situacaoOcupacional,
  nomeDoColaborador,
  SITUACAO_APTIDAO_LABEL,
  type DossieDados,
  type PendenciaDossie,
} from "@/lib/dossieDocumento";
import type {
  SgsstColaboradorDados,
  SgsstColaboradorTreinamento,
} from "@/hooks/sgsst/useSgsstColaboradores";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import type { SgsstEpiEntrega } from "@/hooks/sgsst/useSgsstEpis";
import type { SgsstTreinamentoParticipante } from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * O dossiê responde uma pergunta: este trabalhador está regular para trabalhar
 * hoje? O que estes testes protegem é a honestidade dessa resposta — em especial
 * que "sem ASO" e "ASO vencido" não sejam confundidos com "inapto", que é
 * conclusão médica e o sistema não pode emitir por conta.
 */

const HOJE = new Date(2026, 7, 21); // 21/08/2026

const COLABORADOR: SgsstColaboradorDados = {
  id: "c1",
  empresa_id: "e1",
  nome: "BRUNO SOUZA DA SILVA",
  cpf: "123.456.789-00",
  rg: "1234567",
  telefone: "(62) 99994-0587",
  data_nascimento: "1990-04-12",
  matricula: "0451",
  data_admissao: "2025-02-03",
  tipo_vinculo: "CLT",
  status: "ativo",
  funcao_id: "f1",
  cep: "74.912-000",
  endereco: "Rua Larga, Buriti Sereno, Aparecida de Goiânia - GO",
  endereco_complemento: "Qd 1741 Lt 16",
  tamanho_calcado: "41",
  tamanho_camisa: "G",
  tamanho_calca: "42",
  cnh_numero: "0001",
  cnh_categoria: "B",
  cnh_validade: "2029-05-10",
  funcao: { id: "f1", nome: "Montador", cbo: "7241-05" },
  projeto: { id: "pj1", nome: "Galpão Logístico Sul", codigo: "OBR-02" },
  area: { id: "a1", nome: "Pátio de montagem" },
};

const ASO_VALIDO: SgsstAso = {
  id: "aso1",
  empresa_id: "e1",
  colaborador_id: "c1",
  data_emissao: "2026-02-10",
  tipo: "PERIODICO" as SgsstAso["tipo"],
  aptidao: "APTO" as SgsstAso["aptidao"],
  validade: "2027-02-10",
  medico_responsavel: "Dr. Paulo Menezes",
  crm_medico: "CRM-GO 12345",
  status: "ATIVO" as SgsstAso["status"],
};

const MATRICULA: SgsstTreinamentoParticipante = {
  id: "p1",
  empresa_id: "e1",
  turma_id: "tu1",
  colaborador_id: "c1",
  presenca: true,
  percentual_presenca: 100,
  resultado: "APROVADO",
  aprovacao: true,
  data_conclusao: "2026-03-11",
  validade: "2028-03-11",
  certificado: "CERT-2026-0014",
  turma: {
    id: "tu1",
    empresa_id: "e1",
    treinamento_id: "t1",
    codigo_turma: "T-2026-014",
    data_inicial: "2026-03-10",
    modalidade: "PRESENCIAL",
    status: "CONCLUIDA",
    treinamento: {
      id: "t1",
      empresa_id: "e1",
      nome: "NR-35 — Trabalho em Altura",
      categoria: "NR",
      carga_horaria: 8,
      obrigatorio: true,
      status: "ATIVO",
    },
  },
};

const TREINAMENTO_DOSSIE: SgsstColaboradorTreinamento = {
  id: "ct1",
  empresa_id: "e1",
  colaborador_id: "c1",
  nome_treinamento: "NR-18 — Integração de obra",
  carga_horaria: 6,
  data_conclusao: "2025-02-05",
  data_validade: "2027-02-05",
  certificado_r2_key: "certificados/nr18.pdf",
};

const ENTREGA_EPI: SgsstEpiEntrega = {
  id: "en1",
  empresa_id: "e1",
  colaborador_id: "c1",
  epi_id: "epi1",
  quantidade: 2,
  data_entrega: "2026-03-10",
  motivo: "PRIMEIRA_ENTREGA",
  confirmacao_recebimento: true,
  epi: {
    id: "epi1",
    empresa_id: "e1",
    nome: "Luva de raspa cano longo",
    categoria: "Proteção das Mãos",
    ca: "31469",
    unidade_medida: "PAR",
    estoque_atual: 10,
    estoque_minimo: 2,
    status: "ATIVO",
  },
};

const PENDENCIA: PendenciaDossie = {
  tipo: "TREINAMENTO",
  itemNome: "NR-33 — Espaço Confinado",
  situacao: "NUNCA_FEITO",
};

function dados(over: Partial<DossieDados> = {}): DossieDados {
  return {
    colaborador: COLABORADOR,
    treinamentosDoDossie: [TREINAMENTO_DOSSIE],
    matriculas: [MATRICULA],
    asos: [ASO_VALIDO],
    entregasEpi: [ENTREGA_EPI],
    pendencias: [],
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    geradoPor: "Ana Técnica",
    ...over,
  };
}

describe("nomeDoColaborador", () => {
  it("usa o cadastro próprio", () => {
    expect(nomeDoColaborador(COLABORADOR)).toBe("BRUNO SOUZA DA SILVA");
  });

  it("cai para o profile quando não há nome próprio", () => {
    const r = nomeDoColaborador({
      ...COLABORADOR,
      nome: null,
      profile: { id: "u1", nome: "Nome do Profile", avatar_url: null, cpf: null, cargo: null },
    });
    expect(r).toBe("Nome do Profile");
  });

  it("cai para o recurso depois do profile", () => {
    const r = nomeDoColaborador({
      ...COLABORADOR,
      nome: null,
      recurso: { id: "r1", nome: "Nome do Recurso", cargo: null, tipo: "MO" },
    });
    expect(r).toBe("Nome do Recurso");
  });

  it("sem nenhuma origem, diz que não tem nome em vez de sair vazio", () => {
    expect(nomeDoColaborador({ ...COLABORADOR, nome: null })).toBe("(sem nome)");
  });
});

describe("asoVigente", () => {
  it("escolhe pela maior validade, não pela emissão mais recente", () => {
    // Um exame de retorno ao trabalho emitido depois de um periodico pode ter
    // validade menor. O que responde "esta apto?" e a validade.
    const periodico = { ...ASO_VALIDO, id: "a", data_emissao: "2026-01-10", validade: "2027-01-10" };
    const retorno = { ...ASO_VALIDO, id: "b", data_emissao: "2026-06-01", validade: "2026-09-01" };

    expect(asoVigente([retorno, periodico], HOJE)?.id).toBe("a");
  });

  it("ignora ASO vencido", () => {
    const vencido = { ...ASO_VALIDO, validade: "2026-01-01" };
    expect(asoVigente([vencido], HOJE)).toBeNull();
  });

  it("ignora ASO cancelado, mesmo dentro da validade", () => {
    const cancelado = { ...ASO_VALIDO, status: "CANCELADO" as SgsstAso["status"] };
    expect(asoVigente([cancelado], HOJE)).toBeNull();
  });

  it("ASO que vence hoje ainda vale", () => {
    const hojeMesmo = { ...ASO_VALIDO, validade: "2026-08-21" };
    expect(asoVigente([hojeMesmo], HOJE)?.id).toBe("aso1");
  });

  it("lista vazia devolve nulo", () => {
    expect(asoVigente([], HOJE)).toBeNull();
  });
});

describe("situacaoOcupacional — sem ASO não é inapto", () => {
  it("sem nenhum ASO é SEM_ASO", () => {
    // Cadastro incompleto. Chamar de inapto seria emitir conclusao medica.
    expect(situacaoOcupacional([], HOJE)).toBe("SEM_ASO");
  });

  it("com ASO só cancelado também é SEM_ASO", () => {
    const cancelado = { ...ASO_VALIDO, status: "CANCELADO" as SgsstAso["status"] };
    expect(situacaoOcupacional([cancelado], HOJE)).toBe("SEM_ASO");
  });

  it("ASO existente mas vencido é ASO_VENCIDO, não SEM_ASO", () => {
    // Prazo perdido e cadastro incompleto sao problemas diferentes.
    const vencido = { ...ASO_VALIDO, validade: "2026-01-01" };
    expect(situacaoOcupacional([vencido], HOJE)).toBe("ASO_VENCIDO");
  });

  it("apto vigente é APTO", () => {
    expect(situacaoOcupacional([ASO_VALIDO], HOJE)).toBe("APTO");
  });

  it("apto com restrições tem estado próprio", () => {
    const r = situacaoOcupacional(
      [{ ...ASO_VALIDO, aptidao: "APTO_COM_RESTRICAO" as SgsstAso["aptidao"] }],
      HOJE
    );
    expect(r).toBe("APTO_COM_RESTRICAO");
  });

  it("inapto vigente é INAPTO", () => {
    const r = situacaoOcupacional(
      [{ ...ASO_VALIDO, aptidao: "INAPTO" as SgsstAso["aptidao"] }],
      HOJE
    );
    expect(r).toBe("INAPTO");
  });

  it("cada estado tem rótulo próprio, sem dois dizerem a mesma coisa", () => {
    const rotulos = Object.values(SITUACAO_APTIDAO_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

describe("montarHtmlDossie — a situação vem antes do histórico", () => {
  it("imprime a situação de hoje no alto", () => {
    const html = montarHtmlDossie(dados(), HOJE);
    const posSituacao = html.indexOf("Situação hoje");
    const posHistorico = html.indexOf("Exames ocupacionais");
    expect(posSituacao).toBeGreaterThan(0);
    expect(posSituacao).toBeLessThan(posHistorico);
  });

  it("mostra apto e a validade do ASO vigente", () => {
    const html = montarHtmlDossie(dados(), HOJE);
    expect(html).toContain("Apto para a função");
    expect(html).toContain("ASO válido até 10/02/2027");
  });

  it("sem ASO, diz sem ASO e não inapto", () => {
    const html = montarHtmlDossie(dados({ asos: [] }), HOJE);
    expect(html).toContain("Sem ASO registrado");
    expect(html).not.toContain("Inapto</div>");
  });

  it("conta as pendências separadas por tipo", () => {
    const html = montarHtmlDossie(
      dados({
        pendencias: [PENDENCIA, { ...PENDENCIA, tipo: "EPI", itemNome: "Protetor auricular" }],
      }),
      HOJE
    );
    expect(html).toContain("Treinamentos em falta");
    expect(html).toContain("EPIs em falta");
    expect(html).toContain("NR-33 — Espaço Confinado");
    expect(html).toContain("Protetor auricular");
  });

  it("sem pendência, declara que está tudo em ordem", () => {
    expect(montarHtmlDossie(dados(), HOJE)).toContain("Nenhuma pendência");
  });
});

describe("montarHtmlDossie — as duas origens de treinamento", () => {
  it("mostra as matrículas em turma e os lançamentos do dossiê", () => {
    // Sao tabelas diferentes. Mostrar so uma pareceria incompleto para quem
    // cadastrou pela outra.
    const html = montarHtmlDossie(dados(), HOJE);
    expect(html).toContain("NR-35 — Trabalho em Altura");
    expect(html).toContain("NR-18 — Integração de obra");
    expect(html).toContain("Matrículas em turmas");
    expect(html).toContain("Lançados no dossiê");
  });

  it("nenhuma das duas origens diz isso explicitamente", () => {
    const html = montarHtmlDossie(
      dados({ matriculas: [], treinamentosDoDossie: [] }),
      HOJE
    );
    expect(html).toContain("nenhuma das duas");
  });

  it("marca treinamento com validade vencida", () => {
    const html = montarHtmlDossie(
      dados({ matriculas: [{ ...MATRICULA, validade: "2026-01-01" }] }),
      HOJE
    );
    expect(html).toContain("01/01/2026 (vencido)");
  });

  it("treinamento sem validade sai como não expira, não como vazio", () => {
    const html = montarHtmlDossie(
      dados({ matriculas: [{ ...MATRICULA, validade: null }] }),
      HOJE
    );
    expect(html).toContain("não expira");
  });

  it("certificado do dossiê sem arquivo anexado sai marcado", () => {
    const html = montarHtmlDossie(
      dados({
        treinamentosDoDossie: [
          { ...TREINAMENTO_DOSSIE, certificado_r2_key: null, certificado_url: null },
        ],
      }),
      HOJE
    );
    expect(html).toContain("não anexado");
    expect(html).toContain("doc-falta");
  });
});

describe("montarHtmlDossie — identificação e vínculo", () => {
  it("junta o endereço com o complemento na ordem brasileira", () => {
    const html = montarHtmlDossie(dados(), HOJE);
    expect(html).toContain("Rua Larga, Qd 1741 Lt 16, Buriti Sereno");
  });

  it("imprime o CEP quando há", () => {
    expect(montarHtmlDossie(dados(), HOJE)).toContain("CEP 74.912-000");
  });

  it("função sem definição sai marcada", () => {
    const html = montarHtmlDossie(
      dados({ colaborador: { ...COLABORADOR, funcao: null, funcao_id: null } }),
      HOJE
    );
    expect(html).toContain("não definida");
    expect(html).toContain("doc-falta");
  });

  it("mostra o CBO junto da função", () => {
    expect(montarHtmlDossie(dados(), HOJE)).toContain("CBO 7241-05");
  });

  it("CNH vencida sai marcada", () => {
    const html = montarHtmlDossie(
      dados({ colaborador: { ...COLABORADOR, cnh_validade: "2025-01-01" } }),
      HOJE
    );
    expect(html).toContain("vencida em 01/01/2025");
  });

  it("trabalhador desligado recebe aviso no alto", () => {
    const html = montarHtmlDossie(
      dados({ colaborador: { ...COLABORADOR, status: "desligado" } }),
      HOJE
    );
    expect(html).toContain("status Desligado");
  });

  it("trabalhador ativo não recebe esse aviso", () => {
    expect(montarHtmlDossie(dados(), HOJE)).not.toContain("status Ativo.");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlDossie(
      dados({ colaborador: { ...COLABORADOR, nome: '<script>alert("x")</script>' } }),
      HOJE
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlDossie(dados({ pendencias: [PENDENCIA] }), HOJE);
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("montarHtmlDossie — EPI", () => {
  it("lista as entregas com o CA", () => {
    const html = montarHtmlDossie(dados(), HOJE);
    expect(html).toContain("Luva de raspa cano longo");
    expect(html).toContain("31469");
  });

  it("aponta a ausência de entrega citando a norma", () => {
    const html = montarHtmlDossie(dados({ entregasEpi: [] }), HOJE);
    expect(html).toContain("Nenhuma entrega de EPI registrada");
    expect(html).toContain("6.6.1");
  });

  it("aponta onde se emite a ficha assinada, para não confundir os dois documentos", () => {
    expect(montarHtmlDossie(dados(), HOJE)).toContain("é emitida na tela de EPI");
  });
});

describe("pendenciasDossie", () => {
  it("dossiê completo não acusa pendência", () => {
    expect(pendenciasDossie(dados(), HOJE)).toEqual([]);
  });

  it("sem ASO é a primeira pendência, citando a norma", () => {
    const p = pendenciasDossie(dados({ asos: [] }), HOJE);
    expect(p[0]).toContain("Sem ASO registrado");
    expect(p[0]).toContain("NR-07");
  });

  it("ASO vencido é pendência diferente de sem ASO", () => {
    const p = pendenciasDossie(
      dados({ asos: [{ ...ASO_VALIDO, validade: "2026-01-01" }] }),
      HOJE
    );
    expect(p[0]).toContain("ASO vencido");
  });

  it("acusa último ASO inapto", () => {
    const p = pendenciasDossie(
      dados({ asos: [{ ...ASO_VALIDO, aptidao: "INAPTO" as SgsstAso["aptidao"] }] }),
      HOJE
    );
    expect(p[0]).toContain("INAPTO");
  });

  it("acusa função ausente explicando a consequência", () => {
    const p = pendenciasDossie(
      dados({ colaborador: { ...COLABORADOR, funcao_id: null, funcao: null } }),
      HOJE
    );
    expect(p.join(" ")).toContain("sem função não há como saber");
  });

  it("conta treinamento e EPI pendentes em linhas separadas", () => {
    const p = pendenciasDossie(
      dados({
        pendencias: [PENDENCIA, { ...PENDENCIA, tipo: "EPI", itemNome: "Protetor" }],
      }),
      HOJE
    );
    expect(p.join(" ")).toContain("treinamento(s) obrigatório(s)");
    expect(p.join(" ")).toContain("EPI(s) obrigatório(s)");
  });

  it("acusa ausência de treinamento nas duas origens", () => {
    const p = pendenciasDossie(
      dados({ matriculas: [], treinamentosDoDossie: [] }),
      HOJE
    );
    expect(p.join(" ")).toContain("nenhuma das duas origens");
  });

  it("treinamento em uma das origens já basta para não acusar", () => {
    const p = pendenciasDossie(dados({ matriculas: [] }), HOJE);
    expect(p.join(" ")).not.toContain("nenhuma das duas origens");
  });

  it("acusa CPF e admissão ausentes", () => {
    const p = pendenciasDossie(
      dados({ colaborador: { ...COLABORADOR, cpf: null, data_admissao: null } }),
      HOJE
    );
    expect(p.join(" ")).toContain("CPF não informado");
    expect(p.join(" ")).toContain("Data de admissão");
  });
});
