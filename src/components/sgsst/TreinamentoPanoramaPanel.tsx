import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import { useSgsstTreinamentoPanorama } from "@/hooks/sgsst/useSgsstTreinamentoPanorama";
import {
  SITUACAO_PANORAMA_LABEL,
  type SituacaoPanorama,
} from "@/utils/sgsstTreinamentoPanorama";
import {
  Search,
  CalendarClock,
  GraduationCap,
  UserX,
  AlertTriangle,
  Users,
} from "lucide-react";
import { format } from "date-fns";

/**
 * "O que preciso treinar" — numa lista só.
 *
 * A pergunta estava partida em duas telas: Funções → Pendências sabia quem nunca
 * fez, Treinamentos → Vencimentos sabia o que está vencendo. Quem abre turma
 * precisa das duas na mesma data, porque a mesma turma atende os dois grupos.
 */

const TOM_SITUACAO: Record<SituacaoPanorama, string> = {
  NUNCA_FEITO: "bg-red-100 text-red-800 border-red-300",
  VENCIDO: "bg-orange-100 text-orange-800 border-orange-300",
  A_VENCER: "bg-amber-100 text-amber-800 border-amber-300",
};

/** Texto do prazo. Já vencido conta os dias de atraso, que é o que pressiona. */
function textoDoPrazo(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < 0) return `vencido há ${Math.abs(dias)} d`;
  if (dias === 0) return "vence hoje";
  return `em ${dias} d`;
}

function dataBr(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export function TreinamentoPanoramaPanel({ enabled }: { enabled?: boolean }) {
  const {
    linhas,
    resumo,
    grupos,
    isLoading,
    erroPendencias,
    erroVencimentos,
    truncado,
  } = useSgsstTreinamentoPanorama({ enabled });

  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("todas");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtroSituacao !== "todas" && l.situacao !== filtroSituacao) return false;
      if (!termo) return true;
      return (
        l.colaborador.toLowerCase().includes(termo) ||
        l.treinamentoNome.toLowerCase().includes(termo) ||
        (l.funcaoNome ?? "").toLowerCase().includes(termo) ||
        (l.obra ?? "").toLowerCase().includes(termo)
      );
    });
  }, [linhas, busca, filtroSituacao]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          O que precisa ser treinado
        </h2>
        <p className="text-sm text-muted-foreground">
          Junta as duas metades da pergunta: quem <strong>nunca fez</strong> o treinamento que
          a função exige e quem <strong>está com a validade vencendo</strong>. Uma turma
          atende os dois grupos.
        </p>
      </div>

      <SgsstStatCards
        isLoading={isLoading}
        stats={[
          {
            label: "Nunca realizado",
            value: resumo.nuncaFeito,
            tone: resumo.nuncaFeito > 0 ? "critico" : "positivo",
            icon: UserX,
            ajuda:
              "Colaborador ativo sem o treinamento que a função dele exige. Vem do vínculo cadastrado na função — função sem exigência cadastrada não gera linha aqui.",
          },
          {
            label: "Vencido",
            value: resumo.vencido,
            tone: resumo.vencido > 0 ? "critico" : "positivo",
            icon: AlertTriangle,
            ajuda:
              "Fez, mas a validade já passou. Do ponto de vista da norma equivale a não ter o treinamento.",
          },
          {
            label: "A vencer (90 dias)",
            value: resumo.aVencer,
            tone: resumo.aVencer > 0 ? "atencao" : "positivo",
            icon: CalendarClock,
            ajuda:
              "Ainda vale, mas vence dentro da janela. É a fila de reciclagem a programar.",
          },
          {
            label: "Turmas a abrir",
            value: resumo.treinamentosAProgramar,
            tone: resumo.treinamentosAProgramar > 0 ? "atencao" : "positivo",
            icon: GraduationCap,
            hint: `${resumo.colaboradoresAfetados} pessoa(s)`,
            ajuda:
              "Treinamentos distintos que aparecem na lista. É o número mínimo de turmas para zerar as pendências.",
          },
        ]}
      />

      {/* Os dois erros aparecem separados: cada um derruba só a sua metade. */}
      {erroPendencias && (
        <SgsstErrorState error={erroPendencias} modulo="Pendências por função" inline />
      )}
      {erroVencimentos && (
        <SgsstErrorState error={erroVencimentos} modulo="Vencimentos de treinamento" inline />
      )}

      {truncado && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Uma das listas usadas no cruzamento bateu o teto de segurança, então este quadro pode
          estar <strong>incompleto</strong>. Trate os números como piso, não como total.
        </p>
      )}

      {grupos.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Turmas a programar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Treinamento</TableHead>
                    <TableHead className="text-right">Pessoas</TableHead>
                    <TableHead className="text-right">Nunca fez</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                    <TableHead className="text-right">A vencer</TableHead>
                    <TableHead className="text-right">Prazo mais curto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((g) => (
                    <TableRow key={g.treinamentoId || g.treinamentoNome}>
                      <TableCell className="text-xs font-medium">{g.treinamentoNome}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-bold">
                        {g.total}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {g.nuncaFeito || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {g.vencido || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {g.aVencer || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {textoDoPrazo(g.prazoMaisCurto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por colaborador, treinamento, função ou obra..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
          <SelectTrigger className="w-[190px] text-xs" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="NUNCA_FEITO">Nunca realizado</SelectItem>
            <SelectItem value="VENCIDO">Vencido</SelectItem>
            <SelectItem value="A_VENCER">A vencer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Treinamento</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      Cruzando exigências da função com as validades registradas...
                    </TableCell>
                  </TableRow>
                ) : visiveis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      {linhas.length === 0
                        ? "Ninguém pendente na janela de 90 dias. Se uma função ainda não tem treinamentos vinculados, ninguém aparece por ela — vincule os itens no painel da função."
                        : "Nenhuma linha para os filtros aplicados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  visiveis.map((l) => (
                    <TableRow key={l.chave}>
                      <TableCell className="text-xs font-medium">{l.colaborador}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.funcaoNome || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.obra || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.treinamentoNome}
                        {!l.exigidoPelaFuncao && (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            (não exigido pela função)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {dataBr(l.vencimento)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {textoDoPrazo(l.diasParaVencer)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs whitespace-nowrap ${TOM_SITUACAO[l.situacao]}`}
                        >
                          {SITUACAO_PANORAMA_LABEL[l.situacao]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Considera apenas colaboradores <strong>ativos</strong>. Um treinamento só conta como
        feito se o resultado for <strong>Aprovado</strong> — presença sem aprovação não
        capacita. Treinamento sem validade não expira e por isso não aparece aqui.
      </p>
    </div>
  );
}
