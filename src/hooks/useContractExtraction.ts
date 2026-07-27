import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/services/uploadImage";
import { supabase } from "@/integrations/supabase/client";

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useContractExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();

  const extrairContrato = useCallback(
    async (
      file: File,
    ): Promise<{
      data: ContratoExtraido;
      path: string;
    } | null> => {
      setIsExtracting(true);
      let result: { data: ContratoExtraido; path: string } | null = null;

      try {
        // 1) Upload do arquivo (R2) para manter o "Arquivo salvo no sistema"
        let publicUrl = "";
        try {
          publicUrl = await uploadImage(file);
          console.log("Arquivo enviado:", publicUrl);
        } catch (uploadErr) {
          console.warn("Falha no upload R2, seguindo apenas com extração via base64:", uploadErr);
        }

        // 2) Converter para base64 e chamar a Edge Function (Lovable AI)
        const base64 = await fileToBase64(file);

        const { data, error } = await supabase.functions.invoke("extract-contract", {
          body: {
            pdfBase64: base64,
            fileName: file.name,
            contentType: file.type || "application/pdf",
          },
        });

        if (error) throw new Error(error.message || "Erro ao chamar a função de extração");
        if (!data?.success) throw new Error(data?.error || "Falha na extração do contrato");

        result = {
          data: data.data as ContratoExtraido,
          path: publicUrl,
        };

        toast({
          title: "Leitura concluída",
          description: "Dados do contrato foram extraídos com sucesso.",
        });
      } catch (error) {
        console.error(`Erro ao processar ${file.name}:`, error);
        toast({
          title: "Erro na leitura do contrato",
          description: error instanceof Error ? error.message : "Erro desconhecido na extração.",
          variant: "destructive",
        });
      } finally {
        setIsExtracting(false);
      }

      return result;
    },
    [toast],
  );

  return { extrairContrato, isExtracting };
}
