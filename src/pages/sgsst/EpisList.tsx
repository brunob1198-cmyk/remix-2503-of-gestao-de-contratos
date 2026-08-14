import { useState } from "react";
import {
  useSgsstEpis,
  useSgsstEpiEntregas,
  useSgsstEpiDevolucoes,
  useSgsstEpiHistoricoColaborador,
  SgsstEpi,
  SgsstEpiEntrega,
  CategoriaEpi,
} from "@/hooks/sgsst/useSgsstEpis";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  PackageCheck,
  RotateCcw,
  Boxes,
  History,
  AlertTriangle,
  Clock,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { EpiFormDialog } from "@/components/sgsst/EpiFormDialog";
import { EntregaEpiFormDialog } from "@/components/sgsst/EntregaEpiFormDialog";
import { DevolucaoEpiFormDialog } from "@/components/sgsst/DevolucaoEpiFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";

export default function SgsstEpisListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-epis");

  const [pageCat, setPageCat] = useState(0);
  const [pageSizeCat, setPageSizeCat] = useState(25);
  const [searchTermCat, setSearchTermCat] = useState("");
  const debouncedSearchCat = useDebounce(searchTermCat, 400);

  const { epis, total: totalCat, isLoading: loadingEpis, createEpi, updateEpi, removeEpi } = useSgsstEpis({
    page: pageCat,
    pageSize: pageSizeCat,
    search: debouncedSearchCat,
  });

  const totalPagesCat = Math.ceil(totalCat / pageSizeCat) || 1;

  const { entregas, isLoading: loadingEntregas, createEntrega, removeEntrega } = useSgsstEpiEntregas();
  const { devolucoes, isLoading: loadingDevolucoes, createDevolucao } = useSgsstEpiDevolucoes();
  const { colaboradores } = useSgsstColaboradoresResumo();

  // Active Tab
  const [activeTab, setActiveTab] = useState("catalogo");

  // Catálogo Filters
  const [filterCat, setFilterCat] = useState("todos");
  const [isEpiFormOpen, setIsEpiFormOpen] = useState(false);
  const [editingEpi, setEditingEpi] = useState<SgsstEpi | null>(null);

  // Entregas & Devoluções Filters
  const [searchTermEntrega, setSearchTermEntrega] = useState("");
  const [isEntregaFormOpen, setIsEntregaFormOpen] = useState(false);

  const [isDevolucaoFormOpen, setIsDevolucaoFormOpen] = useState(false);
  const [initialEntregaForDev, setInitialEntregaForDev] = useState<string | null>(null);

  // Ficha de Posse Filter
  const [selectedColabPosse, setSelectedColabPosse] = useState<string>("todos");
  const { historico: historicoColab } = useSgsstEpiHistoricoColaborador(selectedColabPosse !== "todos" ? selectedColabPosse : undefined);

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  // Filter Catálogo
  const filteredEpis = epis.filter((e) => {
    const term = searchTermCat.toLowerCase();
    const matchesSearch =
      e.nome.toLowerCase().includes(term) ||
      e.ca.toLowerCase().includes(term) ||
      (e.codigo && e.codigo.toLowerCase().includes(term)) ||
      (e.fabricante && e.fabricante.toLowerCase().includes(term));

    const matchesCat = filterCat === "todos" || e.categoria === filterCat;
    return matchesSearch && matchesCat;
  });

  // Filter Entregas
  const filteredEntregas = entregas.filter((ent) => {
    const term = searchTermEntrega.toLowerCase();
    const colabNome = ent.colaborador?.profile?.nome || ent.colaborador?.recurso?.nome || "";
    const epiNome = ent.epi?.nome || "";
    return (
      colabNome.toLowerCase().includes(term) ||
      epiNome.toLowerCase().includes(term) ||
      (ent.epi?.ca && ent.epi.ca.includes(term))
    );
  });

  // Stats
  const episAtivosCount = epis.filter((e) => e.status === "ATIVO").length;
  const caProximosCount = epis.filter((e) => e.statusValidadeCa === "PROXIMO_VENCIMENTO").length;
  const caVencidosCount = epis.filter((e) => e.statusValidadeCa === "VENCIDO").length;
  const estoqueAbaixoMinimoCount = epis.filter((e) => e.abaixoMinimo).length;
  const totalEntregasAtivas = entregas.length;

  const getCaStatusBadge = (statusCa?: string) => {
    switch (statusCa) {
      case "VALIDO":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">CA VÁLIDO</Badge>;
      case "PROXIMO_VENCIMENTO":
        return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> CA PRÓX. VENCIMENTO</Badge>;
      case "VENCIDO":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> CA VENCIDO</Badge>;
      default:
        return null;
    }
  };

  const handleSaveEpi = async (data: any) => {
    if (editingEpi) {
      await updateEpi.mutateAsync({ id: editingEpi.id, ...data });
    } else {
      await createEpi.mutateAsync(data);
    }
  };

  const handleSaveEntrega = async (data: any) => {
    await createEntrega.mutateAsync(data);
  };

  const handleSaveDevolucao = async (data: any) => {
    await createDevolucao.mutateAsync(data);
  };

  const handleOpenDevolucaoModal = (entregaId?: string) => {
    setInitialEntregaForDev(entregaId || null);
    setIsDevolucaoFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <Shield className="h-6 w-6 text-primary" />
            SGSST — Equipamentos de Proteção Individual (EPI)
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle de Certificados de Aprovação (CA), ficha de entrega com confirmação do trabalhador, devoluções e estoque mínimo.
          </p>
        </div>

        {allowEdit && (
          <div className="flex items-center gap-2">
            {activeTab === "catalogo" && (
              <Button onClick={() => { setEditingEpi(null); setIsEpiFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Cadastrar EPI
              </Button>
            )}
            {activeTab === "entregas" && (
              <Button onClick={() => setIsEntregaFormOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <PackageCheck className="h-4 w-4" /> Registrar Entrega
              </Button>
            )}
            {activeTab === "devolucoes" && (
              <Button onClick={() => handleOpenDevolucaoModal()} className="gap-2 bg-amber-600 hover:bg-amber-700">
                <RotateCcw className="h-4 w-4" /> Registrar Devolução
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 5 Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total EPIs Ativos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{episAtivosCount}</div>
          </CardContent>
        </Card>

        <Card className={caProximosCount > 0 ? "border-amber-300 bg-amber-50/20" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">CAs Próx. Vencimento</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{caProximosCount}</div>
          </CardContent>
        </Card>

        <Card className={caVencidosCount > 0 ? "border-red-300 bg-red-50/30" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">CAs Vencidos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-red-600">{caVencidosCount}</div>
          </CardContent>
        </Card>

        <Card className={estoqueAbaixoMinimoCount > 0 ? "border-amber-300 bg-amber-50/20" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Estoque Abaixo Mínimo</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{estoqueAbaixoMinimoCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Entregas Ativas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-blue-600">{totalEntregasAtivas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-5">
          <TabsTrigger value="catalogo" className="gap-2">
            <Shield className="h-4 w-4" /> Catálogo ({epis.length})
          </TabsTrigger>
          <TabsTrigger value="entregas" className="gap-2">
            <PackageCheck className="h-4 w-4" /> Entregas ({entregas.length})
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Devoluções ({devolucoes.length})
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2">
            <Boxes className="h-4 w-4" /> Estoque SST
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Ficha de Posse
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CATÁLOGO DE EPIS */}
        <TabsContent value="catalogo" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do EPI, CA ou fabricante..."
                value={searchTermCat}
                onChange={(e) => setSearchTermCat(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[180px] text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                <SelectItem value="Proteção da Cabeça">Proteção da Cabeça</SelectItem>
                <SelectItem value="Proteção dos Olhos e Face">Olhos e Face</SelectItem>
                <SelectItem value="Proteção Auditiva">Proteção Auditiva</SelectItem>
                <SelectItem value="Proteção Respiratória">Proteção Respiratória</SelectItem>
                <SelectItem value="Proteção das Mãos">Proteção das Mãos</SelectItem>
                <SelectItem value="Proteção dos Pés">Proteção dos Pés</SelectItem>
                <SelectItem value="Proteção do Corpo">Proteção do Corpo</SelectItem>
                <SelectItem value="Proteção Contra Quedas">Contra Quedas</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI / Equipamento</TableHead>
                    <TableHead>N° CA</TableHead>
                    <TableHead>Validade CA</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Estoque Atual</TableHead>
                    <TableHead>Situação CA</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEpis ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando catálogo de EPIs...</TableCell></TableRow>
                  ) : filteredEpis.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum EPI encontrado.</TableCell></TableRow>
                  ) : (
                    filteredEpis.map((epi) => (
                      <TableRow key={epi.id}>
                        <TableCell className="font-medium max-w-xs">
                          <div>{epi.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{epi.fabricante || "Fabricante n/i"} {epi.modelo ? `— ${epi.modelo}` : ""}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold">{epi.ca}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(epi.validade_ca)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{epi.categoria}</Badge></TableCell>
                        <TableCell>
                          <span className={`font-mono font-bold ${epi.abaixoMinimo ? "text-red-600" : "text-emerald-600"}`}>
                            {epi.estoque_atual} {epi.unidade_medida}
                          </span>
                          {epi.abaixoMinimo && <span className="text-[10px] text-red-600 block">Abaixo do mín. ({epi.estoque_minimo})</span>}
                        </TableCell>
                        <TableCell>{getCaStatusBadge(epi.statusValidadeCa)}</TableCell>
                        <TableCell className="text-right">
                          {allowEdit && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingEpi(epi);
                                  setIsEpiFormOpen(true);
                                }}
                                title="Editar EPI"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir EPI "{epi.nome}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O histórico de entregas deste equipamento será mantido para auditoria.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeEpi.mutate(epi.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pageCat + 1}
                totalPages={totalPagesCat}
                onPageChange={(p) => setPageCat(p - 1)}
                itemsPerPage={pageSizeCat}
                onItemsPerPageChange={(s) => {
                  setPageSizeCat(s);
                  setPageCat(0);
                }}
                totalItems={totalCat}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ENTREGAS DE EPI */}
        <TabsContent value="entregas" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador ou EPI..."
                value={searchTermEntrega}
                onChange={(e) => setSearchTermEntrega(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador / Trabalhador</TableHead>
                    <TableHead>EPI Entregue</TableHead>
                    <TableHead>N° CA</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Data Entrega</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEntregas ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando entregas de EPIs...</TableCell></TableRow>
                  ) : filteredEntregas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma entrega registrada.</TableCell></TableRow>
                  ) : (
                    filteredEntregas.map((ent) => {
                      const colabNome = ent.colaborador?.profile?.nome || ent.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={ent.id}>
                          <TableCell>
                            <div className="font-medium text-xs sm:text-sm">{colabNome}</div>
                            <div className="text-[11px] text-muted-foreground">CPF: {ent.colaborador?.cpf || "—"} | {ent.colaborador?.funcao?.nome || "Sem Função"}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-xs max-w-xs">{ent.epi?.nome}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{ent.epi?.ca || "—"}</TableCell>
                          <TableCell className="text-xs font-mono font-bold">{ent.quantidade} {ent.epi?.unidade_medida || "UN"}</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(ent.data_entrega)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{ent.motivo}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {allowEdit && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                    onClick={() => handleOpenDevolucaoModal(ent.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" /> Devolver
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeEntrega.mutate(ent.id)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: DEVOLUÇÕES DE EPI */}
        <TabsContent value="devolucoes" className="space-y-4 pt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>EPI Devolvido</TableHead>
                    <TableHead>Qtd Devolvida</TableHead>
                    <TableHead>Data Devolução</TableHead>
                    <TableHead>Condição do EPI</TableHead>
                    <TableHead>Motivo / Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDevolucoes ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando devoluções...</TableCell></TableRow>
                  ) : devolucoes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma devolução registrada.</TableCell></TableRow>
                  ) : (
                    devolucoes.map((dev) => {
                      const colabNome = dev.entrega?.colaborador?.profile?.nome || dev.entrega?.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={dev.id}>
                          <TableCell className="font-semibold text-xs">{colabNome}</TableCell>
                          <TableCell className="text-xs">{dev.entrega?.epi?.nome}</TableCell>
                          <TableCell className="text-xs font-mono font-bold">{dev.quantidade_devolvida} un</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(dev.data_devolucao)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-bold text-xs">
                              {dev.condicao_epi}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs">{dev.motivo || dev.observacao || "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ESTOQUE E ALERTA DE REPOSIÇÃO */}
        <TabsContent value="estoque" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" /> Posição Geral do Estoque de EPIs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI / Equipamento</TableHead>
                    <TableHead>N° CA</TableHead>
                    <TableHead>Estoque Atual</TableHead>
                    <TableHead>Estoque Mínimo</TableHead>
                    <TableHead>Status Reposição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {epis.map((epi) => (
                    <TableRow key={epi.id} className={epi.abaixoMinimo ? "bg-red-50/30" : ""}>
                      <TableCell className="font-semibold text-xs sm:text-sm">{epi.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{epi.ca}</TableCell>
                      <TableCell className="text-xs font-mono font-bold">{epi.estoque_atual} {epi.unidade_medida}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{epi.estoque_minimo} {epi.unidade_medida}</TableCell>
                      <TableCell>
                        {epi.abaixoMinimo ? (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> REPOSIÇÃO URGENTE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> OK / ESTOQUE SUFICIENTE
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: FICHA DE POSSE E HISTÓRICO DO COLABORADOR */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Ficha de Posse & Histórico do Colaborador</h3>
              <p className="text-xs text-muted-foreground">Consulte todos os EPIs entregues, devolvidos e atualmente sob responsabilidade do trabalhador.</p>
            </div>

            <Select value={selectedColabPosse} onValueChange={setSelectedColabPosse}>
              <SelectTrigger className="w-[280px] text-xs">
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">-- Selecione o Colaborador --</SelectItem>
                {colaboradores.map((c) => {
                  const nome = c.profile?.nome || c.recurso?.nome || "Sem Nome";
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {nome} (CPF: {c.cpf})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>EPI Relacionado</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedColabPosse === "todos" ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Selecione um colaborador acima para abrir a ficha de posse.</TableCell></TableRow>
                  ) : historicoColab.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum histórico registrado para este colaborador.</TableCell></TableRow>
                  ) : (
                    historicoColab.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{formatDateStr(h.created_at)}</TableCell>
                        <TableCell><Badge variant="outline" className="font-bold text-xs">{h.operacao}</Badge></TableCell>
                        <TableCell className="text-xs font-semibold">{(h as any).epi?.nome || "—"} (CA: {(h as any).epi?.ca || "—"})</TableCell>
                        <TableCell className="text-xs font-mono font-bold">{h.quantidade || 1}</TableCell>
                        <TableCell className="text-xs">{h.usuario?.nome || "Sistema"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs">{h.observacao || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EpiFormDialog
        open={isEpiFormOpen}
        onOpenChange={setIsEpiFormOpen}
        epi={editingEpi}
        onSave={handleSaveEpi}
        isLoading={createEpi.isPending || updateEpi.isPending}
      />

      <EntregaEpiFormDialog
        open={isEntregaFormOpen}
        onOpenChange={setIsEntregaFormOpen}
        onSave={handleSaveEntrega}
        isLoading={createEntrega.isPending}
      />

      <DevolucaoEpiFormDialog
        open={isDevolucaoFormOpen}
        onOpenChange={setIsDevolucaoFormOpen}
        initialEntregaId={initialEntregaForDev}
        onSave={handleSaveDevolucao}
        isLoading={createDevolucao.isPending}
      />
    </div>
  );
}
