import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SgsstDocumento, useSgsstDocumentoVersoes } from "@/hooks/sgsst/useSgsstDocumentos";
import { History, Download, ExternalLink, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

interface DocumentoVersoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: SgsstDocumento | null;
}

export function DocumentoVersoesDialog({
  open,
  onOpenChange,
  documento,
}: DocumentoVersoesDialogProps) {
  const { versoes, isLoading } = useSgsstDocumentoVersoes(documento?.id);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Versões no R2: {documento?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {documento && (
            <div className="p-3 bg-muted/40 rounded border space-y-1 text-xs sm:text-sm">
              <div className="font-semibold text-primary">Versão Atual: v{documento.versao_atual}</div>
              <div className="text-xs text-muted-foreground truncate">
                Chave R2: <span className="font-mono">{documento.r2_key}</span> | Tamanho: {formatFileSize(documento.tamanho)}
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">Carregando histórico de versões...</TableCell></TableRow>
              ) : versoes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">Nenhuma versão encontrada.</TableCell></TableRow>
              ) : (
                versoes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Badge variant="outline" className={`font-bold font-mono ${v.numero_versao === documento?.versao_atual ? "bg-emerald-50 text-emerald-700 border-emerald-300" : ""}`}>
                        v{v.numero_versao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{formatDateStr(v.created_at)}</TableCell>
                    <TableCell className="text-xs font-mono">{formatFileSize(v.tamanho)}</TableCell>
                    <TableCell className="text-xs">{v.usuario?.nome || "Sistema"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{v.observacao || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-xs gap-1 text-primary"
                        title="Baixar Versão R2"
                      >
                        <a href={v.r2_url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-3.5 w-3.5" /> Baixar
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
