import { useCallback, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractionResult } from '@/types/extraction';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  results: ExtractionResult[];
  onRemoveFile: (fileName: string) => void;
  isProcessing: boolean;
}

export function FileUploader({ onFilesSelected, results, onRemoveFile, isProcessing }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = '';
  }, [onFilesSelected]);

  const getStatusIcon = (status: ExtractionResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-2 h-2 rounded-full bg-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'success':
        return <div className="w-2 h-2 rounded-full bg-green-500" />;
      case 'error':
        return <div className="w-2 h-2 rounded-full bg-destructive" />;
    }
  };

  const getStatusText = (result: ExtractionResult) => {
    switch (result.status) {
      case 'pending':
        return 'Aguardando...';
      case 'processing':
        return 'Processando...';
      case 'success':
        return 'Extraído com sucesso';
      case 'error':
        return result.error || 'Erro na extração';
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
          isDragOver 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isProcessing && "opacity-50 pointer-events-none"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">
          Arraste e solte seus arquivos PDF aqui
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          ou clique para selecionar arquivos
        </p>
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="file-input"
          disabled={isProcessing}
        />
        <Button asChild variant="outline" disabled={isProcessing}>
          <label htmlFor="file-input" className="cursor-pointer">
            Selecionar PDFs
          </label>
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Arquivos ({results.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((result) => (
              <div
                key={result.fileName}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  result.status === 'error' && "border-destructive/50 bg-destructive/5",
                  result.status === 'success' && "border-green-500/50 bg-green-500/5"
                )}
              >
                <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{result.fileName}</p>
                  <p className={cn(
                    "text-xs",
                    result.status === 'error' ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {getStatusText(result)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  {!isProcessing && (
                    <button
                      onClick={() => onRemoveFile(result.fileName)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
