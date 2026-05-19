import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, verifyImageUrl } from '@/services/uploadImage';


export interface ContratoExtraido {
  valor_total: string | null;
  prazo_inicio: string | null;
  prazo_fim: string | null;
  cnpjs_clientes: string[];
  escopo: string | null;
  condicoes_pagamento: string | null;
  garantias: string | null;
  liberacao_garantias: string | null;
  medicoes: string | null;
  multas: string | null;
  reajuste: string | null;
  observacoes: string | null;
}

export function useContractExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();

  const extrairContrato = useCallback(async (file: File): Promise<{ data: ContratoExtraido, path: string } | null> => {
    setIsExtracting(true);
    let result: { data: ContratoExtraido, path: string } | null = null;
    
    try {
      console.log('Uploading file to R2...');
      const publicUrl = await uploadImage(file);


      console.log('File uploaded, calling extraction function...');
      const { data, error } = await supabase.functions.invoke('extract-contract', {
        body: { 
          fileUrl: publicUrl, 
          fileName: file.name
        }
      });


      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha na extração de contrato');
      }

      result = { 
        data: data.data as ContratoExtraido, 
        path: publicUrl 
      };

      
      toast({
        title: 'Leitura concluída',
        description: 'Dados do contrato foram extraídos com sucesso.',
      });

    } catch (error) {
      console.error(`Error processing contract ${file.name}:`, error);
      toast({
        title: 'Erro na leitura do contrato',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao comunicar com a IA.',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
    
    return result;
  }, [toast]);

  return {
    extrairContrato,
    isExtracting,
  };
}
