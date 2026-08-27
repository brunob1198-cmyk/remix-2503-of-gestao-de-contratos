/**
 * Data de calendário local, em "YYYY-MM-DD".
 *
 * Existe porque `new Date().toISOString().split("T")[0]` — o jeito curto e o mais
 * usado — devolve a data em UTC. Em fuso negativo, entre as 21h e a meia-noite
 * isso é o DIA SEGUINTE:
 *
 *   03/09/2026 21:30 em Goiânia  ->  toISOString() diz 2026-09-04
 *
 * Num campo de data de implementação, de conclusão ou de entrega, isso grava um
 * dia que não aconteceu — e num documento de conformidade a data é o que se
 * confere. Estas funções usam o calendário local, que é o que o usuário vê no
 * relógio dele.
 */

/** Converte um `Date` para "YYYY-MM-DD" pelo calendário local. */
export function comoIsoLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Hoje em "YYYY-MM-DD", pelo calendário local. */
export function hojeIso(agora: Date = new Date()): string {
  return comoIsoLocal(agora);
}
