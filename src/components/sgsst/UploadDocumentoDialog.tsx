import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoriaDocumento } from "@/hooks/sgsst/useSgsstDocumentos";
import { ALLOWED_DOC_EXTENSIONS, MAX_DOC_FILE_SIZE_BYTES } from "@/utils/sgsstDocumentosUtils";
import { UploadCloud, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface UploadDocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoIdForNovaVersao?: string | null;
  defaultCategoria?: CategoriaDocumento;
  defaultEntidadeTipo?: CategoriaDocumento;
  defaultEntidadeId?: string;
  onUpload: (data: {
    file: File;
    nome: string;
    descricao?: string;
    categoria: CategoriaDocumento;
    entidadeTipo?: CategoriaDocumento;
    entidadeId?: string;
    observacaoNovaVersao?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function UploadDocumentoDialog({
  open,
  onOpenChange,
  documentoIdForNovaVersao,
  defaultCategoria = "OUTROS",
  defaultEntidadeTipo,
  defaultEntidadeId,
  onUpload,
  isLoading = false,
}: UploadDocumentoDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDocumento>(defaultCategoria);
  const [observacaoNovaVersao, setObservacaoNovaVersao] = useState("");

  useEffect(() => {
    setFile(null);
    setNome("");
    setDescricao("");
    setCategoria(defaultCategoria || "OUTROS");
    setObservacaoNovaVersao("");
  }, [open, defaultCategoria]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      if (selectedFile.size > MAX_DOC_FILE_SIZE_BYTES) {
        toast.error("O arquivo excede o tamanho máximo permitido de 50MB.");
        return;
      }

      setFile(selectedFile);
      if (!nome) {
        setNome(selectedFile.name.substring(0, selectedFile.name.lastIndexOf(".")) || selectedFile.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Por favor, selecione um arquivo.");
      return;
    }
    if (!nome.trim() && !documentoIdForNovaVersao) return;

    await onUpload({
      file,
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      categoria,
      entidadeTipo: defaultEntidadeTipo,
      entidadeId: defaultEntidadeId,
      observacaoNovaVersao: observacaoNovaVersao.trim() || undefined,
    });

    onOpenChange(false);
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            {documentoIdForNovaVersao ? "Substituir Documento (Nova Versão)" : "Enviar Documento ao Cloudflare R2"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {/* File Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="fileInput">Selecione o Arquivo *</Label>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center hover:bg-muted/30 transition-colors">
              <input
                id="fileInput"
                type="file"
                accept={ALLOWED_DOC_EXTENSIONS.join(",")}
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <div>
                    <span className="font-semibold text-primary block">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)} | {file.type || "Arquivo"}</span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-xs sm:text-sm block">Clique para escolher o arquivo</span>
                    <span className="text-[11px] text-muted-foreground">Formatos suportados: PDF, DOCX, XLSX, PNG, JPG (Máx 50MB)</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {!documentoIdForNovaVersao ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome do Documento *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Laudo PGR 2026 - Canteiro Principal"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cat">Categoria SGSST *</Label>
                  <Select value={categoria} onValueChange={(val: CategoriaDocumento) => setCategoria(val)}>
                    <SelectTrigger id="cat">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PGR">PGR (Programa de Gerenciamento de Riscos)</SelectItem>
                      <SelectItem value="APR">APR (Análise Preliminar de Riscos)</SelectItem>
                      <SelectItem value="PT">PT (Permissão de Trabalho)</SelectItem>
                      <SelectItem value="INSPECAO">Inspeções de Segurança</SelectItem>
                      <SelectItem value="INCIDENTE">Incidentes & Acidentes</SelectItem>
                      <SelectItem value="NAO_CONFORMIDADE">Não Conformidades</SelectItem>
                      <SelectItem value="PCMSO">PCMSO</SelectItem>
                      <SelectItem value="ASO">ASO / Exames Ocupacionais</SelectItem>
                      <SelectItem value="TREINAMENTO">Treinamento / Certificados</SelectItem>
                      <SelectItem value="EPI">EPI / Fichas de Controle</SelectItem>
                      <SelectItem value="OUTROS">Outros / Laudos Gerais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc">Descrição do Documento</Label>
                <Textarea
                  id="desc"
                  placeholder="Resumo dos anexos, escopo técnico, observações da auditoria..."
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="obsVersao">Motivo da Substituição / Observações da Versão</Label>
              <Textarea
                id="obsVersao"
                placeholder="Ex: Atualização de laudo após revisão médica ou assinatura..."
                rows={2}
                value={observacaoNovaVersao}
                onChange={(e) => setObservacaoNovaVersao(e.target.value)}
              />
            </div>
          )}

          <div className="bg-muted/40 p-2.5 rounded border text-[11px] text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <span>Este arquivo será enviado de forma segura para o Cloudflare R2 da sua empresa.</span>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !file}>
              {isLoading ? "Enviando ao R2..." : documentoIdForNovaVersao ? "Substituir & Criar Versão" : "Confirmar Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
