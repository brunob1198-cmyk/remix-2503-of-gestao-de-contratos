import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnaliseObra } from "@/hooks/useAnaliseObra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Brain,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  CircleAlert,
  BarChart3,
  DollarSign,
  Loader2,
  Sparkles,
  History,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface AnaliseIAData {
  resumo: string;
  riscos: Array<{
    titulo: string;
    descricao: string;
    severidade: "alta" | "media" | "baixa";
  }>;
  desvios_custo: Array<{
    categoria: string;
    descricao: string;
    percentual: number;
    impacto: "positivo" | "negativo" | "neutro";
  }>;
  produtividade: {
    avaliacao_geral: string;
    pontos_fortes: string[];
    pontos_fracos: string[];
    tendencia: "melhorando" | "estavel" | "piorando";
  };
  recomendacoes: Array<{
    acao: string;
    prioridade: "alta" | "media" | "baixa";
    impacto_esperado: string;
  }>;
  alertas_criticos: Array<{
    alerta: string;
    acao_imediata: string;
  }>;
}

interface AnaliseRecord {
  id: string;
  site_id: string;
  resultado: AnaliseIAData;
  created_at: string;
}

function SeveridadeBadge({ severidade }: { severidade: string }) {
  const map: Record<string, { className: string; label: string }> = {
    alta: { className: "bg-red-100 text-red-800 border-red-300", label: "Alta" },
    media: { className: "bg-amber-100 text-amber-800 border-amber-300", label: "Média" },
    baixa: { className: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Baixa" },
  };
  const s = map[severidade] || map.media;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const map: Record<string, { className: string; label: string }> = {
    alta: { className: "bg-red-100 text-red-800 border-red-300", label: "Urgente" },
    media: { className: "bg-amber-100 text-amber-800 border-amber-300", label: "Importante" },
    baixa: { className: "bg-blue-100 text-blue-800 border-blue-300", label: "Melhoria" },
  };
  const p = map[prioridade] || map.media;
  return <Badge variant="outline" className={p.className}>{p.label}</Badge>;
}

function TendenciaIcon({ tendencia }: { tendencia: string }) {
  if (tendencia === "melhorando") return <TrendingUp className="h-5 w-5 text-emerald-600" />;
  if (tendencia === "piorando") return <TrendingDown className="h-5 w-5 text-red-600" />;
  return <Minus className="h-5 w-5 text-amber-600" />;
}

function ImpactoIcon({ impacto }: { impacto: string }) {
  if (impacto === "positivo") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (impacto === "negativo") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function AnaliseContent({ analise }: { analise: AnaliseIAData }) {
  return (
    <>
      {/* Alertas Críticos */}
      {analise.alertas_criticos?.length > 0 && (
        <Card className="border-red-300 bg-red-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-red-800">
              <CircleAlert className="h-5 w-5" />
              Alertas Críticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analise.alertas_criticos.map((a, i) => (
              <div key={i} className="bg-white border border-red-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-red-900 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {a.alerta}
                </p>
                <p className="text-sm text-red-700 pl-6">
                  <span className="font-medium">Ação:</span> {a.acao_imediata}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumo Executivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-line">{analise.resumo}</p>
        </CardContent>
      </Card>

      {/* Riscos */}
      {analise.riscos?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-amber-600" />
              Riscos Identificados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analise.riscos.map((r, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">{r.titulo}</p>
                  <SeveridadeBadge severidade={r.severidade} />
                </div>
                <p className="text-sm text-muted-foreground">{r.descricao}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Desvios de Custo */}
      {analise.desvios_custo?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Desvios de Custo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analise.desvios_custo.map((d, i) => (
              <div key={i} className="flex items-start gap-3 border rounded-lg p-4">
                <ImpactoIcon impacto={d.impacto} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{d.categoria}</p>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        d.impacto === "negativo"
                          ? "text-red-600"
                          : d.impacto === "positivo"
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {d.percentual > 0 ? "+" : ""}
                      {d.percentual.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.descricao}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Produtividade */}
      {analise.produtividade && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Análise de Produtividade
              <div className="ml-auto flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <TendenciaIcon tendencia={analise.produtividade.tendencia} />
                <span className="capitalize">{analise.produtividade.tendencia}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{analise.produtividade.avaliacao_geral}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analise.produtividade.pontos_fortes?.length > 0 && (
                <div className="bg-emerald-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-2">✅ Pontos Fortes</p>
                  <ul className="space-y-1">
                    {analise.produtividade.pontos_fortes.map((p, i) => (
                      <li key={i} className="text-sm text-emerald-700">• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analise.produtividade.pontos_fracos?.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">⚠️ Pontos de Atenção</p>
                  <ul className="space-y-1">
                    {analise.produtividade.pontos_fracos.map((p, i) => (
                      <li key={i} className="text-sm text-red-700">• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recomendações */}
      {analise.recomendacoes?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analise.recomendacoes.map((r, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">{r.acao}</p>
                  <PrioridadeBadge prioridade={r.prioridade} />
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Impacto esperado:</span> {r.impacto_esperado}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export function AnaliseIA({ projetoId, projetoName }: { projetoId: string; projetoName: string }) {
  const { data: obraData, isLoading: isLoadingObra } = useAnaliseObra(projetoId);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load saved analyses for this project (uses first site)
  const firstSiteId = obraData?.siteIds?.[0] || null;

  const { data: savedAnalises = [], isLoading: isLoadingSaved } = useQuery({
    queryKey: ["analises_ia_projeto", projetoId],
    queryFn: async () => {
      if (!obraData?.siteIds?.length) return [];
      const { data, error } = await supabase
        .from("analises_ia")
        .select("id, site_id, resultado, created_at")
        .in("site_id", obraData.siteIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AnaliseRecord[];
    },
    enabled: !!projetoId && !!obraData?.siteIds?.length,
  });

  const latestAnalise = savedAnalises[0] || null;
  const displayedAnalise = selectedHistoryId
    ? savedAnalises.find(a => a.id === selectedHistoryId)
    : latestAnalise;

  // Reset selection when project changes
  useEffect(() => {
    setSelectedHistoryId(null);
    setShowHistory(false);
  }, [projetoId]);

  const handleAnalise = async () => {
    if (!obraData) {
      toast({ title: "Sem dados", description: "Não há dados suficientes para gerar a análise.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const payload = {
        siteName: projetoName,
        financeiro: obraData.financeiro,
        progresso: obraData.progresso,
        servicos: obraData.servicos.slice(0, 15),
        alertas: obraData.alertas,
        custosCategorias: obraData.custosCategorias,
        producaoItems: obraData.producaoItems.slice(0, 20).map((p) => ({
          codigo: p.codigo,
          descricao: p.descricao,
          planejado: p.planejado,
          executado: p.executado,
          saldo: p.saldo,
          mediaDiaria: p.mediaDiaria,
          diasComProducao: p.diasComProducao,
        })),
        escopoTotal: obraData.escopoTotal,
        fotos: (obraData as any).fotos?.slice(0, 20).map((f: any) => ({
          url: f.url,
          legenda: f.legenda,
          classificacao: f.classificacao,
          data: f.diario?.data
        })),
      };

      const { data, error } = await supabase.functions.invoke("analyze-obra", {
        body: { obraData: payload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.analise) throw new Error("Resposta inválida");

      // Save to database
      if (firstSiteId) {
        const { error: insertError } = await supabase.from("analises_ia").insert({
          site_id: firstSiteId,
          resultado: data.analise,
        });

        if (insertError) {
          console.error("Erro ao salvar análise:", insertError);
        }
      }

      // Refresh the list
      await queryClient.invalidateQueries({ queryKey: ["analises_ia_projeto", projetoId] });
      setSelectedHistoryId(null);

      toast({ title: "Análise concluída", description: "A inteligência artificial processou os dados da obra e o resultado foi salvo." });
    } catch (err: any) {
      console.error("Erro na análise IA:", err);
      toast({
        title: "Erro na análise",
        description: err.message || "Não foi possível gerar a análise. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoadingObra || isLoadingSaved) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Análise com Inteligência Artificial
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gere insights estratégicos a partir dos dados reais da obra
          </p>
        </div>
        <Button
          onClick={handleAnalise}
          disabled={isAnalyzing || !obraData}
          size="lg"
          className="gap-2 shadow-md"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {latestAnalise ? "Gerar Nova Análise" : "Gerar Análise Inteligente"}
            </>
          )}
        </Button>
      </div>

      {/* Last analysis date info */}
      {displayedAnalise && !isAnalyzing && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4" />
            <span>
              {selectedHistoryId ? "Análise de" : "Última análise:"}{" "}
              <strong>
                {format(new Date(displayedAnalise.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </strong>
            </span>
          </div>

          {savedAnalises.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4" />
              Histórico ({savedAnalises.length})
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}

          {selectedHistoryId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedHistoryId(null)}
            >
              Ver mais recente
            </Button>
          )}
        </div>
      )}

      {/* History panel */}
      {showHistory && savedAnalises.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Histórico de Análises
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedAnalises.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedHistoryId(a.id === latestAnalise?.id ? null : a.id);
                    setShowHistory(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    (selectedHistoryId === a.id || (!selectedHistoryId && a.id === latestAnalise?.id))
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {a.id === latestAnalise?.id && (
                    <Badge variant="secondary" className="text-xs">Mais recente</Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!displayedAnalise && !isAnalyzing && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-sm max-w-md">
              Clique em <strong>"Gerar Análise Inteligente"</strong> para que a IA analise os dados financeiros, de produção e custos da obra e gere recomendações estratégicas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isAnalyzing && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <Skeleton className="h-5 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Analysis content */}
      {displayedAnalise && !isAnalyzing && (
        <AnaliseContent analise={displayedAnalise.resultado} />
      )}
    </div>
  );
}
