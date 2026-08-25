import { describe, it, expect } from "vitest";
import {
  ESTADOS_REQUISICAO,
  ESTADOS_COTACAO,
  ESTADOS_PEDIDO,
  ESTADO_REQUISICAO_LABEL,
  ESTADO_COTACAO_LABEL,
  ESTADO_PEDIDO_LABEL,
  ESTADO_REQUISICAO_AJUDA,
  TRANSICOES_REQUISICAO,
  TRANSICOES_COTACAO,
  TRANSICOES_PEDIDO,
  ESTADOS_REQUISICAO_TERMINAIS,
  normalizarEstadoRequisicao,
  normalizarEstadoCotacao,
  normalizarEstadoPedido,
  rotuloRequisicao,
  rotuloCotacao,
  rotuloPedido,
  validarTransicaoRequisicao,
  validarTransicaoCotacao,
  validarTransicaoPedido,
  alcancaveis,
  caminho,
  estadosOrfaos,
  type EstadoRequisicao,
} from "@/lib/fluxoCompras";

/**
 * O fluxo de compras tinha as transições escritas dentro do JSX de cada aba, e
 * ninguém verificava se o conjunto delas formava um caminho completo. Não formava:
 *
 * - a emissão do pedido gravava `pedido_emitido`, fora do vocabulário;
 * - o botão "Receber" exigia `PURCHASED`, que nenhuma linha escrevia;
 * - `PENDING_APPROVAL` era lido em quatro lugares e escrito em nenhum.
 *
 * O primeiro bloco destes testes é a checagem que faltava: **provar que dá para
 * sair do rascunho e chegar ao recebimento**. Os demais travam o vocabulário único
 * e a recusa de transição inventada.
 */

describe("a travessia do rascunho ao recebimento existe", () => {
  it("há caminho de DRAFT até RECEIVED", () => {
    // É a pergunta que a auditoria respondeu com "não". Se este teste cair, o ciclo
    // de compras voltou a ficar sem fim.
    const rota = caminho<EstadoRequisicao>("DRAFT", "RECEIVED", TRANSICOES_REQUISICAO);

    expect(rota).not.toBeNull();
    expect(rota?.[0]).toBe("DRAFT");
    expect(rota?.[rota.length - 1]).toBe("RECEIVED");
  });

  it("o caminho passa pela cotação, pela aprovação e pelo pedido", () => {
    // Um atalho DRAFT → RECEIVED satisfaria o teste acima e destruiria o controle.
    const rota = caminho<EstadoRequisicao>("DRAFT", "RECEIVED", TRANSICOES_REQUISICAO) ?? [];

    expect(rota).toContain("QUOTING");
    expect(rota).toContain("PENDING_APPROVAL");
    expect(rota).toContain("APPROVED");
    expect(rota).toContain("PURCHASED");
  });

  it("o recebimento parcial também chega ao recebimento total", () => {
    const rota = caminho<EstadoRequisicao>(
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      TRANSICOES_REQUISICAO
    );
    expect(rota).not.toBeNull();
  });

  it("nenhum estado da requisição fica órfão", () => {
    // É assim que nascem estados fantasma: declarados no mapa, alcançados por
    // ninguém. Eram cinco.
    expect(estadosOrfaos<EstadoRequisicao>("DRAFT", ESTADOS_REQUISICAO, TRANSICOES_REQUISICAO)).toEqual([]);
  });

  it("nenhum estado de cotação nem de pedido fica órfão", () => {
    expect(estadosOrfaos("pendente", ESTADOS_COTACAO, TRANSICOES_COTACAO)).toEqual([]);
    expect(estadosOrfaos("rascunho", ESTADOS_PEDIDO, TRANSICOES_PEDIDO)).toEqual([]);
  });

  it("todo estado não terminal tem alguma saída", () => {
    // Estado sem saída que não seja terminal é beco: o registro entra e não sai,
    // que foi exatamente o que aconteceu com `pedido_emitido`.
    const becos = ESTADOS_REQUISICAO.filter(
      (e) => !ESTADOS_REQUISICAO_TERMINAIS.includes(e) && TRANSICOES_REQUISICAO[e].length === 0
    );
    expect(becos).toEqual([]);
  });

  it("os estados terminais são terminais de propósito", () => {
    for (const e of ESTADOS_REQUISICAO_TERMINAIS) {
      expect(TRANSICOES_REQUISICAO[e], `${e} deveria ser terminal`).toEqual([]);
    }
  });

  it("o pedido chega de rascunho a entregue", () => {
    expect(caminho("rascunho", "entregue", TRANSICOES_PEDIDO)).not.toBeNull();
  });

  it("a cotação chega de pendente a vencedora", () => {
    expect(caminho("pendente", "aprovada", TRANSICOES_COTACAO)).not.toBeNull();
  });

  it("cotação sem preço lançado não vira vencedora direto", () => {
    // `pendente` significa "fornecedor consultado, sem preço". Aprovar dali faria a
    // cotação entrar no comparativo valendo zero e ganhar de todas.
    expect(TRANSICOES_COTACAO.pendente).not.toContain("aprovada");
    expect(validarTransicaoCotacao("pendente", "aprovada").permitida).toBe(false);
  });
});

describe("o vocabulário é único, e o antigo continua legível", () => {
  it("traduz o pedido_emitido que a aba de Pedidos gravava", () => {
    // Era o defeito central: minúsculo, fora do mapa, e o botão "Receber" exigia
    // PURCHASED — então a requisição não tinha como ser concluída.
    expect(normalizarEstadoRequisicao("pedido_emitido")).toBe("PURCHASED");
    expect(rotuloRequisicao("pedido_emitido").label).toBe("Pedido emitido");
    expect(rotuloRequisicao("pedido_emitido").desconhecido).toBe(false);
  });

  it("traduz o em_cotacao que o cancelamento gravava", () => {
    expect(normalizarEstadoRequisicao("em_cotacao")).toBe("QUOTING");
  });

  it("resolve os sinônimos que existiam no mapa antigo", () => {
    expect(normalizarEstadoRequisicao("PURCHASE_ORDER_CREATED")).toBe("PURCHASED");
    expect(normalizarEstadoRequisicao("QUOTE_COMPLETED")).toBe("PENDING_APPROVAL");
    expect(normalizarEstadoRequisicao("CLOSED")).toBe("RECEIVED");
  });

  it("traduz aberta e rejeitada na cotação", () => {
    // `aberta` era procurado pelo card "Para Aprovar" e nunca gravado.
    expect(normalizarEstadoCotacao("aberta")).toBe("pendente");
    // `rejeitada` era o rótulo esperado; `perdida` era o valor gravado.
    expect(normalizarEstadoCotacao("rejeitada")).toBe("perdida");
  });

  it("traduz as duas grafias da entrega parcial", () => {
    // O rótulo do aviso em tempo real dizia entregue_parcial; o código gravava
    // entrega_parcial — e o aviso saía com a string crua.
    expect(normalizarEstadoPedido("entregue_parcial")).toBe("entrega_parcial");
    expect(normalizarEstadoPedido("entrega_parcial")).toBe("entrega_parcial");
    expect(rotuloPedido("entregue_parcial").label).toBe("Entrega parcial");
  });

  it("aceita diferença de caixa", () => {
    expect(normalizarEstadoRequisicao("draft")).toBe("DRAFT");
    expect(normalizarEstadoCotacao("PENDENTE")).toBe("pendente");
  });

  it("valor desconhecido devolve nulo em vez de encaixar no mais parecido", () => {
    expect(normalizarEstadoRequisicao("APROVADO_TALVEZ")).toBeNull();
    expect(normalizarEstadoCotacao("qualquer_coisa")).toBeNull();
    expect(normalizarEstadoPedido("a_caminho")).toBeNull();
  });

  it("o desconhecido sai marcado na tela, com o valor cru", () => {
    // Encaixá-lo no estado mais parecido esconderia o problema — que foi o que
    // deixou `pedido_emitido` circular por meses.
    const r = rotuloRequisicao("status_inventado");
    expect(r.desconhecido).toBe(true);
    expect(r.label).toBe("status_inventado");
    expect(r.variante).toBe("destructive");
  });

  it("status vazio não é desconhecido, é vazio", () => {
    expect(rotuloRequisicao(null).desconhecido).toBe(false);
    expect(rotuloRequisicao(null).label).toBe("—");
    expect(rotuloRequisicao("").label).toBe("—");
  });
});

describe("transição não declarada é recusada", () => {
  it("recusa o salto do rascunho ao recebido", () => {
    // `updateStatus` aceitava qualquer string: este salto passava.
    const r = validarTransicaoRequisicao("DRAFT", "RECEIVED");
    expect(r.permitida).toBe(false);
    expect(r.motivo).toContain("Rascunho");
    expect(r.motivo).toContain("Recebida");
  });

  it("a mensagem diz quais são as saídas possíveis", () => {
    // Recusar sem dizer o que fazer transfere o problema para o usuário.
    const r = validarTransicaoRequisicao("DRAFT", "APPROVED");
    expect(r.motivo).toContain("Aguardando liberação");
  });

  it("aceita as transições do fluxo normal", () => {
    const passos: [EstadoRequisicao, EstadoRequisicao][] = [
      ["DRAFT", "SUBMITTED"],
      ["SUBMITTED", "QUOTING"],
      ["QUOTING", "PENDING_APPROVAL"],
      ["PENDING_APPROVAL", "APPROVED"],
      ["APPROVED", "PURCHASED"],
      ["PURCHASED", "PARTIALLY_RECEIVED"],
      ["PARTIALLY_RECEIVED", "RECEIVED"],
    ];

    for (const [de, para] of passos) {
      const r = validarTransicaoRequisicao(de, para);
      expect(r.permitida, `${de} → ${para}: ${r.motivo ?? ""}`).toBe(true);
    }
  });

  it("recusa aprovar direto da cotação, sem passar pela aprovação", () => {
    // Sem essa parada não há onde aplicar alçada por valor.
    expect(validarTransicaoRequisicao("QUOTING", "APPROVED").permitida).toBe(false);
  });

  it("estado terminal não sai de lugar", () => {
    expect(validarTransicaoRequisicao("RECEIVED", "QUOTING").permitida).toBe(false);
    expect(validarTransicaoRequisicao("CANCELLED", "DRAFT").permitida).toBe(false);
    expect(validarTransicaoPedido("entregue", "emitido").permitida).toBe(false);
  });

  it("cancelar o pedido devolve a requisição para cotação", () => {
    // Deixá-la em estado de compra que não aconteceu era o efeito anterior.
    expect(validarTransicaoRequisicao("PURCHASED", "QUOTING").permitida).toBe(true);
  });

  it("requisição rejeitada pode ser corrigida e reenviada", () => {
    // Exigir abrir outra perderia o histórico do que foi pedido e por que recusaram.
    expect(validarTransicaoRequisicao("REJECTED", "DRAFT").permitida).toBe(true);
  });

  it("ficar no mesmo estado é permitido", () => {
    // Salvar o registro sem mexer no status não pode ser recusado.
    expect(validarTransicaoRequisicao("QUOTING", "QUOTING").permitida).toBe(true);
  });

  it("recebimento parcial pode acontecer mais de uma vez", () => {
    expect(validarTransicaoRequisicao("PARTIALLY_RECEIVED", "PARTIALLY_RECEIVED").permitida).toBe(true);
    expect(validarTransicaoPedido("entrega_parcial", "entrega_parcial").permitida).toBe(true);
  });

  it("registro antigo, com status irreconhecível, não fica travado", () => {
    // Travar deixaria o usuário sem conseguir mexer no que já está no sistema.
    const r = validarTransicaoRequisicao("status_de_2024", "QUOTING");
    expect(r.permitida).toBe(true);
  });

  it("mas o destino inventado é recusado, venha de onde vier", () => {
    const r = validarTransicaoRequisicao("QUOTING", "status_inventado");
    expect(r.permitida).toBe(false);
    expect(r.motivo).toContain("não é um status");
  });
});

describe("rótulos e ajuda", () => {
  it("todo estado tem rótulo e nenhum rótulo é o próprio código", () => {
    for (const e of ESTADOS_REQUISICAO) {
      expect(ESTADO_REQUISICAO_LABEL[e]).toBeTruthy();
      expect(ESTADO_REQUISICAO_LABEL[e]).not.toBe(e);
    }
    for (const e of ESTADOS_COTACAO) expect(ESTADO_COTACAO_LABEL[e]).toBeTruthy();
    for (const e of ESTADOS_PEDIDO) expect(ESTADO_PEDIDO_LABEL[e]).toBeTruthy();
  });

  it("todo estado da requisição explica de quem é a bola", () => {
    // O usuário que abre a tela precisa saber o que fazer, não só como se chama.
    for (const e of ESTADOS_REQUISICAO) {
      expect(ESTADO_REQUISICAO_AJUDA[e].length, e).toBeGreaterThan(20);
    }
  });

  it("os dois primeiros estados da cotação se distinguem na explicação", () => {
    // É o comprador que lança a resposta do fornecedor nesta etapa do produto: a
    // diferença entre "consultado" e "preço lançado" tem de estar dita.
    expect(rotuloCotacao("pendente").ajuda).toContain("Falta lançar");
    expect(rotuloCotacao("recebida").ajuda).toContain("comparativo");
  });

  it("os rótulos de cotação são distintos entre si", () => {
    const rotulos = ESTADOS_COTACAO.map((e) => ESTADO_COTACAO_LABEL[e]);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

describe("alcancaveis", () => {
  it("parte do inicial e segue as setas", () => {
    const r = alcancaveis("rascunho", TRANSICOES_PEDIDO);
    expect(r.has("rascunho")).toBe(true);
    expect(r.has("entregue")).toBe(true);
    expect(r.size).toBe(ESTADOS_PEDIDO.length);
  });

  it("caminho para o próprio estado é o estado", () => {
    expect(caminho("emitido", "emitido", TRANSICOES_PEDIDO)).toEqual(["emitido"]);
  });

  it("sem caminho devolve nulo", () => {
    expect(caminho("entregue", "rascunho", TRANSICOES_PEDIDO)).toBeNull();
  });
});
