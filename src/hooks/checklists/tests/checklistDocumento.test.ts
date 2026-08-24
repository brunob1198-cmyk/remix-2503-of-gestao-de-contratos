import { describe, it, expect } from "vitest";
import {
  montarHtmlChecklist,
  textoDoIndice,
  type ChecklistDocumentoDados,
} from "@/lib/checklistDocumento";
import { calcularPontuacao } from "@/utils/checklistPontuacao";

/**
 * O checklist aplicado É o documento: é o que se entrega na auditoria do cliente
 * e o que fica no arquivo provando que a verificação aconteceu. Antes saía por
 * `window.print()` — a página do navegador, com diálogo e botões, sem timbre.
 *
 * O que estes testes protegem é a conferibilidade da folha: peso à vista, desvio
 * com o tratamento ao lado, e índice que não afirma o que os dados não sustentam.
 */

const SECOES = [
  {
    id: "s1",
    titulo: "Proteção contra incêndio",
    ordem: 1,
    itens: [
      { id: "i1", titulo: "Extintor desobstruído", peso_pontuacao: 10, obrigatorio: true },
      { id: "i2", titulo: "Quadro de avisos atualizado", peso_pontuacao: 1 },
    ],
  },
  {
    id: "s2",
    titulo: "Organização",
    ordem: 2,
    itens: [{ id: "i3", titulo: "Corredores livres", peso_pontuacao: 2 }],
  },
];

function dados(over: Partial<ChecklistDocumentoDados> = {}): ChecklistDocumentoDados {
  const respostas = over.respostas ?? {
    i1: { item_id: "i1", resposta_valor: "Conforme" },
    i2: { item_id: "i2", resposta_valor: "Conforme" },
    i3: { item_id: "i3", resposta_valor: "Conforme" },
  };

  const pontuacao =
    over.pontuacao ??
    calcularPontuacao(
      SECOES.flatMap((s) =>
        s.itens.map((i) => ({
          item_id: i.id,
          resposta_valor: respostas[i.id]?.resposta_valor,
          is_nao_conforme: respostas[i.id]?.is_nao_conforme,
          peso_pontuacao: i.peso_pontuacao,
        }))
      )
    );

  return {
    modeloNome: "Inspeção semanal de canteiro",
    modeloCodigo: "CHK-2026-0003",
    categoria: "Segurança",
    aplicacaoCodigo: "APL-2026-0041",
    secoes: SECOES,
    empresa: { nome: "Construtora Exemplo LTDA", cnpj: "12.345.678/0001-99" },
    obra: "[OBR-02] Galpão Logístico Sul",
    area: "Pátio",
    aplicador: "Carlos Andrade",
    responsavel: "Marina Reis",
    dataAplicacao: "2026-08-24",
    geradoPor: "Ana Técnica",
    ...over,
    respostas,
    pontuacao,
  };
}

describe("textoDoIndice", () => {
  it("formata em português", () => {
    expect(textoDoIndice(66.7)).toBe("66,7%");
  });

  it("nulo sai como não avaliado, não como 0% nem 100%", () => {
    // Nenhum dos dois e verdade quando nada foi avaliado.
    expect(textoDoIndice(null)).toBe("não avaliado");
  });

  it("zero é zero, e é diferente de nulo", () => {
    expect(textoDoIndice(0)).toBe("0,0%");
  });
});

describe("montarHtmlChecklist — o peso à vista", () => {
  it("imprime o peso de cada item", () => {
    // Indice ponderado sem os pesos a vista e numero que nao se confere.
    const html = montarHtmlChecklist(dados());
    expect(html).toContain("<th>Peso</th>");
    expect(html).toContain(">10</td>");
  });

  it("peso ausente aparece como 1, não em branco", () => {
    const html = montarHtmlChecklist(
      dados({
        secoes: [
          { id: "s1", titulo: "S", ordem: 1, itens: [{ id: "i1", titulo: "Item", peso_pontuacao: null }] },
        ],
        respostas: { i1: { item_id: "i1", resposta_valor: "Conforme" } },
      })
    );
    expect(html).toContain(">1</td>");
  });

  it("explica que o índice é ponderado e que N/A fica fora", () => {
    const html = montarHtmlChecklist(dados());
    expect(html).toContain("ponderado pelo peso");
    expect(html).toContain("ficam fora do cálculo");
  });

  it("mostra os pontos obtidos e o máximo", () => {
    const html = montarHtmlChecklist(dados());
    expect(html).toContain("13 de 13 ponto(s)");
  });
});

describe("montarHtmlChecklist — a não conformidade e o que a acompanha", () => {
  const comDesvio = () =>
    dados({
      respostas: {
        i1: {
          item_id: "i1",
          resposta_valor: "NaoConforme",
          comentario: "Obstruído por paletes no vão leste",
          quantidadeEvidencias: 2,
          planoAcao: {
            o_que_fazer: "Remover paletes e sinalizar o piso",
            quando_prazo: "2026-08-30",
            quem: "Encarregado do pátio",
          },
        },
        i2: { item_id: "i2", resposta_valor: "Conforme" },
        i3: { item_id: "i3", resposta_valor: "Conforme" },
      },
    });

  it("destaca a resposta não conforme", () => {
    const html = montarHtmlChecklist(comDesvio());
    expect(html).toContain("Não conforme");
    expect(html).toContain("doc-inapto");
  });

  it("traz comentário, evidências e plano na própria linha do item", () => {
    // O desvio sem o tratamento ao lado obriga quem recebe a folha a procurar em
    // outro lugar.
    const html = montarHtmlChecklist(comDesvio());
    expect(html).toContain("Obstruído por paletes no vão leste");
    expect(html).toContain("2 evidência(s)");
    expect(html).toContain("Remover paletes e sinalizar o piso");
    expect(html).toContain("30/08/2026");
    expect(html).toContain("Encarregado do pátio");
  });

  it("não conformidade sem plano de ação sai apontada", () => {
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "NaoConforme" },
          i2: { item_id: "i2", resposta_valor: "Conforme" },
          i3: { item_id: "i3", resposta_valor: "Conforme" },
        },
      })
    );
    expect(html).toContain("Sem plano de ação registrado");
  });

  it("item conforme não recebe o apontamento de plano ausente", () => {
    expect(montarHtmlChecklist(dados())).not.toContain("Sem plano de ação registrado");
  });

  it("o peso do desvio derruba o índice de forma visível", () => {
    // i1 pesa 10 e i2+i3 pesam 3: nao conformidade em i1 deixa 3 de 13.
    const html = montarHtmlChecklist(comDesvio());
    expect(html).toContain("3 de 13 ponto(s)");
    expect(html).toContain("23,1%");
  });
});

describe("montarHtmlChecklist — item não respondido", () => {
  it("sai marcado e é avisado no alto do documento", () => {
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "Conforme" },
          i2: { item_id: "i2", resposta_valor: "" },
          i3: { item_id: "i3", resposta_valor: "Conforme" },
        },
      })
    );
    expect(html).toContain("não respondido");
    expect(html).toContain("1 item(ns) sem resposta");
  });

  it("checklist completo não recebe esse aviso", () => {
    expect(montarHtmlChecklist(dados())).not.toContain("item(ns) sem resposta");
  });
});

describe("montarHtmlChecklist — estrutura e identificação", () => {
  it("respeita a ordem das seções", () => {
    // Busca pelo título DA SEÇÃO, não pela palavra solta: "Organização" também é
    // o rótulo da empresa no cabeçalho, e a primeira versão deste teste comparou
    // com essa ocorrência.
    const html = montarHtmlChecklist(dados());
    const tituloDaSecao = (t: string) => html.indexOf(`<div class="tit">${t}</div>`);

    expect(tituloDaSecao("Proteção contra incêndio")).toBeGreaterThan(0);
    expect(tituloDaSecao("Proteção contra incêndio")).toBeLessThan(
      tituloDaSecao("Organização")
    );
  });

  it("identifica organização, obra e quem aplicou", () => {
    const html = montarHtmlChecklist(dados());
    expect(html).toContain("Construtora Exemplo LTDA");
    expect(html).toContain("Galpão Logístico Sul");
    expect(html).toContain("Carlos Andrade");
    expect(html).toContain("APL-2026-0041");
  });

  it("imprime a geolocalização quando houve captura", () => {
    const html = montarHtmlChecklist(
      dados({
        geolocalizacao: { latitude: -16.6799, longitude: -49.255, precisao: 12 },
      })
    );
    expect(html).toContain("Localização do registro");
    expect(html).toContain("-16.6799");
    expect(html).toContain("12 m");
  });

  it("sem geolocalização a seção não aparece", () => {
    expect(montarHtmlChecklist(dados())).not.toContain("Localização do registro");
  });

  it("N/A conta como fora do índice, e o documento diz", () => {
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "NA" },
          i2: { item_id: "i2", resposta_valor: "Conforme" },
          i3: { item_id: "i3", resposta_valor: "Conforme" },
        },
      })
    );
    expect(html).toContain("Não aplicáveis");
    expect(html).toContain("fora do índice");
    // 3 de 3 pontos: o item de peso 10 saiu da conta.
    expect(html).toContain("3 de 3 ponto(s)");
  });

  it("tudo N/A sai como não avaliado", () => {
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "NA" },
          i2: { item_id: "i2", resposta_valor: "NA" },
          i3: { item_id: "i3", resposta_valor: "NA" },
        },
      })
    );
    expect(html).toContain("não avaliado");
  });

  it("escapa HTML dos campos livres", () => {
    const html = montarHtmlChecklist(
      dados({ modeloNome: '<script>alert("x")</script>' })
    );
    expect(html).not.toContain("<script>alert");
  });

  it("todas as classes doc- usadas existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "NaoConforme", quantidadeEvidencias: 1 },
          i2: { item_id: "i2", resposta_valor: "NA" },
          i3: { item_id: "i3", resposta_valor: "" },
        },
        geolocalizacao: { latitude: -16, longitude: -49 },
        observacoesGerais: "Observação",
      })
    );

    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("montarHtmlChecklist — veredito por item crítico", () => {
  const SECOES_COM_CRITICO = [
    {
      id: "s1",
      titulo: "Impeditivos",
      ordem: 1,
      itens: [
        {
          id: "k1",
          titulo: "Extintor desobstruído",
          peso_pontuacao: 1,
          critico: true,
          obrigatorio: true,
        },
        { id: "k2", titulo: "Quadro de avisos", peso_pontuacao: 1 },
      ],
    },
  ];

  function comCritico(respostaCritico: string) {
    const respostas = {
      k1: { item_id: "k1", resposta_valor: respostaCritico },
      k2: { item_id: "k2", resposta_valor: "Conforme" },
    };

    return dados({
      secoes: SECOES_COM_CRITICO,
      respostas,
      pontuacao: calcularPontuacao([
        { item_id: "k1", resposta_valor: respostaCritico, peso_pontuacao: 1, critico: true },
        { item_id: "k2", resposta_valor: "Conforme", peso_pontuacao: 1 },
      ]),
    });
  }

  it("imprime REPROVADO em bloco de conclusão quando o crítico falha", () => {
    const html = montarHtmlChecklist(comCritico("NaoConforme"));
    expect(html).toContain("REPROVADO");
    expect(html).toContain("doc-conclusao");
  });

  it("o aviso explica que a reprovação não depende do percentual", () => {
    const html = montarHtmlChecklist(comCritico("NaoConforme"));
    expect(html).toContain("CHECKLIST REPROVADO");
    expect(html).toContain("não depende do");
  });

  it("o percentual continua impresso ao lado do veredito", () => {
    // As duas informacoes convivem: a nota diz quanto esta certo, o veto diz que
    // nao se opera.
    const html = montarHtmlChecklist(comCritico("NaoConforme"));
    expect(html).toContain("50,0%");
    expect(html).toContain("REPROVADO");
  });

  it("crítico conforme sai APROVADO", () => {
    const html = montarHtmlChecklist(comCritico("Conforme"));
    expect(html).toContain("APROVADO");
    expect(html).not.toContain("CHECKLIST REPROVADO");
  });

  it("marca o item crítico na própria linha da tabela", () => {
    // Quem le precisa saber que AQUELE item veta, sem conferir legenda no rodape.
    const html = montarHtmlChecklist(comCritico("Conforme"));
    expect(html).toContain("[CRÍTICO]");
  });

  it("item não crítico não recebe a marca", () => {
    const html = montarHtmlChecklist(dados());
    expect(html).not.toContain("[CRÍTICO]");
  });

  it("checklist sem item crítico sai APROVADO mesmo com não conformidade comum", () => {
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "NaoConforme" },
          i2: { item_id: "i2", resposta_valor: "Conforme" },
          i3: { item_id: "i3", resposta_valor: "Conforme" },
        },
      })
    );
    expect(html).toContain("APROVADO");
    expect(html).not.toContain("CHECKLIST REPROVADO");
  });

  it("diz quantos críticos falharam, não só que falhou algum", () => {
    const html = montarHtmlChecklist(
      dados({
        secoes: [
          {
            id: "s1",
            titulo: "Impeditivos",
            ordem: 1,
            itens: [
              { id: "k1", titulo: "A", critico: true },
              { id: "k2", titulo: "B", critico: true },
            ],
          },
        ],
        respostas: {
          k1: { item_id: "k1", resposta_valor: "NaoConforme" },
          k2: { item_id: "k2", resposta_valor: "NaoConforme" },
        },
        pontuacao: calcularPontuacao([
          { item_id: "k1", resposta_valor: "NaoConforme", critico: true },
          { item_id: "k2", resposta_valor: "NaoConforme", critico: true },
        ]),
      })
    );
    expect(html).toContain("2 item(ns) crítico(s)");
  });

  it("todas as classes doc- do documento reprovado existem na folha de estilos", async () => {
    const { estilosDocumentoSgsst } = await import("@/lib/sgsstDocumentoEstilos");
    const html = montarHtmlChecklist(comCritico("NaoConforme"));
    const usadas = new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("doc"))
    );

    const ausentes = [...usadas].filter((c) => !estilosDocumentoSgsst.includes(`.${c}`));
    expect(ausentes).toEqual([]);
  });
});

describe("montarHtmlChecklist — selo de localização das fotos", () => {
  function comFoto(evidencias: Array<Record<string, unknown>>) {
    return dados({
      respostas: {
        i1: {
          item_id: "i1",
          resposta_valor: "NaoConforme",
          quantidadeEvidencias: evidencias.length,
          evidencias: evidencias as never,
        },
        i2: { item_id: "i2", resposta_valor: "Conforme" },
        i3: { item_id: "i3", resposta_valor: "Conforme" },
      },
    });
  }

  it("imprime coordenada, precisão, horário e origem de cada foto", () => {
    // "2 evidencias anexadas" nao diz nada a quem confere: a foto pode ser de outro
    // dia e de outro lugar.
    const html = montarHtmlChecklist(
      comFoto([
        {
          latitude: -16.6799,
          longitude: -49.255,
          precisao: 12,
          capturadaEm: "2026-08-26T13:45:00.000Z",
          origem: "CAMERA",
        },
      ])
    );

    expect(html).toContain("Foto 1:");
    expect(html).toContain("-16.679900, -49.255000");
    expect(html).toContain("±12 m");
    expect(html).toContain("Foto tirada na hora");
  });

  it("numera as fotos do item", () => {
    const html = montarHtmlChecklist(
      comFoto([
        { latitude: -16.6799, longitude: -49.255, origem: "CAMERA" },
        { latitude: -16.6798, longitude: -49.2551, origem: "CAMERA" },
      ])
    );
    expect(html).toContain("Foto 1:");
    expect(html).toContain("Foto 2:");
  });

  it("foto sem localização sai destacada, com o motivo", () => {
    const html = montarHtmlChecklist(
      comFoto([{ motivoSemGeo: "permissão de localização negada", origem: "CAMERA" }])
    );
    expect(html).toContain("Sem localização");
    expect(html).toContain("permissão de localização negada");
    expect(html).toContain(`<span class="doc-restr">Foto 1:`);
  });

  it("arquivo da galeria é identificado como tal", () => {
    // Pode ser de outro dia e de outro lugar. Nao e erro, mas muda o peso da
    // evidencia, e a folha precisa dizer.
    const html = montarHtmlChecklist(
      comFoto([{ latitude: -16.6799, longitude: -49.255, origem: "ARQUIVO" }])
    );
    expect(html).toContain("Arquivo escolhido da galeria");
    expect(html).toContain(`<span class="doc-restr">Foto 1:`);
  });

  it("foto boa da câmera sai em tom neutro, não em alerta", () => {
    // Procura o selo pelo atributo, e não pela palavra solta: `.doc-restr` também
    // existe na folha de estilos embutida no documento, e a primeira versão deste
    // teste comparou com essa ocorrência.
    const html = montarHtmlChecklist(
      comFoto([{ latitude: -16.6799, longitude: -49.255, precisao: 8, origem: "CAMERA" }])
    );
    expect(html).toContain(`<span class="doc-neutro">Foto 1:`);
    expect(html).not.toContain(`<span class="doc-restr">Foto 1:`);
  });

  it("aplicação antiga, sem selo, diz que a localização não foi registrada", () => {
    // Nao inventa uma localizacao que nao existe no dado.
    const html = montarHtmlChecklist(
      dados({
        respostas: {
          i1: { item_id: "i1", resposta_valor: "NaoConforme", quantidadeEvidencias: 2 },
          i2: { item_id: "i2", resposta_valor: "Conforme" },
          i3: { item_id: "i3", resposta_valor: "Conforme" },
        },
      })
    );
    expect(html).toContain("2 evidência(s) anexada(s), sem localização registrada");
  });

  it("item sem foto não imprime nada sobre evidência", () => {
    const html = montarHtmlChecklist(dados());
    expect(html).not.toContain("evidência(s) anexada(s)");
    expect(html).not.toContain("Foto 1:");
  });
});
