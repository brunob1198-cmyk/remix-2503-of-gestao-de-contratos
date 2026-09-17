/**
 * Máscara de telefone brasileiro, para digitação.
 *
 * `(62) 3300-1148` para fixo de 10 dígitos e `(62) 93300-1148` para celular de
 * 11. A máscara é aplicada enquanto se digita, então precisa funcionar em número
 * incompleto — `(62) 3300` é um estado legítimo de quem ainda está escrevendo.
 *
 * POR QUE NÃO TRUNCAR O QUE PASSA DE 11 DÍGITOS
 *
 * A saída fácil seria cortar em 11 e formatar. Mas quem cola `+55 62 3300-1148`
 * fica com 12 dígitos, e cortar o excesso produziria **um telefone que não é o
 * que a pessoa colou** — num campo que vai para o rodapé de todo documento da
 * empresa.
 *
 * Acima de 11 dígitos a máscara desiste e devolve os dígitos como vieram. Campo
 * sem formatação é visivelmente estranho e a pessoa corrige; número errado e bem
 * formatado passa despercebido até alguém tentar ligar.
 */

/** Só os dígitos, que é o que a máscara sabe posicionar. */
function digitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

export function mascararTelefone(valor: string): string {
  const d = digitos(valor);

  if (d.length === 0) return "";

  // Acima do que a numeração brasileira comporta: devolve sem formatar em vez de
  // inventar um número. Ver o comentário no topo.
  if (d.length > 11) return d;

  // Só o DDD, ainda sendo digitado.
  if (d.length <= 2) return `(${d}`;

  const ddd = d.slice(0, 2);
  const resto = d.slice(2);

  /*
    O hífen entra DEPOIS do quarto dígito, e não quatro antes do fim.

    A primeira versão contava do fim — o que dá o mesmo resultado no número
    completo, mas move o hífen a cada tecla enquanto se digita: `330-0114` num
    momento, `3300-1148` no seguinte. Contando do começo, ele entra uma vez e
    fica.

    O celular tem nove dígitos depois do DDD e o corte sobe para cinco, para o
    bloco final continuar com quatro: `(62) 93300-1148`.
  */
  if (resto.length <= 4) return `(${ddd}) ${resto}`;

  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Verdadeiro quando o número tem a quantidade de dígitos de um telefone brasileiro. */
export function telefoneCompleto(valor: string): boolean {
  const d = digitos(valor);
  return d.length === 10 || d.length === 11;
}
