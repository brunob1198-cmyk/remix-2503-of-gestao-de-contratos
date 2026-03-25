import { FileUploader } from '@/components/FileUploader';
import { DataPreview } from '@/components/DataPreview';
import { usePdfExtraction } from '@/hooks/usePdfExtraction';
import { exportToExcel } from '@/lib/excelExport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download } from 'lucide-react';
import { LogoWithUpload } from '@/components/LogoUploader';
import { useToast } from '@/hooks/use-toast';
import { useRef } from 'react';

export default function Index() {
  const { results, isProcessing, removeFile, clearAll, processFiles } = usePdfExtraction();
  const { toast } = useToast();
  const filesRef = useRef<File[]>([]);

  const handleFilesSelected = (files: File[]) => {
    filesRef.current = [...filesRef.current, ...files];
    processFiles(files);
  };

  const handleExport = () => {
    try {
      exportToExcel(results);
      toast({
        title: 'Exportação concluída',
        description: 'Arquivo Excel baixado com sucesso!',
      });
    } catch (error) {
      toast({
        title: 'Erro na exportação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const hasSuccessfulResults = results.some(r => r.status === 'success');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4 overflow-hidden">
            <LogoWithUpload className="h-16" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Extrator de PDF para Excel
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Faça upload de pedidos de compra em PDF e extraia automaticamente 
            os dados para uma planilha Excel usando inteligência artificial.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Upload Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Upload de Arquivos</CardTitle>
              <CardDescription>
                Arraste PDFs ou clique para selecionar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploader
                onFilesSelected={handleFilesSelected}
                results={results}
                onRemoveFile={removeFile}
                isProcessing={isProcessing}
              />
              
              {results.length > 0 && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Dados Extraídos</CardTitle>
                <CardDescription>
                  Visualize e revise os dados antes de exportar
                </CardDescription>
              </div>
              {hasSuccessfulResults && (
                <Button onClick={handleExport} className="gap-2">
                  <Download className="w-4 h-4" />
                  Exportar Excel
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <DataPreview results={results} />
            </CardContent>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            A IA analisa cada documento e extrai automaticamente: dados do pedido, 
            informações do fornecedor e lista de itens.
          </p>
        </div>
      </div>
    </div>
  );
}
