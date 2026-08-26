import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import {
  FileBarChart,
  FileSpreadsheet,
  FileDown,
  Loader2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "sonner";
import {
  gerarPdfRelatorioGerencial,
  type LinhaRelatorio,
} from "@/lib/relatorioGerencialDocumento";

/**
 * SGSST — Relatórios Executivos & Gerenciais.
 *
 * Três coisas nesta tela estavam apenas decorativas, e foram corrigidas:
 *
 * 1. Os filtros de data entravam na chave da consulta mas nunca eram aplicados:
 *    mudar o período reconsultava o banco e trazia exatamente o mesmo resultado.
 *    Agora cada relatório declara qual é a sua coluna de data.
 *
 * 2. O filtro de obra valia só para seis dos nove relatórios. Nos outros três
 *    (Saúde, Treinamentos, EPI) a tabela não tem obra — o filtro era ignorado em
 *    silêncio, o que é pior que não existir: quem filtra acredita ter filtrado.
 *    Agora o seletor desabilita e diz o motivo.
 *
 * 3. "Imprimir / PDF" chamava `window.print()`, que imprime a página do
 *    navegador. Virou emissão de verdade, no papel timbrado da empresa, com o
 *    recorte aplicado impresso no cabeçalho.
 *
 * Também passou a haver limite explícito de linhas: o PostgREST corta no teto
 * padrão sem avisar, e relatório truncado em silêncio é o pior tipo de erro num
 * documento de conferência.
 */

export type TipoRelatorioSgsst =
  | "PGR"
  | "APR"
  | "PT"
  | "INSPECAO"
  | "INCIDENTE"
  | "NC"
  | "SAUDE"
  | "TREINAMENTO"
  | "EPI";

/** Teto de linhas por relatório. Acima disso a tela avisa em vez de cortar calada. */
const LIMITE_LINHAS = 2000;

interface ConfigRelatorio {
  rotulo: string;
  tabela: string;
  select: string;
  /** Coluna de data sobre a qual os filtros de período agem. */
  colunaData: string;
  /** Falso quando a tabela não tem vínculo com obra. */
  filtraPorObra: boolean;
  /** O que o relatório de fato conta, quando isso não é óbvio pelo nome. */
  aviso?: string;
  mapear: (d: Record<string, any>) => LinhaRelatorio;
}

const nomeDoColaborador = (c: Record<string, any> | null | undefined): string =>
  c?.profile?.nome || c?.recurso?.nome || c?.nome || "Sem Nome";

const textoDaObra = (p: Record<string, any> | null | undefined): string =>
  p ? `[${p.codigo}] ${p.nome}` : "Geral";

const RELATORIOS: Record<TipoRelatorioSgsst, ConfigRelatorio> = {
  PGR: {
    rotulo: "Riscos e PGR (NR-01)",
    tabela: "sgsst_pgr",
    select: "*, projeto:projetos(codigo, nome)",
    colunaData: "data_inicio",
    filtraPorObra: true,
    mapear: (d) => ({
      Código: d.codigo || "PGR",
      Título: d.titulo,
      Projeto: textoDaObra(d.projeto),
      Status: d.status,
      "Elaborado por": d.elaborado_por || "—",
      "Data Início": d.data_inicio || "—",
      "Data Revisão": d.data_revisao || "—",
    }),
  },

  APR: {
    rotulo: "Análise Preliminar de Riscos (APR)",
    tabela: "sgsst_apr",
    select: "*, projeto:projetos(codigo, nome)",
    colunaData: "data_analise",
    filtraPorObra: true,
    mapear: (d) => ({
      Código: d.codigo || "APR",
      Título: d.titulo,
      Projeto: textoDaObra(d.projeto),
      Status: d.status,
      Atividade: d.atividade,
      Elaborador: d.elaborador || "—",
      "Data Análise": d.data_analise || "—",
    }),
  },

  PT: {
    rotulo: "Permissão de Trabalho (PT)",
    tabela: "sgsst_pt",
    select: "*, projeto:projetos(codigo, nome)",
    colunaData: "data_inicio",
    filtraPorObra: true,
    mapear: (d) => ({
      Código: d.codigo || "PT",
      Título: d.titulo,
      Tipo: d.tipo,
      Projeto: textoDaObra(d.projeto),
      Status: d.status,
      Atividade: d.atividade,
      "Local Execução": d.local_execucao,
      "Data Início": d.data_inicio || "—",
      "Data Validade": d.data_validade || "—",
    }),
  },

  INSPECAO: {
    rotulo: "Inspeções de Segurança",
    tabela: "sgsst_inspecoes",
    select: "*, projeto:projetos(codigo, nome)",
    colunaData: "data_planejada",
    filtraPorObra: true,
    mapear: (d) => ({
      Código: d.codigo || "INSP",
      Título: d.titulo,
      Tipo: d.tipo,
      Projeto: textoDaObra(d.projeto),
      Status: d.status,
      Responsável: d.responsavel || "—",
      "Data Planejada": d.data_planejada || "—",
      "Data Execução": d.data_execucao || "—",
    }),
  },

  INCIDENTE: {
    rotulo: "Incidentes e Acidentes",
    tabela: "sgsst_incidentes",
    select: "*, projeto:projetos(codigo, nome)",
    colunaData: "data_ocorrencia",
    filtraPorObra: true,
    mapear: (d) => ({
      Código: d.codigo || "INC",
      Título: d.titulo,
      Tipo: d.tipo,
      Gravidade: d.gravidade,
      Status: d.status,
      Projeto: textoDaObra(d.projeto),
      "Local Ocorrência": d.local_ocorrencia,
      "Data Ocorrência": d.data_ocorrencia || "—",
    }),
  },

  NC: {
    rotulo: "Não Conformidades",
    tabela: "sgsst_nao_conformidades",
    select: "*, projeto:projetos(codigo, nome)",
    colunaData: "data_identificacao",
    filtraPorObra: true,
    mapear: (d) => ({
      Código: d.codigo || "NC",
      Título: d.titulo,
      Origem: d.origem_tipo,
      Gravidade: d.gravidade,
      Status: d.status,
      Responsável: d.responsavel_tratamento || "—",
      "Data Identificação": d.data_identificacao || "—",
      "Data Limite": d.data_limite || "—",
    }),
  },

  SAUDE: {
    rotulo: "Saúde Ocupacional (PCMSO/ASO)",
    tabela: "sgsst_asos",
    select:
      "*, colaborador:sgsst_colaborador_dados(nome, cpf, profile:profiles(nome), recurso:recursos(nome), funcao:sgsst_funcoes(nome))",
    colunaData: "data_emissao",
    filtraPorObra: false,
    aviso:
      "Lista os ASOs emitidos. O ASO é do trabalhador, não da obra — por isso este relatório não se filtra por obra.",
    mapear: (d) => ({
      Colaborador: nomeDoColaborador(d.colaborador),
      CPF: d.colaborador?.cpf || "—",
      Função: d.colaborador?.funcao?.nome || "—",
      Aptidão: d.aptidao,
      "Data Emissão": d.data_emissao || "—",
      Validade: d.validade || "—",
      "Médico Emissor": d.medico_emissor || "—",
      Status: d.status,
    }),
  },

  TREINAMENTO: {
    rotulo: "Treinamentos e Capacitações",
    tabela: "sgsst_treinamentos_participantes",
    select:
      "*, colaborador:sgsst_colaborador_dados(nome, cpf, profile:profiles(nome), recurso:recursos(nome)), turma:sgsst_treinamentos_turmas(codigo_turma, treinamento:sgsst_treinamentos(nome, carga_horaria))",
    colunaData: "data_conclusao",
    filtraPorObra: false,
    aviso:
      "Este relatório conta MATRÍCULAS de alunos em turmas, não cursos do catálogo. Curso cadastrado sem turma aberta, ou turma sem aluno inscrito, não aparece aqui — cadastre a turma e matricule os alunos para o treinamento entrar no relatório. O certificado de cada aluno é emitido na própria tela de Treinamentos.",
    mapear: (d) => ({
      Colaborador: nomeDoColaborador(d.colaborador),
      CPF: d.colaborador?.cpf || "—",
      Treinamento: d.turma?.treinamento?.nome || "—",
      Turma: d.turma?.codigo_turma || "—",
      "Carga Horária": `${d.turma?.treinamento?.carga_horaria ?? "—"}h`,
      "Presença (%)": `${d.percentual_presenca ?? 100}%`,
      Resultado: d.resultado,
      "Data Conclusão": d.data_conclusao || "—",
      Validade: d.validade || "—",
    }),
  },

  EPI: {
    rotulo: "EPI & Ficha de Entrega",
    tabela: "sgsst_epi_entregas",
    select:
      "*, colaborador:sgsst_colaborador_dados(nome, cpf, profile:profiles(nome), recurso:recursos(nome)), epi:sgsst_epis(nome, ca, unidade_medida)",
    colunaData: "data_entrega",
    filtraPorObra: false,
    aviso:
      "Lista as entregas de EPI registradas. A entrega é do trabalhador — este relatório não se filtra por obra.",
    mapear: (d) => ({
      Colaborador: nomeDoColaborador(d.colaborador),
      CPF: d.colaborador?.cpf || "—",
      "EPI Entregue": d.epi?.nome || "—",
      "N° CA": d.epi?.ca || "—",
      Quantidade: `${d.quantidade} ${d.epi?.unidade_medida || "UN"}`,
      "Data Entrega": d.data_entrega || "—",
      Motivo: d.motivo,
      "Tamanho / Modelo": d.tamanho_modelo || "—",
    }),
  },
};

const ORDEM_RELATORIOS: TipoRelatorioSgsst[] = [
  "PGR",
  "APR",
  "PT",
  "INSPECAO",
  "INCIDENTE",
  "NC",
  "SAUDE",
  "TREINAMENTO",
  "EPI",
];

export default function SgsstRelatoriosListPage() {
  const { profile } = useAuth();
  const { empresa } = useEmpresaAtual();
  const empresaId = profile?.empresa_id;

  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorioSgsst>("PGR");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("todos");
  const [dataInicial, setDataInicial] = useState<string>("");
  const [dataFinal, setDataFinal] = useState<string>("");
  const [emitindo, setEmitindo] = useState(false);

  const config = RELATORIOS[tipoRelatorio];

  // Load Projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_relatorios_sgsst", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  const {
    data: resultado,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "sgsst_report_data",
      empresaId,
      tipoRelatorio,
      selectedProjetoId,
      dataInicial,
      dataFinal,
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = (supabase.from(config.tabela as never) as any)
        .select(config.select)
        .eq("empresa_id", empresaId!);

      if (config.filtraPorObra && selectedProjetoId !== "todos") {
        query = query.eq("projeto_id", selectedProjetoId);
      }

      // Os filtros de data agem sobre a coluna que cada relatório declara.
      // Antes entravam só na chave da consulta: mudar o período não mudava nada.
      if (dataInicial) query = query.gte(config.colunaData, dataInicial);
      if (dataFinal) query = query.lte(config.colunaData, dataFinal);

      query = query.order(config.colunaData, { ascending: false, nullsFirst: false });
      query = query.limit(LIMITE_LINHAS);

      const { data, error: erroConsulta } = await query;
      if (erroConsulta) throw erroConsulta;

      const brutos = (data || []) as Record<string, any>[];

      return {
        linhas: brutos.map(config.mapear),
        truncado: brutos.length >= LIMITE_LINHAS,
      };
    },
  });

  const reportData = resultado?.linhas ?? [];
  const truncado = resultado?.truncado ?? false;

  const nomeDoProjetoSelecionado =
    selectedProjetoId === "todos"
      ? null
      : (() => {
          const p = projetos.find((x) => x.id === selectedProjetoId);
          return p ? `[${p.codigo}] ${p.nome}` : selectedProjetoId;
        })();

  const handleExportExcel = () => {
    if (!reportData.length) {
      toast.error("Nenhum dado disponível para exportar no relatório selecionado.");
      return;
    }
    exportToExcel(reportData, `Relatorio_SGSST_${tipoRelatorio}_${format(new Date(), "yyyyMMdd")}`);
    toast.success("Relatório exportado para Excel com sucesso!");
  };

  // Emissão de verdade: papel timbrado e recorte impresso. Relatório vazio também
  // é emitido — ausência conferida é informação, e a folha comprova o filtro.
  const handleEmitirPdf = async () => {
    setEmitindo(true);
    try {
      await gerarPdfRelatorioGerencial({
        titulo: config.rotulo,
        tipo: tipoRelatorio,
        linhas: reportData,
        empresa: empresa ?? null,
        filtros: {
          projeto: config.filtraPorObra ? nomeDoProjetoSelecionado : null,
          dataInicial: dataInicial || null,
          dataFinal: dataFinal || null,
        },
        geradoPor: profile?.nome ?? null,
        aviso: config.aviso ?? null,
        truncado,
      });
    } catch (e) {
      toast.error(`Erro ao emitir o relatório: ${(e as Error).message}`);
    } finally {
      setEmitindo(false);
    }
  };

  const nowStr = format(new Date(), "dd/MM/yyyy HH:mm");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <FileBarChart className="h-6 w-6 text-primary" />
            SGSST — Relatórios Executivos & Gerenciais
          </h1>
          <p className="text-sm text-muted-foreground">
            Listagens consolidadas por módulo, em Excel ou PDF timbrado. Os documentos
            individuais — certificado, ASO, CAT, PGR, PT — são emitidos na tela do próprio
            módulo, onde o registro é criado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isLoading || !reportData.length}
            className="gap-2 text-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={handleEmitirPdf}
            disabled={isLoading || emitindo}
            className="gap-2 text-xs"
          >
            {emitindo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 text-primary" />
            )}
            Emitir PDF
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de Relatório</label>
            <Select
              value={tipoRelatorio}
              onValueChange={(val: TipoRelatorioSgsst) => setTipoRelatorio(val)}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Selecione o relatório..." />
              </SelectTrigger>
              <SelectContent>
                {ORDEM_RELATORIOS.map((t, i) => (
                  <SelectItem key={t} value={t}>
                    {i + 1}. {RELATORIOS[t].rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Obra / Projeto</label>
            <Select
              value={selectedProjetoId}
              onValueChange={setSelectedProjetoId}
              disabled={!config.filtraPorObra}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todas as obras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Obras / Geral</SelectItem>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    [{p.codigo}] {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!config.filtraPorObra && (
              <p className="text-[11px] text-muted-foreground">
                Este relatório não tem vínculo com obra.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Data Inicial
            </label>
            <Input
              type="date"
              className="text-xs"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Final</label>
            <Input
              type="date"
              className="text-xs"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
            />
          </div>

          <p className="sm:col-span-4 text-[11px] text-muted-foreground">
            O período é aplicado sobre <span className="font-mono">{config.colunaData}</span> —
            a data de referência deste relatório.
          </p>
        </CardContent>
      </Card>

      {config.aviso && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>{config.aviso}</p>
        </div>
      )}

      {truncado && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A consulta atingiu o limite de {LIMITE_LINHAS} linhas e a lista pode estar
            incompleta. Reduza o período ou filtre por obra para conferir o conjunto inteiro.
          </p>
        </div>
      )}

      {/* Report Container */}
      <Card className="w-full">
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-primary" />
                {config.rotulo}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Gerado por:{" "}
                <span className="font-semibold text-foreground">
                  {profile?.nome || "Usuário"}
                </span>{" "}
                | Organização:{" "}
                <span className="font-semibold text-foreground">{empresa?.nome || "—"}</span>
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Gerado em: {nowStr} | Total: {reportData.length} registros
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-3">
              <SgsstErrorState error={error} modulo="Relatórios" inline />
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {reportData.length > 0 &&
                    Object.keys(reportData[0]).map((key) => (
                      <TableHead key={key} className="text-xs font-bold">
                        {key}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                      Gerando relatório do SGSST...
                    </TableCell>
                  </TableRow>
                ) : reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                      Nenhum registro encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((row, idx) => (
                    <TableRow key={idx}>
                      {Object.values(row).map((val, valIdx) => (
                        <TableCell key={valIdx} className="text-xs">
                          {val === null || val === undefined || val === "" ? "—" : String(val)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
