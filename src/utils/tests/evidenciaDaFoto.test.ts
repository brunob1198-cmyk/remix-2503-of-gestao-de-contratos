import { describe, expect, it } from "vitest";
import { avisoDeFotoNaoEnviada, payloadDaEvidencia } from "../evidenciaDaFoto";
import type { FotoCapturada } from "@/components/comum/CapturaFotoCampo";

/**
 * Roteiro 13.13, agora no formulário de entrega.
 *
 * O mapeamento da foto para a linha de evidência passou a existir em dois
 * lugares — o painel de evidências e o formulário de entrega de EPI. Campo
 * esquecido aqui não dá erro: a foto entra sem coordenada ou sem o horário da
 * captura, e o selo do documento passa a mentir em silêncio.
 */

const arquivo = (nome = "epi.jpg", tipo = "image/jpeg", tamanho = 2048) =>
  ({ name: nome, type: tipo, size: tamanho }) as unknown as File;

const foto = (over: Partial<FotoCapturada> = {}): FotoCapturada => ({
  arquivo: arquivo(),
  origem: "CAMERA",
  capturadaEm: "2026-09-17T08:30:00.000Z",
  coordenada: { latitude: -16.68, longitude: -49.25, precisao: 12 },
  localidade: { municipio: "Goiânia", uf: "GO" },
  motivoSemGeo: null,
  ...over,
});

const base = { entidade: "EPI_ENTREGA" as const, entidadeId: "ent-1", url: "https://cdn/f.jpg" };

describe("payloadDaEvidencia", () => {
  it("leva a entidade e o registro a que a foto pertence", () => {
    const p = payloadDaEvidencia({ ...base, foto: foto() });
    expect(p.entidade).toBe("EPI_ENTREGA");
    expect(p.entidade_id).toBe("ent-1");
  });

  it("guarda o horário da CAPTURA, não o do envio", () => {
    // O selo do documento afirma quando a foto foi tirada. Gravar a hora do
    // envio transformaria o selo numa informação sobre o upload.
    expect(payloadDaEvidencia({ ...base, foto: foto() }).capturada_em).toBe(
      "2026-09-17T08:30:00.000Z"
    );
  });

  it("leva a coordenada e a precisão do instante da foto", () => {
    const p = payloadDaEvidencia({ ...base, foto: foto() });
    expect(p.latitude).toBe(-16.68);
    expect(p.longitude).toBe(-49.25);
    expect(p.precisao_metros).toBe(12);
  });

  it("distingue foto tirada na hora de foto escolhida da galeria", () => {
    expect(payloadDaEvidencia({ ...base, foto: foto() }).origem_captura).toBe("CAMERA");
    expect(
      payloadDaEvidencia({ ...base, foto: foto({ origem: "ARQUIVO" }) }).origem_captura
    ).toBe("ARQUIVO");
  });

  it("sem coordenada, o MOTIVO vai junto", () => {
    // Coordenada ausente sem explicação vira campo vazio, e quem confere não
    // sabe se faltou permissão, sinal ou se ninguém tentou.
    const p = payloadDaEvidencia({
      ...base,
      foto: foto({ coordenada: null, motivoSemGeo: "Permissão de localização negada" }),
    });

    expect(p.latitude).toBeNull();
    expect(p.longitude).toBeNull();
    expect(p.precisao_metros).toBeNull();
    expect(p.motivo_sem_geo).toBe("Permissão de localização negada");
  });

  it("leva nome, tipo e tamanho do arquivo", () => {
    const p = payloadDaEvidencia({ ...base, foto: foto() });
    expect(p.nome_arquivo).toBe("epi.jpg");
    expect(p.tipo_mime).toBe("image/jpeg");
    expect(p.tamanho).toBe(2048);
  });

  it("tipo e tamanho ausentes viram nulo, e não vazio ou zero mentiroso", () => {
    const p = payloadDaEvidencia({
      ...base,
      foto: foto({ arquivo: arquivo("s.jpg", "", 0) }),
    });
    expect(p.tipo_mime).toBeNull();
    expect(p.tamanho).toBeNull();
  });

  it("a legenda em branco não vira string vazia", () => {
    expect(payloadDaEvidencia({ ...base, foto: foto(), descricao: "   " }).descricao).toBeNull();
    expect(payloadDaEvidencia({ ...base, foto: foto() }).descricao).toBeNull();
  });

  it("a legenda preenchida chega sem espaço de sobra", () => {
    expect(
      payloadDaEvidencia({ ...base, foto: foto(), descricao: "  cinto novo  " }).descricao
    ).toBe("cinto novo");
  });

  it("chave e endereço recebem o mesmo valor do envio", () => {
    const p = payloadDaEvidencia({ ...base, foto: foto() });
    expect(p.r2_key).toBe("https://cdn/f.jpg");
    expect(p.r2_url).toBe("https://cdn/f.jpg");
  });
});

describe("avisoDeFotoNaoEnviada", () => {
  it("diz que a entrega FOI registrada, e não que falhou", () => {
    // A entrega move estoque e é um fato: o equipamento saiu da prateleira.
    // Sugerir que falhou levaria a pessoa a lançar tudo de novo e duplicar a
    // baixa.
    const m = avisoDeFotoNaoEnviada(1);
    expect(m).toMatch(/foi registrada/i);
    expect(m).toMatch(/não precisa ser refeito/i);
  });

  it("aponta onde completar", () => {
    expect(avisoDeFotoNaoEnviada(1)).toMatch(/botão de câmera/i);
  });

  it("concorda em número", () => {
    expect(avisoDeFotoNaoEnviada(1)).toContain("1 foto não subiu");
    expect(avisoDeFotoNaoEnviada(3)).toContain("3 fotos não subiram");
  });

  it("nenhuma falha não gera aviso", () => {
    expect(avisoDeFotoNaoEnviada(0)).toBe("");
    expect(avisoDeFotoNaoEnviada(-1)).toBe("");
  });
});

describe("payloadDaEvidencia — município e UF", () => {
  it("leva o nome do lugar junto com a coordenada", () => {
    const p = payloadDaEvidencia({
      entidade: "epi_entrega",
      entidadeId: "e1",
      foto: foto(),
      url: "https://r2/f.jpg",
    });
    expect(p.municipio).toBe("Goiânia");
    expect(p.uf).toBe("GO");
  });

  it("foto sem localidade apurada vai com os campos nulos", () => {
    // Obra sem sinal, serviço fora do ar: a evidência entra do mesmo jeito.
    const p = payloadDaEvidencia({
      entidade: "epi_entrega",
      entidadeId: "e1",
      foto: foto({ localidade: null }),
      url: "https://r2/f.jpg",
    });
    expect(p.municipio).toBeNull();
    expect(p.uf).toBeNull();
  });

  it("foto sem coordenada não leva município", () => {
    // O banco recusa município sem latitude: o nome deriva da coordenada.
    const p = payloadDaEvidencia({
      entidade: "epi_entrega",
      entidadeId: "e1",
      foto: foto({ coordenada: null, localidade: null, motivoSemGeo: "permissão negada" }),
      url: "https://r2/f.jpg",
    });
    expect(p.municipio).toBeNull();
    expect(p.latitude).toBeNull();
  });
});
