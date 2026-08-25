import { useState, useMemo } from "react";
import { useCotacoes, useRequisicoes, registrarHistorico } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Star, TrendingDown, Clock, ShieldCheck, Truck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PONTOS_POR_ESTRELA, textoDaForca } from "@/lib/avaliacaoFornecedor";
import { avaliarAlcada, rotuloTipoCompra } from "@/lib/alcadaCompras";
import { useAlcadasCompra } from "@/hooks/useAlcadasCompra";
import { useAuth } from "@/contexts/AuthContext";
import {
  normalizarEstadoRequisicao,
  validarTransicaoRequisicao,
  rotuloCotacao,
} from "@/lib/fluxoCompras";

interface ComparativoTabProps {
  onNavigate?: (tab: string, filter?: string) => void;
}

/** O recorte da cotação que o quadro comparativo compara. */
interface CotacaoComparada {
  id: string;
  valor_total?: number | null;
  prazo_entrega_dias?: number | null;
  fornecedor?: {
    razao_social?: string | null;
    score?: number | null;
    /** Quantas avaliacoes sustentam o score. Zero = sem historico. */
    avaliacoes_total?: number | null;
  } | null;
}

export function ComparativoTab({ onNavigate }: ComparativoTabProps) {
  const { requisicoes } = useRequisicoes();
  const { cotacoes } = useCotacoes();
  const { hasActionPermission } = usePermissions();
  const { alcadas } = useAlcadasCompra();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [selectedReqId, setSelectedReqId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<any>(null);
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A aprovação mora aqui, e chega por "Enviar para aprovação" na aba de Cotação.
  // QUOTING continua elegível para não travar requisição que já estava no meio do
  // caminho antes desta mudança.
  const eligibleRequisicoes = requisicoes.filter((r: any) => {
    const e = normalizarEstadoRequisicao(r.workflow_status);
    return e === "PENDING_APPROVAL" || e === "QUOTING";
  });

  const requisicaoSelecionada = useMemo(
    () => requisicoes.find((r: { id: string }) => r.id === selectedReqId) ?? null,
    [requisicoes, selectedReqId]
  );

  const relevantCotacoes = useMemo(() => {
    if (!selectedReqId) return [];
    return cotacoes.filter((c: any) => c.requisicao_id === selectedReqId);
  }, [cotacoes, selectedReqId]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  /**
   * Os destaques do quadro comparativo.
   *
   * O selo de "melhor avaliação" era decidido por `razao_social.length % 5` — o
   * número de letras do nome do fornecedor, resto da divisão por cinco. Não era
   * cálculo impreciso: era número inventado apresentado como avaliação, no momento
   * em que alguém decide para quem vai o dinheiro.
   *
   * Agora vem do score real do cadastro, e o selo **só aparece quando existe
   * score**. Sem avaliação registrada não há o que destacar, e dizer isso é melhor
   * que eleger um vencedor por sorteio.
   */
  const highlights = useMemo(() => {
    const vazio = { minPrice: null, minLeadTime: null, bestRating: null, temScore: false };
    if (relevantCotacoes.length === 0) return vazio;

    const lista = relevantCotacoes as CotacaoComparada[];

    // Só entra no comparativo a cotação com preço lançado: uma cotação sem resposta
    // vale zero e ganharia de todas no menor preço.
    const comPreco = lista.filter((c) => Number(c.valor_total || 0) > 0);
    if (comPreco.length === 0) return vazio;

    /** O menor valor por um critério, ou nulo se ninguém tem o dado. */
    const melhorPor = (
      candidatos: CotacaoComparada[],
      valor: (c: CotacaoComparada) => number,
      preferirMaior = false
    ): CotacaoComparada | null => {
      const validos = candidatos.filter((c) => valor(c) > 0);
      if (validos.length === 0) return null;
      return validos.reduce((a, b) =>
        preferirMaior ? (valor(b) > valor(a) ? b : a) : valor(b) < valor(a) ? b : a
      );
    };

    const menorPreco = melhorPor(comPreco, (c) => Number(c.valor_total || 0));
    const menorPrazo = melhorPor(comPreco, (c) => Number(c.prazo_entrega_dias || 0));
    const melhorScore = melhorPor(comPreco, (c) => Number(c.fornecedor?.score || 0), true);

    return {
      minPrice: menorPreco?.id ?? null,
      minLeadTime: menorPrazo?.id ?? null,
      bestRating: melhorScore?.id ?? null,
      temScore: !!melhorScore,
    };
  }, [relevantCotacoes]);

  const isPendingMinPrice = pendingWinner && pendingWinner.id === highlights.minPrice;
  const requiresJustification = pendingWinner && !isPendingMinPrice;

  /**
   * A alçada do usuário para o valor daquela cotação.
   *
   * A checagem acontece por cotação, e não uma vez para a requisição: o valor que
   * importa é o do vencedor escolhido, e escolher o fornecedor mais caro pode
   * mudar a faixa de quem precisa aprovar.
   */
  const alcadaDaCotacao = (cotacao: { valor_total?: number | null } | null) =>
    avaliarAlcada({
      alcadas,
      valor: Number(cotacao?.valor_total ?? 0),
      tipoCompra: (requisicaoSelecionada as { tipo_compra?: string | null } | null)?.tipo_compra ?? null,
      usuarioId: profile?.id ?? null,
      podeAprovarPelaRegraAntiga: hasActionPermission("pode_aprovar_compra"),
    });

  const openConfirm = (cotacao: any) => {
    if (!hasActionPermission("pode_criar_pedido")) return;

    // A alçada é conferida ANTES de abrir o diálogo: deixar abrir e falhar no
    // salvamento faria o usuário escrever a justificativa para depois descobrir que
    // não podia aprovar.
    const alcada = alcadaDaCotacao(cotacao);
    if (!alcada.podeAprovar) {
      toast.error(alcada.mensagem, {
        description:
          alcada.alcadasDaFaixa.length > 0
            ? `Alçada desta faixa: ${alcada.alcadasDaFaixa.map((a) => a.nome).join(", ")}.`
            : undefined,
        duration: 9000,
      });
      return;
    }

    setPendingWinner(cotacao);
    setJustificativa("");
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingWinner) return;
    if (requiresJustification && !justificativa.trim()) {
      toast.error("Justificativa é obrigatória quando o vencedor não é o menor preço.");
      return;
    }

    const cotacao = pendingWinner;
    setSubmitting(true);
    try {
      const req = requisicoes.find((r: any) => r.id === cotacao.requisicao_id);
      if (!req) throw new Error("Requisição não encontrada");

      // a) aprovar cotação vencedora
      const { error: e1 } = await supabase
        .from("cotacoes")
        .update({ status: "aprovada", updated_at: new Date().toISOString() })
        .eq("id", cotacao.id);
      if (e1) throw e1;

      // b) marcar as demais como perdidas
      const { error: e2 } = await supabase
        .from("cotacoes")
        .update({ status: "perdida" })
        .eq("requisicao_id", cotacao.requisicao_id)
        .neq("id", cotacao.id);
      if (e2) throw e2;

      // c) atualizar requisição.
      //
      // Só `workflow_status`. A coluna `status` era uma segunda fonte de verdade na
      // mesma tabela, escrita com outro vocabulário — e ninguém a lia.
      //
      // A transição passa pela máquina de estados: aprovar a partir de um estado que
      // não permite aprovação deixa de passar em silêncio.
      const transicaoReq = validarTransicaoRequisicao(req.workflow_status, "APPROVED");
      if (!transicaoReq.permitida) throw new Error(transicaoReq.motivo);

      const { error: e3 } = await supabase
        .from("requisicoes_compra")
        .update({ workflow_status: "APPROVED", updated_at: new Date().toISOString() })
        .eq("id", cotacao.requisicao_id);
      if (e3) throw e3;

      // d) número do pedido pela mesma RPC que o hook usa.
      //
      // Aqui era `COUNT(*) + 1`: duas aprovações simultâneas geravam o mesmo
      // PED-0001, e excluir um pedido fazia o número seguinte repetir um já usado.
      const { data: numero, error: numeroErr } = await supabase.rpc("gerar_proximo_numero_sc", {
        p_empresa_id: cotacao.empresa_id,
        p_prefixo: "PED",
      });
      if (numeroErr) throw numeroErr;

      const { data: pedido, error: e4 } = await supabase
        .from("pedidos")
        .insert({
          numero,
          cotacao_id: cotacao.id,
          requisicao_id: cotacao.requisicao_id,
          fornecedor_id: cotacao.fornecedor_id,
          projeto_id: req.projeto_id,
          empresa_id: cotacao.empresa_id,
          valor_total: cotacao.valor_total || 0,
          frete: cotacao.frete || 0,
          condicao_pagamento: cotacao.condicao_pagamento || null,
          prazo_entrega_dias: cotacao.prazo_entrega_dias || null,
          status: "rascunho",
          observacoes: justificativa ? `Justificativa da escolha: ${justificativa}` : null,
        })
        .select()
        .single();
      if (e4) throw e4;

      // e) inserir itens do pedido
      const cotItens = cotacao.itens || [];
      if (cotItens.length > 0) {
        const pedidoItens = cotItens.map((ci: any) => {
          const reqItem = ci.req_item || {};
          const descricao = reqItem.sc_item?.descricao || reqItem.descricao_livre || "Item";
          const qtd = Number(ci.quantidade || 0);
          const pu = Number(ci.preco_unitario || 0);
          return {
            pedido_id: pedido.id,
            sc_item_id: reqItem.sc_item?.id || null,
            descricao,
            unidade: reqItem.unidade || null,
            quantidade: qtd,
            preco_unitario: pu,
            valor_total: qtd * pu,
          };
        });
        const { error: e5 } = await supabase.from("pedido_itens").insert(pedidoItens);
        if (e5) throw e5;
      }

      /**
       * Histórico das três entidades.
       *
       * Esta tela inseria o pedido direto no banco, sem passar pelo hook — e o hook
       * era quem registrava o histórico. Resultado: a linha do tempo do pedido
       * nascia vazia, sem sequer o "rascunho criado", e a aprovação da requisição
       * não deixava rastro de quem escolheu o vencedor nem por quê.
       */
      await registrarHistorico([
        {
          entidade_tipo: "requisicao",
          entidade_id: cotacao.requisicao_id,
          status_anterior: req.workflow_status ?? null,
          status_novo: "APPROVED",
          observacoes: justificativa
            ? `Vencedora: ${cotacao.fornecedor?.razao_social ?? "fornecedor"}. Justificativa: ${justificativa}`
            : `Vencedora: ${cotacao.fornecedor?.razao_social ?? "fornecedor"} (menor preço).`,
        },
        {
          entidade_tipo: "cotacao",
          entidade_id: cotacao.id,
          status_anterior: cotacao.status ?? null,
          status_novo: "aprovada",
          observacoes: "Escolhida como vencedora no comparativo.",
        },
        {
          entidade_tipo: "pedido",
          entidade_id: pedido.id,
          status_anterior: null,
          status_novo: "rascunho",
          observacoes: `Gerado pela aprovação da cotação ${cotacao.numero ?? ""}.`.trim(),
        },
      ], cotacao.empresa_id);

      toast.success(`Pedido ${numero} criado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["cotacoes"] });
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });

      setConfirmOpen(false);
      setPendingWinner(null);
      setJustificativa("");

      // navegar para aba pedidos com o id do pedido como filtro
      onNavigate?.("pedidos", pedido.id);
    } catch (err: any) {
      toast.error("Erro ao confirmar vencedor: " + (err.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparativo de Preços e Condições</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs mb-6">
            <Label>Selecione a Requisição</Label>
            <Select value={selectedReqId} onValueChange={setSelectedReqId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma RC..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleRequisicoes.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.numero} - {r.projeto?.codigo || "Sem Projeto"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            A alçada aparece ANTES de escolher o vencedor, e não como erro depois de
            clicar: quem está decidindo precisa saber, ao ver o quadro, se vai poder
            aprovar a opção que está pensando em escolher.
          */}
          {selectedReqId && relevantCotacoes.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Tipo de compra:{" "}
                  <strong>
                    {rotuloTipoCompra(
                      (requisicaoSelecionada as { tipo_compra?: string | null } | null)?.tipo_compra
                    )}
                  </strong>
                </span>
                {alcadas.filter((a) => a.ativo).length === 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    sem alçada cadastrada — qualquer valor
                  </Badge>
                )}
              </div>

              {relevantCotacoes.some(
                (c: { valor_total?: number | null }) => !alcadaDaCotacao(c).podeAprovar
              ) && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Há cotações acima da sua alçada nesta requisição. O botão de
                    vencedor fica desabilitado nelas, e o motivo aparece ao passar o
                    mouse.
                  </span>
                </div>
              )}
            </div>
          )}

          {!selectedReqId ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              Selecione uma requisição para visualizar o comparativo de cotações.
            </div>
          ) : relevantCotacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              Nenhuma cotação registrada para esta requisição ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Fornecedor</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Prazo (dias)</TableHead>
                    <TableHead>Frete</TableHead>
                    <TableHead>Condição Pagto</TableHead>
                    <TableHead>Avaliação Histórica</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relevantCotacoes.map((c: any) => {
                    const isMinPrice = c.id === highlights.minPrice;
                    const isMinLeadTime = c.id === highlights.minLeadTime;
                    const isBestRating = c.id === highlights.bestRating;
                    const isWinner = c.status === "aprovada";
                    const isLost = c.status === "perdida" || c.status === "rejeitada";

                    return (
                      <TableRow key={c.id} className={isWinner ? "bg-primary/5" : isLost ? "opacity-60" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{c.fornecedor?.razao_social}</span>
                            <div className="flex gap-1 mt-1">
                              {isMinPrice && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 py-0 h-4">Menor Preço</Badge>}
                              {isMinLeadTime && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-4">Melhor Prazo</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-semibold">
                            {isMinPrice && <TrendingDown className="h-3 w-3 text-green-600" />}
                            {fmt(c.valor_total || 0)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isMinLeadTime && <Clock className="h-3 w-3 text-blue-600" />}
                            {c.prazo_entrega_dias || "—"} dias
                          </div>
                        </TableCell>
                        <TableCell>{c.frete > 0 ? fmt(c.frete) : "Incluso/FOB"}</TableCell>
                        <TableCell className="text-xs">{c.condicao_pagamento || "—"}</TableCell>
                        <TableCell>
                          {/*
                            As estrelas eram `4 + (razao_social.length % 2)`: todo
                            fornecedor recebia 4 ou 5 estrelas conforme o nome ter
                            número par ou ímpar de letras. Era a segunda instância do
                            mesmo número inventado nesta tela.

                            Agora vêm do score real, e fornecedor SEM avaliação não
                            recebe estrela nenhuma — a ausência de histórico é dita, e
                            não preenchida com nota alta.
                          */}
                          {Number(c.fornecedor?.avaliacoes_total || 0) === 0 ? (
                            <span
                              className="text-xs text-muted-foreground italic"
                              title={textoDaForca(0)}
                            >
                              sem avaliação
                            </span>
                          ) : (
                            <div
                              className="flex items-center gap-0.5"
                              title={textoDaForca(c.fornecedor?.avaliacoes_total)}
                            >
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= Math.round(Number(c.fornecedor?.score || 0) / PONTOS_POR_ESTRELA)
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                ({c.fornecedor?.avaliacoes_total})
                              </span>
                              {isBestRating && <ShieldCheck className="ml-1 h-3 w-3 text-primary" />}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isWinner ? (
                            <Badge className="bg-green-600">Vencedor</Badge>
                          ) : isLost ? (
                            <Badge variant="outline">Perdida</Badge>
                          ) : (
                            (() => {
                              // O botão desabilitado com o motivo no `title` é melhor
                              // que o botão ativo que falha no clique: a informação
                              // chega antes da tentativa.
                              const alcada = alcadaDaCotacao(c);
                              const semPermissao = !hasActionPermission("pode_criar_pedido");
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openConfirm(c)}
                                  disabled={semPermissao || !alcada.podeAprovar}
                                  title={
                                    semPermissao
                                      ? "Você não tem permissão de gerar pedido de compra."
                                      : alcada.mensagem
                                  }
                                >
                                  Vencedor
                                </Button>
                              );
                            })()
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReqId && relevantCotacoes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-600"><TrendingDown className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Economia Potencial</p>
                  <h4 className="text-xl font-bold text-green-700">
                    {fmt((relevantCotacoes.reduce((max: number, c: any) => Math.max(max, c.valor_total || 0), 0)) - (relevantCotacoes.find((c: any) => c.id === highlights.minPrice)?.valor_total || 0))}
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Clock className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Entrega Mais Rápida</p>
                  <h4 className="text-xl font-bold text-blue-700">
                    {relevantCotacoes.find((c: any) => c.id === highlights.minLeadTime)?.prazo_entrega_dias || "—"} dias
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Truck className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider">Qtd Cotações</p>
                  <h4 className="text-xl font-bold text-primary">{relevantCotacoes.length} fornecedores</h4>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar fornecedor vencedor</DialogTitle>
            <DialogDescription>
              {pendingWinner && (
                <>
                  Confirmar <strong>{pendingWinner.fornecedor?.razao_social}</strong> como vencedor da RC{" "}
                  <strong>{requisicoes.find((r: any) => r.id === pendingWinner.requisicao_id)?.numero}</strong>?
                  <br />
                  Valor: <strong>{fmt(pendingWinner.valor_total || 0)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {requiresJustification && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>O fornecedor selecionado não é o menor preço. Justificativa é obrigatória.</span>
            </div>
          )}

          <div>
            <Label>Justificativa {requiresJustification && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: prazo de entrega mais curto, melhor avaliação histórica, condição de pagamento..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={submitting || (requiresJustification && !justificativa.trim())}>
              {submitting ? "Processando..." : "Confirmar Vencedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
