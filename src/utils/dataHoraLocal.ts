/**
 * Data digitada na tela é hora LOCAL. `new Date("2026-09-04")` não é.
 *
 * O DEFEITO
 *
 * `new Date("2026-09-04")` — string só com data — é interpretado pelo JavaScript
 * como meia-noite UTC. No Brasil (GMT-3) isso é 03/09 às 21:00. Então a PT que o
 * usuário emitiu para o dia 4 aparecia na tela de detalhe como:
 *
 *     Início da Validade: 03/09/2026 21:00
 *
 * Um dia antes, num horário que ninguém digitou. E o formulário de edição, que
 * lia de volta com `iso.split("T")[0]`, mostrava "2026-09-04" — a data UTC. O
 * mesmo registro, no mesmo aplicativo, dizendo dois dias diferentes.
 *
 * Numa Permissão de Trabalho isso não é cosmético: é o papel afixado no local
 * dizendo de quando até quando aquele serviço está autorizado. Um dia a menos
 * autoriza cedo demais, ou faz a permissão parecer vencida no dia certo.
 *
 * A REGRA
 *
 * Acrescentar a hora força a leitura local: `new Date("2026-09-04T00:00")` é
 * meia-noite NO FUSO DE QUEM DIGITOU. É a única diferença entre as duas
 * chamadas, e é toda a diferença.
 *
 * Na volta, o mesmo cuidado: montar o texto do campo a partir dos componentes
 * locais (`getFullYear`, `getMonth`…), nunca recortando o ISO — que está em UTC.
 */

/** Dois dígitos, para compor o texto que o input espera. */
const dd = (n: number) => String(n).padStart(2, "0");

/**
 * Texto do campo (`date` ou `datetime-local`) para ISO, lendo como hora local.
 *
 * Aceita "2026-09-04" e "2026-09-04T07:30". Devolve null para vazio ou inválido
 * — o chamador decide se isso é erro ou ausência.
 */
export function isoDoCampoLocal(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (!texto) return null;

  // Sem hora, o JavaScript leria como UTC. Com hora, lê como local.
  const comHora = texto.includes("T") ? texto : `${texto}T00:00`;

  const data = new Date(comHora);
  if (Number.isNaN(data.getTime())) return null;

  return data.toISOString();
}

/**
 * ISO para o texto de um `datetime-local`, em hora local.
 *
 * Recortar o ISO (`iso.slice(0, 16)`) devolveria a hora UTC — que é justamente
 * o que fazia o formulário e a tela discordarem.
 */
export function campoLocalDoIso(iso: string | null | undefined): string {
  if (!iso) return "";

  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";

  return (
    `${data.getFullYear()}-${dd(data.getMonth() + 1)}-${dd(data.getDate())}` +
    `T${dd(data.getHours())}:${dd(data.getMinutes())}`
  );
}

/** ISO para o texto de um `date`, em hora local. */
export function dataLocalDoIso(iso: string | null | undefined): string {
  return campoLocalDoIso(iso).slice(0, 10);
}
