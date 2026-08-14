import { useState } from "react";
import {
  useSgsstDocumentos,
  SgsstDocumento,
  CategoriaDocumento,
} from "@/hooks/sgsst/useSgsstDocumentos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  UploadCloud,
  FileText,
  Download,
  ExternalLink,
  History,
  Archive,
  RefreshCw,
} from "lucide-react";
import { UploadDocumentoDialog } from "@/components/sgsst/UploadDocumentoDialog";
import { DocumentoVersoesDialog } from "@/components/sgsst/DocumentoVersoesDialog";
import { format, parseISO } from "date-fns";

interface SgsstDocumentosTabProps {
  entidadeTipo: CategoriaDocumento;
  entidadeId: string;
  title?: string;
}

export function SgsstDocumentosTab({
  entidadeTipo,
  entidadeId,
  title = "Documentos e Anexos Vinculados (Cloudflare R2)",
}: SgsstDocumentosTabProps) {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-documentos");

  const { documentos, isLoading, uploadDocumento, uploadNovaVersao, arquivarDocumento } = useSgsstDocumentos(entidadeTipo, entidadeId);

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
    <Card className="w-full">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>

        {allowEdit && (
          <Button
            size="sm"
            onClick={() => {
              setDocForNovaVersao(null);
              setIsUploadOpen(true);
            }}
            className="gap-1 text-xs"
          >
            <UploadCloud className="h-3.5 w-3.5" /> Anexar Documento R2
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableRow key="header">
                <TableHead>Nome do Documento</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data Envio</TableHead>
                <TableHead>Enviado por</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Carregando documentos anexados...</TableCell></TableRow>
            ) : documentos.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Nenhum documento anexado a este registro.</TableCell></TableRow>
            ) : (
              documentos.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium text-xs">
                    <div>{doc.nome}</div>
                    {doc.descricao && <div className="text-[11px] text-muted-foreground truncate max-w-xs">{doc.descricao}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-bold font-mono text-[11px]">
                      v{doc.versao_atual}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{formatFileSize(doc.tamanho)}</TableCell>
                  <TableCell className="text-xs font-mono">{formatDateStr(doc.created_at)}</TableCell>
                  <TableCell className="text-xs">{doc.autor?.nome || "Sistema"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Visualizar / Baixar"
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

                      {allowEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDocForNovaVersao(doc.id);
                              setIsUploadOpen(true);
                            }}
                            title="Substituir / Nova Versão"
                          >
                            <RefreshCw className="h-4 w-4 text-indigo-600" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => arquivarDocumento.mutate(doc.id)}
                            title="Arquivar Documento"
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

      <UploadDocumentoDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        documentoIdForNovaVersao={docForNovaVersao}
        defaultCategoria={entidadeTipo}
        defaultEntidadeTipo={entidadeTipo}
        defaultEntidadeId={entidadeId}
        onUpload={handleUploadSubmit}
        isLoading={uploadDocumento.isPending || uploadNovaVersao.isPending}
      />

      <DocumentoVersoesDialog
        open={!!selectedDocVersoes}
        onOpenChange={(open) => !open && setSelectedDocVersoes(null)}
        documento={selectedDocVersoes}
      />
    </Card>
  );
}
