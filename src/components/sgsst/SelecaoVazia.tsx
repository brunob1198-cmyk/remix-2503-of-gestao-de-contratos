/**
 * O que um seletor mostra quando não há o que escolher.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Roteiro 0.3: "Confirmar que existe pelo menos uma obra/projeto cadastrada. Sem
 * obra, quase todo formulário do SGSST travará no campo obrigatório de obra."
 *
 * Repare que o próprio roteiro precisou avisar — ele está compensando uma
 * mensagem que o sistema não dá. Em oito formulários do SGSST o seletor de obra
 * abria uma caixa VAZIA: sem opção, sem explicação e sem saída. Em seis deles a
 * obra é obrigatória, então o formulário não pode ser concluído e nada diz por
 * quê.
 *
 * Caixa vazia não distingue três coisas muito diferentes: não há obra
 * cadastrada, a consulta falhou, ou você não tem permissão de ver. Quem está na
 * tela fica sem saber se cadastra, recarrega ou pede acesso.
 *
 * É a mesma regra do `ListaVazia` das medições: quando a lista está vazia, diga
 * que está vazia e diga o que fazer. O silêncio é sempre lido como defeito.
 */

export function SelecaoVazia({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-3 text-xs text-muted-foreground leading-relaxed" role="note">
      {children}
    </div>
  );
}

/**
 * As opções da lista, ou o aviso de que ela está vazia.
 *
 * Existe como componente para que os oito seletores não repitam o mesmo ternário
 * — repetido oito vezes, um deles ficaria de fora, que é exatamente como o
 * problema começou.
 */
export function OpcoesOuAviso<T>({
  itens,
  aviso,
  children,
}: {
  itens: readonly T[] | null | undefined;
  aviso: React.ReactNode;
  children: (item: T) => React.ReactNode;
}) {
  if (!itens || itens.length === 0) return <SelecaoVazia>{aviso}</SelecaoVazia>;
  return <>{itens.map(children)}</>;
}

/** O aviso de obra, usado por todos os formulários que pedem uma. */
export const SEM_OBRA_CADASTRADA =
  "Nenhuma obra cadastrada. Cadastre uma em Obras antes de continuar — " +
  "quase todo registro do SGSST é vinculado a uma.";
