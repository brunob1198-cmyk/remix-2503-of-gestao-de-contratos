import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  HardHat,
  IdCard,
  Pencil,
  Settings2,
  Users,
  XCircle,
} from "lucide-react";
import type { SgsstFuncao } from "@/hooks/sgsst/useSgsstFuncoes";
import {
  useSgsstFuncaoVinculos,
  type TabelaVinculo,
} from "@/hooks/sgsst/useSgsstFuncaoVinculos";
import {
  ExposicaoDoRisco,
  ExposicaoDoRiscoTexto,
  ObrigatoriedadeDoVinculo,
  QuantidadeDoEpi,
  TrocaDoEpi,
  type AtualizarVinculo,
} from "@/components/sgsst/camposDoVinculoFuncao";
import { formatarLimite } from "@/utils/sgsstRiscoLimite";
import { textoDaTroca } from "@/utils/validacaoInteiro";
import { useSgsstFuncaoMatriz } from "@/hooks/sgsst/useSgsstFuncaoMatriz";
import { estadoDaContagem } from "@/utils/sgsstMatrizFuncao";

/**
 * Resumo da função: tudo o que foi cadastrado nela, numa tela só.
 *
 * Existe porque ver uma função exigia abrir dois diálogos — o formulário para os
 * dados dela e o painel de vínculos para riscos, treinamentos e EPIs, este
 * último ainda dividido em três abas. Eram quatro cliques para responder "o que
 * esta função exige?".
 *
 * Por isso aqui NÃO há abas: os quatro blocos ficam empilhados e visíveis de uma
 * vez. Abas resolveriam o problema de espaço e manteriam o problema original.
 *
 * Os campos pequenos são editáveis na própria linha, com os mesmos componentes
 * da tela de gerenciamento. Incluir e excluir vínculo continua no painel de
 * vínculos, alcançável pelos botões "Gerenciar".
 */

interface FuncaoResumoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcao: SgsstFuncao | null;
  allowEdit?: boolean;
  /** Abre o formulário de dados da função. */
  onEditarDados: (funcao: SgsstFuncao) => void;
  /** Abre o painel de vínculos, para incluir ou excluir. */
  onGerenciarVinculos: (funcao: SgsstFuncao, aba: AbaVinculo) => void;
}

export type AbaVinculo = "riscos" | "treinamentos" | "epis";

/** Cabeçalho de card, no mesmo desenho do dossiê do colaborador. */
function TituloDoBloco({
  icone: Icone,
  children,
  acao,
}: {
  icone: typeof IdCard;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b bg-muted/50 px-4 py-2.5">
      <CardTitle className="flex items-center gap-2 text-xs font-bold">
        <Icone className="h-4 w-4 text-primary" /> {children}
      </CardTitle>
      {acao}
    </CardHeader>
  );
}

/** Linha rótulo/valor do bloco de identificação. */
function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-1 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{rotulo}:</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

/** Aviso de bloco vazio, dizendo a consequência de estar vazio. */
function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-5 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Número grande com rótulo, para o bloco de quem exerce a função. */
function Numero({
  valor,
  rotulo,
  destaque,
}: {
  valor: number;
  rotulo: string;
  destaque?: "ok" | "alerta";
}) {
  const cor =
    destaque === "ok"
      ? "text-emerald-600"
      : destaque === "alerta" && valor > 0
        ? "text-amber-600"
        : "text-foreground";
  return (
    <div>
      <p className={`text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{rotulo}</p>
    </div>
  );
}

export function FuncaoResumoDialog({
  open,
  onOpenChange,
  funcao,
  allowEdit = false,
  onEditarDados,
  onGerenciarVinculos,
}: FuncaoResumoDialogProps) {
  // Só consulta com o resumo aberto: a lista tem uma linha por função e três
  // consultas por linha seriam custo sem uso.
  const { riscos, treinamentos, epis, atualizar } = useSgsstFuncaoVinculos(
    open ? (funcao?.id ?? null) : null
  );

  const atualizarVinculo: AtualizarVinculo = (tabela: TabelaVinculo, id, campos) =>
    atualizar.mutate({ tabela, id, campos });

  // Recorte da matriz para esta função. Compartilha a chave de cache com a aba
  // "Pendências por função", então abrir o resumo depois dela não recalcula.
  const matriz = useSgsstFuncaoMatriz({ enabled: open });
  // A ordem dos casos é a regra, e vive numa função pura testada: "sem
  // colaborador" avaliado antes de "calculando" faria a tela afirmar que
  // ninguém exerce a função enquanto a consulta ainda corre.
  const contagem = estadoDaContagem({
    isLoading: matriz.isLoading,
    temErro: !!matriz.error,
    resumo: funcao ? matriz.porFuncao[funcao.id] : undefined,
  });

  if (!funcao) return null;

  const botaoGerenciar = (aba: AbaVinculo) =>
    allowEdit ? (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => onGerenciarVinculos(funcao, aba)}
      >
        <Settings2 className="h-3.5 w-3.5" /> Gerenciar
      </Button>
    ) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/10 p-2">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-bold">
                {funcao.nome}
                {funcao.cbo && (
                  <Badge variant="outline" className="font-mono text-xs">
                    CBO {funcao.cbo}
                  </Badge>
                )}
                {funcao.status === "ativo" ? (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 border-emerald-200 bg-emerald-50 text-xs text-emerald-700"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Ativo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 bg-muted text-xs text-muted-foreground"
                  >
                    <XCircle className="h-3 w-3" /> Inativo
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {riscos.itens.length} risco{riscos.itens.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {treinamentos.itens.length} treinamento
                  {treinamentos.itens.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <HardHat className="h-3.5 w-3.5" />
                  {epis.itens.length} EPI{epis.itens.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* ---------- Identificação ---------- */}
          <Card>
            <TituloDoBloco
              icone={IdCard}
              acao={
                allowEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => onEditarDados(funcao)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                ) : undefined
              }
            >
              Identificação &amp; Atribuições
            </TituloDoBloco>
            <CardContent className="space-y-2 p-4 text-xs">
              <Linha rotulo="Nome da função">{funcao.nome}</Linha>
              <Linha rotulo="CBO">{funcao.cbo || "—"}</Linha>
              <Linha rotulo="Descrição / Atribuições">
                {funcao.descricao || <span className="font-normal text-muted-foreground">—</span>}
              </Linha>
              <Linha rotulo="Requisitos mínimos">
                {funcao.requisitos_minimos || (
                  <span className="font-normal text-muted-foreground">—</span>
                )}
              </Linha>
            </CardContent>
          </Card>

          {/* ---------- Quem exerce a função ---------- */}
          <Card>
            <TituloDoBloco icone={Users}>Quem exerce esta função</TituloDoBloco>
            <CardContent className="p-4">
              {/* Os três estados são distintos de propósito. "Calculando" e "não
                  foi possível calcular" não podem virar zero: um zero afirma que
                  ninguém exerce a função, e isso é uma conclusão, não a ausência
                  de uma. */}
              {contagem.tipo === "CALCULANDO" ? (
                <p className="text-xs text-muted-foreground">Calculando…</p>
              ) : contagem.tipo === "ERRO" ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Não foi possível calcular a conformidade de quem exerce esta função.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => matriz.refetch()}
                  >
                    Tentar de novo
                  </Button>
                </div>
              ) : contagem.tipo === "SEM_COLABORADOR" ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum colaborador ativo está nesta função. As exigências abaixo ainda valem —
                  passam a ser cobradas de quem for alocado nela.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Numero valor={contagem.resumo.colaboradores} rotulo="colaboradores" />
                    <Numero valor={contagem.resumo.emDia} rotulo="em dia" destaque="ok" />
                    <Numero
                      valor={contagem.resumo.comPendencia}
                      rotulo="com pendência"
                      destaque="alerta"
                    />
                  </div>
                  {contagem.resumo.comPendencia > 0 && (
                    <p className="pt-3 text-xs text-muted-foreground">
                      {contagem.resumo.pendenciasTreinamento} de treinamento e {contagem.resumo.pendenciasEpi} de
                      EPI. Só o que está marcado como obrigatório conta aqui.
                    </p>
                  )}
                  {matriz.truncado && (
                    <p className="pt-2 text-xs text-amber-700">
                      Alguma lista bateu o teto de linhas: a contagem pode estar incompleta.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ---------- Riscos ---------- */}
          <Card>
            <TituloDoBloco icone={AlertTriangle} acao={botaoGerenciar("riscos")}>
              Riscos ocupacionais ({riscos.itens.length})
            </TituloDoBloco>
            <CardContent className="p-0">
              {riscos.itens.length === 0 ? (
                <Vazio>
                  Nenhum risco mapeado. Sem isso, o PGR e o PCMSO não têm de onde puxar a
                  exposição de quem exerce esta função.
                </Vazio>
              ) : (
                <ul className="divide-y">
                  {riscos.itens.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {r.risco?.codigo && (
                            <span className="font-mono text-muted-foreground">
                              [{r.risco.codigo}]{" "}
                            </span>
                          )}
                          {r.risco?.nome ?? "(risco removido)"}
                        </p>
                        <p className="text-muted-foreground">
                          {r.risco?.agente || "—"}
                          {" · "}
                          {r.risco?.categoria ?? "sem categoria"}
                          {" · limite "}
                          {formatarLimite(r.risco?.limite_tolerancia, r.risco?.unidade_medida) ??
                            "não definido"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {allowEdit ? (
                          <ExposicaoDoRisco vinculo={r} onAtualizar={atualizarVinculo} />
                        ) : (
                          <ExposicaoDoRiscoTexto vinculo={r} />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ---------- Treinamentos ---------- */}
          <Card>
            <TituloDoBloco icone={GraduationCap} acao={botaoGerenciar("treinamentos")}>
              Treinamentos exigidos ({treinamentos.itens.length})
            </TituloDoBloco>
            <CardContent className="p-0">
              {treinamentos.itens.length === 0 ? (
                <Vazio>
                  Nenhum treinamento exigido. É o que permite saber quem está sem capacitação
                  obrigatória.
                </Vazio>
              ) : (
                <ul className="divide-y">
                  {treinamentos.itens.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {t.treinamento?.nome ?? "(treinamento removido)"}
                        </p>
                        <p className="text-muted-foreground">
                          {t.treinamento?.categoria ?? "sem categoria"}
                          {" · "}
                          {t.treinamento?.carga_horaria
                            ? `${t.treinamento.carga_horaria}h`
                            : "carga não informada"}
                          {" · "}
                          {t.treinamento?.validade_meses
                            ? `recicla a cada ${t.treinamento.validade_meses} m`
                            : "não expira"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {allowEdit ? (
                          <ObrigatoriedadeDoVinculo
                            tabela="sgsst_funcao_treinamentos"
                            id={t.id}
                            obrigatorio={t.obrigatorio}
                            onAtualizar={atualizarVinculo}
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              t.obrigatorio
                                ? "border-amber-300 bg-amber-50 text-xs text-amber-800"
                                : "text-xs"
                            }
                          >
                            {t.obrigatorio ? "Obrigatório" : "Recomendado"}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ---------- EPIs ---------- */}
          <Card>
            <TituloDoBloco icone={HardHat} acao={botaoGerenciar("epis")}>
              EPIs exigidos ({epis.itens.length})
            </TituloDoBloco>
            <CardContent className="p-0">
              {epis.itens.length === 0 ? (
                <Vazio>
                  Nenhum EPI exigido. Os EPIs listados aqui formam a ficha de entrega do
                  trabalhador e o indicador de entrega pendente.
                </Vazio>
              ) : (
                <ul className="divide-y">
                  {epis.itens.map((e) => (
                    <li key={e.id} className="px-4 py-2.5 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{e.epi?.nome ?? "(EPI removido)"}</p>
                          <p className="text-muted-foreground">
                            {e.epi?.categoria ?? "sem categoria"}
                            {" · CA "}
                            <span className="font-mono">{e.epi?.ca ?? "—"}</span>
                          </p>
                        </div>
                        <div className="shrink-0">
                          {allowEdit ? (
                            <ObrigatoriedadeDoVinculo
                              tabela="sgsst_funcao_epis"
                              id={e.id}
                              obrigatorio={e.obrigatorio}
                              onAtualizar={atualizarVinculo}
                            />
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                e.obrigatorio
                                  ? "border-amber-300 bg-amber-50 text-xs text-amber-800"
                                  : "text-xs"
                              }
                            >
                              {e.obrigatorio ? "Obrigatório" : "Recomendado"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-2">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          Qtd. por entrega:
                          {allowEdit ? (
                            <QuantidadeDoEpi vinculo={e} onAtualizar={atualizarVinculo} />
                          ) : (
                            <span className="font-semibold text-foreground tabular-nums">
                              {e.quantidade_padrao}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          Troca:
                          {allowEdit ? (
                            <TrocaDoEpi vinculo={e} onAtualizar={atualizarVinculo} />
                          ) : (
                            <span className="font-semibold text-foreground tabular-nums">
                              {textoDaTroca(e.periodicidade_troca_meses)}
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
