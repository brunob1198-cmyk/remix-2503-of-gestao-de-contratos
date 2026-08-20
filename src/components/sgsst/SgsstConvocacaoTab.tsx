import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { useSgsstConvocacao, type ItemConvocacao } from "@/hooks/sgsst/useSgsstConvocacao";
import { SITUACAO_LABEL, type SituacaoConvocacao } from "@/utils/sgsstConvocacao";
import { FAIXA_ETARIA_LABEL } from "@/hooks/sgsst/useSgsstPcmso";

/**
 * Painel de convocação de exames.
 *
 * Responde a pergunta que o módulo não respondia: quem precisa ser chamado, e
 * quando. Cruza a periodicidade e a faixa etária do PCMSO com a data do último
 * exame de cada trabalhador ativo.
 */

const TOM_SITUACAO: Record<SituacaoConvocacao, string> = {
  VENCIDO: "bg-red-100 text-red-800 border-red-300",
  VENCE_ESTE_MES: "bg-amber-100 text-amber-800 border-amber-300",
  A_VENCER: "bg-blue-50 text-blue-800 border-blue-200",
  EM_DIA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SEM_BASE: "bg-muted text-muted-foreground",
};

export function SgsstConvocacaoTab() {
  const { itens, resumo, isLoading, error, refetch } = useSgsstConvocacao();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSituacao, setFilterSituacao] = useState<string>("PENDENTES");
  const [filterObra, setFilterObra] = useState("todas");

  const obras = useMemo(
    () => [...new Set(itens.map((i) => i.obra).filter((o): o is string => !!o))].sort(),
    [itens]
  );

  // O filtro roda no cliente de propósito: a lista já veio inteira do cruzamento,
  // e refazer o cálculo no servidor a cada tecla seria desperdício.
  const visiveis = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();

    return itens.filter((i) => {
      if (filterObra !== "todas" && i.obra !== filterObra) return false;

      // "Pendentes" é o recorte que interessa no dia a dia: o que exige ação.
      if (filterSituacao === "PENDENTES") {
        if (i.situacao === "EM_DIA") return false;
      } else if (filterSituacao !== "todas" && i.situacao !== filterSituacao) {
        return false;
      }

      if (!termo) return true;
      return (
        i.trabalhador.toLowerCase().includes(termo) ||
        i.nomeExame.toLowerCase().includes(termo) ||
        (i.cpf ?? "").includes(termo) ||
        (i.funcao ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, searchTerm, filterSituacao, filterObra]);

  const temFiltroAtivo =
    searchTerm.trim().length > 0 || filterSituacao !== "PENDENTES" || filterObra !== "todas";

  const limparFiltros = () => {
    setSearchTerm("");
    setFilterSituacao("PENDENTES");
    setFilterObra("todas");
  };

  const dataBr = (d: Date | null) => (d ? format(d, "dd/MM/yyyy") : "—");

  const prazoTexto = (i: ItemConvocacao) => {
    if (i.situacao === "SEM_BASE") return "sem periodicidade";
    if (i.diasRestantes === null) return "nunca realizado";
    if (i.diasRestantes < 0) return `${Math.abs(i.diasRestantes)} dia(s) em atraso`;
    if (i.diasRestantes === 0) return "vence hoje";
    return `em ${i.diasRestantes} dia(s)`;
  };

  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: visiveis.length === 0,
    modulo: "Convocação",
    onRetry: refetch,
    emptyTitulo: "Ninguém a convocar",
    emptyDescricao:
      "A convocação cruza a periodicidade dos exames do PCMSO com a data do último exame de cada trabalhador ativo. Precisa de um PCMSO ativo com exames previstos e de colaboradores cadastrados.",
    filtrado: temFiltroAtivo,
    onLimparFiltros: limparFiltros,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Convocação de exames
        </h2>
        <p className="text-sm text-muted-foreground">
          Quem precisa ser chamado, com base na periodicidade e na faixa etária definidas
          no PCMSO ativo.
        </p>
      </div>

      <SgsstStatCards
        isLoading={isLoading}
        stats={[
          {
            label: "Vencidos",
            value: resumo.vencidos,
            tone: resumo.vencidos > 0 ? "critico" : "positivo",
            icon: AlertTriangle,
            hint: "exigem ação imediata",
            ajuda:
              "Inclui quem nunca realizou o exame: quem nunca fez é justamente quem mais precisa aparecer.",
          },
          {
            label: "Vencem este mês",
            value: resumo.venceEsteMes,
            tone: resumo.venceEsteMes > 0 ? "atencao" : "positivo",
            icon: Clock,
            ajuda: "A data de vencimento cai no mês corrente.",
          },
          {
            label: "A vencer (60 dias)",
            value: resumo.aVencer,
            tone: "info",
            icon: CalendarClock,
            ajuda: "Janela de antecedência para organizar a agenda com a clínica.",
          },
          {
            label: "Sem base de cálculo",
            value: resumo.semBase,
            tone: resumo.semBase > 0 ? "atencao" : "neutro",
            icon: HelpCircle,
            hint: "periodicidade não informada",
            ajuda:
              "O exame previsto no PCMSO está sem periodicidade em meses, então não há como calcular a data. Corrija no quadro de exames do programa.",
          },
        ]}
      />

      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por trabalhador, CPF, função ou exame..."
        resultCount={visiveis.length}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={[
          ...(filterSituacao !== "PENDENTES"
            ? [
                {
                  label: "Situação",
                  value:
                    filterSituacao === "todas"
                      ? "Todas"
                      : SITUACAO_LABEL[filterSituacao as SituacaoConvocacao],
                  onClear: () => setFilterSituacao("PENDENTES"),
                },
              ]
            : []),
          ...(filterObra !== "todas"
            ? [{ label: "Obra", value: filterObra, onClear: () => setFilterObra("todas") }]
            : []),
        ]}
      >
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDENTES">Só o que exige ação</SelectItem>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="VENCIDO">Vencidos</SelectItem>
            <SelectItem value="VENCE_ESTE_MES">Vencem este mês</SelectItem>
            <SelectItem value="A_VENCER">A vencer</SelectItem>
            <SelectItem value="EM_DIA">Em dia</SelectItem>
            <SelectItem value="SEM_BASE">Sem base de cálculo</SelectItem>
          </SelectContent>
        </Select>

        {obras.length > 0 && (
          <Select value={filterObra} onValueChange={setFilterObra}>
            <SelectTrigger className="w-[170px]" aria-label="Filtrar por obra">
              <SelectValue placeholder="Obra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SgsstFilterBar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabalhador</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Exame previsto</TableHead>
                <TableHead>Period.</TableHead>
                <TableHead>Último</TableHead>
                <TableHead>Vence em</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Agenda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="p-0">
                    {tableState}
                  </TableCell>
                </TableRow>
              ) : (
                visiveis.map((i) => (
                  <TableRow key={i.chave}>
                    <TableCell className="text-xs font-medium">
                      {i.trabalhador}
                      {i.idade !== null && (
                        <span className="text-muted-foreground font-normal"> · {i.idade}a</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.funcao || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.obra || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.nomeExame}
                      {i.faixaEtaria && i.faixaEtaria !== "TODAS" && (
                        <span
                          className="block text-muted-foreground"
                          title="Este exame só se aplica a esta faixa etária"
                        >
                          {FAIXA_ETARIA_LABEL[i.faixaEtaria]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {i.periodicidadeMeses > 0 ? `${i.periodicidadeMeses} m` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.ultimaRealizacao ? (
                        format(new Date(`${i.ultimaRealizacao}T00:00:00`), "dd/MM/yyyy")
                      ) : (
                        <span className="text-red-600">nunca</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {dataBr(i.proximoVencimento)}
                      <span className="block text-muted-foreground">{prazoTexto(i)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs whitespace-nowrap ${TOM_SITUACAO[i.situacao]}`}
                      >
                        {SITUACAO_LABEL[i.situacao]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.jaAgendado && i.dataAgendada ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {format(new Date(`${i.dataAgendada}T00:00:00`), "dd/MM")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A lista considera apenas PCMSOs com status <strong>Ativo</strong> e trabalhadores
        ativos. Trabalhador sem data de nascimento entra em todas as faixas etárias — deixar
        de convocar por falta de cadastro é o erro mais caro.
      </p>
    </div>
  );
}
