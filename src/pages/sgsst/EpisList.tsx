import { useState } from "react";
import {
  useSgsstEpis,
  useSgsstEpiEntregas,
  useSgsstEpiDevolucoes,
  useSgsstEpiHistoricoColaborador,
  useSgsstFichaEpiDoColaborador,
  useSgsstEpiManutencoes,
  SgsstEpi,
  SgsstEpiEntrega,
  CategoriaEpi,
} from "@/hooks/sgsst/useSgsstEpis";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import {
  gerarPdfFichaEpi,
  pendenciasFichaEpi,
  type FichaEpiDados,
} from "@/lib/fichaEpiDocumento";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { useSgsstCounts } from "@/hooks/sgsst/useSgsstCounts";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import { toast } from "sonner";
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
  FileDown,
  Loader2,
  Sparkles,
  Camera,
} from "lucide-react";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { EpiFormDialog } from "@/components/sgsst/EpiFormDialog";
import { EntregaEpiFormDialog } from "@/components/sgsst/EntregaEpiFormDialog";
import { DevolucaoEpiFormDialog } from "@/components/sgsst/DevolucaoEpiFormDialog";
import { ManutencaoEpiFormDialog } from "@/components/sgsst/ManutencaoEpiFormDialog";
import { SgsstEvidenciasDialog } from "@/components/sgsst/SgsstEvidenciasDialog";
import {
  fotosDosRegistrosParaDocumento,
  type EntidadeEvidencia,
} from "@/hooks/sgsst/useSgsstEvidencias";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import {
  previsaoTroca,
  SITUACAO_VIDA_UTIL_LABEL,
} from "@/utils/sgsstEpiVidaUtil";
import {
  situacaoHigienizacao,
  higienizacaoPendente,
  SITUACAO_HIGIENIZACAO_LABEL,
  TIPO_MANUTENCAO_LABEL,
} from "@/utils/sgsstEpiHigienizacao";

export default function SgsstEpisListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-epis");

  const [pageCat, setPageCat] = useState(0);
  const [pageSizeCat, setPageSizeCat] = useState(25);
  const [searchTermCat, setSearchTermCat] = useState("");
  const debouncedSearchCat = useDebounce(searchTermCat, 400);

  const { epis, total: totalCat, isLoading: loadingEpis, error: errEpis, refetch: refetchEpis, createEpi, updateEpi, removeEpi } = useSgsstEpis({
    page: pageCat,
    pageSize: pageSizeCat,
    search: debouncedSearchCat,
  });

  const totalPagesCat = Math.ceil(totalCat / pageSizeCat) || 1;

  // Entregas e devolucoes acumulam a cada reposicao de cada trabalhador. As duas
  // consultas nao tinham limite nenhum e o PostgREST cortava no teto padrao em
  // silencio — a tela mostrava lista incompleta sem dizer que era incompleta.
  const [pageEnt, setPageEnt] = useState(0);
  const [pageSizeEnt, setPageSizeEnt] = useState(25);
  const [pageDev, setPageDev] = useState(0);
  const [pageSizeDev, setPageSizeDev] = useState(25);

  const {
    entregas,
    total: totalEntregas,
    isLoading: loadingEntregas,
    error: errEntregas,
    createEntrega,
    removeEntrega,
  } = useSgsstEpiEntregas({ page: pageEnt, pageSize: pageSizeEnt });

  const {
    devolucoes,
    total: totalDevolucoes,
    isLoading: loadingDevolucoes,
    error: errDevolucoes,
    createDevolucao,
  } = useSgsstEpiDevolucoes({ page: pageDev, pageSize: pageSizeDev });

  const totalPagesEnt = Math.ceil(totalEntregas / pageSizeEnt) || 1;
  const totalPagesDev = Math.ceil(totalDevolucoes / pageSizeDev) || 1;

  // Higienização e manutenção — NR-06 6.6.1 alínea "f".
  const [pageManut, setPageManut] = useState(0);
  const [pageSizeManut, setPageSizeManut] = useState(25);
  const [isManutencaoFormOpen, setIsManutencaoFormOpen] = useState(false);

  // Um dialogo de fotos para as tres tabelas da tela. Entrega, devolucao e
  // higienizacao vivem em LINHA, sem tela de detalhe onde encaixar o painel — e
  // abrir uma so para anexar foto seria mais navegacao do que a tarefa merece.
  const [fotosDe, setFotosDe] = useState<{
    entidade: EntidadeEvidencia;
    id: string;
    subtitulo: string;
  } | null>(null);

  const {
    manutencoes,
    total: totalManutencoes,
    isLoading: loadingManutencoes,
    error: errManutencoes,
    createManutencao,
    removeManutencao,
  } = useSgsstEpiManutencoes({ page: pageManut, pageSize: pageSizeManut });

  const totalPagesManut = Math.ceil(totalManutencoes / pageSizeManut) || 1;
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { empresa } = useEmpresaAtual();
  const { profile } = useAuth();

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

  // ------------------------------------------------------------------
  // Ficha de Entrega de EPI — NR-06 6.6.1
  // ------------------------------------------------------------------
  // A ficha e por trabalhador e cumulativa: e assim que ela e usada quando o
  // fornecimento e contestado.
  const [emitindoFicha, setEmitindoFicha] = useState(false);

  const colabDaFicha = colaboradores.find((c) => c.id === selectedColabPosse) ?? null;

  // Consulta propria: recortar a pagina carregada faria a ficha sair com as
  // entregas dos ultimos registros da empresa e faltando as antigas — que sao
  // justamente as que se contesta.
  const {
    entregas: entregasDaFicha,
    devolucoes: devolucoesDaFicha,
    isLoading: carregandoFicha,
    truncado: fichaTruncada,
  } = useSgsstFichaEpiDoColaborador(
    selectedColabPosse !== "todos" ? selectedColabPosse : undefined
  );

  // As execucoes das entregas deste trabalhador. A ficha precisa delas para
  // comprovar a alinea "f" — sem isso a secao sairia sempre dizendo que nao ha
  // registro, mesmo havendo.
  const { manutencoes: manutencoesDaFicha } = useSgsstEpiManutencoes({
    entregaIds: entregasDaFicha.map((e) => e.id),
    pageSize: 200,
  });

  const emitirFichaEpi = async () => {
    if (!colabDaFicha) return;

    const dadosDaFicha: FichaEpiDados = {
      entregas: entregasDaFicha,
      devolucoes: devolucoesDaFicha,
      manutencoes: manutencoesDaFicha,
      // `displayNome` ja resolve cadastro proprio, profile e recurso na ordem certa.
      nomeTrabalhador: colabDaFicha.displayNome,
      cpfTrabalhador: colabDaFicha.cpf ?? null,
      funcaoTrabalhador: colabDaFicha.funcao ?? null,
      empresa: empresa ?? null,
      geradoPor: profile?.nome ?? null,
    };

    if (fichaTruncada) {
      toast.warning("Histórico possivelmente incompleto", {
        description:
          "A consulta atingiu o limite de linhas. A ficha pode não conter as entregas mais antigas.",
      });
    }

    // Pendencia nao impede a emissao: a ficha sai marcando cada falta. Uma ficha
    // que esconde a entrega feita com CA vencido afirma mais do que os dados
    // sustentam — e e exatamente esse ponto que se contesta depois.
    const pendencias = pendenciasFichaEpi(dadosDaFicha);
    if (pendencias.length > 0) {
      toast.warning(`Ficha com ${pendencias.length} pendência(s)`, {
        description: pendencias.slice(0, 3).join(" · "),
      });
    }

    setEmitindoFicha(true);
    try {
      const [fotosPorEntrega, fotosPorDevolucao, fotosPorManutencao] = await Promise.all([
        fotosDosRegistrosParaDocumento(
          "EPI_ENTREGA",
          entregasDaFicha.map((e) => e.id)
        ),
        fotosDosRegistrosParaDocumento(
          "EPI_DEVOLUCAO",
          devolucoesDaFicha.map((d) => d.id)
        ),
        fotosDosRegistrosParaDocumento(
          "EPI_MANUTENCAO",
          manutencoesDaFicha.map((m) => m.id)
        ),
      ]);

      await gerarPdfFichaEpi({
        ...dadosDaFicha,
        fotosPorEntrega,
        fotosPorDevolucao,
        fotosPorManutencao,
      });
    } catch (e) {
      toast.error(`Erro ao emitir a ficha: ${(e as Error).message}`);
    } finally {
      setEmitindoFicha(false);
    }
  };

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  /**
   * Equipamentos reutilizáveis com higienização atrasada ou nunca registrada.
   *
   * Só o que exige higienização entra: cobrar de descartável seria ruído, e ruído
   * ensina o usuário a ignorar o aviso verdadeiro. "Próxima do prazo" também fica
   * fora — é aviso de antecedência, não pendência.
   *
   * As execuções consideradas são as da página carregada. Isso subestima o número
   * quando há muitos registros, e por isso o painel fala em "pendente", nunca em
   * "total" — número que pode estar por baixo não deve se apresentar como fechado.
   */
  const pendenciasHigienizacao = epis
    .filter((epi) => epi.exige_higienizacao)
    .map((epi) => ({
      epi,
      situacao: situacaoHigienizacao({
        exigeHigienizacao: epi.exige_higienizacao,
        periodicidadeDias: epi.higienizacao_periodicidade_dias,
        execucoes: manutencoes.filter((m) => m.epi_id === epi.id),
        hoje: new Date(),
      }),
    }))
    .filter((x) => higienizacaoPendente(x.situacao.situacao));

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
    const colabNome = ent.colaborador?.profile?.nome || ent.colaborador?.recurso?.nome || ent.colaborador?.nome || "";
    const epiNome = ent.epi?.nome || "";
    return (
      colabNome.toLowerCase().includes(term) ||
      epiNome.toLowerCase().includes(term) ||
      (ent.epi?.ca && ent.epi.ca.includes(term))
    );
  });

  // Indicadores do catálogo de EPI.
  // Eram calculados com `epis.filter(...)` sobre a página carregada, então
  // "CA vencidos" e "estoque abaixo do mínimo" contavam só as linhas visíveis —
  // exatamente os números que não podem ser subestimados. Agora vêm de
  // contagens do servidor sobre a base inteira.
  const hojeIso = new Date().toISOString().slice(0, 10);
  const limiteCaIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const { count: countEpis } = useSgsstCounts("sgsst_epis", [
    { key: "ativos", build: (q) => q.eq("status", "ATIVO") },
    {
      key: "caProximos",
      build: (q) => q.gte("validade_ca", hojeIso).lte("validade_ca", limiteCaIso),
    },
    { key: "caVencidos", build: (q) => q.lt("validade_ca", hojeIso) },
    // `abaixo_minimo` é coluna gerada (estoque_atual <= estoque_minimo): o
    // PostgREST não compara duas colunas, por isso a comparação virou coluna.
    { key: "abaixoMinimo", build: (q) => q.is("abaixo_minimo", true) },
  ]);

  const episAtivosCount = countEpis("ativos");
  const caProximosCount = countEpis("caProximos");
  const caVencidosCount = countEpis("caVencidos");
  const estoqueAbaixoMinimoCount = countEpis("abaixoMinimo");
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

  // Basta um dos hooks falhar para várias abas ficarem vazias; o banner diz
  // qual é a causa em vez de deixar as tabelas parecerem sem cadastro.
  const erroModulo = errEpis ?? errEntregas ?? errDevolucoes;

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

      {erroModulo && (
        <SgsstErrorState error={erroModulo} modulo="EPI" onRetry={refetchEpis} />
      )}

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="catalogo" className="gap-2">
            <Shield className="h-4 w-4" /> Catálogo ({epis.length})
          </TabsTrigger>
          <TabsTrigger value="entregas" className="gap-2">
            <PackageCheck className="h-4 w-4" /> Entregas ({totalEntregas})
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Devoluções ({totalDevolucoes})
          </TabsTrigger>
          <TabsTrigger value="higienizacao" className="gap-2">
            <Sparkles className="h-4 w-4" /> Higienização
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
                    <TableHead>Troca prevista</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEntregas ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando entregas de EPIs...</TableCell></TableRow>
                  ) : filteredEntregas.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma entrega registrada.</TableCell></TableRow>
                  ) : (
                    filteredEntregas.map((ent) => {
                      const colabNome = ent.colaborador?.profile?.nome || ent.colaborador?.recurso?.nome || ent.colaborador?.nome || "Sem Nome";
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
                          <TableCell className="text-xs">
                            {(() => {
                              // Sem vida util cadastrada no EPI nao ha prazo a
                              // mostrar — e inventar um faria o usuario aprender a
                              // ignorar o aviso.
                              const troca = previsaoTroca({
                                dataEntrega: ent.data_entrega,
                                vidaUtilMeses: ent.epi?.vida_util_meses ?? null,
                                hoje: new Date(),
                              });

                              if (troca.situacao === "SEM_PRAZO") {
                                return <span className="text-muted-foreground">—</span>;
                              }

                              const tom =
                                troca.situacao === "VENCIDO"
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : troca.situacao === "PROXIMO_DA_TROCA"
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-300";

                              return (
                                <Badge
                                  variant="outline"
                                  className={`text-xs whitespace-nowrap ${tom}`}
                                  title={SITUACAO_VIDA_UTIL_LABEL[troca.situacao]}
                                >
                                  {formatDateStr(troca.dataPrevista)}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Fotos deste registro"
                                onClick={() =>
                                  setFotosDe({
                                    entidade: "EPI_ENTREGA",
                                    id: ent.id,
                                    subtitulo: `${ent.epi?.nome ?? "EPI"} · entregue em ${formatDateStr(ent.data_entrega)}`,
                                  })
                                }
                              >
                                <Camera className="h-4 w-4" />
                              </Button>

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

                                  <SgsstConfirmDelete
                                    alvo="este registro de entrega"
                                    consequencia={"A entrega do EPI ao colaborador é apagada, junto com a confirmação de recebimento — a evidência de fornecimento exigida pela NR-06 deixa de existir. O saldo em estoque é devolvido."}
                                    onConfirm={() => removeEntrega.mutate(ent.id)}
                                  />
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
              <TablePagination
                currentPage={pageEnt + 1}
                totalPages={totalPagesEnt}
                onPageChange={(pg) => setPageEnt(pg - 1)}
                itemsPerPage={pageSizeEnt}
                onItemsPerPageChange={(v) => {
                  setPageSizeEnt(v);
                  setPageEnt(0);
                }}
                totalItems={totalEntregas}
              />
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
                    <TableHead className="text-right">Fotos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDevolucoes ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando devoluções...</TableCell></TableRow>
                  ) : devolucoes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma devolução registrada.</TableCell></TableRow>
                  ) : (
                    devolucoes.map((dev) => {
                      const colabNome = dev.entrega?.colaborador?.profile?.nome || dev.entrega?.colaborador?.recurso?.nome || dev.entrega?.colaborador?.nome || "Sem Nome";
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
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Fotos desta devolução"
                              onClick={() =>
                                setFotosDe({
                                  entidade: "EPI_DEVOLUCAO",
                                  id: dev.id,
                                  subtitulo: `${dev.entrega?.epi?.nome ?? "EPI"} · devolvido em ${formatDateStr(dev.data_devolucao)} · ${dev.condicao_epi}`,
                                })
                              }
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pageDev + 1}
                totalPages={totalPagesDev}
                onPageChange={(pg) => setPageDev(pg - 1)}
                itemsPerPage={pageSizeDev}
                onItemsPerPageChange={(v) => {
                  setPageSizeDev(v);
                  setPageDev(0);
                }}
                totalItems={totalDevolucoes}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3.5: HIGIENIZAÇÃO E MANUTENÇÃO — NR-06 6.6.1 alínea "f" */}
        <TabsContent value="higienizacao" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Higienização & Manutenção</h3>
              <p className="text-xs text-muted-foreground">
                A NR-06 6.6.1 alínea "f" põe no empregador a responsabilidade pela
                higienização e manutenção <strong>periódica</strong> do EPI. É o
                histórico que comprova a periodicidade.
              </p>
            </div>

            {allowEdit && (
              <Button onClick={() => setIsManutencaoFormOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Registrar execução
              </Button>
            )}
          </div>

          {/* Equipamentos reutilizáveis com a higienização em atraso ou nunca feita */}
          {pendenciasHigienizacao.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {pendenciasHigienizacao.length} equipamento(s) reutilizável(is) com
                higienização pendente
              </p>
              <ul className="mt-2 space-y-1">
                {pendenciasHigienizacao.map((p) => (
                  <li key={p.epi.id} className="text-[11px] text-amber-900 dark:text-amber-200">
                    <strong>{p.epi.nome}</strong> —{" "}
                    {SITUACAO_HIGIENIZACAO_LABEL[p.situacao.situacao]}
                    {p.situacao.proximaEm
                      ? ` · prazo era ${formatDateStr(p.situacao.proximaEm)}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {errManutencoes && (
                <div className="p-3">
                  <SgsstErrorState error={errManutencoes} modulo="EPI" inline />
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>EPI</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Alvo</TableHead>
                      <TableHead>Executado por</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Próxima</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingManutencoes ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Carregando execuções...
                        </TableCell>
                      </TableRow>
                    ) : manutencoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                          Nenhuma higienização ou manutenção registrada. Enquanto não
                          houver registro, a periodicidade da NR-06 não tem como ser
                          comprovada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      manutencoes.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs font-mono">
                            {formatDateStr(m.data_execucao)}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">
                            {m.epi?.nome || "—"}
                            <div className="text-[11px] text-muted-foreground font-normal">
                              CA {m.epi?.ca || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {TIPO_MANUTENCAO_LABEL[m.tipo] ?? m.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{m.quantidade}</TableCell>
                          <TableCell className="text-xs">
                            {/* Estoque e peça do trabalhador têm efeitos diferentes;
                                a coluna diz qual dos dois é. */}
                            {m.entrega_id ? (
                              <span>
                                {m.entrega?.colaborador?.profile?.nome ||
                                  m.entrega?.colaborador?.recurso?.nome ||
                                  m.entrega?.colaborador?.nome ||
                                  "trabalhador"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Estoque</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {m.executado_por_nome || m.executado_por?.nome || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {m.resultado === "APROVADO" && (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                                Aprovado
                              </Badge>
                            )}
                            {m.resultado === "REPROVADO" && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                Reprovado
                              </Badge>
                            )}
                            {m.resultado === "DESCARTADO" && (
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs font-bold">
                                Descartado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {formatDateStr(m.proxima_prevista)}
                          </TableCell>
                          {/* A célula sai de dentro do `allowEdit`: ver as fotos é
                              leitura, e quem confere no campo costuma não ter
                              permissão de editar. Só a remoção fica restrita. */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Fotos deste registro"
                                onClick={() =>
                                  setFotosDe({
                                    entidade: "EPI_MANUTENCAO",
                                    id: m.id,
                                    subtitulo: `${TIPO_MANUTENCAO_LABEL[m.tipo] ?? m.tipo} · ${m.epi?.nome ?? "EPI"} · ${formatDateStr(m.data_execucao)}`,
                                  })
                                }
                              >
                                <Camera className="h-4 w-4" />
                              </Button>

                              {allowEdit && (
                                <SgsstConfirmDelete
                                  alvo="este registro de execução"
                                  consequencia={
                                    "O registro de higienização/manutenção é apagado e a prova da periodicidade exigida pela NR-06 deixa de existir. Se era um descarte de estoque, as unidades voltam ao estoque."
                                  }
                                  onConfirm={() => removeManutencao.mutate(m.id)}
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={pageManut + 1}
                totalPages={totalPagesManut}
                onPageChange={(pg) => setPageManut(pg - 1)}
                itemsPerPage={pageSizeManut}
                onItemsPerPageChange={(v) => {
                  setPageSizeManut(v);
                  setPageManut(0);
                }}
                totalItems={totalManutencoes}
              />
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                disabled={!colabDaFicha || emitindoFicha || carregandoFicha}
                onClick={emitirFichaEpi}
                title="Emitir a ficha de entrega de EPI deste trabalhador em PDF"
              >
                {emitindoFicha ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                Emitir ficha
              </Button>

              <Select value={selectedColabPosse} onValueChange={setSelectedColabPosse}>
              <SelectTrigger className="w-[280px] text-xs">
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">-- Selecione o Colaborador --</SelectItem>
                {colaboradores.map((c) => {
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayNome} (CPF: {c.cpf})
                    </SelectItem>
                  );
                })}
              </SelectContent>
              </Select>
            </div>
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

      <SgsstEvidenciasDialog
        open={!!fotosDe}
        onOpenChange={(aberto) => !aberto && setFotosDe(null)}
        entidade={fotosDe?.entidade ?? "EPI_ENTREGA"}
        entidadeId={fotosDe?.id}
        permiteEditar={allowEdit}
        subtitulo={fotosDe?.subtitulo}
        ajuda="Fotografe o equipamento: o estado em que foi entregue, o dano que motivou a devolução ou a condição após a higienização."
      />

      <ManutencaoEpiFormDialog
        open={isManutencaoFormOpen}
        onOpenChange={setIsManutencaoFormOpen}
        onSave={async (dados) => {
          await createManutencao.mutateAsync(dados);
        }}
        isLoading={createManutencao.isPending}
      />
    </div>
  );
}
