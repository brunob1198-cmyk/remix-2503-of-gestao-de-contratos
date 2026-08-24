import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENTIDADE_EVIDENCIA_LABEL,
  type EntidadeEvidencia,
} from "@/hooks/sgsst/useSgsstEvidencias";

/**
 * A evidência do SGSST é uma tabela só para doze entidades, e o preço dessa
 * escolha é não haver chave estrangeira: o banco não consegue garantir por FK que
 * `entidade_id` aponta para uma linha que existe.
 *
 * As mitigações são um CHECK, um trigger de validação e doze triggers de limpeza —
 * e as três só funcionam se as listas estiverem **em sincronia**. Uma entidade
 * acrescentada no TypeScript e esquecida no CHECK falha na hora de gravar;
 * esquecida no mapa do trigger, grava sem validação; esquecida na limpeza, deixa
 * foto órfã para sempre.
 *
 * Estes testes comparam o código com o SQL da migration, que é a única forma de
 * pegar essa divergência sem um banco de pé.
 */

const SQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260827100000_sgsst_evidencias_fotograficas.sql"
  ),
  "utf8"
);

/** As entidades declaradas no TypeScript, lidas do mapa de rótulos. */
const ENTIDADES = Object.keys(ENTIDADE_EVIDENCIA_LABEL) as EntidadeEvidencia[];

/** Extrai a lista do CHECK da coluna `entidade`. */
function entidadesDoCheck(): string[] {
  const bloco = SQL.slice(
    SQL.indexOf("entidade text NOT NULL CHECK (entidade IN ("),
    SQL.indexOf("entidade_id uuid NOT NULL")
  );
  return [...bloco.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
}

/** Extrai os pares entidade → tabela do mapa do trigger de validação. */
function mapaDoTrigger(): Record<string, string> {
  const bloco = SQL.slice(
    SQL.indexOf("v_tabela := CASE NEW.entidade"),
    SQL.indexOf("IF v_tabela IS NULL")
  );

  const mapa: Record<string, string> = {};
  for (const m of bloco.matchAll(/WHEN\s+'([A-Z_]+)'\s+THEN\s+'(\w+)'/g)) {
    mapa[m[1]] = m[2];
  }
  return mapa;
}

/** Extrai os pares do array de limpeza. */
function paresDaLimpeza(): Record<string, string> {
  const bloco = SQL.slice(
    SQL.indexOf("v_pares text[][] := ARRAY["),
    SQL.indexOf("FOREACH v_par SLICE 1")
  );

  const mapa: Record<string, string> = {};
  for (const m of bloco.matchAll(/ARRAY\['(\w+)',\s*'([A-Z_]+)'\]/g)) {
    mapa[m[2]] = m[1];
  }
  return mapa;
}

describe("as três listas de entidades estão em sincronia", () => {
  it("o TypeScript declara doze entidades", () => {
    // Se este número mudar, os três testes abaixo dizem onde falta acompanhar.
    expect(ENTIDADES).toHaveLength(12);
  });

  it("toda entidade do TypeScript está no CHECK da tabela", () => {
    // Faltando aqui, a gravação falha com erro de constraint na hora de anexar.
    const doCheck = entidadesDoCheck();
    const ausentes = ENTIDADES.filter((e) => !doCheck.includes(e));
    expect(ausentes).toEqual([]);
  });

  it("o CHECK não tem entidade que o TypeScript não conhece", () => {
    // Sobrando aqui, existe um valor gravável que nenhuma tela sabe exibir.
    const doCheck = entidadesDoCheck();
    const sobrando = doCheck.filter((e) => !ENTIDADES.includes(e as EntidadeEvidencia));
    expect(sobrando).toEqual([]);
  });

  it("toda entidade tem tabela mapeada no trigger de validação", () => {
    // Faltando aqui, o trigger não sabe onde conferir e a foto entra sem validação
    // de existência nem de empresa.
    const mapa = mapaDoTrigger();
    const ausentes = ENTIDADES.filter((e) => !mapa[e]);
    expect(ausentes).toEqual([]);
  });

  it("toda entidade tem trigger de limpeza na tabela pai", () => {
    // Faltando aqui, apagar o registro pai deixa as fotos órfãs para sempre —
    // invisíveis em qualquer tela e ocupando espaço no R2.
    const limpeza = paresDaLimpeza();
    const ausentes = ENTIDADES.filter((e) => !limpeza[e]);
    expect(ausentes).toEqual([]);
  });

  it("a tabela apontada na validação é a mesma da limpeza", () => {
    // Divergência aqui validaria contra uma tabela e limparia de outra.
    const mapa = mapaDoTrigger();
    const limpeza = paresDaLimpeza();

    const divergentes = ENTIDADES.filter((e) => mapa[e] !== limpeza[e]);
    expect(divergentes).toEqual([]);
  });
});

describe("a migration mantém as travas que a integridade depende", () => {
  it("recusa entidade sem tabela mapeada em vez de gravar em silêncio", () => {
    expect(SQL).toContain("IF v_tabela IS NULL");
    expect(SQL).toContain("não tem tabela mapeada");
  });

  it("confere existência E empresa, que é o que a chave estrangeira faria", () => {
    expect(SQL).toContain("WHERE id = $1 AND empresa_id = $2");
    expect(SQL).toContain("ou pertence a outra empresa");
  });

  it("mantém as regras de coerência da geolocalização", () => {
    expect(SQL).toContain("latitude e longitude precisam vir juntas");
    expect(SQL).toContain("Latitude fora da faixa válida");
    expect(SQL).toContain("Longitude fora da faixa válida");
    expect(SQL).toContain("A precisão não pode ser negativa");
  });

  it("barra coordenada e motivo de ausência na mesma linha", () => {
    // O selo impresso citaria os dois, afirmando e negando a mesma coisa.
    expect(SQL).toContain("os dois se contradizem");
  });

  it("declara as quatro políticas de RLS", () => {
    for (const acao of ["FOR SELECT", "FOR INSERT", "FOR UPDATE", "FOR DELETE"]) {
      expect(SQL).toContain(acao);
    }
  });
});

describe("rótulos das entidades", () => {
  it("cada entidade tem rótulo próprio, sem dois dizerem a mesma coisa", () => {
    const rotulos = Object.values(ENTIDADE_EVIDENCIA_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it("nenhum rótulo é o próprio código", () => {
    // Rótulo igual ao enum sairia como "EPI_MANUTENCAO" na tela.
    const iguais = ENTIDADES.filter((e) => ENTIDADE_EVIDENCIA_LABEL[e] === e);
    expect(iguais).toEqual([]);
  });
});
