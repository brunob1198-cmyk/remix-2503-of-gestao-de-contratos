/**
 * O tipo de resposta do item e o controle que ele pede.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * O cadastro do modelo oferece nove tipos de resposta — Conforme/NC/NA,
 * Conforme/NC, Sim/Não/NA, Sim/Não, OK/Não OK, Escala de 1 a 5, Texto livre,
 * Valor numérico e Data. A tela de aplicação lia esse campo em duas linhas:
 *
 *   item.tipo_resposta.startsWith("Sim") ? "Sim" : "Conforme"
 *   item.tipo_resposta.includes("NA")
 *
 * Ou seja: reconhecia "Sim" e reconhecia "NA". Todo o resto caía no mesmo par de
 * botões Conforme / Não Conforme. Quem montava o modelo escolhia "Escala (1 a 5)"
 * e ia a campo achando que ia pontuar de 1 a 5; recebia dois botões. Quem
 * escolhia "Data" nunca via um campo de data. Quem escolhia "OK / Não OK" via
 * botões escritos "Conforme", e o que ficava gravado era `Conforme`.
 *
 * Cinco dos nove tipos eram enfeite: salvavam no banco e não mudavam nada.
 *
 * POR QUE O DESVIO É MARCADO À MÃO NOS TIPOS LIVRES
 *
 * `92`, `alta` e `16/09/2026` não dizem sozinhos se houve desvio: depende do
 * limite, e o limite não está no item. `calcularPontuacao` já tratava disso —
 * `is_nao_conforme` tem prioridade justamente porque "tipos de resposta livres
 * não têm valor 'não conforme' que se possa adivinhar". O cálculo estava pronto;
 * faltava a tela deixar a pessoa marcar.
 */

export type FormatoDaResposta = "botoes" | "escala" | "numero" | "texto" | "data";

export interface OpcaoDeResposta {
  /** O que vai gravado em `resposta_valor`. */
  valor: string;
  rotulo: string;
  /** Verdadeiro na opção que significa não conformidade. */
  naoConforme: boolean;
}

export interface ControleDaResposta {
  formato: FormatoDaResposta;
  /** Vazio nos formatos de campo livre. */
  opcoes: readonly OpcaoDeResposta[];
  temNaoAplicavel: boolean;
  /**
   * O valor não classifica sozinho: quem responde é que diz se aquilo é desvio.
   * Nos tipos de botão a própria opção já carrega a classificação.
   */
  desvioEhMarcadoAMao: boolean;
  /** Texto de apoio do campo livre; vazio nos tipos de botão. */
  dicaDoCampo: string;
}

const CONFORME: OpcaoDeResposta[] = [
  { valor: "Conforme", rotulo: "Conforme", naoConforme: false },
  { valor: "NaoConforme", rotulo: "Não Conforme", naoConforme: true },
];

const SIM_NAO: OpcaoDeResposta[] = [
  { valor: "Sim", rotulo: "Sim", naoConforme: false },
  { valor: "Nao", rotulo: "Não", naoConforme: true },
];

const OK: OpcaoDeResposta[] = [
  { valor: "OK", rotulo: "OK", naoConforme: false },
  { valor: "NaoOK", rotulo: "Não OK", naoConforme: true },
];

/**
 * A escala não tem lado bom fixo.
 *
 * Em "estado da plataforma" 5 é ótimo; em "nível de poeira" 5 é péssimo. Marcar 1
 * como não conformidade automaticamente inventaria um sentido que o modelo não
 * declara — por isso todas as notas saem neutras e o desvio é marcado à parte.
 */
const ESCALA: OpcaoDeResposta[] = [1, 2, 3, 4, 5].map((n) => ({
  valor: String(n),
  rotulo: String(n),
  naoConforme: false,
}));

const SEM_OPCOES: readonly OpcaoDeResposta[] = [];

export function controleDaResposta(tipo?: string | null): ControleDaResposta {
  const t = (tipo ?? "").trim();

  const livre = (formato: FormatoDaResposta, dica: string): ControleDaResposta => ({
    formato,
    opcoes: SEM_OPCOES,
    temNaoAplicavel: false,
    desvioEhMarcadoAMao: true,
    dicaDoCampo: dica,
  });

  switch (t) {
    case "Texto":
      return livre("texto", "O que foi observado");
    case "Numero":
      return livre("numero", "Valor medido");
    case "Data":
      return livre("data", "Data verificada");
    case "Escala":
      return {
        formato: "escala",
        opcoes: ESCALA,
        temNaoAplicavel: false,
        desvioEhMarcadoAMao: true,
        dicaDoCampo: "",
      };
    default:
      break;
  }

  const opcoes = t.startsWith("Sim") ? SIM_NAO : t.startsWith("OK") ? OK : CONFORME;

  return {
    formato: "botoes",
    opcoes,
    // Só os tipos que trazem NA no nome oferecem "não aplicável". Oferecer em
    // todos daria uma saída para fugir do item; não oferecer em nenhum obrigaria
    // a responder o que não se aplica.
    temNaoAplicavel: t.includes("NA"),
    desvioEhMarcadoAMao: false,
    dicaDoCampo: "",
  };
}

/** O valor de "não aplicável", quando o tipo o oferece. */
export const VALOR_NAO_APLICAVEL = "NA";

const ROTULOS: Record<string, string> = {
  Conforme: "Conforme",
  NaoConforme: "Não conforme",
  Nao_Conforme: "Não conforme",
  Sim: "Sim",
  Nao: "Não",
  OK: "OK",
  NaoOK: "Não OK",
  Nao_OK: "Não OK",
  NA: "Não aplicável",
  "N/A": "Não aplicável",
  NaoAplicavel: "Não aplicável",
};

/**
 * Como a resposta sai escrita no documento.
 *
 * Data merece tratamento próprio: guardada em ISO, impressa em ISO sairia
 * `2026-09-16` numa folha em português. As demais caem no valor cru, que é o que
 * a pessoa digitou.
 */
export function rotuloDaResposta(
  valor: string | null | undefined,
  tipo?: string | null
): string {
  const v = (valor ?? "").trim();
  if (!v) return "";

  if ((tipo ?? "").trim() === "Data") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }

  return ROTULOS[v] ?? v;
}
