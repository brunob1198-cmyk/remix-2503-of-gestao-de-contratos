import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExtractionResult, ExtractedData } from '@/types/extraction';
import { useToast } from '@/hooks/use-toast';

export function usePdfExtraction() {
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const addFiles = useCallback((files: File[]) => {
    const newResults: ExtractionResult[] = files
      .filter(file => !results.some(r => r.fileName === file.name))
      .map(file => ({
        fileName: file.name,
        status: 'pending' as const,
      }));

    if (newResults.length > 0) {
      setResults(prev => [...prev, ...newResults]);
    }
  }, [results]);

  const removeFile = useCallback((fileName: string) => {
    setResults(prev => prev.filter(r => r.fileName !== fileName));
  }, []);

  const clearAll = useCallback(() => {
    setResults([]);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const processFiles = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    
    // Add files first
    addFiles(files);

    for (const file of files) {
      // Update status to processing
      setResults(prev => prev.map(r => 
        r.fileName === file.name ? { ...r, status: 'processing' as const } : r
      ));

      try {
        const base64 = await fileToBase64(file);
        
        const { data, error } = await supabase.functions.invoke('extract-pdf', {
          body: { pdfBase64: base64, fileName: file.name }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.success) {
          throw new Error(data.error || 'Falha na extração');
        }

        setResults(prev => prev.map(r => 
          r.fileName === file.name 
            ? { ...r, status: 'success' as const, data: data.data as ExtractedData }
            : r
        ));

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setResults(prev => prev.map(r => 
          r.fileName === file.name 
            ? { 
                ...r, 
                status: 'error' as const, 
                error: error instanceof Error ? error.message : 'Erro desconhecido' 
              }
            : r
        ));
      }
    }

    setIsProcessing(false);
    
    const successCount = results.filter(r => r.status === 'success').length + 
      files.filter(f => results.find(r => r.fileName === f.name)?.status !== 'error').length;
    
    toast({
      title: 'Processamento concluído',
      description: `${files.length} arquivo(s) processado(s)`,
    });
  }, [addFiles, results, toast]);

  return {
    results,
    isProcessing,
    addFiles,
    removeFile,
    clearAll,
    processFiles,
  };
}
