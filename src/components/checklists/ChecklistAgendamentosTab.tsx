import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChecklistAgendamentos } from "@/hooks/checklists/useChecklistsEvolution";
import { ChecklistAgendamentoFormDialog } from "@/components/checklists/ChecklistAgendamentoFormDialog";
import { Calendar, Plus, Search, Pause, Play, Power, Clock, AlertTriangle, CheckCircle2, User } from "lucide-react";

export function ChecklistAgendamentosTab() {
  const { agendamentos, execucoes, loadingAgendamentos, updateAgendamentoStatus } = useChecklistAgendamentos();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPeriodicidade, setFilterPeriodicidade] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filtered Agendamentos
  const filteredAgendamentos = agendamentos.filter((a) => {
    const term = search.toLowerCase();
    const nomeModelo = a.modelo?.nome || "";
    const resp = a.responsavel?.nome || "";
    const matchesSearch = nomeModelo.toLowerCase().includes(term) || resp.toLowerCase().includes(term);

    const matchesStatus = filterStatus === "ALL" || a.status === filterStatus;
    const matchesPeriod = filterPeriodicidade === "ALL" || a.periodicidade === filterPeriodicidade;

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  // Metrics from DB
  const totalAgendados = agendamentos.length;
  const pendentes = execucoes.filter((e) => e.status === "PENDENTE").length;
  const concluidos = execucoes.filter((e) => e.status === "CONCLUIDA").length;
  const atrasados = execucoes.filter((e) => e.status === "ATRASADA" || (e.status === "PENDENTE" && e.prazo < new Date().toISOString().split("T")[0])).length;

  const hojeStr = new Date().toISOString().split("T")[0];
  const hoje = execucoes.filter((e) => e.data_prevista === hojeStr).length;

  return (
    <div className="space-y-6 pt-3">
      {/* HEADER ACTIONS & DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Agendamentos Recorrentes de Campo
          </h2>
          <p className="text-xs text-muted-foreground">
            Controle automatizado de emissão periódica de checklists para equipes e obras.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold">
          <Plus className="h-4 w-4" /> Novo Agendamento Recorrente
        </Button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-slate-50/50">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground">AGENDADOS</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-slate-800">{totalAgendados}</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-blue-800">PENDENTES</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-blue-700">{pendentes}</div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/50 border-emerald-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-emerald-800">CONCLUÍDOS</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-emerald-700">{concluidos}</div>
          </CardContent>
        </Card>

        <Card className="bg-red-50/50 border-red-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-red-800">ATRASADOS</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-red-700">{atrasados}</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/50 border-purple-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-purple-800">PREVISTOS HOJE</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-purple-700">{hoje}</div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por modelo de checklist ou responsável..."
            className="pl-8 text-xs bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 text-xs bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os Status</SelectItem>
            <SelectItem value="ATIVO">Ativos</SelectItem>
            <SelectItem value="PAUSADO">Pausados</SelectItem>
            <SelectItem value="ENCERRADO">Encerrados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPeriodicidade} onValueChange={setFilterPeriodicidade}>
          <SelectTrigger className="w-40 text-xs bg-white">
            <SelectValue placeholder="Periodicidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas Periodicidades</SelectItem>
            <SelectItem value="DIARIA">Diária</SelectItem>
            <SelectItem value="SEMANAL">Semanal</SelectItem>
            <SelectItem value="QUINZENAL">Quinzenal</SelectItem>
            <SelectItem value="MENSAL">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TABLE */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold">Checklist Modelo</TableHead>
                <TableHead className="text-xs font-bold">Responsável / Obra</TableHead>
                <TableHead className="text-xs font-bold">Periodicidade</TableHead>
                <TableHead className="text-xs font-bold">Início / Horário</TableHead>
                <TableHead className="text-xs font-bold">Status</TableHead>
                <TableHead className="text-xs font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAgendamentos ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Carregando agendamentos...</TableCell></TableRow>
              ) : filteredAgendamentos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Nenhum agendamento encontrado.</TableCell></TableRow>
              ) : (
                filteredAgendamentos.map((ag) => (
                  <TableRow key={ag.id}>
                    <TableCell>
                      <div className="font-bold text-xs text-primary">{ag.modelo?.nome || "Checklist"}</div>
                      <div className="text-[11px] text-muted-foreground">{ag.modelo?.categoria || "Geral"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-500" /> {ag.responsavel?.nome || "Equipe de Campo"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{ag.projeto?.nome || "Sem obra específica"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs bg-slate-50">{ag.periodicidade}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{new Date(ag.data_inicial).toLocaleDateString("pt-BR")}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" /> {ag.horario || "08:00"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ag.status === "ATIVO" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">ATIVO</Badge>
                      ) : ag.status === "PAUSADO" ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold">PAUSADO</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 font-bold">ENCERRADO</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {ag.status === "ATIVO" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateAgendamentoStatus.mutate({ id: ag.id, status: "PAUSADO" })}
                            className="text-xs text-amber-700 hover:bg-amber-50 gap-1"
                            title="Pausar Agendamento"
                          >
                            <Pause className="h-3.5 w-3.5" /> Pausar
                          </Button>
                        ) : ag.status === "PAUSADO" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateAgendamentoStatus.mutate({ id: ag.id, status: "ATIVO" })}
                            className="text-xs text-emerald-700 hover:bg-emerald-50 gap-1"
                            title="Reativar Agendamento"
                          >
                            <Play className="h-3.5 w-3.5" /> Reativar
                          </Button>
                        ) : null}

                        {ag.status !== "ENCERRADO" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm("Tem certeza que deseja encerrar este agendamento?")) {
                                updateAgendamentoStatus.mutate({ id: ag.id, status: "ENCERRADO" });
                              }
                            }}
                            className="text-xs text-red-600 hover:bg-red-50 gap-1"
                            title="Encerrar Agendamento"
                          >
                            <Power className="h-3.5 w-3.5" /> Encerrar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ChecklistAgendamentoFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
