import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Siren,
  Clock,
  SearchCheck,
  Wrench,
  Plus,
  Trash2,
  Info,
  Timer,
  FileWarning,
  Wand2,
  TrendingUp,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import {
  useSgsstIndicadores,
  useSgsstHht,
  useSgsstHhtSugerido,
  limitesDoMes,
  ORIGEM_HHT_LABEL,
  type OrigemHht,
} from "@/hooks/sgsst/useSgsstIndicadores";
import { formatarPercentual, formatarTaxa } from "@/utils/sgsstIndicadores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Indicadores de SST.
 *
 * O módulo tinha contagens ("12 incidentes") mas não as taxas que a área usa e
 * reporta. Taxa de frequência e de gravidade vêm da NBR 14280 e dependem de HHT
 * — homens-hora trabalhadas. Sem HHT elas aparecem como "—", nunca como zero:
 * zero seria lido como desempenho perfeito.
 */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export default function SgsstIndicadoresPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pgr");
  const { profile } = useAuth();

  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [projetoId, setProjetoId] = useState<string>("todas");
  // "mes" para o fechamento mensal; "ano" para a visão anual acumulada.
  const [janela, setJanela] = useState<"mes" | "ano">("mes");

  const periodo = useMemo(() => {
    if (janela === "ano") {
      return {
        de: `${ano}-01-01`,
        ate: `${ano}-12-31`,
        projetoId: projetoId === "todas" ? null : projetoId,
      };
    }
    const { de, ate } = limitesDoMes(ano, mes);
    return { de, ate, projetoId: projetoId === "todas" ? null : projetoId };
  }, [ano, mes, janela, projetoId]);

  const { indicadores, isLoading, error, refetch } = useSgsstIndicadores(periodo);
  const { registros, salvarHht, removerHht } = useSgsstHht({ ano });
  const sugerido = useSgsstHhtSugerido(periodo);

  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_indicadores", profile?.empresa_id],
    enabled: !!profile?.empresa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, nome")
        .eq("empresa_id", profile!.empresa_id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- formulário de HHT ----
  const [hhtHoras, setHhtHoras] = useState("");
  const [hhtOrigem, setHhtOrigem] = useState<OrigemHht>("FOLHA");
  const [hhtTrabalhadores, setHhtTrabalhadores] = useState("");

  const horasNumero = Number(hhtHoras.replace(",", "."));
  const horasInvalidas = !hhtHoras.trim() || !Number.isFinite(horasNumero) || horasNumero <= 0;

  const salvar = () => {
    if (horasInvalidas) return;
    salvarHht.mutate(
      {
        projeto_id: projetoId === "todas" ? null : projetoId,
        ano,
        mes,
        horas: horasNumero,
        origem: hhtOrigem,
        media_trabalhadores: hhtTrabalhadores ? Number(hhtTrabalhadores) : null,
        observacao: null,
      },
      {
        onSuccess: () => {
          setHhtHoras("");
          setHhtTrabalhadores("");
        },
      }
    );
  };

  const seg = indicadores?.seguranca;
  const insp = indicadores?.inspecoes;
  const plano = indicadores?.planoAcao;

  const semHht = !seg?.hht;

  const rotuloPeriodo =
    janela === "ano" ? `ano de ${ano}` : `${MESES[mes - 1]} de ${ano}`;

  const estadoHht = resolveTableState({
    isLoading: false,
    error: null,
    isEmpty: registros.length === 0,
    modulo: "HHT",
    emptyTitulo: "Nenhum HHT lançado",
    emptyDescricao:
      "As taxas de frequência e gravidade da NBR 14280 dividem pelas homens-hora trabalhadas. Sem esse número elas não existem — e o sistema mostra um travessão em vez de inventar um valor.",
  });

  return (
    <div className="space-y-6">
      <SgsstSegurancaHeaderNav />

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          SGSST — Indicadores de Segurança
        </h1>
        <p className="text-sm text-muted-foreground">
          Taxa de frequência e de gravidade (NBR 14280), conformidade das inspeções e
          desempenho do plano de ação.
        </p>
      </div>

      {/* Recorte */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ind-janela">Janela</Label>
              <Select value={janela} onValueChange={(v) => setJanela(v as "mes" | "ano")}>
                <SelectTrigger id="ind-janela" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês</SelectItem>
                  <SelectItem value="ano">Ano acumulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {janela === "mes" && (
              <div className="space-y-1.5">
                <Label htmlFor="ind-mes">Mês</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger id="ind-mes" className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((nome, i) => (
                      <SelectItem key={nome} value={String(i + 1)}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ind-ano">Ano</Label>
              <Input
                id="ind-ano"
                type="number"
                className="w-[110px]"
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ind-obra">Obra</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger id="ind-obra" className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Consolidado da empresa</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo}] {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Atualizar
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Mostrando <strong>{rotuloPeriodo}</strong>
            {projetoId === "todas"
              ? " — consolidado da empresa, usando o HHT lançado sem obra."
              : " — desta obra, usando o HHT lançado para ela."}
          </p>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm">
              <strong>Não foi possível carregar os indicadores.</strong> A migration{" "}
              <code className="font-mono text-xs">20260820180000</code> pode não ter sido
              aplicada ao banco.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {indicadores && indicadores.indisponiveis.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Não foi possível ler: <strong>{indicadores.indisponiveis.join(", ")}</strong>. Os
          indicadores dessas fontes aparecem como "—" em vez de zero — zero significaria "não
          houve", e não "não deu para contar".
        </p>
      )}

      {indicadores?.truncado && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Alguma lista bateu o teto de segurança da consulta. Trate os números como{" "}
          <strong>piso</strong>, não como total.
        </p>
      )}

      <Tabs defaultValue="taxas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="taxas" className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> Taxas
          </TabsTrigger>
          <TabsTrigger value="hht" className="gap-1.5">
            <Timer className="h-4 w-4" /> Homens-hora (HHT)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="taxas" className="space-y-4 mt-0">
          {semHht && !isLoading && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <strong>Sem HHT lançado para {rotuloPeriodo}</strong>, as taxas de frequência e
              gravidade não podem ser calculadas — elas dividem pelas homens-hora trabalhadas.
              Lance o HHT na aba ao lado. As contagens de acidentes abaixo continuam válidas.
            </p>
          )}

          <SgsstStatCards
            isLoading={isLoading}
            stats={[
              {
                label: "Taxa de frequência",
                value: formatarTaxa(seg?.taxaFrequencia ?? null),
                tone: semHht ? "neutro" : "info",
                icon: Siren,
                hint: semHht ? "sem HHT" : "por milhão de HHT",
                ajuda:
                  "Acidentes COM AFASTAMENTO × 1.000.000 ÷ HHT (NBR 14280). Um acidente lançado como tipo genérico mas com dias perdidos registrados também conta — deixar de contá-lo faria a taxa mentir para melhor.",
              },
              {
                label: "Taxa de gravidade",
                value: formatarTaxa(seg?.taxaGravidade ?? null),
                tone: semHht ? "neutro" : "info",
                icon: Clock,
                hint: semHht ? "sem HHT" : `${seg?.diasPerdidos ?? 0} dia(s) perdidos`,
                ajuda:
                  "(dias perdidos + dias debitados) × 1.000.000 ÷ HHT. Os dias debitados são os que a NBR 14280 atribui a perda permanente — sem eles, um óbito pesaria menos que um afastamento de 30 dias.",
              },
              {
                label: "Conformidade das inspeções",
                value: formatarPercentual(insp?.conformidade ?? null),
                tone:
                  insp?.conformidade === null || insp?.conformidade === undefined
                    ? "neutro"
                    : insp.conformidade >= 90
                      ? "positivo"
                      : "atencao",
                icon: SearchCheck,
                hint: insp ? `${insp.naoConformes} não conformes` : undefined,
                ajuda:
                  "Itens conformes ÷ itens avaliados, nas inspeções concluídas do período. Itens pendentes e não aplicáveis ficam fora do denominador: pendente ainda não foi avaliado, e contá-lo como falha puniria inspeção em andamento.",
              },
              {
                label: "Plano de ação implementado",
                value: formatarPercentual(plano?.percentualImplementado ?? null),
                tone:
                  plano?.atrasadas && plano.atrasadas > 0
                    ? "atencao"
                    : plano?.percentualImplementado === null
                      ? "neutro"
                      : "positivo",
                icon: Wrench,
                hint: plano ? `${plano.atrasadas} atrasada(s)` : undefined,
                ajuda:
                  "Medidas implementadas ÷ medidas não canceladas. 'Atrasada' conta apenas o que continua aberto com prazo vencido — medida entregue com atraso já foi entregue.",
              },
            ]}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-5 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Siren className="h-4 w-4 text-primary" /> Ocorrências no período
                </h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs">Acidentes com afastamento</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {seg?.acidentesComAfastamento ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Acidentes sem afastamento</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {seg?.acidentesSemAfastamento ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Quase-acidentes</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {seg?.quaseAcidentes ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">
                        Quase-acidentes por acidente
                        <span className="block text-muted-foreground">
                          quanto maior, melhor
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {seg?.razaoQuaseAcidente === null || seg?.razaoQuaseAcidente === undefined
                          ? "—"
                          : seg.razaoQuaseAcidente.toFixed(1).replace(".", ",")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">
                        Dias perdidos + debitados
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {seg ? seg.diasPerdidos + seg.diasDebitados : "—"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {seg && seg.afastamentosSemCat > 0 && (
                  <p className="flex items-start gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    <FileWarning className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      <strong>{seg.afastamentosSemCat} acidente(s) com afastamento sem CAT
                      emitida.</strong> A emissão é obrigação legal — isto é irregularidade, não
                      lacuna de cadastro.
                    </span>
                  </p>
                )}

                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Razão baixa de quase-acidente quase sempre significa subnotificação, não
                    excelência: registrar o evento antes de ele virar lesão é o que permite
                    agir.
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" /> Plano de ação do PGR
                </h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs">Medidas cadastradas</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {plano?.total ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Implementadas</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {plano?.implementadas ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Implementadas no prazo</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {plano?.noPrazo ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Abertas com prazo vencido</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums text-amber-700 dark:text-amber-500">
                        {plano?.atrasadas ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">
                        Implementadas sem aferição
                        <span className="block text-muted-foreground">NR-01 1.5.5.2</span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums">
                        {plano?.semAfericao ?? "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Aferidas como ineficazes</TableCell>
                      <TableCell className="text-xs text-right font-semibold tabular-nums text-red-700 dark:text-red-400">
                        {plano?.ineficazes ?? "—"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <p className="text-xs text-muted-foreground">
                  O plano de ação não é recortado por período: uma medida em aberto de meses
                  atrás continua em aberto hoje, e escondê-la ao trocar o mês tiraria a
                  utilidade do indicador para cobrança.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================== HHT ================== */}
        <TabsContent value="hht" className="space-y-4 mt-0">
          <div>
            <h3 className="text-lg font-semibold">Homens-hora trabalhadas</h3>
            <p className="text-xs text-muted-foreground">
              Denominador das taxas da NBR 14280. Um lançamento por mês, por obra — ou sem obra,
              para o consolidado da empresa.
            </p>
          </div>

          {allowEdit && (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm font-medium">
                  Lançar HHT de {MESES[mes - 1]} de {ano}
                  {projetoId === "todas" ? " (consolidado da empresa)" : ""}
                </p>

                {sugerido.horas > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                    <p className="text-xs">
                      O diário de obra soma{" "}
                      <strong>{sugerido.horas.toLocaleString("pt-BR")} horas</strong> no período
                      ({sugerido.lancamentos} lançamentos).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1 shrink-0"
                      onClick={() => {
                        setHhtHoras(String(sugerido.horas));
                        setHhtOrigem("DIARIO_OBRA");
                      }}
                    >
                      <Wand2 className="h-3.5 w-3.5" /> Usar
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="hht-horas">Horas trabalhadas</Label>
                    <Input
                      id="hht-horas"
                      inputMode="decimal"
                      placeholder="Ex: 24000"
                      value={hhtHoras}
                      onChange={(e) => setHhtHoras(e.target.value)}
                      aria-invalid={horasInvalidas && hhtHoras.trim().length > 0}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hht-origem">Origem do número</Label>
                    <Select
                      value={hhtOrigem}
                      onValueChange={(v) => setHhtOrigem(v as OrigemHht)}
                    >
                      <SelectTrigger id="hht-origem">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOLHA">Departamento pessoal</SelectItem>
                        <SelectItem value="DIARIO_OBRA">Diário de obra</SelectItem>
                        <SelectItem value="MANUAL">Estimativa manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hht-trab">Média de trabalhadores</Label>
                    <Input
                      id="hht-trab"
                      type="number"
                      min={0}
                      value={hhtTrabalhadores}
                      onChange={(e) => setHhtTrabalhadores(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={salvar}
                      disabled={horasInvalidas || salvarHht.isPending}
                      className="w-full gap-1"
                    >
                      <Plus className="h-4 w-4" /> Lançar
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Diário de obra incompleto <strong>subestima</strong> o HHT e portanto{" "}
                    <strong>infla</strong> as taxas, porque o HHT é divisor. É o erro seguro para
                    indicador de segurança — erra para pior, não para melhor. A origem aparece na
                    tabela para o número nunca se passar pelo que não é.
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Trabalhadores</TableHead>
                    <TableHead>Origem</TableHead>
                    {allowEdit && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estadoHht ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={allowEdit ? 6 : 5} className="p-0">
                        {estadoHht}
                      </TableCell>
                    </TableRow>
                  ) : (
                    registros.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {MESES[h.mes - 1]}/{h.ano}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.projeto ? h.projeto.nome : (
                            <span className="text-muted-foreground">consolidado</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums font-medium">
                          {Number(h.horas).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {h.media_trabalhadores ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className={
                              h.origem === "MANUAL"
                                ? "bg-amber-50 text-amber-800 border-amber-300 text-xs"
                                : "text-xs"
                            }
                            title={
                              h.origem === "MANUAL"
                                ? "Estimativa manual: a taxa calculada sobre este HHT não tem o mesmo peso de uma calculada sobre a folha"
                                : undefined
                            }
                          >
                            {ORIGEM_HHT_LABEL[h.origem]}
                          </Badge>
                        </TableCell>
                        {allowEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Remover lançamento"
                              onClick={() => removerHht.mutate(h.id)}
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
            </CardContent>
          </Card>

          {seg?.origemHht && (
            <p className="text-xs text-muted-foreground">
              As taxas de {rotuloPeriodo} foram calculadas sobre{" "}
              <strong>{seg.hht?.toLocaleString("pt-BR")} HHT</strong>
              {seg.origemHht === "MISTA"
                ? ", somando meses de origens diferentes."
                : ` — origem: ${ORIGEM_HHT_LABEL[seg.origemHht as OrigemHht] ?? seg.origemHht}.`}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
