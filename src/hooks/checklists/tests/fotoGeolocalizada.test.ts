import { describe, it, expect } from "vitest";
import {
  qualidadeDaCoordenada,
  formatarCoordenada,
  linkDoMapa,
  seloDaFoto,
  conferirNoLocal,
  QUALIDADE_GEO_LABEL,
  SITUACAO_NO_LOCAL_LABEL,
  PRECISAO_BOA_METROS,
  PRECISAO_RUIM_METROS,
} from "@/utils/fotoGeolocalizada";

/**
 * O sistema capturava coordenada no início e no fim da aplicação — o que responde
 * "onde a pessoa estava quando abriu e fechou", não "onde esta foto foi tirada".
 * Entre abrir e fechar um checklist de trinta itens passam horas e quilômetros.
 *
 * O que estes testes protegem é a distinção que faz o selo ser honesto: **precisão
 * ruim não é ausência de coordenada**, e nenhuma das duas é "fora da área".
 */

const OBRA = { latitude: -16.6799, longitude: -49.2550 };

describe("qualidadeDaCoordenada", () => {
  it("precisão fina é BOA", () => {
    expect(qualidadeDaCoordenada({ latitude: -16.68, longitude: -49.25, precisao: 8 })).toBe("BOA");
  });

  it("no limite da precisão boa ainda é BOA", () => {
    const r = qualidadeDaCoordenada({
      latitude: -16.68,
      longitude: -49.25,
      precisao: PRECISAO_BOA_METROS,
    });
    expect(r).toBe("BOA");
  });

  it("um metro acima do limite já é RAZOAVEL", () => {
    const r = qualidadeDaCoordenada({
      latitude: -16.68,
      longitude: -49.25,
      precisao: PRECISAO_BOA_METROS + 1,
    });
    expect(r).toBe("RAZOAVEL");
  });

  it("precisão grosseira é RUIM", () => {
    // 800 m localiza o bairro, nao o andaime — e apresentar como se localizasse o
    // andaime e pior que dizer que nao ha ponto.
    const r = qualidadeDaCoordenada({ latitude: -16.68, longitude: -49.25, precisao: 800 });
    expect(r).toBe("RUIM");
  });

  it("no limite do ruim ainda é RAZOAVEL", () => {
    const r = qualidadeDaCoordenada({
      latitude: -16.68,
      longitude: -49.25,
      precisao: PRECISAO_RUIM_METROS,
    });
    expect(r).toBe("RAZOAVEL");
  });

  it("coordenada sem precisão informada é RAZOAVEL, não BOA nem RUIM", () => {
    // Ha ponto e nao se pode afirmar que e bom nem ruim. Chamar de boa afirmaria
    // mais do que se sabe; chamar de ruim descartaria dado provavelmente util.
    const r = qualidadeDaCoordenada({ latitude: -16.68, longitude: -49.25 });
    expect(r).toBe("RAZOAVEL");
  });

  it("sem coordenada é SEM_COORDENADA", () => {
    expect(qualidadeDaCoordenada(null)).toBe("SEM_COORDENADA");
    expect(qualidadeDaCoordenada({})).toBe("SEM_COORDENADA");
    expect(qualidadeDaCoordenada({ latitude: -16.68 })).toBe("SEM_COORDENADA");
    expect(qualidadeDaCoordenada({ latitude: null, longitude: null })).toBe("SEM_COORDENADA");
  });

  it("coordenada não finita não passa por válida", () => {
    const r = qualidadeDaCoordenada({
      latitude: Number.NaN,
      longitude: -49.25,
      precisao: 5,
    });
    expect(r).toBe("SEM_COORDENADA");
  });

  it("latitude zero é coordenada válida, não ausência", () => {
    // Zero e um valor legitimo. Tratar como falsy descartaria pontos na linha do
    // Equador e no meridiano de Greenwich.
    expect(qualidadeDaCoordenada({ latitude: 0, longitude: 0, precisao: 5 })).toBe("BOA");
  });

  it("cada qualidade tem rótulo próprio", () => {
    const rotulos = Object.values(QUALIDADE_GEO_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

describe("formatarCoordenada e linkDoMapa", () => {
  it("formata com seis casas", () => {
    const r = formatarCoordenada({ latitude: -16.6799123, longitude: -49.2550456 });
    expect(r).toBe("-16.679912, -49.255046");
  });

  it("sem coordenada devolve travessão", () => {
    expect(formatarCoordenada(null)).toBe("—");
  });

  it("o link abre o ponto no mapa", () => {
    const r = linkDoMapa({ latitude: -16.6799, longitude: -49.255 });
    expect(r).toContain("maps?q=-16.679900,-49.255000");
  });

  it("sem coordenada não há link", () => {
    expect(linkDoMapa({})).toBeNull();
  });
});

describe("seloDaFoto", () => {
  it("junta coordenada, precisão, horário e origem", () => {
    const r = seloDaFoto({
      coord: { latitude: -16.6799, longitude: -49.255, precisao: 12 },
      capturadaEm: "2026-08-25T14:30:00.000Z",
      origem: "CAMERA",
    });
    expect(r.texto).toContain("-16.679900, -49.255000");
    expect(r.texto).toContain("±12 m");
    expect(r.texto).toContain("Foto tirada na hora");
    expect(r.qualidade).toBe("BOA");
  });

  it("foto sem coordenada diz o motivo quando ele é conhecido", () => {
    const r = seloDaFoto({
      coord: null,
      motivoSemCoordenada: "permissão de localização negada",
    });
    expect(r.texto).toContain("Sem localização");
    expect(r.texto).toContain("permissão de localização negada");
    expect(r.alerta).toBe(true);
  });

  it("sem motivo conhecido, diz apenas que não há localização", () => {
    const r = seloDaFoto({ coord: null });
    expect(r.texto).toBe("Sem localização");
  });

  it("foto boa tirada na câmera não alerta", () => {
    const r = seloDaFoto({
      coord: { latitude: -16.68, longitude: -49.25, precisao: 10 },
      origem: "CAMERA",
    });
    expect(r.alerta).toBe(false);
  });

  it("arquivo da galeria alerta, mesmo com coordenada boa", () => {
    // Nao e erro: e informacao que muda o peso da evidencia, e quem confere
    // precisa notar sem procurar.
    const r = seloDaFoto({
      coord: { latitude: -16.68, longitude: -49.25, precisao: 10 },
      origem: "ARQUIVO",
    });
    expect(r.alerta).toBe(true);
  });

  it("precisão ruim alerta", () => {
    const r = seloDaFoto({
      coord: { latitude: -16.68, longitude: -49.25, precisao: 900 },
      origem: "CAMERA",
    });
    expect(r.qualidade).toBe("RUIM");
    expect(r.alerta).toBe(true);
  });

  it("horário inválido não quebra o selo", () => {
    const r = seloDaFoto({ coord: null, capturadaEm: "data-torta" });
    expect(r.texto).toContain("data-torta");
  });
});

describe("conferirNoLocal", () => {
  it("dentro do raio é DENTRO", () => {
    const r = conferirNoLocal({
      coord: { latitude: -16.6799, longitude: -49.2551, precisao: 10 },
      referencia: OBRA,
      raioMetros: 200,
    });
    expect(r.situacao).toBe("DENTRO");
    expect(r.distanciaMetros).toBeLessThan(200);
  });

  it("bem longe é FORA, com a distância", () => {
    const r = conferirNoLocal({
      // Sao Paulo, a mais de 800 km de Goiania.
      coord: { latitude: -23.5505, longitude: -46.6333, precisao: 10 },
      referencia: OBRA,
      raioMetros: 200,
    });
    expect(r.situacao).toBe("FORA");
    expect(r.distanciaMetros).toBeGreaterThan(500_000);
  });

  it("a precisão entra como margem: no limite, não acusa fora", () => {
    // Um ponto pouco alem do raio, com incerteza que o cobre, pode estar dentro —
    // acusar "fora" trataria a margem de erro como certeza.
    const referencia = { latitude: 0, longitude: 0 };

    // ~222 m ao norte de (0,0): 0,002 grau de latitude.
    const coord = { latitude: 0.002, longitude: 0, precisao: 60 };

    const semMargem = conferirNoLocal({ coord: { ...coord, precisao: 0 }, referencia, raioMetros: 200 });
    const comMargem = conferirNoLocal({ coord, referencia, raioMetros: 200 });

    expect(semMargem.situacao).toBe("FORA");
    expect(comMargem.situacao).toBe("DENTRO");
  });

  it("obra sem coordenada de referência não acusa nada", () => {
    // Acusar "fora da area" por falta de cadastro puniria o inspetor por uma
    // referencia que ninguem informou.
    const r = conferirNoLocal({
      coord: { latitude: -16.68, longitude: -49.25 },
      referencia: null,
      raioMetros: 200,
    });
    expect(r.situacao).toBe("SEM_REFERENCIA");
    expect(r.distanciaMetros).toBeNull();
  });

  it("raio zero ou ausente conta como sem referência", () => {
    expect(
      conferirNoLocal({ coord: { latitude: 0, longitude: 0 }, referencia: OBRA, raioMetros: 0 })
        .situacao
    ).toBe("SEM_REFERENCIA");
    expect(
      conferirNoLocal({ coord: { latitude: 0, longitude: 0 }, referencia: OBRA }).situacao
    ).toBe("SEM_REFERENCIA");
  });

  it("foto sem coordenada é estado próprio, não FORA", () => {
    const r = conferirNoLocal({ coord: null, referencia: OBRA, raioMetros: 200 });
    expect(r.situacao).toBe("SEM_COORDENADA");
  });

  it("cada situação tem rótulo próprio", () => {
    const rotulos = Object.values(SITUACAO_NO_LOCAL_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});
