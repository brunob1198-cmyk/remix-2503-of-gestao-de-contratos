import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AtividadePlanejamento, FrenteObra } from "@/hooks/usePlanejamento";
import { addDays, differenceInDays, format } from "date-fns";
import {
  Users, TrendingUp, TrendingDown, Clock, AlertTriangle,
  RotateCcw, Zap, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SimulacaoEquipesProps {
  atividades: AtividadePlanejamento[];
  frentes: FrenteObra[];
}

interface SimResult {
  atividade: AtividadePlanejamento;
  originalDuracao: number;
  novaDuracao: number;
  originalFim: Date | null;
  novoFim: Date | null;
  diferencaDias: number;
  novaProducaoDiaria: number;
}

export function SimulacaoEquipes({ atividades, frentes }: SimulacaoEquipesProps) {
  const [fatorEquipe, setFatorEquipe] = useState(1);
  const [selectedFrentes, setSelectedFrentes] = useState<string[]>([]);

  const targetAtividades = useMemo(() => {
    if (selectedFrentes.length === 0) return atividades;
    return atividades.filter((a) => selectedFrentes.includes(a.frente_id));
  }, [atividades, selectedFrentes]);

  const results = useMemo<SimResult[]>(() => {
    return targetAtividades.map((a) => {
      const prodDiaria = a.producao_diaria_prevista || 1;
      const qtdTotal = a.quantidade_total || 1;
      const qtdRestante = Math.max(0, qtdTotal - (a.qtd_produzida || 0));

      const originalDuracao = a.duracao_dias || Math.ceil(qtdTotal / prodDiaria);
      const novaProducaoDiaria = prodDiaria * fatorEquipe;
      const duracaoRestanteOriginal = Math.ceil(qtdRestante / prodDiaria);
      const duracaoRestanteNova = Math.ceil(qtdRestante / novaProducaoDiaria);
      const novaDuracao = (originalDuracao - duracaoRestanteOriginal) + duracaoRestanteNova;

      const originalFim = a.data_inicio
        ? addDays(new Date(a.data_inicio), originalDuracao)
        : null;
      const novoFim = a.data_inicio
        ? addDays(new Date(a.data_inicio), novaDuracao)
        : null;

      return {
        atividade: a,
        originalDuracao,
        novaDuracao: Math.max(1, novaDuracao),
        originalFim,
        novoFim,
        diferencaDias: novaDuracao - originalDuracao,
        novaProducaoDiaria,
      };
    });
  }, [targetAtividades, fatorEquipe]);

  const summary = useMemo(() => {
    const totalDiasOriginal = results.reduce((s, r) => s + r.originalDuracao, 0);
    const totalDiasNovo = results.reduce((s, r) => s + r.novaDuracao, 0);
    const diasEconomizados = totalDiasOriginal - totalDiasNovo;

    let maxOriginal: Date | null = null;
    let maxNovo: Date | null = null;
    results.forEach((r) => {
      if (r.originalFim && (!maxOriginal || r.originalFim > maxOriginal)) maxOriginal = r.originalFim;
      if (r.novoFim && (!maxNovo || r.novoFim > maxNovo)) maxNovo = r.novoFim;
    });

    const prazoOriginal = maxOriginal ? format(maxOriginal, "dd/MM/yyyy") : "—";
    const prazoNovo = maxNovo ? format(maxNovo, "dd/MM/yyyy") : "—";
    const diffPrazo = maxOriginal && maxNovo ? differenceInDays(maxNovo, maxOriginal) : 0;

    const atrasadas = results.filter((r) => r.atividade.status === "atrasado");

    return { totalDiasOriginal, totalDiasNovo, diasEconomizados, prazoOriginal, prazoNovo, diffPrazo, atrasadas };
  }, [results]);

  const toggleFrente = (id: string) => {
    setSelectedFrentes((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const fatorLabel = fatorEquipe === 1 ? "Atual" :
    fatorEquipe > 1 ? `+${((fatorEquipe - 1) * 100).toFixed(0)}% equipe` :
    `${((fatorEquipe - 1) * 100).toFixed(0)}% equipe`;

  return (
    <div className="space-y-4">
      {/* Filter frentes */}
      {frentes.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-muted-foreground">Frentes:</span>
          <Button
            variant={selectedFrentes.length === 0 ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedFrentes([])}
          >
            Todas
          </Button>
          {frentes.map((f) => (
            <Button
              key={f.id}
              variant={selectedFrentes.includes(f.id) ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleFrente(f.id)}
            >
              {f.nome}
            </Button>
          ))}
        </div>
      )}

      {/* Simulation control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Simulação de Equipe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Fator de equipe</span>
                <Badge variant={fatorEquipe === 1 ? "secondary" : fatorEquipe > 1 ? "default" : "destructive"}>
                  {fatorLabel}
                </Badge>
              </div>
              <Slider
                value={[fatorEquipe * 100]}
                onValueChange={([v]) => setFatorEquipe(v / 100)}
                min={25}
                max={300}
                step={25}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>-75%</span>
                <span>Atual</span>
                <span>+200%</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFatorEquipe(1)} title="Resetar">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="py-3 px-4">
                <p className="text-[11px] text-muted-foreground">Duração Total</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm line-through text-muted-foreground">{summary.totalDiasOriginal}d</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-bold">{summary.totalDiasNovo}d</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-3 px-4">
                <p className="text-[11px] text-muted-foreground">Dias Economizados</p>
                <p className={cn(
                  "text-lg font-bold mt-0.5",
                  summary.diasEconomizados > 0 ? "text-emerald-600" : summary.diasEconomizados < 0 ? "text-red-600" : ""
                )}>
                  {summary.diasEconomizados > 0 ? "+" : ""}{summary.diasEconomizados}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-3 px-4">
                <p className="text-[11px] text-muted-foreground">Prazo Atual</p>
                <p className="text-sm font-bold mt-0.5">{summary.prazoOriginal}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-3 px-4">
                <p className="text-[11px] text-muted-foreground">Prazo Simulado</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm font-bold">{summary.prazoNovo}</p>
                  {summary.diffPrazo !== 0 && (
                    <Badge variant={summary.diffPrazo < 0 ? "default" : "destructive"} className="text-[10px]">
                      {summary.diffPrazo > 0 ? "+" : ""}{summary.diffPrazo}d
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Atrasadas highlight */}
      {summary.atrasadas.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                {summary.atrasadas.length} atividade(s) atrasada(s)
              </span>
            </div>
            <div className="space-y-1">
              {summary.atrasadas.slice(0, 5).map((r) => (
                <div key={r.atividade.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{r.atividade.frente_nome}: {r.atividade.nome}</span>
                  <span className="text-muted-foreground ml-2">
                    {r.atividade.percentual_executado?.toFixed(0)}% executado
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Impacto por Atividade
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium">Atividade</th>
                  <th className="text-right py-2 px-3 font-medium">Prod. Atual</th>
                  <th className="text-right py-2 px-3 font-medium">Prod. Simulada</th>
                  <th className="text-right py-2 px-3 font-medium">Duração</th>
                  <th className="text-right py-2 px-3 font-medium">Fim Simulado</th>
                  <th className="text-right py-2 px-3 font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.atividade.id} className="border-b hover:bg-muted/20">
                    <td className="py-2 px-3">
                      <div className="truncate max-w-48">
                        <span className="text-muted-foreground">{r.atividade.frente_nome}: </span>
                        {r.atividade.nome}
                      </div>
                    </td>
                    <td className="text-right py-2 px-3">{r.atividade.producao_diaria_prevista}/dia</td>
                    <td className="text-right py-2 px-3 font-medium">{r.novaProducaoDiaria.toFixed(1)}/dia</td>
                    <td className="text-right py-2 px-3">
                      <span className="line-through text-muted-foreground mr-1">{r.originalDuracao}d</span>
                      <span className="font-medium">{r.novaDuracao}d</span>
                    </td>
                    <td className="text-right py-2 px-3">
                      {r.novoFim ? format(r.novoFim, "dd/MM/yy") : "—"}
                    </td>
                    <td className="text-right py-2 px-3">
                      {r.diferencaDias !== 0 && (
                        <Badge
                          variant={r.diferencaDias < 0 ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {r.diferencaDias > 0 ? "+" : ""}{r.diferencaDias}d
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
