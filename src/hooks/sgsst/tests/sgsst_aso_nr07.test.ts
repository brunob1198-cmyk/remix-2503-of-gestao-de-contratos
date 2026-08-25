import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  montarHtmlAso,
  pendenciasAso,
  faixaDeValidade,
  tipoForaDaNorma,
  OCASIOES_EXAME_ASO,
} from "@/lib/asoDocumento";
import {
  AGENTES_RISCO_ASO,
  CATEGORIAS_RISCO_ASO,
  agenteDeRisco,
  agentesDaCategoria,
  nomesDosRiscos,
  situacaoDosRiscos,
  totalDeRiscos,
} from "@/utils/sgsstRiscosAso";
import {
  conclusaoPendente,
  liberaAFuncao,
  liberaAtividade,
  situacaoDaConclusao,
  ATIVIDADES_ESPECIFICAS,
} from "@/utils/sgsstAptidaoAso";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";

/**
 * A coluna `aptidao` nascia `NOT NULL DEFAULT 'APTO'`: um ASO criado sem ninguém
 * tocar no campo já afirmava que o trabalhador está apto, e o PDF imprimia isso em
 * corpo grande e verde — com a aparência de uma conclusão médica assinada.
 *
 * É a única afirmação do documento que só um médico pode fazer, e era a que o
 * sistema fazia por omissão. Estes testes travam a correção: **sem conclusão
 * registrada, o documento não conclui nada.**
 *
 * O segundo bloco trava a outra metade: os perigos passaram de texto livre para
 * grade de marcação, e lista vazia não é "não há risco".
 */

const SQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829100000_aso_nr07_riscos_e_aptidao_opcional.sql"
  ),
  "utf8"
);

function aso(over: Partial<SgsstAso> = {}): SgsstAso {
  return {
    id: "a1",
    empresa_id: "e1",
    colaborador_id: "c1",
    numero_documento: "ASO-2026-0001",
    data_emissao: "2026-08-20",
    tipo: "Periódico",
    aptidao: "APTO",
    validade: "2027-08-20",
    medico_responsavel: "Dr. Carlos Lima",
    crm_medico: "CRM-SP 111111",
    medico_coordenador: "Dra. Ana Prado",
    crm_coordenador: "CRM-SP 222222",
    riscos_marcados: ["FIS_RUIDO"],
    sem_risco_especifico: false,
    data_exame_clinico: "2026-08-19",
    empresa_nome: "Construtora Exemplo Ltda",
    empresa_cnpj: "12.345.678/0001-90",
    status: "ATIVO",
    colaborador: {
      id: "c1",
      cpf: "123.456.789-00",
      rg: "12.345.678-9",
      profile: { id: "u1", nome: "José da Silva" },
      funcao: { id: "f1", nome: "Eletricista" },
    },
    exames: [
      {
        id: "v1",
        aso_id: "a1",
        exame_id: "x1",
        exame: {
          id: "x1",
          nome_exame: "Audiometria tonal",
          tipo: "Periódico",
          data_realizacao: "2026-08-18",
          resultado: "Normal",
          status: "REALIZADO",
        },
      },
    ],
    ...over,
  } as SgsstAso;
}

/** Quantas caixas de marcação saíram marcadas. */
function marcadas(html: string): number {
  return (html.match(/doc-marca marcada/g) ?? []).length;
}

/**
 * Só a linha da conclusão de aptidão para a função.
 *
 * Recortar é necessário: contar caixas marcadas no documento inteiro pega as do
 * tipo de exame e as da grade de riscos, e o teste passaria por acidente.
 */
function linhaDaConclusao(html: string): string {
  const inicio = html.indexOf("Para a função");
  const fim = html.indexOf("</tr>", inicio);
  return inicio < 0 || fim < 0 ? "" : html.slice(inicio, fim);
}

describe("a conclusão de aptidão é do médico, não do sistema", () => {
  it("sem conclusão registrada, nenhuma caixa de aptidão para a função é marcada", () => {
    const linha = linhaDaConclusao(montarHtmlAso(aso({ aptidao: null })));

    // As três opções saem desenhadas — o médico marca à mão na folha impressa.
    expect(linha).toContain("Apto");
    expect(linha).toContain("Apto com restrição");
    expect(linha).toContain("Inapto");
    // E nenhuma delas vem marcada.
    expect(marcadas(linha)).toBe(0);
  });

  it("com conclusão registrada, exatamente uma caixa da linha é marcada", () => {
    for (const conclusao of ["APTO", "APTO_COM_RESTRICAO", "INAPTO"] as const) {
      const linha = linhaDaConclusao(montarHtmlAso(aso({ aptidao: conclusao })));
      expect(marcadas(linha), `aptidao ${conclusao}`).toBe(1);
    }
  });

  it("sem conclusão, a folha diz expressamente que não atesta aptidão", () => {
    // Silenciar seria pior: a folha teria a aparência de um ASO completo com um
    // campo em branco que passa por lapso de impressão.
    const html = montarHtmlAso(aso({ aptidao: null }));
    expect(html).toContain("não atesta aptidão");
    expect(html).toContain("doc-aviso");
  });

  it("com conclusão registrada, o aviso não aparece", () => {
    const html = montarHtmlAso(aso({ aptidao: "APTO" }));
    expect(html).not.toContain("não atesta aptidão");
  });

  it("a conclusão ausente entra como pendência", () => {
    const p = pendenciasAso(aso({ aptidao: null }));
    expect(p.some((x) => /Conclusão de aptidão/i.test(x))).toBe(true);
  });

  it("conclusão presente não é pendência", () => {
    const p = pendenciasAso(aso({ aptidao: "INAPTO" }));
    expect(p.some((x) => /Conclusão de aptidão/i.test(x))).toBe(false);
  });

  it("aptidão nula não libera a função", () => {
    // É o coração do defeito: tratar ausência de conclusão como liberação.
    expect(liberaAFuncao(null)).toBe(false);
    expect(liberaAFuncao(undefined)).toBe(false);
    expect(liberaAFuncao("APTO")).toBe(true);
    expect(liberaAFuncao("APTO_COM_RESTRICAO")).toBe(true);
    expect(liberaAFuncao("INAPTO")).toBe(false);
  });

  it("a situação da conclusão tem estado próprio para o não preenchido", () => {
    expect(situacaoDaConclusao(null)).toBe("NAO_CONCLUIDO");
    expect(situacaoDaConclusao("APTO")).toBe("APTO");
    expect(conclusaoPendente(null)).toBe(true);
    expect(conclusaoPendente("INAPTO")).toBe(false);
  });

  it("a migration remove o default que escrevia a conclusão", () => {
    expect(SQL).toContain("ALTER COLUMN aptidao DROP DEFAULT");
    expect(SQL).toContain("ALTER COLUMN aptidao DROP NOT NULL");
  });

  it("a migration não reescreve a conclusão dos ASOs já emitidos", () => {
    // Não há como distinguir o APTO que um médico concluiu do APTO que o default
    // escreveu, e reescrever dado clínico retroativamente é pior que a ambiguidade.
    expect(SQL).not.toMatch(/UPDATE\s+public\.sgsst_asos\s+SET\s+aptidao/i);
  });
});

describe("aptidão por atividade: não se aplica não é inapto", () => {
  it("só APTO autoriza a atividade", () => {
    // A PT de altura consulta isto. Nulo é "não avaliado" e NAO_SE_APLICA é "não
    // faz esse serviço" — nenhum dos dois é autorização.
    expect(liberaAtividade("APTO")).toBe(true);
    expect(liberaAtividade("INAPTO")).toBe(false);
    expect(liberaAtividade("NAO_SE_APLICA")).toBe(false);
    expect(liberaAtividade(null)).toBe(false);
    expect(liberaAtividade(undefined)).toBe(false);
  });

  it("as três atividades da ficha saem no documento", () => {
    const html = montarHtmlAso(aso());
    expect(html).toContain("trabalhos em altura");
    expect(html).toContain("espaços confinados");
    expect(html).toContain("máquinas, equipamentos ou veículos");
    expect(ATIVIDADES_ESPECIFICAS).toHaveLength(3);
  });

  it("a folha explica que campo em branco não autoriza", () => {
    const html = montarHtmlAso(aso());
    expect(html).toContain("não autoriza a atividade");
  });

  it("cada atividade marca a resposta registrada", () => {
    const html = montarHtmlAso(
      aso({ apto_altura: "APTO", apto_espaco_confinado: "NAO_SE_APLICA" })
    );
    expect(html).toContain("Não se aplica");
    expect(marcadas(html)).toBeGreaterThanOrEqual(2);
  });

  it("a migration cria as três colunas com os três estados", () => {
    for (const coluna of ["apto_altura", "apto_espaco_confinado", "apto_maquinas"]) {
      expect(SQL).toContain(coluna);
    }
    expect(SQL).toContain("'APTO'', ''INAPTO'', ''NAO_SE_APLICA'");
  });
});

describe("os perigos são marcados, e a ausência é afirmada", () => {
  it("lista vazia é não preenchido, e não ausência de risco", () => {
    // Tratar vazio como "não há risco" transformaria todo ASO não preenchido num
    // atestado de atividade sem perigo.
    expect(situacaoDosRiscos({ codigos: [], semRiscoEspecifico: false })).toBe(
      "NAO_PREENCHIDO"
    );
    expect(situacaoDosRiscos({ codigos: null, semRiscoEspecifico: null })).toBe(
      "NAO_PREENCHIDO"
    );
  });

  it("a inexistência declarada tem estado próprio", () => {
    expect(situacaoDosRiscos({ codigos: [], semRiscoEspecifico: true })).toBe(
      "SEM_RISCO_DECLARADO"
    );
  });

  it("marcar agentes e declarar que não há risco é contraditório", () => {
    expect(
      situacaoDosRiscos({ codigos: ["FIS_RUIDO"], semRiscoEspecifico: true })
    ).toBe("CONTRADITORIO");
  });

  it("o documento aponta a contradição em vez de escolher um dos dois", () => {
    const html = montarHtmlAso(
      aso({ riscos_marcados: ["FIS_RUIDO"], sem_risco_especifico: true })
    );
    expect(html).toContain("contraditória");
  });

  it("o banco barra a contradição", () => {
    expect(SQL).toContain("sgsst_asos_riscos_coerentes_check");
    expect(SQL).toContain("NOT (sem_risco_especifico AND array_length(riscos_marcados, 1) > 0)");
  });

  it("a grade sai com todas as categorias, marcadas ou não", () => {
    // A ficha impressa serve para preencher à mão: as opções não marcadas têm de
    // aparecer, ou não há o que marcar no papel.
    const html = montarHtmlAso(aso({ riscos_marcados: ["FIS_RUIDO"] }));

    expect(html).toContain("Ruídos");
    expect(html).toContain("Vibrações"); // não marcada, e presente
    expect(html).toContain("Bactérias");
    expect(html).toContain("Quedas");
  });

  it("cada categoria tem agentes, e nenhuma sai vazia na folha", () => {
    for (const categoria of CATEGORIAS_RISCO_ASO) {
      expect(agentesDaCategoria(categoria).length).toBeGreaterThan(0);
    }
  });

  it("os códigos do catálogo são únicos", () => {
    // O código é o que liga o ASO de 2026 à lista de hoje; duplicado faria dois
    // agentes compartilharem marcação.
    const codigos = AGENTES_RISCO_ASO.map((a) => a.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("nenhum agente tem nome vazio nem igual ao código", () => {
    for (const a of AGENTES_RISCO_ASO) {
      expect(a.nome.trim().length).toBeGreaterThan(0);
      expect(a.nome).not.toBe(a.codigo);
    }
  });

  it("agente fora do catálogo não é descartado da folha", () => {
    // Ele veio de algum lugar. Sumir com ele faria o ASO impresso listar menos
    // riscos do que o registro guarda.
    const html = montarHtmlAso(aso({ riscos_marcados: ["FIS_RUIDO", "CODIGO_ANTIGO"] }));
    expect(html).toContain("CODIGO_ANTIGO");

    expect(nomesDosRiscos(["FIS_RUIDO", "CODIGO_ANTIGO"])).toEqual([
      "Ruídos",
      "CODIGO_ANTIGO",
    ]);
  });

  it("o texto livre permanece, como complemento", () => {
    const html = montarHtmlAso(
      aso({ descricao_riscos: "Sílica cristalina acima do limite." })
    );
    expect(html).toContain("Complemento:");
    expect(html).toContain("Sílica cristalina acima do limite.");
  });

  it("resolve o agente pelo código e devolve nulo para desconhecido", () => {
    expect(agenteDeRisco("FIS_RUIDO")?.nome).toBe("Ruídos");
    expect(agenteDeRisco("NAO_EXISTE")).toBeNull();
  });

  it("a contagem não conta código repetido duas vezes", () => {
    expect(totalDeRiscos(["FIS_RUIDO", "FIS_RUIDO"])).toBe(1);
    expect(totalDeRiscos([])).toBe(0);
    expect(totalDeRiscos(null)).toBe(0);
  });
});

describe("tipo de exame e validade como opções", () => {
  it("as seis ocasiões da NR-07 7.5.4 saem na folha", () => {
    expect(OCASIOES_EXAME_ASO).toHaveLength(6);
    const html = montarHtmlAso(aso());
    expect(html).toContain("Admissional");
    expect(html).toContain("Monitoração pontual");
  });

  it("tipo que não é ocasião da norma não marca caixa nenhuma", () => {
    // Marcar uma caixa aproximada faria a folha afirmar uma classificação
    // normativa que o registro não tem.
    expect(tipoForaDaNorma("Complementar")).toBe(true);
    expect(tipoForaDaNorma("Outros")).toBe(true);
    expect(tipoForaDaNorma("Periódico")).toBe(false);

    const html = montarHtmlAso(aso({ tipo: "Complementar" }));
    expect(html).toContain("não corresponde a nenhuma das");
  });

  it("a faixa de validade é deduzida das datas", () => {
    expect(faixaDeValidade("2026-03-10", "2026-09-10")).toBe("SEIS_MESES");
    expect(faixaDeValidade("2026-03-10", "2027-03-10")).toBe("UM_ANO");
    expect(faixaDeValidade("2026-03-10", "2028-03-10")).toBe("DOIS_ANOS");
  });

  it("faixa que não bate cai em outro, sem arredondar", () => {
    // Arredondar para a caixa mais próxima faria a folha afirmar uma validade
    // diferente da data impressa ao lado.
    expect(faixaDeValidade("2026-03-10", "2026-12-01")).toBe("OUTRO");
    expect(faixaDeValidade(null, "2027-03-10")).toBe("OUTRO");
    expect(faixaDeValidade("2026-03-10", null)).toBe("OUTRO");
    expect(faixaDeValidade("lixo", "mais lixo")).toBe("OUTRO");
  });

  it("a data de validade sai impressa junto da faixa", () => {
    const html = montarHtmlAso(aso());
    expect(html).toContain("Válido até");
    expect(html).toContain("20/08/2027");
  });
});

describe("campos de identificação que a ficha pede", () => {
  it("imprime a identidade, e não só o CPF", () => {
    // NR-07 7.5.15.1 alínea "a" pede o número de registro de identidade.
    const html = montarHtmlAso(aso());
    expect(html).toContain("12.345.678-9");
    expect(html).toContain("Identidade");
  });

  it("cobra a nova função no exame de mudança, e só nele", () => {
    const mudanca = pendenciasAso(
      aso({ tipo: "Mudança de Risco/Função", nova_funcao: null })
    );
    expect(mudanca.some((x) => /Nova função/i.test(x))).toBe(true);

    const periodico = pendenciasAso(aso({ tipo: "Periódico", nova_funcao: null }));
    expect(periodico.some((x) => /Nova função/i.test(x))).toBe(false);
  });

  it("cobra a data do exame clínico", () => {
    const p = pendenciasAso(aso({ data_exame_clinico: null }));
    expect(p.some((x) => /exame clínico/i.test(x))).toBe(true);
  });

  it("a ordem do exame não informada sai como falta, não como sequencial", () => {
    // Um resultado alterado só é interpretável contra a referência certa.
    const html = montarHtmlAso(aso());
    expect(html).toContain("Ordem do exame");
    expect(html).toContain("não informada");
  });
});
