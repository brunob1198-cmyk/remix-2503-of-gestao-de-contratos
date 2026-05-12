import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const fileToBase64 = (file: File): Promise<{ base64: string, type: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const [meta, base64] = result.split(',');
        const type = meta.split(':')[1].split(';')[0];
        resolve({ base64, type });
      };
      reader.onerror = reject;
    });
  };

  const extrairContrato = useCallback(async (file: File): Promise<{ data: ContratoExtraido, path: string } | null> => {
    setIsExtracting(true);
    let result: { data: ContratoExtraido, path: string } | null = null;
    
    try {
      const cleanFileName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-zA-Z0-9._-]/g, '_') // only safe chars
        .replace(/_+/g, '_'); // collapse multiple underscores
      const fileName = `${Date.now()}-${cleanFileName}`;
      const filePath = `uploads/${fileName}`;

      console.log('Uploading file to storage:', filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contratos')
        .upload(filePath, file, {
          cacheControl: 'public, max-age=31536000, immutable'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Erro ao salvar arquivo: ${uploadError.message}`);
      }

      console.log('File uploaded, calling extraction function...');
      const { data, error } = await supabase.functions.invoke('extract-contract', {
        body: { 
          filePath: uploadData.path, 
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
        path: uploadData.path 
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
