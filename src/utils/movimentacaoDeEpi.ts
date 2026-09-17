/**
 * O que impede entregar e o que impede devolver um EPI.
 *
 * ONDE ESTAVA O BURACO
 *
 * Roteiro 13.3, 13.5 e 13.9. As três travas existem — mas no BANCO, em triggers
 * (`check_sgsst_epi_entrega`, `check_sgsst_epi_devolucao`). A tela repetia parte
 * delas por conta própria, e repetia errado:
 *
 *     max={selectedEpi?.estoque_atual || 100}
 *     max={selectedEntrega?.quantidade || 100}
 *
 * `||` trata **zero como ausência**. Com estoque zero, o teto do campo virava
 * CEM — o formulário convidava a digitar 40 unidades de um EPI que não existe em
 * prateleira, e só o banco recusava, depois de a pessoa ter preenchido tudo.
 *
 * Não era falha de integridade: o trigger segurava. Era a tela mentindo sobre o
 * que aceita, que é o mesmo defeito do `accept` do upload (R14) e do asterisco
 * que não obrigava (R15) — configuração visível que não corresponde à regra.
 *
 * O QUE ESTE ARQUIVO NÃO TENTA FAZER
 *
 * Não duplica a regra da devolução acumulada. O teto real de uma devolução é
 * `entregue − já devolvido`, e a tela não carrega as devoluções anteriores; quem
 * sabe isso é o banco, e é lá que a conta tem de morar — duas contas iguais em
 * lugares diferentes divergem, e a que diverge em silêncio é a do cliente.
 *
 * Aqui fica só o que a tela sabe: o teto da entrega é o estoque, o teto de uma
 * devolução isolada é o que aquela entrega teve, e zero é zero.
 */

import type { StatusValidadeCa } from "@/utils/sgsstEpiUtils";

export interface EpiParaEntrega {
  nome?: string | null;
  statusValidadeCa?: StatusValidadeCa | null;
  estoque_atual?: number | null;
}

/**
 * O motivo de a entrega não poder acontecer, ou `null` quando pode.
 *
 * Devolve a frase pronta e não um booleano: "bloqueado" sem dizer por quê obriga
 * quem está no almoxarifado a adivinhar entre CA, estoque e permissão.
 */
export function impedimentoDaEntrega(epi?: EpiParaEntrega | null): string | null {
  if (!epi) return null;

  if (epi.statusValidadeCa === "VENCIDO") {
    return (
      "O CA deste EPI está vencido. A NR-06 6.2 proíbe fornecer equipamento " +
      "sem Certificado de Aprovação válido."
    );
  }

  if ((epi.estoque_atual ?? 0) <= 0) {
    return "Sem estoque deste EPI. Registre a entrada antes de entregar.";
  }

  return null;
}

/**
 * O teto do campo de quantidade da entrega.
 *
 * `undefined` quando nenhum EPI foi escolhido — aí não há teto a afirmar. Zero
 * continua zero: o campo fica impossível de satisfazer, que é a verdade, e o
 * impedimento acima explica o porquê em palavras.
 */
export function tetoDaEntrega(epi?: EpiParaEntrega | null): number | undefined {
  if (!epi) return undefined;
  const estoque = epi.estoque_atual;
  if (estoque === null || estoque === undefined || !Number.isFinite(estoque)) {
    return undefined;
  }
  return Math.max(0, Math.trunc(estoque));
}

/**
 * O teto do campo de quantidade da devolução, pelo que a tela sabe.
 *
 * É o que aquela entrega teve. O saldo real desconta as devoluções anteriores e
 * é conferido pelo banco — ver o comentário no topo.
 */
export function tetoDaDevolucao(
  entrega?: { quantidade?: number | null } | null
): number | undefined {
  if (!entrega) return undefined;
  const q = entrega.quantidade;
  if (q === null || q === undefined || !Number.isFinite(q)) return undefined;
  return Math.max(0, Math.trunc(q));
}
