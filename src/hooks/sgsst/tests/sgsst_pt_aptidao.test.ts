import { describe, it, expect } from "vitest";
import {
  atividadeExigidaPorTipoDePt,
  autorizacaoNaPt,
  type AsoParaAutorizacao,
} from "@/utils/sgsstAptidaoAso";

/**
 * O portão que faltava.
 *
 * `apto_altura` e `apto_espaco_confinado` eram gravados e impressos, e ninguém os
 * consultava: dava para marcar INAPTO para altura no ASO e autorizar o mesmo
 * trabalhador numa PT de Trabalho em Altura. E o formulário do ASO afirmava que a
 * PT consultava esses campos — promessa escrita, ligação inexistente.
 */

const HOJE = new Date(2026, 8, 4); // 04/09/2026

const aso = (p: Partial<AsoParaAutorizacao> = {}): AsoParaAutorizacao => ({
  aptidao: "APTO",
  apto_altura: "APTO",
  apto_espaco_confinado: "APTO",
  apto_maquinas: "APTO",
  validade: "2027-08-25",
  status: "ATIVO",
  ...p,
});

describe("atividadeExigidaPorTipoDePt", () => {
  it("liga altura e espaço confinado às aptidões que o ASO avalia", () => {
    expect(atividadeExigidaPorTipoDePt("Trabalho em Altura")).toBe("ALTURA");
    expect(atividadeExigidaPorTipoDePt("Espaço Confinado")).toBe("ESPACO_CONFINADO");
  });

  it("compara sem depender de caixa", () => {
    expect(atividadeExigidaPorTipoDePt("TRABALHO EM ALTURA")).toBe("ALTURA");
  });

  it("não exige aptidão que o ASO não responde", () => {
    // Eletricidade exige aptidão pela NR-10 e içamento envolve máquina, mas o ASO
    // não tem campo para nenhum dos dois. Exigir aqui travaria a PT sem que
    // houvesse como satisfazer.
    expect(atividadeExigidaPorTipoDePt("Trabalho com Eletricidade")).toBeNull();
    expect(atividadeExigidaPorTipoDePt("Içamento")).toBeNull();
    expect(atividadeExigidaPorTipoDePt("Trabalho a Quente")).toBeNull();
    expect(atividadeExigidaPorTipoDePt(null)).toBeNull();
  });
});

describe("autorizacaoNaPt", () => {
  it("BLOQUEIA quem o ASO declara INAPTO para altura", () => {
    // É o caso do roteiro 5.8, que o sistema aceitava.
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ apto_altura: "INAPTO" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
    if (r.autoriza !== false) throw new Error("deveria bloquear");
    expect(r.motivo).toContain("INAPTO");
    expect(r.comoResolver).toContain("médico examinador");
  });

  it("bloqueia INAPTO para espaço confinado na PT de espaço confinado", () => {
    const r = autorizacaoNaPt({
      tipoPt: "Espaço Confinado",
      aso: aso({ apto_espaco_confinado: "INAPTO" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
  });

  it("INAPTO para altura NÃO bloqueia PT de outro tipo", () => {
    // O portão é por atividade: inapto para altura pode trabalhar a quente.
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho a Quente",
      aso: aso({ apto_altura: "INAPTO" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(true);
  });

  it("campo em branco NÃO autoriza — em branco é 'ninguém avaliou'", () => {
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ apto_altura: null }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
    if (r.autoriza !== false) throw new Error("deveria bloquear");
    expect(r.motivo).toContain("não avaliou");
  });

  it("'não se aplica' NÃO autoriza — é resposta, não liberação", () => {
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ apto_altura: "NAO_SE_APLICA" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
    if (r.autoriza !== false) throw new Error("deveria bloquear");
    expect(r.motivo).toContain("não se aplica");
  });

  it("sem ASO nenhum, bloqueia apontando o documento e não o campo", () => {
    const r = autorizacaoNaPt({ tipoPt: "Trabalho em Altura", aso: null, hoje: HOJE });
    expect(r.autoriza).toBe(false);
    if (r.autoriza !== false) throw new Error("deveria bloquear");
    expect(r.motivo).toContain("sem ASO");
  });

  it("ASO vencido não autoriza, mesmo com todos os campos APTO", () => {
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ validade: "2026-09-03" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
    if (r.autoriza !== false) throw new Error("deveria bloquear");
    expect(r.motivo).toContain("vencido");
  });

  it("vencendo HOJE ainda autoriza — o dia da validade é dia válido", () => {
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ validade: "2026-09-04" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(true);
  });

  it("ASO substituído ou cancelado não autoriza", () => {
    for (const status of ["SUBSTITUIDO", "CANCELADO"]) {
      const r = autorizacaoNaPt({
        tipoPt: "Trabalho em Altura",
        aso: aso({ status }),
        hoje: HOJE,
      });
      expect(r.autoriza, status).toBe(false);
    }
  });

  it("conclusão geral não preenchida bloqueia antes de olhar a atividade", () => {
    // Ordem da gravidade: falta a conclusão do médico, então a mensagem é sobre
    // ela — e não sobre o campo de altura, que nem chega a ser consultado.
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ aptidao: null }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
    if (r.autoriza !== false) throw new Error("deveria bloquear");
    expect(r.comoResolver).toContain("não registrou a conclusão");
  });

  it("INAPTO para a função bloqueia qualquer PT que exija aptidão", () => {
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ aptidao: "INAPTO" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(false);
  });

  it("apto com restrição na função, e APTO na atividade, autoriza", () => {
    // A restrição pode ser sobre outra coisa; quem responde pela atividade é o
    // campo específico, e ele está APTO.
    const r = autorizacaoNaPt({
      tipoPt: "Trabalho em Altura",
      aso: aso({ aptidao: "APTO_COM_RESTRICAO" }),
      hoje: HOJE,
    });
    expect(r.autoriza).toBe(true);
  });

  it("tudo em ordem autoriza", () => {
    expect(autorizacaoNaPt({ tipoPt: "Trabalho em Altura", aso: aso(), hoje: HOJE }).autoriza).toBe(
      true
    );
  });
});
