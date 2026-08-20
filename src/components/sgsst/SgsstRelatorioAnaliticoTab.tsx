import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useSgsstRelatorioAnalitico,
  percentualAlterados,
  prevalenciaPor100,
  variacao,
  type ContagemPorChave,
} from "@/hooks/sgsst/useSgsstRelatorioAnalitico";
import { gerarPdfRelatorioAnalitico } from "@/lib/relatorioAnaliticoDocumento";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { SgsstErrorState, SgsstLoadingState } from "@/components/sgsst/SgsstStateFeedback";

/**
 * Relatório analítico anual do PCMSO — NR-07 item 7.6.
 *
 * Fica como aba do módulo de PCMSO, e não na tela genérica de Relatórios, porque
 * tem estrutura legal fixa: as seis alíneas do 7.6.2 e a comparação obrigatória
 * com o exercício anterior.
 */

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => ANO_ATUAL - i);

/** Em indicador de saúde, subir é piorar — por isso a seta vermelha aponta para cima. */
function Tendencia({ atual, anterior }: { atual: number; anterior: number }) {
  const v = variacao(atual, anterior);

  if (v === null) {
    return <span className="text-xs text-muted-foreground">sem base</span>;
  }
  if (Math.abs(v) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> estável
      </span>
    );
  }

  const sobe = v > 0;
  const Icone = sobe ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        sobe ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
      }`}
    >
      <Icone className="h-3 w-3" />
      {Math.abs(v).toFixed(1).replace(".", ",")}%
    </span>
  );
}

function TabelaContagem({
  itens,
  rotulo,
  vazio,
}: {
  itens: ContagemPorChave[];
  rotulo: string;
  vazio: string;
}) {
  if (itens.length === 0) {
    return <p className="py-3 text-xs text-muted-foreground italic">{vazio}</p>;
  }
  const total = itens.reduce((s, i) => s + i.total, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{rotulo}</TableHead>
          <TableHead className="text-right w-20">Qtd.</TableHead>
          <TableHead className="text-right w-20">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((i) => (
          <TableRow key={i.chave}>
            <TableCell className="text-xs">{i.chave}</TableCell>
            <TableCell className="text-right text-xs tabular-nums">{i.total}</TableCell>
            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
              {total > 0 ? `${((i.total / total) * 100).toFixed(1).replace(".", ",")}%` : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SgsstRelatorioAnaliticoTab() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [emitindo, setEmitindo] = useState(false);

  const { relatorio, isLoading, error, refetch } = useSgsstRelatorioAnalitico(ano);
  const { empresa } = useEmpresaAtual();
  const { profile } = useAuth();

  const handleEmitir = async () => {
    if (!relatorio) return;

    setEmitindo(true);
    try {
      await gerarPdfRelatorioAnalitico({
        relatorio,
        empresa,
        geradoPor: profile?.nome ?? null,
      });
      toast.success("Relatório gerado.");
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível gerar o relatório: ${detalhe}`);
    } finally {
      setEmitindo(false);
    }
  };

  if (error) {
    return <SgsstErrorState error={error} modulo="Relatório Analítico" onRetry={refetch} />;
  }

  if (isLoading || !relatorio) {
    return <SgsstLoadingState label="Calculando o relatório analítico" />;
  }

  const a = relatorio.atual;
  const b = relatorio.anterior;
  const semDados = a.examesClinicos + a.examesComplementares === 0 && a.cats === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Relatório Analítico do PCMSO</h2>
          <p className="text-sm text-muted-foreground">
            Obrigatório anualmente pela NR-07 item 7.6, com as seis alíneas do 7.6.2 e a
            comparação com o exercício anterior.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="anoRel" className="text-xs text-muted-foreground">
              Exercício
            </label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger id="anoRel" className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleEmitir} disabled={emitindo} className="gap-2">
            <FileText className="h-4 w-4" />
            {emitindo ? "Gerando…" : "Emitir relatório (PDF)"}
          </Button>
        </div>
      </div>

      {semDados && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Não há exames realizados nem CATs registradas em {ano}. O relatório sai sem
            conteúdo estatístico — registre os exames e classifique os resultados para
            os números aparecerem.
          </span>
        </div>
      )}

      {a.resultadosNaoClassificados > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{a.resultadosNaoClassificados}</strong> exame(s) realizado(s) sem
            classificação de resultado. Eles não entram na estatística de achados — o
            relatório não presume que exame sem laudo é normal.
          </span>
        </div>
      )}

      <SgsstStatCards
        stats={[
          {
            label: "Exames realizados",
            value: a.examesClinicos + a.examesComplementares,
            tone: "info",
            hint: `${a.examesClinicos} clínicos · ${a.examesComplementares} complementares`,
            ajuda:
              "A norma conta clínicos e complementares separadamente. A natureza é definida no cadastro do exame.",
          },
          {
            label: "Resultados alterados",
            value: a.resultadosAlterados,
            tone: a.resultadosAlterados > 0 ? "atencao" : "positivo",
            hint:
              percentualAlterados(a) === null
                ? "nada classificado"
                : `${percentualAlterados(a)!.toFixed(1).replace(".", ",")}% dos classificados`,
            ajuda:
              "Percentual calculado só sobre os exames classificados. Não classificados ficam fora do denominador para não diluir o indicador.",
          },
          {
            label: "CATs emitidas",
            value: a.cats,
            tone: a.cats > 0 ? "critico" : "positivo",
            hint: `${a.diasAfastamento} dia(s) de afastamento`,
            ajuda: "Comunicações de Acidente de Trabalho registradas no exercício.",
          },
          {
            label: "Prevalência",
            value:
              prevalenciaPor100(a) === null
                ? "—"
                : `${prevalenciaPor100(a)!.toFixed(1).replace(".", ",")}`,
            tone: "neutro",
            hint: `por 100 de ${a.trabalhadoresAtivos} ativos`,
            ajuda:
              "Resultados alterados por 100 trabalhadores ativos. Sem trabalhador cadastrado o indicador não existe.",
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">b) Exames complementares, por tipo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TabelaContagem
              itens={a.complementaresPorTipo}
              rotulo="Exame"
              vazio="Nenhum exame complementar realizado no período."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">c) Estatística dos resultados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classificação</TableHead>
                  <TableHead className="text-right w-24">Qtd.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs">Normal</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {a.resultadosNormais}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs">Alterado</TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                    {a.resultadosAlterados}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs">Inconclusivo</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {a.resultadosInconclusivos}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">
                    Não classificado
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {a.resultadosNaoClassificados}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">d) Incidência por obra — alterados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TabelaContagem
              itens={a.alteradosPorObra}
              rotulo="Obra"
              vazio="Nenhum resultado alterado no período."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">e) CATs por tipo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TabelaContagem
              itens={a.catsPorTipo}
              rotulo="Tipo de CAT"
              vazio="Nenhuma CAT emitida no período."
            />
            {a.obitos > 0 && (
              <div className="p-3 pt-0">
                <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">
                  {a.obitos} óbito(s) comunicado(s)
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            f) Comparação com o exercício anterior ({b.ano})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="text-right w-24">{a.ano}</TableHead>
                <TableHead className="text-right w-24">{b.ano}</TableHead>
                <TableHead className="text-right w-32">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Exames clínicos", a.examesClinicos, b.examesClinicos],
                ["Exames complementares", a.examesComplementares, b.examesComplementares],
                ["Resultados alterados", a.resultadosAlterados, b.resultadosAlterados],
                ["CATs emitidas", a.cats, b.cats],
                ["Dias de afastamento", a.diasAfastamento, b.diasAfastamento],
                ["Óbitos comunicados", a.obitos, b.obitos],
              ].map(([rotulo, atual, anterior]) => (
                <TableRow key={rotulo as string}>
                  <TableCell className="text-xs">{rotulo}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-medium">
                    {atual as number}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {anterior as number}
                  </TableCell>
                  <TableCell className="text-right">
                    <Tendencia atual={atual as number} anterior={anterior as number} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-3 py-2 text-xs text-muted-foreground border-t">
            Em indicadores de saúde, alta é piora — por isso a seta vermelha aponta para
            cima. A NR-07 7.6.5 exige que este relatório seja apresentado e discutido com
            os responsáveis pela SST.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
