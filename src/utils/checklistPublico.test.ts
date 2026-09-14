import { describe, expect, it } from "vitest";
import {
  aceitaNaoAplicavel,
  distanciaEmMetros,
  ehItemDeConformidade,
  ehNaoConforme,
  pendenciasDoEnvio,
  situacaoDaPosicao,
  valorConforme,
  valorNaoConforme,
  type ItemPublico,
} from "./checklistPublico";

const item = (p: Partial<ItemPublico> = {}): ItemPublico => ({
  id: "i1",
  titulo: "Carro limpo",
  tipo_resposta: "Conforme_NaoConforme",
  obrigatorio: true,
  exigir_comentario_nao_conforme: true,
  critico: false,
  ...p,
});

describe("vocabulário de resposta", () => {
  it("item Sim/Não grava Sim e Nao", () => {
    expect(valorConforme("Sim_Nao")).toBe("Sim");
    expect(valorNaoConforme("Sim_Nao")).toBe("Nao");
  });

  it("os demais gravam Conforme e NaoConforme", () => {
    expect(valorConforme("Conforme_NaoConforme_NA")).toBe("Conforme");
    expect(valorNaoConforme("OK_NaoOK")).toBe("NaoConforme");
  });

  it("o botão é sempre de CONFORMIDADE, e não de sim/não", () => {
    // A pergunta costuma ser "Houve arranhado?", em que "Sim" é a resposta ruim.
    // Rotular o botão como "Sim" inverteria o sentido do checklist inteiro; por
    // isso quem decide o texto do botão é a conformidade, e o tipo só decide a
    // string gravada.
    expect(valorNaoConforme("Sim_Nao")).toBe("Nao");
    expect(ehNaoConforme(valorNaoConforme("Sim_Nao"))).toBe(true);
    expect(ehNaoConforme(valorConforme("Sim_Nao"))).toBe(false);
  });

  it("só alguns tipos aceitam N/A", () => {
    expect(aceitaNaoAplicavel("Conforme_NaoConforme_NA")).toBe(true);
    expect(aceitaNaoAplicavel("Conforme_NaoConforme")).toBe(false);
  });

  it("campo livre não usa os botões de conformidade", () => {
    expect(ehItemDeConformidade("Texto")).toBe(false);
    expect(ehItemDeConformidade("Numero")).toBe(false);
    expect(ehItemDeConformidade("Sim_Nao_NA")).toBe(true);
  });
});

describe("pendenciasDoEnvio", () => {
  const quem = { nome: "Joao Motorista" };

  it("nome curto demais impede o envio", () => {
    // Sem nome, o checklist não identifica ninguém — e é o único vínculo que
    // sobra quando não há login.
    const p = pendenciasDoEnvio({ itens: [], respostas: {}, quem: { nome: "Jo" } });
    expect(p).toHaveLength(1);
    expect(p[0].itemId).toBe("__quem__");
  });

  it("item obrigatório sem resposta aparece", () => {
    const p = pendenciasDoEnvio({ itens: [item()], respostas: {}, quem });
    expect(p[0].motivo).toContain("obrigatório");
  });

  it("item crítico é exigido mesmo marcado como não obrigatório", () => {
    const p = pendenciasDoEnvio({
      itens: [item({ obrigatorio: false, critico: true })],
      respostas: {},
      quem,
    });
    expect(p).toHaveLength(1);
    expect(p[0].motivo).toContain("crítico");
  });

  it("item opcional em branco não atrapalha", () => {
    const p = pendenciasDoEnvio({
      itens: [item({ obrigatorio: false, tipo_resposta: "Texto" })],
      respostas: {},
      quem,
    });
    expect(p).toEqual([]);
  });

  it("não conformidade sem comentário é cobrada", () => {
    const p = pendenciasDoEnvio({
      itens: [item()],
      respostas: { i1: { valor: "NaoConforme" } },
      quem,
    });
    expect(p[0].motivo).toContain("comentário");
  });

  it("com o comentário, passa", () => {
    const p = pendenciasDoEnvio({
      itens: [item()],
      respostas: { i1: { valor: "NaoConforme", comentario: "Para-choque amassado" } },
      quem,
    });
    expect(p).toEqual([]);
  });

  it("conforme não exige comentário", () => {
    const p = pendenciasDoEnvio({
      itens: [item()],
      respostas: { i1: { valor: "Conforme" } },
      quem,
    });
    expect(p).toEqual([]);
  });

  it("item Sim/Não respondido com Nao é não conformidade e cobra comentário", () => {
    const p = pendenciasDoEnvio({
      itens: [item({ tipo_resposta: "Sim_Nao" })],
      respostas: { i1: { valor: "Nao" } },
      quem,
    });
    expect(p[0].motivo).toContain("comentário");
  });
});

describe("distanciaEmMetros", () => {
  it("o mesmo ponto dá zero", () => {
    const p = { latitude: -23.55052, longitude: -46.633308 };
    expect(distanciaEmMetros(p, p)).toBeCloseTo(0, 5);
  });

  it("bate com uma distância conhecida", () => {
    // ~111 km por grau de latitude no equador.
    const d = distanciaEmMetros(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 }
    );
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("situacaoDaPosicao", () => {
  const alvo = { latitudeAlvo: -23.55052, longitudeAlvo: -46.633308, raioEmMetros: 200 };

  it("modelo que não exige não cobra nada", () => {
    expect(
      situacaoDaPosicao({
        exigirGeolocalizacao: "nao",
        bloquearForaRaio: false,
        ...alvo,
      })
    ).toEqual({ estado: "NAO_EXIGIDA" });
  });

  it("dentro do raio", () => {
    const s = situacaoDaPosicao({
      exigirGeolocalizacao: "iniciar",
      bloquearForaRaio: true,
      ...alvo,
      posicao: { latitude: -23.5506, longitude: -46.6334 },
    });
    expect(s.estado).toBe("DENTRO");
  });

  it("fora do raio, e diz se isso bloqueia ou só fica registrado", () => {
    const longe = { latitude: -23.6, longitude: -46.7 };

    const registra = situacaoDaPosicao({
      exigirGeolocalizacao: "iniciar",
      bloquearForaRaio: false,
      ...alvo,
      posicao: longe,
    });
    // Um checklist de REGISTRO não pode barrar quem está vinte metros além do
    // portão; são duas coisas diferentes e ficam separadas.
    expect(registra).toMatchObject({ estado: "FORA", bloqueia: false });

    const barra = situacaoDaPosicao({
      exigirGeolocalizacao: "iniciar",
      bloquearForaRaio: true,
      ...alvo,
      posicao: longe,
    });
    expect(barra).toMatchObject({ estado: "FORA", bloqueia: true });
  });

  it("sem ponto alvo, a posição é só registrada", () => {
    const s = situacaoDaPosicao({
      exigirGeolocalizacao: "ambos",
      bloquearForaRaio: true,
      latitudeAlvo: null,
      longitudeAlvo: null,
      raioEmMetros: 200,
      posicao: { latitude: -23.9, longitude: -46.9 },
    });
    expect(s.estado).toBe("DENTRO");
  });

  it("permissão negada é estado próprio, e não 'fora do raio'", () => {
    // Confundir os dois diria ao usuário que ele está no lugar errado quando o
    // que houve foi ele não autorizar o GPS.
    const s = situacaoDaPosicao({
      exigirGeolocalizacao: "iniciar",
      bloquearForaRaio: true,
      ...alvo,
      permissaoNegada: true,
    });
    expect(s).toEqual({ estado: "SEM_PERMISSAO", bloqueia: true });
  });

  it("enquanto o aparelho não respondeu, é AGUARDANDO", () => {
    expect(
      situacaoDaPosicao({ exigirGeolocalizacao: "iniciar", bloquearForaRaio: false, ...alvo })
        .estado
    ).toBe("AGUARDANDO");
  });
});
