import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";

/**
 * Tabela sem linhas: dizer POR QUE, em vez de afirmar que não há cadastro.
 *
 * Os filtros de coluna ficam salvos no localStorage e sobrevivem a logout,
 * recarregamento e troca de usuário. Um filtro antigo — por exemplo, a lista de
 * clientes escolhida meses atrás — esconde tudo e a tela anunciava "Nenhum
 * contrato cadastrado". A pessoa lê que o cadastro está vazio, e o que está
 * acontecendo é o contrário: os dados existem e estão sendo escondidos por uma
 * escolha dela mesma, que ela não lembra de ter feito.
 *
 * Esta é a diferença que dá para provar, e por isso a que vale mostrar: sabemos
 * quantos itens chegaram e quantos passaram pelo filtro. Zero de zero é
 * "não há cadastro"; zero de trinta é "você está escondendo trinta".
 *
 * O que continua indistinguível, e nenhum texto aqui resolve: quando o RLS
 * bloqueia, o Supabase devolve lista vazia COM SUCESSO. Do lado do navegador,
 * "a empresa não tem contratos" e "você não pode ver os contratos desta
 * empresa" chegam exatamente iguais.
 */
export function ListaVazia({
  total,
  filtrosAtivos,
  aoLimparFiltros,
  mensagemSemCadastro,
  plural,
}: {
  /** Itens carregados, ANTES de qualquer filtro. */
  total: number;
  filtrosAtivos: boolean;
  aoLimparFiltros: () => void;
  /** O que dizer quando realmente não veio nada, ex.: "Nenhum contrato cadastrado". */
  mensagemSemCadastro: string;
  /** Substantivo no plural para a contagem, ex.: "contratos". */
  plural: string;
}) {
  const ocultos = total > 0 && filtrosAtivos;

  if (!ocultos) {
    return <p className="text-center text-muted-foreground py-8">{mensagemSemCadastro}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-muted-foreground">
        {total} {total === 1 ? plural.replace(/s$/, "") : plural}{" "}
        {total === 1 ? "está oculto" : "estão ocultos"} pelos filtros aplicados.
      </p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={aoLimparFiltros}>
        <FilterX className="h-3.5 w-3.5" />
        Limpar filtros
      </Button>
    </div>
  );
}
