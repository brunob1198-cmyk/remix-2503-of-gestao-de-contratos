import { useEffect, useState } from "react";
import {
  useSgsstDocumentos,
  useSgsstDocumentosHistorico,
  useSgsstDocumentosResumo,
  SgsstDocumento,
  CategoriaDocumento,
} from "@/hooks/sgsst/useSgsstDocumentos";
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
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import {
  UploadCloud,
  Search,
  FileText,
  Download,
  ExternalLink,
  History,
  Archive,
  FolderArchive,
  RefreshCw,
  Layers,
  Filter,
  Ban,
} from "lucide-react";
import { UploadDocumentoDialog } from "@/components/sgsst/UploadDocumentoDialog";
import { DocumentoVersoesDialog } from "@/components/sgsst/DocumentoVersoesDialog";
import { format, parseISO } from "date-fns";

export default function SgsstDocumentosListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-documentos");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [filterCategory, setFilterCategory] = useState("todos");

  // Aba ativa e status: declarados antes do hook porque agora são enviados como
  // filtro ao servidor.
  const [activeTab, setActiveTab] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("ATIVO");

  const { documentos, total, isLoading, error: errDocumentos, refetch, uploadDocumento, uploadNovaVersao, arquivarDocumento, cancelarDocumento } = useSgsstDocumentos(
    undefined,
    undefined,
    {
      page,
      pageSize,
      search: debouncedSearch,
      tipo: filterCategory,
      // O status passou a ser filtrado no servidor: filtrar depois da paginacao
      // fazia a pagina mostrar menos linhas do que o paginador anunciava.
      status: activeTab === "arquivados" ? "ARQUIVADOS" : filterStatus,
    }
  );

  const totalPages = Math.ceil(total / pageSize) || 1;

  // Voltar à primeira página quando busca, categoria, status ou aba mudam: sem
  // isto a consulta pede um range que o resultado filtrado não tem e a tabela
  // aparece vazia mesmo havendo documentos.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterCategory, filterStatus, activeTab]);

  const { historico: historicoGeral, isLoading: loadingHist } = useSgsstDocumentosHistorico();

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docForNovaVersao, setDocForNovaVersao] = useState<string | null>(null);
  const [selectedDocVersoes, setSelectedDocVersoes] = useState<SgsstDocumento | null>(null);

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Indicadores: contagens do servidor sobre a base inteira. Derivar de
  // `documentos.filter(...)` media apenas a pagina corrente.
  const { resumo } = useSgsstDocumentosResumo();
  const docsAtivosCount = resumo.ativos;
  const docsPgrPcmsoCount = resumo.pgrPcmso;
  const docsAprPtCount = resumo.aprPt;
  const docsCertificadosCount = resumo.certificados;
  const docsArquivadosCount = resumo.arquivados;

  const handleUploadSubmit = async (data: any) => {
    if (docForNovaVersao) {
      await uploadNovaVersao.mutateAsync({
        documentoId: docForNovaVersao,
        file: data.file,
        observacao: data.observacaoNovaVersao,
      });
    } else {
      await uploadDocumento.mutateAsync(data);
    }
  };

  // Basta um dos hooks falhar para varias abas ficarem vazias; o banner diz
  // qual e a causa em vez de deixar as tabelas parecerem sem cadastro.
  const erroModulo = errDocumentos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <FolderArchive className="h-6 w-6 text-primary" />
            SGSST — Gestão de Documentos (Cloudflare R2)
          </h1>
          <p className="text-sm text-muted-foreground">
            Central de armazenamento de laudos, programas, evidências e certificados integrados ao Cloudflare R2 com controle de versão.
          </p>
        </div>

        {allowEdit && (
          <Button
            onClick={() => {
              setDocForNovaVersao(null);
              setIsUploadOpen(true);
            }}
            className="gap-2"
          >
            <UploadCloud className="h-4 w-4" /> Enviar Documento R2
          </Button>
        )}
      </div>

      {/* 5 Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Documentos Ativos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{docsAtivosCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">PGR & PCMSO</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-indigo-600">{docsPgrPcmsoCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">APR & PT</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-blue-600">{docsAprPtCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">ASO, Treinamentos & EPI</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-emerald-600">{docsCertificadosCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Arquivados</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-muted-foreground">{docsArquivadosCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      {erroModulo && (
        <SgsstErrorState
          error={erroModulo}
          modulo="Documentos"
          onRetry={refetch}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-4">
          <TabsTrigger value="todos" className="gap-2">
            <FileText className="h-4 w-4" /> Todos Documentos ({docsAtivosCount})
          </TabsTrigger>
          <TabsTrigger value="entidades" className="gap-2">
            <Layers className="h-4 w-4" /> Por Módulo SGSST
          </TabsTrigger>
          <TabsTrigger value="arquivados" className="gap-2">
            <Archive className="h-4 w-4" /> Arquivados ({docsArquivadosCount})
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Trilha de Auditoria
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TODOS DOCUMENTOS & TAB 3: ARQUIVADOS */}
        {(activeTab === "todos" || activeTab === "arquivados" || activeTab === "entidades") && (
          <TabsContent value={activeTab} className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
              <div className="relative flex-1 w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, descrição ou arquivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Categorias</SelectItem>
                  <SelectItem value="PGR">PGR</SelectItem>
                  <SelectItem value="APR">APR</SelectItem>
                  <SelectItem value="PT">PT</SelectItem>
                  <SelectItem value="INSPECAO">Inspeções</SelectItem>
                  <SelectItem value="INCIDENTE">Incidentes</SelectItem>
                  <SelectItem value="NAO_CONFORMIDADE">Não Conformidades</SelectItem>
                  <SelectItem value="PCMSO">PCMSO</SelectItem>
                  <SelectItem value="ASO">ASO / Exames</SelectItem>
                  <SelectItem value="TREINAMENTO">Treinamentos</SelectItem>
                  <SelectItem value="EPI">EPIs</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Versão Atual</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data Envio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando documentos no R2...</TableCell></TableRow>
                    ) : documentos.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum documento encontrado.</TableCell></TableRow>
                    ) : (
                      documentos.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium max-w-xs">
                            <div className="text-xs sm:text-sm font-semibold">{doc.nome}</div>
                            {doc.descricao && <div className="text-xs text-muted-foreground truncate">{doc.descricao}</div>}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{doc.categoria}</Badge></TableCell>
                          <TableCell className="text-xs font-mono font-bold">v{doc.versao_atual}</TableCell>
                          <TableCell className="text-xs font-mono">{formatFileSize(doc.tamanho)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(doc.created_at)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs font-bold">{doc.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                title="Abrir Documento R2"
                              >
                                <a href={doc.r2_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 text-primary" />
                                </a>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedDocVersoes(doc)}
                                title="Histórico de Versões"
                              >
                                <History className="h-4 w-4 text-muted-foreground" />
                              </Button>

                              {allowEdit && doc.status === "ATIVO" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setDocForNovaVersao(doc.id);
                                      setIsUploadOpen(true);
                                    }}
                                    title="Nova Versão R2"
                                  >
                                    <RefreshCw className="h-4 w-4 text-indigo-600" />
                                  </Button>

                                  {/* Arquivar e cancelar não excluem a linha: documento
                                      de SST precisa continuar auditável. Ambos passam
                                      por confirmação porque somem da lista padrão. */}
                                  <SgsstConfirmDelete
                                    alvo={`o documento "${doc.nome}"`}
                                    title={`Arquivar "${doc.nome}"?`}
                                    consequencia="O documento sai da lista de ativos e passa para a aba Arquivados. O arquivo e o histórico de versões continuam disponíveis, e é possível reativá-lo depois."
                                    onConfirm={() => arquivarDocumento.mutate(doc.id)}
                                    trigger={
                                      <Button variant="ghost" size="icon" title="Arquivar">
                                        <Archive className="h-4 w-4 text-amber-600" />
                                      </Button>
                                    }
                                  />

                                  <SgsstConfirmDelete
                                    alvo={`o documento "${doc.nome}"`}
                                    title={`Cancelar "${doc.nome}"?`}
                                    consequencia="O documento é marcado como cancelado e deixa de valer como evidência — use quando ele foi emitido por engano ou substituído. O arquivo permanece no histórico para auditoria."
                                    onConfirm={() => cancelarDocumento.mutate(doc.id)}
                                    trigger={
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Cancelar documento"
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Ban className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  currentPage={page + 1}
                  totalPages={totalPages}
                  onPageChange={(p) => setPage(p - 1)}
                  itemsPerPage={pageSize}
                  onItemsPerPageChange={(s) => {
                    setPageSize(s);
                    setPage(0);
                  }}
                  totalItems={total}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* TAB 4: TRILHA DE AUDITORIA */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Trilha de Auditoria do R2
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHist ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando trilha de auditoria...</TableCell></TableRow>
                  ) : historicoGeral.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum evento registrado.</TableCell></TableRow>
                  ) : (
                    historicoGeral.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{formatDateStr(h.created_at)}</TableCell>
                        <TableCell><Badge variant="outline" className="font-bold text-xs">{h.operacao}</Badge></TableCell>
                        <TableCell className="text-xs font-semibold">{h.usuario?.nome || "Sistema"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md">{h.observacao || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <UploadDocumentoDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        documentoIdForNovaVersao={docForNovaVersao}
        onUpload={handleUploadSubmit}
        isLoading={uploadDocumento.isPending || uploadNovaVersao.isPending}
      />

      <DocumentoVersoesDialog
        open={!!selectedDocVersoes}
        onOpenChange={(open) => !open && setSelectedDocVersoes(null)}
        documento={selectedDocVersoes}
      />
    </div>
  );
}
