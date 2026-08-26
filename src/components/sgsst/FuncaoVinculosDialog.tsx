import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, AlertTriangle, GraduationCap, HardHat, Info } from "lucide-react";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import type { SgsstFuncao } from "@/hooks/sgsst/useSgsstFuncoes";
import { useSgsstRiscos } from "@/hooks/sgsst/useSgsstRiscos";
import { useSgsstTreinamentos } from "@/hooks/sgsst/useSgsstTreinamentos";
import { useSgsstEpis } from "@/hooks/sgsst/useSgsstEpis";
import {
  useSgsstFuncaoVinculos,
  TIPO_EXPOSICAO_AJUDA,
  TIPO_EXPOSICAO_LABEL,
  TIPOS_EXPOSICAO,
  type TipoExposicao,
} from "@/hooks/sgsst/useSgsstFuncaoVinculos";
import { formatarLimite, parseLimite } from "@/utils/sgsstRiscoLimite";
import { CelulaEditavel } from "@/components/sgsst/CelulaEditavel";
import { validarInteiroPositivo, lerInteiroPositivo } from "@/utils/validacaoInteiro";

/**
 * Painel de vínculos da função: o que quem exerce esta função enfrenta e precisa.
 *
 * É a tela que faltava para a informação parar de ser digitada três vezes — no
 * PGR, no PCMSO e na matriz de treinamento — sem nada garantindo que as três
 * concordassem.
 */

interface FuncaoVinculosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcao: SgsstFuncao | null;
  allowEdit?: boolean;
}

/**
 * Teto das listas de apoio. `useSgsstTreinamentos` e `useSgsstEpis` sempre
 * paginam (25 por padrão) e não têm modo "catálogo inteiro" como riscos e
 * funções; sem isto o select de vínculo mostraria só os 25 primeiros e o usuário
 * concluiria que o resto não existe.
 */
const LIMITE_LISTA_APOIO = 500;

export function FuncaoVinculosDialog({
  open,
  onOpenChange,
  funcao,
  allowEdit = false,
}: FuncaoVinculosDialogProps) {
  const funcaoId = funcao?.id ?? null;
  const { riscos, treinamentos, epis, adicionar, atualizar, remover } =
    useSgsstFuncaoVinculos(open ? funcaoId : null);

  // Catálogos de apoio para os selects. Só carregam com o painel aberto.
  const { riscos: catalogoRiscos } = useSgsstRiscos(open ? undefined : { pageSize: 1 });
  const { treinamentos: catalogoTreinamentos } = useSgsstTreinamentos({
    pageSize: open ? LIMITE_LISTA_APOIO : 1,
  });
  const { epis: catalogoEpis } = useSgsstEpis({ pageSize: open ? LIMITE_LISTA_APOIO : 1 });

  // ---------- formulário de risco ----------
  const [novoRisco, setNovoRisco] = useState("");
  const [tipoExposicao, setTipoExposicao] = useState<TipoExposicao>("HABITUAL");
  const [tempoExposicao, setTempoExposicao] = useState("");

  // ---------- formulário de treinamento ----------
  const [novoTreinamento, setNovoTreinamento] = useState("");
  const [treinamentoObrigatorio, setTreinamentoObrigatorio] = useState(true);

  // ---------- formulário de EPI ----------
  const [novoEpi, setNovoEpi] = useState("");
  const [epiObrigatorio, setEpiObrigatorio] = useState(true);
  const [quantidade, setQuantidade] = useState("1");
  const [periodicidade, setPeriodicidade] = useState("");

  // Já vinculado não aparece no select: oferecer e depois recusar com erro de
  // chave duplicada é pior que não oferecer.
  const riscosDisponiveis = useMemo(() => {
    const jaVinculados = new Set(riscos.itens.map((r) => r.risco_catalogo_id));
    return catalogoRiscos.filter((r) => r.status === "ativo" && !jaVinculados.has(r.id));
  }, [catalogoRiscos, riscos.itens]);

  const treinamentosDisponiveis = useMemo(() => {
    const jaVinculados = new Set(treinamentos.itens.map((t) => t.treinamento_id));
    return catalogoTreinamentos.filter((t) => !jaVinculados.has(t.id));
  }, [catalogoTreinamentos, treinamentos.itens]);

  const episDisponiveis = useMemo(() => {
    const jaVinculados = new Set(epis.itens.map((e) => e.epi_id));
    return catalogoEpis.filter((e) => !jaVinculados.has(e.id));
  }, [catalogoEpis, epis.itens]);

  const quantidadeParseada = parseLimite(quantidade);
  const quantidadeInvalida =
    quantidadeParseada === undefined ||
    quantidadeParseada === null ||
    !Number.isInteger(quantidadeParseada) ||
    quantidadeParseada < 1;

  const periodicidadeParseada = parseLimite(periodicidade);
  const periodicidadeInvalida =
    periodicidadeParseada === undefined ||
    (periodicidadeParseada !== null &&
      (!Number.isInteger(periodicidadeParseada) || periodicidadeParseada < 1));

  const adicionarRisco = () => {
    if (!novoRisco) return;
    adicionar.mutate(
      {
        tabela: "sgsst_funcao_riscos",
        dados: {
          risco_catalogo_id: novoRisco,
          tipo_exposicao: tipoExposicao,
          tempo_exposicao: tempoExposicao.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setNovoRisco("");
          setTempoExposicao("");
        },
      }
    );
  };

  const adicionarTreinamento = () => {
    if (!novoTreinamento) return;
    adicionar.mutate(
      {
        tabela: "sgsst_funcao_treinamentos",
        dados: { treinamento_id: novoTreinamento, obrigatorio: treinamentoObrigatorio },
      },
      { onSuccess: () => setNovoTreinamento("") }
    );
  };

  const adicionarEpi = () => {
    if (!novoEpi || quantidadeInvalida || periodicidadeInvalida) return;
    adicionar.mutate(
      {
        tabela: "sgsst_funcao_epis",
        dados: {
          epi_id: novoEpi,
          obrigatorio: epiObrigatorio,
          quantidade_padrao: quantidadeParseada,
          periodicidade_troca_meses: periodicidadeParseada,
        },
      },
      {
        onSuccess: () => {
          setNovoEpi("");
          setQuantidade("1");
          setPeriodicidade("");
        },
      }
    );
  };

  const estadoRiscos = resolveTableState({
    isLoading: riscos.isLoading,
    error: riscos.error,
    isEmpty: riscos.itens.length === 0,
    modulo: "Riscos da função",
    onRetry: riscos.refetch,
    emptyTitulo: "Nenhum risco mapeado",
    emptyDescricao:
      "Sem risco mapeado, o PGR e o PCMSO não têm de onde puxar a exposição de quem exerce esta função.",
  });

  const estadoTreinamentos = resolveTableState({
    isLoading: treinamentos.isLoading,
    error: treinamentos.error,
    isEmpty: treinamentos.itens.length === 0,
    modulo: "Treinamentos da função",
    onRetry: treinamentos.refetch,
    emptyTitulo: "Nenhum treinamento exigido",
    emptyDescricao:
      "Marque aqui os treinamentos que a função exige. É o que permite saber quem está sem capacitação obrigatória.",
  });

  const estadoEpis = resolveTableState({
    isLoading: epis.isLoading,
    error: epis.error,
    isEmpty: epis.itens.length === 0,
    modulo: "EPIs da função",
    onRetry: epis.refetch,
    emptyTitulo: "Nenhum EPI exigido",
    emptyDescricao:
      "Os EPIs listados aqui formam a ficha de entrega do trabalhador e o indicador de entrega pendente.",
  });

  if (!funcao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {funcao.nome}
            {funcao.cbo && (
              <Badge variant="outline" className="font-mono text-xs">
                CBO {funcao.cbo}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            O que esta função enfrenta e o que ela exige. Preenchido uma vez aqui, serve ao
            PGR, ao PCMSO, à matriz de treinamentos e ao eSocial S-2240 — em vez de ser
            redigitado em cada um.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="riscos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="riscos" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Riscos
              {riscos.itens.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {riscos.itens.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="treinamentos" className="gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              Treinamentos
              {treinamentos.itens.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {treinamentos.itens.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="epis" className="gap-1.5">
              <HardHat className="h-3.5 w-3.5" />
              EPIs
              {epis.itens.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {epis.itens.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ================= RISCOS ================= */}
          <TabsContent value="riscos" className="space-y-3 pt-3">
            {allowEdit && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label htmlFor="sel-risco">Risco do catálogo</Label>
                    <Select value={novoRisco} onValueChange={setNovoRisco}>
                      <SelectTrigger id="sel-risco">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {riscosDisponiveis.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.codigo ? `[${r.codigo}] ` : ""}
                            {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <Label htmlFor="sel-exposicao">Exposição</Label>
                    <Select
                      value={tipoExposicao}
                      onValueChange={(v) => setTipoExposicao(v as TipoExposicao)}
                    >
                      <SelectTrigger id="sel-exposicao">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_EXPOSICAO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TIPO_EXPOSICAO_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="in-tempo">Tempo</Label>
                    <Input
                      id="in-tempo"
                      placeholder="8h/dia"
                      value={tempoExposicao}
                      onChange={(e) => setTempoExposicao(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <Button
                      onClick={adicionarRisco}
                      disabled={!novoRisco || adicionar.isPending}
                      className="w-full gap-1"
                    >
                      <Plus className="h-4 w-4" /> Vincular
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{TIPO_EXPOSICAO_AJUDA[tipoExposicao]}</span>
                </p>

                {riscosDisponiveis.length === 0 && catalogoRiscos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Todos os riscos ativos do catálogo já estão vinculados a esta função.
                  </p>
                )}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risco</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Exposição</TableHead>
                  {allowEdit && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadoRiscos ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={allowEdit ? 5 : 4} className="p-0">
                      {estadoRiscos}
                    </TableCell>
                  </TableRow>
                ) : (
                  riscos.itens.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">
                        {r.risco?.codigo && (
                          <span className="font-mono text-muted-foreground">
                            [{r.risco.codigo}]{" "}
                          </span>
                        )}
                        {r.risco?.nome ?? "(risco removido)"}
                        {r.risco?.agente && (
                          <span className="block font-normal text-muted-foreground">
                            {r.risco.agente}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          {r.risco?.categoria ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {formatarLimite(r.risco?.limite_tolerancia, r.risco?.unidade_medida) ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {allowEdit ? (
                          // Editável na linha: o tipo e o tempo de exposição são
                          // dados DO VÍNCULO, não do risco no catálogo. Corrigi-los
                          // desvinculando e vinculando de novo perderia quem
                          // cadastrou e quando.
                          <div className="min-w-[8.5rem] space-y-1">
                            <Select
                              value={r.tipo_exposicao}
                              onValueChange={(valor) =>
                                atualizar.mutate({
                                  tabela: "sgsst_funcao_riscos",
                                  id: r.id,
                                  campos: { tipo_exposicao: valor },
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-7 text-xs"
                                aria-label="Tipo de exposição"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIPOS_EXPOSICAO.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {TIPO_EXPOSICAO_LABEL[t]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <CelulaEditavel
                              valor={r.tempo_exposicao ?? ""}
                              placeholder="8h/dia"
                              ariaLabel="Tempo de exposição"
                              onSalvar={(texto) =>
                                atualizar.mutate({
                                  tabela: "sgsst_funcao_riscos",
                                  id: r.id,
                                  campos: { tempo_exposicao: texto || null },
                                })
                              }
                            />
                          </div>
                        ) : (
                          <>
                            {TIPO_EXPOSICAO_LABEL[r.tipo_exposicao]}
                            {r.tempo_exposicao && (
                              <span className="block text-muted-foreground">
                                {r.tempo_exposicao}
                              </span>
                            )}
                          </>
                        )}
                      </TableCell>
                      {allowEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Desvincular risco desta função"
                            onClick={() =>
                              remover.mutate({ tabela: "sgsst_funcao_riscos", id: r.id })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ============== TREINAMENTOS ============== */}
          <TabsContent value="treinamentos" className="space-y-3 pt-3">
            {allowEdit && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-7 space-y-1.5">
                    <Label htmlFor="sel-treinamento">Treinamento</Label>
                    <Select value={novoTreinamento} onValueChange={setNovoTreinamento}>
                      <SelectTrigger id="sel-treinamento">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {treinamentosDisponiveis.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.codigo ? `[${t.codigo}] ` : ""}
                            {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-3 flex items-end gap-2 pb-2">
                    <Switch
                      id="sw-tr-obrig"
                      checked={treinamentoObrigatorio}
                      onCheckedChange={setTreinamentoObrigatorio}
                    />
                    <Label htmlFor="sw-tr-obrig" className="text-sm">
                      Obrigatório
                    </Label>
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <Button
                      onClick={adicionarTreinamento}
                      disabled={!novoTreinamento || adicionar.isPending}
                      className="w-full gap-1"
                    >
                      <Plus className="h-4 w-4" /> Vincular
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Só o que está marcado como <strong>obrigatório</strong> entra no quadro de
                  pendências. Recomendação aparecendo como falta viraria ruído.
                </p>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Treinamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Carga</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Exigência</TableHead>
                  {allowEdit && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadoTreinamentos ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={allowEdit ? 6 : 5} className="p-0">
                      {estadoTreinamentos}
                    </TableCell>
                  </TableRow>
                ) : (
                  treinamentos.itens.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs font-medium">
                        {t.treinamento?.nome ?? "(treinamento removido)"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          {t.treinamento?.categoria ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {t.treinamento?.carga_horaria ? `${t.treinamento.carga_horaria}h` : "—"}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {t.treinamento?.validade_meses
                          ? `${t.treinamento.validade_meses} m`
                          : "não expira"}
                      </TableCell>
                      <TableCell>
                        {allowEdit ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={t.obrigatorio}
                              aria-label="Alternar obrigatoriedade"
                              onCheckedChange={(valor) =>
                                atualizar.mutate({
                                  tabela: "sgsst_funcao_treinamentos",
                                  id: t.id,
                                  campos: { obrigatorio: valor },
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {t.obrigatorio ? "Obrigatório" : "Recomendado"}
                            </span>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              t.obrigatorio
                                ? "bg-amber-50 text-amber-800 border-amber-300 text-xs"
                                : "text-xs"
                            }
                          >
                            {t.obrigatorio ? "Obrigatório" : "Recomendado"}
                          </Badge>
                        )}
                      </TableCell>
                      {allowEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Desvincular treinamento desta função"
                            onClick={() =>
                              remover.mutate({ tabela: "sgsst_funcao_treinamentos", id: t.id })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ================== EPIs ================== */}
          <TabsContent value="epis" className="space-y-3 pt-3">
            {allowEdit && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label htmlFor="sel-epi">EPI</Label>
                    <Select value={novoEpi} onValueChange={setNovoEpi}>
                      <SelectTrigger id="sel-epi">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {episDisponiveis.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome} — CA {e.ca}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="in-qtd">Qtd. padrão</Label>
                    <Input
                      id="in-qtd"
                      inputMode="numeric"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      aria-invalid={quantidadeInvalida}
                      className={quantidadeInvalida ? "border-destructive" : undefined}
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <Label htmlFor="in-period">Troca (meses)</Label>
                    <Input
                      id="in-period"
                      inputMode="numeric"
                      placeholder="sem troca"
                      value={periodicidade}
                      onChange={(e) => setPeriodicidade(e.target.value)}
                      aria-invalid={periodicidadeInvalida}
                      className={periodicidadeInvalida ? "border-destructive" : undefined}
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <Button
                      onClick={adicionarEpi}
                      disabled={
                        !novoEpi ||
                        quantidadeInvalida ||
                        periodicidadeInvalida ||
                        adicionar.isPending
                      }
                      className="w-full gap-1"
                    >
                      <Plus className="h-4 w-4" /> Vincular
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="sw-epi-obrig"
                    checked={epiObrigatorio}
                    onCheckedChange={setEpiObrigatorio}
                  />
                  <Label htmlFor="sw-epi-obrig" className="text-sm">
                    Obrigatório
                  </Label>
                </div>

                {(quantidadeInvalida || periodicidadeInvalida) && (
                  <p className="text-xs text-destructive">
                    {quantidadeInvalida
                      ? "A quantidade precisa ser um número inteiro maior que zero."
                      : "A troca precisa ser um número inteiro de meses, ou pode ficar em branco."}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Deixar a troca em branco significa <strong>sem troca programada</strong>: uma
                  entrega basta. Com periodicidade, o sistema passa a acusar quando a última
                  entrega vence — sem isso, uma entrega de três anos atrás contaria para sempre.
                </p>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Troca</TableHead>
                  <TableHead>Exigência</TableHead>
                  {allowEdit && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadoEpis ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={allowEdit ? 6 : 5} className="p-0">
                      {estadoEpis}
                    </TableCell>
                  </TableRow>
                ) : (
                  epis.itens.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium">
                        {e.epi?.nome ?? "(EPI removido)"}
                        {e.epi?.categoria && (
                          <span className="block font-normal text-muted-foreground">
                            {e.epi.categoria}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{e.epi?.ca ?? "—"}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {allowEdit ? (
                          <CelulaEditavel
                            valor={String(e.quantidade_padrao)}
                            inputMode="numeric"
                            ariaLabel="Quantidade padrão"
                            className="w-14"
                            validar={validarInteiroPositivo(true, "a quantidade")}
                            onSalvar={(texto) =>
                              atualizar.mutate({
                                tabela: "sgsst_funcao_epis",
                                id: e.id,
                                campos: { quantidade_padrao: lerInteiroPositivo(texto) },
                              })
                            }
                          />
                        ) : (
                          e.quantidade_padrao
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {allowEdit ? (
                          <CelulaEditavel
                            valor={
                              e.periodicidade_troca_meses
                                ? String(e.periodicidade_troca_meses)
                                : ""
                            }
                            inputMode="numeric"
                            placeholder="sem troca"
                            ariaLabel="Troca em meses"
                            className="w-20"
                            validar={validarInteiroPositivo(false, "a troca")}
                            onSalvar={(texto) =>
                              atualizar.mutate({
                                tabela: "sgsst_funcao_epis",
                                id: e.id,
                                // Vazio grava null: "sem troca programada" é uma
                                // decisão, e não o mesmo que zero mês.
                                campos: { periodicidade_troca_meses: lerInteiroPositivo(texto) },
                              })
                            }
                          />
                        ) : e.periodicidade_troca_meses ? (
                          `${e.periodicidade_troca_meses} m`
                        ) : (
                          "sem troca"
                        )}
                      </TableCell>
                      <TableCell>
                        {allowEdit ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={e.obrigatorio}
                              aria-label="Alternar obrigatoriedade"
                              onCheckedChange={(valor) =>
                                atualizar.mutate({
                                  tabela: "sgsst_funcao_epis",
                                  id: e.id,
                                  campos: { obrigatorio: valor },
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {e.obrigatorio ? "Obrigatório" : "Recomendado"}
                            </span>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              e.obrigatorio
                                ? "bg-amber-50 text-amber-800 border-amber-300 text-xs"
                                : "text-xs"
                            }
                          >
                            {e.obrigatorio ? "Obrigatório" : "Recomendado"}
                          </Badge>
                        )}
                      </TableCell>
                      {allowEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Desvincular EPI desta função"
                            onClick={() =>
                              remover.mutate({ tabela: "sgsst_funcao_epis", id: e.id })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
