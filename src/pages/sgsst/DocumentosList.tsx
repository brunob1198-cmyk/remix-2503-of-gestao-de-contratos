import { useState } from "react";
import {
  useSgsstDocumentos,
  useSgsstDocumentosHistorico,
  SgsstDocumento,
  CategoriaDocumento,
} from "@/hooks/sgsst/useSgsstDocumentos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { UploadDocumentoDialog } from "@/components/sgsst/UploadDocumentoDialog";
import { DocumentoVersoesDialog } from "@/components/sgsst/DocumentoVersoesDialog";
import { format, parseISO } from "date-fns";

export default function SgsstDocumentosListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-documentos");

  const { documentos, isLoading, uploadDocumento, uploadNovaVersao, arquivarDocumento } = useSgsstDocumentos();
  const { historico: historicoGeral, isLoading: loadingHist } = useSgsstDocumentosHistorico();

  // Active Tab
  const [activeTab, setActiveTab] = useState("todos");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("ATIVO");

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

  // Filtered documents for 'todos' tab
  const filteredDocs = documentos.filter((doc) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      doc.nome.toLowerCase().includes(term) ||
      (doc.descricao && doc.descricao.toLowerCase().includes(term)) ||
      (doc.r2_key && doc.r2_key.toLowerCase().includes(term));

    const matchesCategory = filterCategory === "todos" || doc.categoria === filterCategory;
    const matchesStatus = activeTab === "arquivados" ? (doc.status === "ARQUIVADO" || doc.status === "CANCELADO") : doc.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Stats
  const docsAtivosCount = documentos.filter((d) => d.status === "ATIVO").length;
  const docsPgrPcmsoCount = documentos.filter((d) => d.status === "ATIVO" && (d.categoria === "PGR" || d.categoria === "PCMSO")).length;
  const docsAprPtCount = documentos.filter((d) => d.status === "ATIVO" && (d.categoria === "APR" || d.categoria === "PT")).length;
  const docsCertificadosCount = documentos.filter((d) => d.status === "ATIVO" && (d.categoria === "ASO" || d.categoria === "TREINAMENTO" || d.categoria === "EPI")).length;
  const docsArquivadosCount = documentos.filter((d) => d.status === "ARQUIVADO" || d.status === "CANCELADO").length;

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
                    ) : filteredDocs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum documento encontrado.</TableCell></TableRow>
                    ) : (
                      filteredDocs.map((doc) => (
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

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => arquivarDocumento.mutate(doc.id)}
                                    title="Arquivar"
                                  >
                                    <Archive className="h-4 w-4 text-amber-600" />
                                  </Button>
                                </>
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
