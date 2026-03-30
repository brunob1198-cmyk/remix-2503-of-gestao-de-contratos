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

  const extrairContrato = useCallback(async (file: File): Promise<ContratoExtraido | null> => {
    setIsExtracting(true);
    let extractedData: ContratoExtraido | null = null;
    
    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('extract-contract', {
        body: { pdfBase64: base64, fileName: file.name }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha na extração de contrato');
      }

      extractedData = data.data as ContratoExtraido;
      
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
    
    return extractedData;
  }, [toast]);

  return {
    extrairContrato,
    isExtracting,
  };
}
