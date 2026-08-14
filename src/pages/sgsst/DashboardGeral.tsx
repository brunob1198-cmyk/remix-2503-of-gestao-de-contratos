import { useState } from "react";
import { useSgsstDashboard, SgsstAlertaItem } from "@/hooks/sgsst/useSgsstDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  ClipboardList,
  SearchCheck,
  Siren,
  AlertOctagon,
  HeartPulse,
  GraduationCap,
  Shield,
  FolderArchive,
  FileBarChart,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function SgsstDashboardGeralPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("todos");

  const { metrics, isLoading } = useSgsstDashboard(selectedProjetoId !== "todos" ? selectedProjetoId : undefined);

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_dashboard_sgsst", empresaId],
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

  const getUrgencyBadge = (urgencia: string) => {
    switch (urgencia) {
      case "CRITICA":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">CRÍTICO</Badge>;
      case "ALTA":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">ALTA</Badge>;
      default:
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 font-semibold">MÉDIA</Badge>;
    }
  };

  // Data for Charts
  const chartSegurancaData = [
    { name: "PGRs Ativos", total: metrics?.pgrAtivos || 0, fill: "#0284c7" },
    { name: "APRs Andamento", total: metrics?.aprEmAndamento || 0, fill: "#6366f1" },
    { name: "PTs Execução", total: metrics?.ptEmExecucao || 0, fill: "#eab308" },
    { name: "Insp. Pendentes", total: metrics?.inspecoesPendentes || 0, fill: "#f97316" },
    { name: "Incidentes Aber.", total: metrics?.incidentesAbertos || 0, fill: "#ef4444" },
    { name: "NCs Abertas", total: metrics?.naoConformidadesAbertas || 0, fill: "#dc2626" },
  ];

  const chartSaudeData = [
    { name: "Válidos", value: metrics?.asosValidos || 0, color: "#10b981" },
    { name: "Próx. Vencimento", value: metrics?.asosProximosVencimento || 0, color: "#f59e0b" },
    { name: "Vencidos", value: metrics?.asosVencidos || 0, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <Activity className="h-6 w-6 text-primary" />
            SGSST — Dashboard Executivo & Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de Segurança, Saúde Ocupacional, Capacitações NRs, EPIs e Conformidade Legal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedProjetoId} onValueChange={setSelectedProjetoId}>
            <SelectTrigger className="w-[200px] text-xs">
              <SelectValue placeholder="Filtrar Obra / Projeto" />
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
      </div>

      {/* Internal Navigation Shortcuts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Button variant="secondary" size="sm" onClick={() => navigate("/medicoes/sgsst/dashboard")} className="font-bold gap-1">
          <Activity className="h-3.5 w-3.5" /> Dashboard
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/pgr")} className="gap-1">
          <FileCheck className="h-3.5 w-3.5" /> Segurança (PGR/APR/PT)
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/pcmso")} className="gap-1">
          <HeartPulse className="h-3.5 w-3.5" /> Saúde (PCMSO/ASO)
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/treinamentos")} className="gap-1">
          <GraduationCap className="h-3.5 w-3.5" /> Treinamentos
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/epis")} className="gap-1">
          <Shield className="h-3.5 w-3.5" /> EPI
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/documentos")} className="gap-1">
          <FolderArchive className="h-3.5 w-3.5" /> Documentos R2
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/relatorios")} className="gap-1">
          <FileBarChart className="h-3.5 w-3.5" /> Relatórios Executivos
        </Button>
      </div>

      {/* SECTION 1: Central de Pendências "Requer Atenção" */}
      <Card className="border-amber-300 bg-amber-50/10">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-amber-50/30">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Central de Alertas & Pendências Prioritárias ("Requer Atenção")
            </CardTitle>
            <CardDescription className="text-xs">
              Pendências críticas de ASO, CAs de EPIs vencidos, Não Conformidades em atraso e PTs em execução.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
            {metrics?.alertasRequerAtenção.length || 0} Itens Pendentes
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Alerta / Ocorrência</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead className="text-right">Ação Direta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">Carregando pendências de segurança...</TableCell></TableRow>
              ) : !metrics?.alertasRequerAtenção.length ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-xs text-emerald-700 font-semibold">Tudo em conformidade! Nenhuma pendência crítica identificada.</TableCell></TableRow>
              ) : (
                metrics.alertasRequerAtenção.map((item) => (
                  <TableRow key={item.id} className="hover:bg-amber-50/20">
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{item.modulo}</Badge></TableCell>
                    <TableCell>
                      <div className="font-medium text-xs sm:text-sm">{item.titulo}</div>
                      <div className="text-xs text-muted-foreground">{item.subtitulo}</div>
                    </TableCell>
                    <TableCell>{getUrgencyBadge(item.urgencia)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(item.linkUrl)}
                        className="text-xs gap-1 text-primary hover:text-primary"
                      >
                        Tratar <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECTION 2: Módulos de Segurança (Overview Cards) */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Indicadores de Segurança do Trabalho
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/medicoes/sgsst/pgr")}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileCheck className="h-3.5 w-3.5 text-blue-600" /> PGRs Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-blue-600">{metrics?.pgrAtivos || 0}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/medicoes/sgsst/apr")}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5 text-indigo-600" /> APRs em Andam.
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-indigo-600">{metrics?.aprEmAndamento || 0}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/medicoes/sgsst/pt")}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> PTs em Execução
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-amber-600">{metrics?.ptEmExecucao || 0}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/medicoes/sgsst/inspecoes")}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <SearchCheck className="h-3.5 w-3.5 text-emerald-600" /> Insp. Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-emerald-600">{metrics?.inspecoesPendentes || 0}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/medicoes/sgsst/incidentes")}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Siren className="h-3.5 w-3.5 text-red-600" /> Incidentes Aber.
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-red-600">{metrics?.incidentesAbertos || 0}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/medicoes/sgsst/nao-conformidades")}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertOctagon className="h-3.5 w-3.5 text-purple-600" /> NCs Abertas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-purple-600">{metrics?.naoConformidadesAbertas || 0}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3 & 4: Gráficos de Resumo e Saúde Ocupacional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico Bar Chart Segurança */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Volume Operacional de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSegurancaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartSegurancaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico Pie Chart Saúde Ocupacional */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" /> Saúde Ocupacional — Situação dos ASOs
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] flex items-center justify-center pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartSaudeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartSaudeData.map((entry, index) => (
                    <Cell key={`cell-pie-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 5: Treinamentos & EPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Treinamentos Card */}
        <Card>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Treinamentos & Capacitações NRs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-800">Válidos</div>
              <div className="text-xl font-bold text-emerald-700">{metrics?.treinamentosValidos || 0}</div>
            </div>
            <div className="p-3 bg-amber-50 rounded border border-amber-200">
              <div className="text-xs font-semibold text-amber-800">Próx. Vencimento</div>
              <div className="text-xl font-bold text-amber-700">{metrics?.treinamentosProximosVencimento || 0}</div>
            </div>
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <div className="text-xs font-semibold text-red-800">Vencidos</div>
              <div className="text-xl font-bold text-red-700">{metrics?.treinamentosVencidos || 0}</div>
            </div>
          </CardContent>
        </Card>

        {/* EPI Card */}
        <Card>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> EPI & Controle de CAs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <div className="text-xs font-semibold text-blue-800">EPIs Ativos</div>
              <div className="text-xl font-bold text-blue-700">{metrics?.episAtivos || 0}</div>
            </div>
            <div className="p-3 bg-amber-50 rounded border border-amber-200">
              <div className="text-xs font-semibold text-amber-800">Estoque Mínimo</div>
              <div className="text-xl font-bold text-amber-700">{metrics?.estoqueAbaixoMinimo || 0}</div>
            </div>
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <div className="text-xs font-semibold text-red-800">CAs Vencidos</div>
              <div className="text-xl font-bold text-red-700">{metrics?.casVencidos || 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
