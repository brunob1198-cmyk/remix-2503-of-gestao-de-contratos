import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { uploadImage } from "@/services/uploadImage";
import { ALLOWED_DOC_EXTENSIONS, MAX_DOC_FILE_SIZE_BYTES } from "@/utils/sgsstDocumentosUtils";

export { ALLOWED_DOC_EXTENSIONS, MAX_DOC_FILE_SIZE_BYTES };

export type CategoriaDocumento =
  | "PGR"
  | "APR"
  | "PT"
  | "INSPECAO"
  | "INCIDENTE"
  | "NAO_CONFORMIDADE"
  | "PCMSO"
  | "ASO"
  | "TREINAMENTO"
  | "EPI"
  | "OUTROS";

export type StatusDocumento = "ATIVO" | "ARQUIVADO" | "CANCELADO";

export interface SgsstDocumento {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string | null;
  categoria: CategoriaDocumento;
  tipo_mime: string;
  tamanho: number;
  r2_key: string;
  r2_url: string;
  entidade_tipo?: CategoriaDocumento | null;
  entidade_id?: string | null;
  versao_atual: number;
  status: StatusDocumento;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  autor?: { id: string; nome: string | null } | null;
}

export interface SgsstDocumentoVersao {
  id: string;
  empresa_id: string;
  documento_id: string;
  numero_versao: number;
  r2_key: string;
  r2_url: string;
  tamanho: number;
  tipo_mime: string;
  usuario_id?: string | null;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export interface SgsstDocumentoHistorico {
  id: string;
  empresa_id: string;
  documento_id?: string | null;
  usuario_id?: string | null;
  operacao: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export interface CreateDocumentoParams {
  file: File;
  nome: string;
  descricao?: string;
  categoria: CategoriaDocumento;
  entidadeTipo?: CategoriaDocumento;
  entidadeId?: string;
}

export interface CreateNovaVersaoParams {
  documentoId: string;
  file: File;
  observacao?: string;
}

// 1. Hook Documentos SGSST
export function useSgsstDocumentos(
  entidadeTipo?: CategoriaDocumento,
  entidadeId?: string,
  params?: { page?: number; pageSize?: number; search?: string; tipo?: string }
) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_documentos", empresaId, entidadeTipo, entidadeId, page, pageSize, params?.search, params?.tipo],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_documentos" as any)
        .select(`
          *,
          autor:profiles!sgsst_documentos_created_by_fkey(id, nome)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (entidadeTipo && entidadeId) {
        query = query.eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId);
      }

      if (params?.search) {
        query = query.or(`nome.ilike.%${params.search}%,codigo.ilike.%${params.search}%`);
      }

      if (params?.tipo && params.tipo !== "todos") {
        query = query.eq("categoria", params.tipo);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);
      if (error) throw error;
      return { rows: (data as SgsstDocumento[]) || [], total: count ?? 0 };
    },
  });

  const uploadDocumento = useMutation({
    mutationFn: async ({ file, nome, descricao, categoria, entidadeTipo, entidadeId }: CreateDocumentoParams) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      // Validate File Size
      if (file.size > MAX_DOC_FILE_SIZE_BYTES) {
        throw new Error("O arquivo excede o limite máximo permitido de 50MB.");
      }

      // Reutiliza o serviço Cloudflare R2 existente (uploadImage)
      const r2Url = await uploadImage(file);
      const r2Key = r2Url.split("/").pop() || file.name;

      const { data: docData, error: docErr } = await (supabase
        .from("sgsst_documentos" as any)
        .insert({
          empresa_id: empresaId,
          nome,
          descricao: descricao || null,
          categoria,
          tipo_mime: file.type || "application/octet-stream",
          tamanho: file.size,
          r2_key: r2Key,
          r2_url: r2Url,
          entidade_tipo: entidadeTipo || null,
          entidade_id: entidadeId || null,
          versao_atual: 1,
          status: "ATIVO",
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (docErr) throw docErr;

      // Inserir Versão 1 em sgsst_documentos_versoes
      await supabase.from("sgsst_documentos_versoes" as any).insert({
        empresa_id: empresaId,
        documento_id: docData.id,
        numero_versao: 1,
        r2_key: r2Key,
        r2_url: r2Url,
        tamanho: file.size,
        tipo_mime: file.type || "application/octet-stream",
        usuario_id: profile?.id,
        observacao: "Upload inicial do documento",
      });

      // Log no histórico
      await supabase.from("sgsst_documentos_historico" as any).insert({
        empresa_id: empresaId,
        documento_id: docData.id,
        usuario_id: profile?.id,
        operacao: "UPLOAD",
        observacao: `Upload inicial [Arquivo: ${file.name}]`,
      });

      return docData as SgsstDocumento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_documentos"] });
      toast.success("Documento enviado e armazenado no Cloudflare R2!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao enviar documento: ${err.message || err}`);
    },
  });

  const uploadNovaVersao = useMutation({
    mutationFn: async ({ documentoId, file, observacao }: CreateNovaVersaoParams) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      if (file.size > MAX_DOC_FILE_SIZE_BYTES) {
        throw new Error("O arquivo excede o limite máximo de 50MB.");
      }

      const { data: docData } = await (supabase
        .from("sgsst_documentos" as any)
        .select("id, versao_atual, nome")
        .eq("id", documentoId)
        .single() as any);

      if (!docData) throw new Error("Documento não encontrado.");

      const proxVersao = (docData.versao_atual || 1) + 1;
      const r2Url = await uploadImage(file);
      const r2Key = r2Url.split("/").pop() || file.name;

      // Inserir nova versão em sgsst_documentos_versoes
      await supabase.from("sgsst_documentos_versoes" as any).insert({
        empresa_id: empresaId,
        documento_id: documentoId,
        numero_versao: proxVersao,
        r2_key: r2Key,
        r2_url: r2Url,
        tamanho: file.size,
        tipo_mime: file.type || "application/octet-stream",
        usuario_id: profile?.id,
        observacao: observacao || `Nova versão v${proxVersao}`,
      });

      // Atualizar metadados principais do documento
      const { data: updatedDoc, error } = await (supabase
        .from("sgsst_documentos" as any)
        .update({
          versao_atual: proxVersao,
          r2_key: r2Key,
          r2_url: r2Url,
          tamanho: file.size,
          tipo_mime: file.type || "application/octet-stream",
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentoId)
        .select()
        .single() as any);

      if (error) throw error;

      // Log no histórico
      await supabase.from("sgsst_documentos_historico" as any).insert({
        empresa_id: empresaId,
        documento_id: documentoId,
        usuario_id: profile?.id,
        operacao: "NOVA_VERSAO",
        observacao: `Nova versão v${proxVersao} carregada no R2`,
      });

      return updatedDoc as SgsstDocumento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_documentos"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_documentos_versoes"] });
      toast.success("Nova versão do documento carregada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao carregar nova versão: ${err.message || err}`);
    },
  });

  const arquivarDocumento = useMutation({
    mutationFn: async (documentoId: string) => {
      const { error } = await (supabase
        .from("sgsst_documentos" as any)
        .update({
          status: "ARQUIVADO",
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentoId) as any);

      if (error) throw error;

      await supabase.from("sgsst_documentos_historico" as any).insert({
        empresa_id: empresaId,
        documento_id: documentoId,
        usuario_id: profile?.id,
        operacao: "ARQUIVAMENTO",
        observacao: "Documento arquivado",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_documentos"] });
      toast.success("Documento arquivado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao arquivar documento: ${err.message || err}`);
    },
  });

  const cancelarDocumento = useMutation({
    mutationFn: async (documentoId: string) => {
      const { error } = await (supabase
        .from("sgsst_documentos" as any)
        .update({
          status: "CANCELADO",
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentoId) as any);

      if (error) throw error;

      await supabase.from("sgsst_documentos_historico" as any).insert({
        empresa_id: empresaId,
        documento_id: documentoId,
        usuario_id: profile?.id,
        operacao: "CANCELAMENTO",
        observacao: "Documento cancelado",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_documentos"] });
      toast.success("Documento cancelado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cancelar documento: ${err.message || err}`);
    },
  });

  return {
    documentos: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    uploadDocumento,
    uploadNovaVersao,
    arquivarDocumento,
    cancelarDocumento,
  };
}

// 2. Hook Versões do Documento
export function useSgsstDocumentoVersoes(documentoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["sgsst_documentos_versoes", documentoId],
    enabled: !!empresaId && !!documentoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_documentos_versoes" as any)
        .select(`
          *,
          usuario:profiles!sgsst_documentos_versoes_usuario_id_fkey(id, nome)
        `)
        .eq("documento_id", documentoId!)
        .order("numero_versao", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstDocumentoVersao[]) || [];
    },
  });

  return {
    versoes,
    isLoading,
  };
}

// 3. Hook Histórico de Auditoria de Documentos
export function useSgsstDocumentosHistorico(documentoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_documentos_historico", documentoId],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_documentos_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_documentos_historico_usuario_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (documentoId) query = query.eq("documento_id", documentoId);

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data as SgsstDocumentoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
