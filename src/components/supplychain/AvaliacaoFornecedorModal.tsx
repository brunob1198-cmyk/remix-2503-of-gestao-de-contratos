import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Info, Lightbulb } from "lucide-react";
import { useAvaliacoesFornecedor } from "@/hooks/useSupplyChain";
import {
  CRITERIOS_AVALIACAO,
  PONTOS_POR_ESTRELA,
  notaSugeridaDePrazo,
  pontosDaNota,
  prazoDoPedido,
  scoreDaAvaliacao,
  textoDoPrazo,
  type CriterioAvaliacao,
} from "@/lib/avaliacaoFornecedor";

/**
 * Avaliação do fornecedor depois da entrega.
 *
 * A versão anterior era quatro rótulos de duas palavras com cinco estrelas ao lado,
 * e a frase "Avalie o fornecedor para atualizar o seu Score" — que era falsa: a
 * avaliação era gravada e nunca chegava ao score. Isso foi corrigido no banco.
 *
 * O que mudou nesta tela, e por quê:
 *
 * - **Cada critério diz o que está sendo perguntado, e o que cada nota significa.**
 *   "3 estrelas" não quer dizer nada sem referência: dois compradores dão notas
 *   diferentes para a mesma entrega e a média deixa de ser comparável.
 *
 * - **O peso aparece.** Prazo vale o dobro de qualidade no score final. Quem avalia
 *   sem saber disso distribui as notas como se pesassem igual.
 *
 * - **O atraso medido aparece ANTES da nota de prazo.** A nota é opinião; o atraso é
 *   fato, e o sistema já conhece os dois. É difícil marcar cinco estrelas com
 *   "atrasou 9 dias" escrito ao lado — e essa é a intenção.
 *
 * - **O efeito no score é mostrado enquanto se marca**, com a ressalva de que a
 *   conta final é a média de todas as avaliações do fornecedor.
 */

/** O recorte do pedido que a avaliação precisa. */
interface PedidoAvaliado {
  id: string;
  numero?: string | null;
  fornecedor_id: string;
  fornecedor?: { razao_social?: string | null } | null;
  prazo_entrega_dias?: number | null;
  data_emissao?: string | null;
  data_entrega_real?: string | null;
}

interface AvaliacaoFornecedorModalProps {
  pedido: PedidoAvaliado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AvaliacaoFornecedorModal({
  pedido,
  open,
  onOpenChange,
}: AvaliacaoFornecedorModalProps) {
  const { create } = useAvaliacoesFornecedor();

  const [notas, setNotas] = useState<Record<CriterioAvaliacao, number>>({
    PRAZO: 0,
    PRECO: 0,
    QUALIDADE: 0,
    RESPONSIVIDADE: 0,
  });
  const [observacao, setObservacao] = useState("");

  const prazo = useMemo(() => prazoDoPedido(pedido ?? {}), [pedido]);
  const sugestaoPrazo = notaSugeridaDePrazo(prazo);

  /**
   * As notas começam VAZIAS, e não em 5.
   *
   * A versão anterior iniciava tudo em 5 estrelas: quem clicasse direto em "Salvar"
   * registrava um fornecedor nota máxima em todos os critérios sem ter avaliado
   * nada — e essa nota entra na média que decide pedidos futuros.
   */
  useEffect(() => {
    if (!open) return;
    setNotas({ PRAZO: 0, PRECO: 0, QUALIDADE: 0, RESPONSIVIDADE: 0 });
    setObservacao("");
  }, [open, pedido?.id]);

  const todasPreenchidas = CRITERIOS_AVALIACAO.every((c) => notas[c.criterio] > 0);
  const scorePrevisto = scoreDaAvaliacao(notas);

  const handleSave = () => {
    if (!todasPreenchidas || !pedido) return;

    create.mutate(
      {
        pedido_id: pedido.id,
        fornecedor_id: pedido.fornecedor_id,
        nota_prazo: notas.PRAZO,
        nota_preco: notas.PRECO,
        nota_qualidade: notas.QUALIDADE,
        nota_responsividade: notas.RESPONSIVIDADE,
        // Os três campos objetivos existiam na tabela e nenhuma tela os preenchia.
        // São o contraponto da nota: opinião de um lado, medição do outro.
        dias_prometidos: prazo.diasPrometidos,
        dias_entregues: prazo.diasEntregues,
        atraso_dias: prazo.atrasoDias,
        observacao: observacao.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const Estrelas = ({
    valor,
    onChange,
    ancoras,
  }: {
    valor: number;
    onChange: (v: number) => void;
    ancoras: Readonly<Record<1 | 2 | 3 | 4 | 5, string>>;
  }) => (
    <div className="flex items-center gap-1">
      {([1, 2, 3, 4, 5] as const).map((estrela) => (
        <button
          key={estrela}
          type="button"
          // O significado de cada nota fica no `title`: a lista inteira na tela
          // ocuparia mais espaço do que a decisão merece, mas ela precisa estar
          // alcançável — sem isso a nota é um número sem referência.
          title={`${estrela} — ${ancoras[estrela]} (${estrela * PONTOS_POR_ESTRELA} pontos)`}
          aria-label={`${estrela} de 5: ${ancoras[estrela]}`}
          onClick={() => onChange(estrela)}
          className="p-0.5"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              estrela <= valor
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30 hover:text-yellow-400/60"
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Avaliar {pedido?.fornecedor?.razao_social ?? "fornecedor"}
          </DialogTitle>
          <DialogDescription>
            Pedido <strong>{pedido?.numero}</strong> concluído. Esta avaliação entra na
            média do fornecedor e passa a aparecer no comparativo de cotações — é ela
            que sustenta o selo de melhor avaliado na próxima compra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* O fato, antes da opinião. */}
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="flex items-start gap-2 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <strong>Prazo medido pelo sistema:</strong> {textoDoPrazo(prazo)}
              </span>
            </p>
            {sugestaoPrazo !== null && (
              <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Pelo atraso medido, a nota de prazo sugerida é{" "}
                  <strong>{sugestaoPrazo} de 5</strong>. É sugestão — quem avalia decide,
                  e pode considerar que o atraso foi avisado ou não atrapalhou a obra.
                </span>
              </p>
            )}
          </div>

          {CRITERIOS_AVALIACAO.map((c) => (
            <div key={c.criterio} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.titulo}</span>
                    <Badge variant="outline" className="text-[10px]">
                      peso {Math.round(c.peso * 100)}%
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.pergunta}</p>
                </div>

                <Estrelas
                  valor={notas[c.criterio]}
                  ancoras={c.ancoras}
                  onChange={(v) => setNotas((atual) => ({ ...atual, [c.criterio]: v }))}
                />
              </div>

              {/* O significado da nota escolhida, escrito. É o que torna a média
                  comparável entre quem avalia. */}
              {notas[c.criterio] > 0 && (
                <p className="mt-2 border-t pt-2 text-xs">
                  <strong>{notas[c.criterio]} de 5:</strong>{" "}
                  {c.ancoras[notas[c.criterio] as 1 | 2 | 3 | 4 | 5]}
                  <span className="text-muted-foreground">
                    {" "}
                    · {pontosDaNota(notas[c.criterio])} pontos
                  </span>
                </p>
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="obs-avaliacao">
              Observação
            </label>
            <Textarea
              id="obs-avaliacao"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="O que aconteceu nesta entrega que as notas não contam."
            />
            <p className="text-xs text-muted-foreground">
              Fica no histórico do fornecedor. É o que explica uma nota baixa a quem
              for comprar dele no ano que vem.
            </p>
          </div>

          {/* O efeito, antes de salvar. */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {todasPreenchidas ? (
                  <>
                    Esta avaliação vale{" "}
                    <strong>{scorePrevisto.toFixed(1)} de 100</strong>. O score do
                    fornecedor é a <strong>média de todas</strong> as avaliações dele —
                    não só desta.
                  </>
                ) : (
                  <>
                    Marque os quatro critérios para ver o efeito no score. Nota não
                    preenchida não é nota zero: a avaliação só é salva completa.
                  </>
                )}
              </span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!todasPreenchidas || create.isPending}>
            {create.isPending ? "Salvando..." : "Salvar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
