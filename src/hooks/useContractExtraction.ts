import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/services/uploadImage";

const WORKER_URL = "https://obras-ai-api.brunob1198.workers.dev/extract-contract";

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

  const extrairContrato = useCallback(
    async (
      file: File,
    ): Promise<{
      data: ContratoExtraido;
      path: string;
    } | null> => {
      setIsExtracting(true);

      let result: {
        data: ContratoExtraido;
        path: string;
      } | null = null;

      try {
        console.log("Uploading file to R2...");

        const publicUrl = await uploadImage(file);

        console.log("Arquivo enviado para o R2:", publicUrl);

        console.log("Chamando Cloudflare Worker...");

        const response = await fetch(WORKER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileUrl: publicUrl,
            fileName: file.name,
          }),
        });

        const data = await response.json();

        console.log("Resposta do Worker:", data);

        if (!response.ok) {
          throw new Error(data.error || "Erro ao comunicar com o Worker");
        }

        if (!data.success) {
          throw new Error(data.error || "Falha na extração do contrato");
        }

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
          description: error instanceof Error ? error.message : "Erro desconhecido ao comunicar com o Worker.",
          variant: "destructive",
        });
      } finally {
        setIsExtracting(false);
      }

      return result;
    },

    [toast],
  );

  return {
    extrairContrato,

    isExtracting,
  };
}
