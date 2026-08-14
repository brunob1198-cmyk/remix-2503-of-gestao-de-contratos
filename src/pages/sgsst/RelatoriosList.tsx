import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileBarChart,
  Download,
  Printer,
  FileSpreadsheet,
  FileCheck,
  ClipboardList,
  ShieldCheck,
  SearchCheck,
  Siren,
  AlertOctagon,
  HeartPulse,
  GraduationCap,
  Shield,
  Filter,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "sonner";

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

export default function SgsstRelatoriosListPage() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorioSgsst>("PGR");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("todos");
  const [dataInicial, setDataInicial] = useState<string>("");
  const [dataFinal, setDataFinal] = useState<string>("");

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

  // Query Dynamic Data Based on Selected Report Type
  const { data: reportData = [], isLoading } = useQuery({
    queryKey: ["sgsst_report_data", empresaId, tipoRelatorio, selectedProjetoId, dataInicial, dataFinal],
    enabled: !!empresaId,
    queryFn: async () => {
      let dataRes: any[] = [];

      switch (tipoRelatorio) {
        case "PGR": {
          let q = supabase.from("sgsst_pgr" as any).select(`*, projeto:projetos(codigo, nome)`).eq("empresa_id", empresaId!);
          if (selectedProjetoId !== "todos") q = q.eq("projeto_id", selectedProjetoId);
          const { data } = await (q as any);
          dataRes = (data || []).map((d: any) => ({
            Código: d.codigo || "PGR",
            Título: d.titulo,
            Projeto: d.projeto ? `[${d.projeto.codigo}] ${d.projeto.nome}` : "Geral",
            Status: d.status,
            "Elaborado por": d.elaborado_por || "—",
            "Data Início": d.data_inicio || "—",
            "Data Revisão": d.data_revisao || "—",
          }));
          break;
        }

        case "APR": {
          let q = supabase.from("sgsst_apr" as any).select(`*, projeto:projetos(codigo, nome)`).eq("empresa_id", empresaId!);
          if (selectedProjetoId !== "todos") q = q.eq("projeto_id", selectedProjetoId);
          const { data } = await (q as any);
          dataRes = (data || []).map((d: any) => ({
            Código: d.codigo || "APR",
            Título: d.titulo,
            Projeto: d.projeto ? `[${d.projeto.codigo}] ${d.projeto.nome}` : "Geral",
            Status: d.status,
            Atividade: d.atividade,
            Elaborador: d.elaborador || "—",
            "Data Análise": d.data_analise || "—",
          }));
          break;
        }

        case "PT": {
          let q = supabase.from("sgsst_pt" as any).select(`*, projeto:projetos(codigo, nome)`).eq("empresa_id", empresaId!);
          if (selectedProjetoId !== "todos") q = q.eq("projeto_id", selectedProjetoId);
          const { data } = await (q as any);
          dataRes = (data || []).map((d: any) => ({
            Código: d.codigo || "PT",
            Título: d.titulo,
            Tipo: d.tipo,
            Projeto: d.projeto ? `[${d.projeto.codigo}] ${d.projeto.nome}` : "Geral",
            Status: d.status,
            Atividade: d.atividade,
            "Local Execução": d.local_execucao,
            "Data Início": d.data_inicio || "—",
            "Data Validade": d.data_validade || "—",
          }));
          break;
        }

        case "INSPECAO": {
          let q = supabase.from("sgsst_inspecoes" as any).select(`*, projeto:projetos(codigo, nome)`).eq("empresa_id", empresaId!);
          if (selectedProjetoId !== "todos") q = q.eq("projeto_id", selectedProjetoId);
          const { data } = await (q as any);
          dataRes = (data || []).map((d: any) => ({
            Código: d.codigo || "INSP",
            Título: d.titulo,
            Tipo: d.tipo,
            Projeto: d.projeto ? `[${d.projeto.codigo}] ${d.projeto.nome}` : "Geral",
            Status: d.status,
            Responsável: d.responsavel || "—",
            "Data Planejada": d.data_planejada || "—",
            "Data Execução": d.data_execucao || "—",
          }));
          break;
        }

        case "INCIDENTE": {
          let q = supabase.from("sgsst_incidentes" as any).select(`*, projeto:projetos(codigo, nome)`).eq("empresa_id", empresaId!);
          if (selectedProjetoId !== "todos") q = q.eq("projeto_id", selectedProjetoId);
          const { data } = await (q as any);
          dataRes = (data || []).map((d: any) => ({
            Código: d.codigo || "INC",
            Título: d.titulo,
            Tipo: d.tipo,
            Gravidade: d.gravidade,
            Status: d.status,
            Projeto: d.projeto ? `[${d.projeto.codigo}] ${d.projeto.nome}` : "Geral",
            "Local Ocorrência": d.local_ocorrencia,
            "Data Ocorrência": d.data_ocorrencia || "—",
          }));
          break;
        }

        case "NC": {
          let q = supabase.from("sgsst_nao_conformidades" as any).select(`*, projeto:projetos(codigo, nome)`).eq("empresa_id", empresaId!);
          if (selectedProjetoId !== "todos") q = q.eq("projeto_id", selectedProjetoId);
          const { data } = await (q as any);
          dataRes = (data || []).map((d: any) => ({
            Código: d.codigo || "NC",
            Título: d.titulo,
            Origem: d.origem_tipo,
            Gravidade: d.gravidade,
            Status: d.status,
            Responsável: d.responsavel_tratamento || "—",
            "Data Identificação": d.data_identificacao || "—",
            "Data Limite": d.data_limite || "—",
          }));
          break;
        }

        case "SAUDE": {
          const { data } = await (supabase
            .from("sgsst_asos" as any)
            .select(`*, colaborador:sgsst_colaborador_dados(cpf, profile:profiles(nome), recurso:recursos(nome), funcao:sgsst_funcoes(nome))`)
            .eq("empresa_id", empresaId!) as any);
          dataRes = (data || []).map((d: any) => {
            const nome = d.colaborador?.profile?.nome || d.colaborador?.recurso?.nome || "Sem Nome";
            return {
              Colaborador: nome,
              CPF: d.colaborador?.cpf || "—",
              Função: d.colaborador?.funcao?.nome || "—",
              Aptidão: d.aptidao,
              "Data Emissão": d.data_emissao || "—",
              Validade: d.validade || "—",
              "Médico Emissor": d.medico_emissor || "—",
              Status: d.status,
            };
          });
          break;
        }

        case "TREINAMENTO": {
          const { data } = await (supabase
            .from("sgsst_treinamentos_participantes" as any)
            .select(`*, colaborador:sgsst_colaborador_dados(cpf, profile:profiles(nome), recurso:recursos(nome)), turma:sgsst_treinamentos_turmas(codigo_turma, treinamento:sgsst_treinamentos(nome, carga_horaria))`)
            .eq("empresa_id", empresaId!) as any);
          dataRes = (data || []).map((d: any) => {
            const nome = d.colaborador?.profile?.nome || d.colaborador?.recurso?.nome || "Sem Nome";
            return {
              Colaborador: nome,
              CPF: d.colaborador?.cpf || "—",
              Treinamento: d.turma?.treinamento?.nome || "—",
              "Carga Horária": `${d.turma?.treinamento?.carga_horaria || 8}h`,
              "Presença (%)": `${d.percentual_presenca || 100}%`,
              Resultado: d.resultado,
              "Data Conclusão": d.data_conclusao || "—",
              Validade: d.validade || "—",
            };
          });
          break;
        }

        case "EPI": {
          const { data } = await (supabase
            .from("sgsst_epi_entregas" as any)
            .select(`*, colaborador:sgsst_colaborador_dados(cpf, profile:profiles(nome), recurso:recursos(nome)), epi:sgsst_epis(nome, ca, unidade_medida)`)
            .eq("empresa_id", empresaId!) as any);
          dataRes = (data || []).map((d: any) => {
            const nome = d.colaborador?.profile?.nome || d.colaborador?.recurso?.nome || "Sem Nome";
            return {
              Colaborador: nome,
              CPF: d.colaborador?.cpf || "—",
              "EPI Entregue": d.epi?.nome || "—",
              "N° CA": d.epi?.ca || "—",
              Quantidade: `${d.quantidade} ${d.epi?.unidade_medida || "UN"}`,
              "Data Entrega": d.data_entrega || "—",
              Motivo: d.motivo,
              "Tamanho / Modelo": d.tamanho_modelo || "—",
            };
          });
          break;
        }
      }

      return dataRes;
    },
  });

  const handleExportExcel = () => {
    if (!reportData.length) {
      toast.error("Nenhum dado disponível para exportar no relatório selecionado.");
      return;
    }
    exportToExcel(reportData, `Relatorio_SGSST_${tipoRelatorio}_${format(new Date(), "yyyyMMdd")}`);
    toast.success("Relatório exportado para Excel com sucesso!");
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const nowStr = format(new Date(), "dd/MM/yyyy HH:mm");

  return (
    <div className="space-y-6 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <FileBarChart className="h-6 w-6 text-primary" />
            SGSST — Relatórios Executivos & Gerenciais
          </h1>
          <p className="text-sm text-muted-foreground">
            Geração de relatórios consolidados por módulo do SGSST com exportação para Excel (XLSX) e PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || !reportData.length} className="gap-2 text-xs">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Exportar Excel
          </Button>
          <Button variant="outline" onClick={handlePrintPdf} disabled={isLoading || !reportData.length} className="gap-2 text-xs">
            <Printer className="h-4 w-4 text-primary" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="print:hidden">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de Relatório</label>
            <Select value={tipoRelatorio} onValueChange={(val: TipoRelatorioSgsst) => setTipoRelatorio(val)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Selecione o relatório..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PGR">1. Riscos e PGR (NR-1)</SelectItem>
                <SelectItem value="APR">2. Análise Preliminar de Riscos (APR)</SelectItem>
                <SelectItem value="PT">3. Permissão de Trabalho (PT)</SelectItem>
                <SelectItem value="INSPECAO">4. Inspeções de Segurança</SelectItem>
                <SelectItem value="INCIDENTE">5. Incidentes e Acidentes</SelectItem>
                <SelectItem value="NC">6. Não Conformidades</SelectItem>
                <SelectItem value="SAUDE">7. Saúde Ocupacional (PCMSO/ASO)</SelectItem>
                <SelectItem value="TREINAMENTO">8. Treinamentos e Capacitações</SelectItem>
                <SelectItem value="EPI">9. EPI & Ficha de Entrega</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Obra / Projeto</label>
            <Select value={selectedProjetoId} onValueChange={setSelectedProjetoId}>
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
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
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
        </CardContent>
      </Card>

      {/* Report Container */}
      <Card className="w-full">
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-primary" />
                Relatório SGSST: {tipoRelatorio}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Gerado por: <span className="font-semibold text-foreground">{profile?.nome || "Usuário"}</span> | Empresa ID: <span className="font-mono">{empresaId || "—"}</span>
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Gerado em: {nowStr} | Total: {reportData.length} registros
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {reportData.length > 0 &&
                  Object.keys(reportData[0]).map((key) => (
                    <TableHead key={key} className="text-xs font-bold">{key}</TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">Gerando relatório do SGSST...</TableCell></TableRow>
              ) : reportData.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">Nenhum registro encontrado para os filtros selecionados.</TableCell></TableRow>
              ) : (
                reportData.map((row, idx) => (
                  <TableRow key={idx}>
                    {Object.values(row).map((val: any, valIdx) => (
                      <TableCell key={valIdx} className="text-xs">
                        {val}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
