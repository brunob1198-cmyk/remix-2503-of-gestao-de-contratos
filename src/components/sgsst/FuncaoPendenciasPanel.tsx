import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, HardHat, UserX, ShieldCheck, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { useSgsstFuncaoMatriz } from "@/hooks/sgsst/useSgsstFuncaoMatriz";
import { SITUACAO_ITEM_LABEL, type SituacaoItem } from "@/utils/sgsstMatrizFuncao";

/**
 * Quem está sem o que a função dele exige.
 *
 * É o retorno prático de ter dado vínculos à função: antes essa pergunta não
 * tinha resposta possível, porque nada no sistema dizia o que cada função exige.
 */

const TOM_SITUACAO: Record<SituacaoItem, string> = {
  NUNCA_FEITO: "bg-red-100 text-red-800 border-red-300",
  VENCIDO: "bg-amber-100 text-amber-800 border-amber-300",
  SEM_FUNCAO: "bg-muted text-muted-foreground",
  OK: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function FuncaoPendenciasPanel() {
  const { pendencias, resumo, isLoading, error, refetch, truncado } = useSgsstFuncaoMatriz();

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroSituacao, setFiltroSituacao] = useState("todas");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return pendencias.filter((p) => {
      if (filtroTipo === "TREINAMENTO" && p.tipo !== "TREINAMENTO") return false;
      if (filtroTipo === "EPI" && p.tipo !== "EPI") return false;
      if (filtroSituacao !== "todas" && p.situacao !== filtroSituacao) return false;

      if (!termo) return true;
      return (
        p.colaborador.toLowerCase().includes(termo) ||
        p.itemNome.toLowerCase().includes(termo) ||
        (p.funcaoNome ?? "").toLowerCase().includes(termo) ||
        (p.obra ?? "").toLowerCase().includes(termo)
      );
    });
  }, [pendencias, busca, filtroTipo, filtroSituacao]);

  const temFiltro =
    busca.trim().length > 0 || filtroTipo !== "todos" || filtroSituacao !== "todas";

  const limparFiltros = () => {
    setBusca("");
    setFiltroTipo("todos");
    setFiltroSituacao("todas");
  };

  const estado = resolveTableState({
    isLoading,
    error,
    isEmpty: visiveis.length === 0,
    modulo: "Pendências por função",
    onRetry: refetch,
    emptyTitulo:
      resumo.colaboradoresAvaliados === 0
        ? "Nenhum colaborador ativo para avaliar"
        : "Ninguém com pendência",
    emptyDescricao:
      resumo.colaboradoresAvaliados === 0
        ? "O quadro cruza os colaboradores ativos com os treinamentos e EPIs obrigatórios da função de cada um. Precisa de colaborador ativo cadastrado."
        : "Todos os colaboradores ativos têm os treinamentos e EPIs obrigatórios da função em dia. Se uma função ainda não tem exigências cadastradas, ninguém aparece por ela — vincule os itens no painel da função.",
    filtrado: temFiltro,
    onLimparFiltros: limparFiltros,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Pendências por função
        </h2>
        <p className="text-sm text-muted-foreground">
          Cruza cada colaborador ativo com os treinamentos e EPIs que a função dele exige.
          Só o que está marcado como obrigatório entra aqui.
        </p>
      </div>

      <SgsstStatCards
        isLoading={isLoading}
        stats={[
          {
            label: "Com pendência",
            value: resumo.comPendencia,
            tone: resumo.comPendencia > 0 ? "critico" : "positivo",
            icon: UserX,
            hint: `de ${resumo.colaboradoresAvaliados} ativos`,
            ajuda:
              "Colaboradores que têm ao menos um treinamento ou EPI obrigatório da função faltando ou vencido. Conta pessoas, não itens.",
          },
          {
            label: "Treinamentos em falta",
            value: resumo.pendenciasTreinamento,
            tone: resumo.pendenciasTreinamento > 0 ? "atencao" : "positivo",
            icon: GraduationCap,
            ajuda:
              "Cada linha é um par colaborador × treinamento obrigatório. Só aprovação conta; presença sem aprovação não capacita.",
          },
          {
            label: "EPIs em falta",
            value: resumo.pendenciasEpi,
            tone: resumo.pendenciasEpi > 0 ? "atencao" : "positivo",
            icon: HardHat,
            ajuda:
              "Nunca entregue, ou entregue há mais tempo que a periodicidade de troca definida na função.",
          },
          {
            label: "Sem função definida",
            value: resumo.semFuncao,
            tone: resumo.semFuncao > 0 ? "atencao" : "positivo",
            icon: ShieldCheck,
            hint: "não dá para avaliar",
            ajuda:
              "Colaborador ativo sem função no cadastro. Sem função não há como saber o que é exigido dele — por isso aparece na lista em vez de passar como 'em dia'.",
          },
        ]}
      />

      {truncado && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Uma das listas usadas no cruzamento bateu o teto de segurança, então este quadro
          pode estar <strong>incompleto</strong>. Trate os números como piso, não como total.
        </p>
      )}

      <SgsstFilterBar
        searchValue={busca}
        onSearchChange={setBusca}
        searchPlaceholder="Buscar por colaborador, função, obra ou item..."
        resultCount={visiveis.length}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={[
          ...(filtroTipo !== "todos"
            ? [
                {
                  label: "Tipo",
                  value: filtroTipo === "EPI" ? "EPI" : "Treinamento",
                  onClear: () => setFiltroTipo("todos"),
                },
              ]
            : []),
          ...(filtroSituacao !== "todas"
            ? [
                {
                  label: "Situação",
                  value: SITUACAO_ITEM_LABEL[filtroSituacao as SituacaoItem] ?? filtroSituacao,
                  onClear: () => setFiltroSituacao("todas"),
                },
              ]
            : []),
        ]}
      >
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por tipo de pendência">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Treinamento e EPI</SelectItem>
            <SelectItem value="TREINAMENTO">Só treinamentos</SelectItem>
            <SelectItem value="EPI">Só EPIs</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="NUNCA_FEITO">Nunca realizado</SelectItem>
            <SelectItem value="VENCIDO">Vencido</SelectItem>
            <SelectItem value="SEM_FUNCAO">Função não definida</SelectItem>
          </SelectContent>
        </Select>
      </SgsstFilterBar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>O que falta</TableHead>
                <TableHead>Venceu em</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estado ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    {estado}
                  </TableCell>
                </TableRow>
              ) : (
                visiveis.map((p) => (
                  <TableRow key={p.chave}>
                    <TableCell className="text-xs font-medium">{p.colaborador}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.funcaoNome || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.obra || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.situacao === "SEM_FUNCAO" ? (
                        "—"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {p.tipo === "TREINAMENTO" ? (
                            <GraduationCap className="h-3 w-3" />
                          ) : (
                            <HardHat className="h-3 w-3" />
                          )}
                          {p.tipo === "TREINAMENTO" ? "Treinamento" : "EPI"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{p.itemNome}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {p.vencimento
                        ? format(new Date(`${p.vencimento}T00:00:00`), "dd/MM/yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs whitespace-nowrap ${TOM_SITUACAO[p.situacao]}`}
                      >
                        {SITUACAO_ITEM_LABEL[p.situacao]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Considera apenas colaboradores com status <strong>ativo</strong>. Um treinamento só
        conta como feito se o resultado for <strong>Aprovado</strong> — presença sem aprovação
        não capacita. Treinamento sem validade não expira; EPI sem periodicidade de troca vale
        com uma entrega.
      </p>
    </div>
  );
}
