import type { StatusPcmso } from "@/hooks/sgsst/useSgsstPcmso";

/**
 * O que dizer antes de excluir um PCMSO.
 *
 * Excluir um PCMSO não é uma operação neutra, e as consequências não são
 * simétricas:
 *
 * - O plano de exames do programa e o histórico dele são filhos e vão embora
 *   junto (`ON DELETE CASCADE`). Isso é correto: sem o programa eles não
 *   significam nada.
 * - Os ASOs e exames que APONTAVAM para o programa sobrevivem, mas perdem o
 *   vínculo (`ON DELETE SET NULL`). E o PDF do ASO imprime o PCMSO de
 *   referência — então um atestado já emitido passa a mostrar "—" nesse campo.
 *
 * A segunda consequência é a que ninguém adivinha, e é a que este módulo existe
 * para colocar na frente de quem confirma. A alternativa também precisa aparecer:
 * um programa real que saiu de uso deve ser CANCELADO ou ENCERRADO, que preserva
 * a trilha; excluir é para o registro que nunca deveria ter existido.
 */

export interface DependentesDoPcmso {
  asos: number;
  exames: number;
}

export interface AvisoExclusaoPcmso {
  /** Frases a mostrar, na ordem. A primeira é sempre a consequência mais grave. */
  linhas: string[];
  /**
   * True quando a exclusão vai desvincular documento já emitido. A tela usa para
   * escolher entre confirmação simples e confirmação com destaque.
   */
  desvinculaDocumento: boolean;
  /**
   * True quando cancelar/encerrar é a ação mais adequada que excluir — programa
   * fora de rascunho já produziu efeito e a trilha vale mais que a limpeza.
   */
  sugereCancelarEmVez: boolean;
}

export function avisoExclusaoPcmso(params: {
  status: StatusPcmso;
  dependentes: DependentesDoPcmso;
}): AvisoExclusaoPcmso {
  const { status, dependentes } = params;
  const { asos, exames } = dependentes;
  const total = asos + exames;

  const linhas: string[] = [];

  if (total > 0) {
    const partes: string[] = [];
    if (asos > 0) partes.push(`${asos} ASO${asos > 1 ? "s" : ""}`);
    if (exames > 0) partes.push(`${exames} exame${exames > 1 ? "s" : ""}`);

    linhas.push(
      `${partes.join(" e ")} apontam para este PCMSO. Os registros NÃO são apagados, ` +
        `mas perdem o vínculo com o programa que os exigiu — e o PDF do ASO imprime o ` +
        `PCMSO de referência, que passará a sair em branco.`
    );
  }

  linhas.push(
    "O plano de exames e o histórico deste programa são apagados junto, por serem " +
      "parte dele."
  );

  const sugereCancelarEmVez = status !== "RASCUNHO";
  if (sugereCancelarEmVez) {
    linhas.push(
      `Este PCMSO está ${status}, ou seja, já saiu do rascunho. Programa que produziu ` +
        `efeito costuma pedir CANCELADO ou ENCERRADO em vez de exclusão: o status ` +
        `preserva a trilha, e a NR-07 se sustenta no histórico. Excluir é para o ` +
        `registro que nunca deveria ter existido.`
    );
  }

  return { linhas, desvinculaDocumento: total > 0, sugereCancelarEmVez };
}
