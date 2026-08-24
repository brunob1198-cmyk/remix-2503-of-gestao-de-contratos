import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { temMetadadoDeCaptura } from "@/components/comum/SeloDaFotoNaMiniatura";
import { seloDaFoto } from "@/utils/fotoGeolocalizada";

/**
 * As fotos do Diário de Obra existiam desde sempre — com grupo, ordem e legenda —
 * e não guardavam nem onde nem quando foram tiradas. O diário é o documento que o
 * cliente lê, e a medição é paga em cima dele: a glosa costuma vir de foto que o
 * fiscal não reconhece como sendo daquela frente de serviço.
 *
 * O que estes testes protegem:
 *
 * 1. **Ausência de selo e selo dizendo ausência são coisas diferentes.** Todo o
 *    histórico do projeto foi gravado antes de a coordenada existir. Escrever "sem
 *    localização" numa foto de 2025 acusaria de falta algo que o sistema nem
 *    pedia; deixar sem selo diz apenas que aquela versão não registrava.
 *
 * 2. **As travas do banco.** O selo é montado das colunas; coordenada incoerente
 *    produz selo que afirma o que os dados não sustentam.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260828100000_diario_fotos_geolocalizacao.sql"),
  "utf8"
);

describe("temMetadadoDeCaptura — separa foto antiga de foto sem GPS", () => {
  it("foto antiga, sem nada gravado, não tem metadado", () => {
    // Sem isto, toda foto do histórico ganharia um selo de "sem localização" que
    // parece defeito da foto e é apenas a idade do registro.
    expect(temMetadadoDeCaptura({})).toBe(false);
  });

  it("foto com coordenada tem metadado", () => {
    expect(temMetadadoDeCaptura({ latitude: -16.68, longitude: -49.26 })).toBe(true);
  });

  it("foto com hora de captura tem metadado, mesmo sem coordenada", () => {
    expect(temMetadadoDeCaptura({ capturada_em: "2026-08-24T10:00:00Z" })).toBe(true);
  });

  it("a tentativa que falhou tem metadado, e é o caso que mais importa", () => {
    // GPS negado é informação: a captura tentou registrar e não conseguiu. Isso
    // precisa aparecer, ao contrário da foto antiga que nem tentou.
    expect(temMetadadoDeCaptura({ motivo_sem_geo: "permissão negada" })).toBe(true);
  });

  it("só a origem já basta", () => {
    expect(temMetadadoDeCaptura({ origem_captura: "CAMERA" })).toBe(true);
  });

  it("nulos explícitos são tratados como ausência", () => {
    const r = temMetadadoDeCaptura({
      latitude: null,
      longitude: null,
      precisao_metros: null,
      capturada_em: null,
      origem_captura: null,
      motivo_sem_geo: null,
    });
    expect(r).toBe(false);
  });
});

describe("o selo do diário distingue os casos que pesam diferente", () => {
  it("câmera com boa precisão não alerta", () => {
    const selo = seloDaFoto({
      coord: { latitude: -16.6869, longitude: -49.2648, precisao: 8 },
      capturadaEm: "2026-08-24T13:00:00.000Z",
      origem: "CAMERA",
    });
    expect(selo.alerta).toBe(false);
  });

  it("arquivo escolhido da galeria alerta, mesmo com coordenada boa", () => {
    // A coordenada é de quem enviou, e não de onde a foto foi tirada. Quem confere
    // precisa notar isso sem procurar.
    const selo = seloDaFoto({
      coord: { latitude: -16.6869, longitude: -49.2648, precisao: 8 },
      capturadaEm: "2026-08-24T13:00:00.000Z",
      origem: "ARQUIVO",
    });
    expect(selo.alerta).toBe(true);
  });

  it("sem coordenada, o motivo entra no selo", () => {
    // "Permissão negada" e "sinal indisponível" pesam diferente na conferência.
    const selo = seloDaFoto({
      coord: null,
      origem: "CAMERA",
      motivoSemCoordenada: "permissão de localização negada",
    });
    expect(selo.texto).toContain("permissão de localização negada");
    expect(selo.alerta).toBe(true);
  });
});

describe("a migration mantém as travas de coerência", () => {
  it("alcança as duas tabelas de foto do diário", () => {
    // O Diário de Campo é o único lugar do projeto que já tinha câmera, e também
    // não guardava coordenada.
    expect(SQL).toContain("ALTER TABLE public.diario_fotos");
    expect(SQL).toContain("ALTER TABLE public.diario_campo_fotos");
  });

  it("as colunas são idempotentes, para a migration poder rodar de novo", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS latitude");
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS motivo_sem_geo");
  });

  it("as colunas nascem nulas, sem preencher o histórico com valor inventado", () => {
    // `NOT NULL DEFAULT` aqui faria toda foto antiga passar a afirmar uma
    // localização que ninguém registrou.
    expect(SQL).not.toContain("latitude numeric(10, 7) NOT NULL");
  });

  it("a origem é restrita a CAMERA e ARQUIVO", () => {
    expect(SQL).toContain("origem_captura IN ('CAMERA', 'ARQUIVO')");
  });

  it("meia coordenada é recusada", () => {
    expect(SQL).toContain("latitude e longitude precisam vir juntas");
  });

  it("coordenada fora da faixa é recusada", () => {
    expect(SQL).toContain("Latitude fora da faixa válida");
    expect(SQL).toContain("Longitude fora da faixa válida");
  });

  it("precisão negativa é recusada", () => {
    // Sairia "±-30 m" no selo.
    expect(SQL).toContain("A precisão não pode ser negativa");
  });

  it("coordenada e motivo de ausência na mesma linha é recusado", () => {
    // O selo diria ao mesmo tempo onde a foto foi tirada e que não se sabe onde.
    expect(SQL).toContain("os dois se contradizem");
  });

  it("as duas tabelas têm o trigger, e não só uma", () => {
    expect(SQL).toContain("CREATE TRIGGER trg_check_diario_foto_geo");
    expect(SQL).toContain("CREATE TRIGGER trg_check_diario_campo_foto_geo");
  });

  it("os triggers são recriáveis", () => {
    expect(SQL).toContain("DROP TRIGGER IF EXISTS trg_check_diario_foto_geo");
    expect(SQL).toContain("DROP TRIGGER IF EXISTS trg_check_diario_campo_foto_geo");
  });

  it("documenta que capturada_em não é a hora do envio", () => {
    // A distinção sustenta a fila offline do Diário de Campo: a foto é tirada no
    // campo e enviada quando o sinal volta.
    expect(SQL).toContain("não é o momento do envio");
  });
});
