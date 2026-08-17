import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/services/uploadImage";
import { generateSignedPDF } from "@/services/pdfSignatureService";
import { calculateSHA256 } from "@/utils/cryptoUtils";
import {
  SignatureRequest,
  SignatureSigner,
  SignatureEvent,
  SignatureDocument,
  SignatureStatus,
  SignatureMethod,
  SignatureEventName,
  PublicSignatureVerification,
} from "@/types/signature";

export interface CreateSignatureRequestInput {
  empresa_id: string;
  documento_id?: string;
  modulo_origem: string; // 'CHECKLISTS', 'APR', 'PT', etc.
  entidade_tipo: string;
  entidade_id: string;
  metodo?: SignatureMethod;
  expires_at?: string;
}

export interface SignDocumentInput {
  signature_request_id: string;
  user_id: string;
  nome: string;
  cpf?: string;
  email?: string;
  cargo?: string;
  empresa_nome: string;
  documento_titulo: string;
  conteudo_resumo?: string;
  ip?: string;
  user_agent?: string;
  metodo?: SignatureMethod;
}

export class SignatureService {
  /**
   * 1. Criar solicitação de assinatura
   */
  static async createRequest(input: CreateSignatureRequestInput): Promise<SignatureRequest> {
    const { empresa_id, documento_id, modulo_origem, entidade_tipo, entidade_id, metodo = "ASSINATURA_ELETRONICA_INTERNA", expires_at } = input;

    const { data: request, error } = await supabase
      .from("signature_requests" as any)
      .insert({
        empresa_id,
        documento_id,
        modulo_origem,
        entidade_tipo,
        entidade_id,
        status: "PENDENTE" as SignatureStatus,
        metodo,
        expires_at,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Erro ao criar solicitação de assinatura:", error);
      throw new Error(`Falha ao criar solicitação de assinatura: ${error.message}`);
    }

    // Registrar evento de auditoria: SOLICITACAO_CRIADA
    await this.recordAuditEvent({
      empresa_id,
      signature_(request as any).id: request.id,
      evento: "SOLICITACAO_CRIADA",
      metadata: { modulo_origem, entidade_tipo, entidade_id, metodo },
    });

    return request as unknown as SignatureRequest;
  }

  /**
   * 2. Assinar documento com Assinatura Eletrônica Interna (fallback gratuito e auditável)
   */
  static async sign(input: SignDocumentInput): Promise<{
    request: SignatureRequest;
    signer: SignatureSigner;
    document: SignatureDocument;
    arquivo_assinado_url: string;
  }> {
    const {
      signature_request_id,
      user_id,
      nome,
      cpf,
      email,
      cargo,
      empresa_nome,
      documento_titulo,
      conteudo_resumo,
      ip,
      user_agent,
      metodo = "ASSINATURA_ELETRONICA_INTERNA",
    } = input;

    // Buscar solicitação existente
    const { data: reqData, error: reqErr } = await supabase
      .from("signature_requests" as any)
      .select("*")
      .eq("id", signature_request_id)
      .single();

    if (reqErr || !reqData) {
      throw new Error("Solicitação de assinatura não encontrada.");
    }

    const request = reqData as unknown as SignatureRequest;

    if (request.status === "INVALIDADO" || request.status === "CANCELADO" || request.status === "EXPIRADO") {
      throw new Error(`Solicitação de assinatura não está ativa. Status atual: ${request.status}`);
    }

    const signedAt = new Date().toISOString();
    const publicVerificationUrl = `${window.location.origin}/verificar-assinatura/${signature_request_id}`;

    // Registrar início do evento
    await this.recordAuditEvent({
      empresa_id: request.empresa_id,
      signature_request_id,
      evento: "ASSINATURA_INICIADA",
      usuario_id: user_id,
      ip,
      user_agent,
      metadata: { metodo, nome, cargo, empresa_nome },
    });

    // Gerar documento PDF final assinado contendo a marca d'água de assinatura, QR Code e Hash SHA-256
    const pdfResult = await generateSignedPDF({
      requestId: signature_request_id,
      documentTitle: documento_titulo,
      signerNome: nome,
      signerCargo: cargo,
      empresaNome: empresa_nome,
      signedAt,
      metodo,
      originalContentSummary: conteudo_resumo,
      verificationUrl: publicVerificationUrl,
    });

    // Upload do arquivo final assinado para Cloudflare R2 utilizando a infraestrutura existente
    const arquivoAssinadoUrl = await uploadImage(pdfResult.pdfFile);

    // Registrar Signatário
    const { data: signerData, error: signerErr } = await supabase
      .from("signature_signers" as any)
      .insert({
        empresa_id: request.empresa_id,
        signature_request_id,
        user_id,
        nome,
        cpf: cpf || null,
        email: email || null,
        cargo: cargo || null,
        empresa_nome,
        ordem: 1,
        status: "ASSINADO",
        signed_at: signedAt,
      })
      .select("*")
      .single();

    if (signerErr) {
      throw new Error(`Erro ao registrar signatário: ${signerErr.message}`);
    }

    // Registrar Documento com Hashes Criptográficos
    const { data: docData, error: docErr } = await supabase
      .from("signature_documents" as any)
      .insert({
        empresa_id: request.empresa_id,
        signature_request_id,
        arquivo_original: arquivoAssinadoUrl,
        arquivo_assinado: arquivoAssinadoUrl,
        hash_original: pdfResult.hashOriginal,
        hash_assinado: pdfResult.hashAssinado,
        tamanho: pdfResult.pdfFile.size,
        mime_type: "application/pdf",
      })
      .select("*")
      .single();

    if (docErr) {
      throw new Error(`Erro ao registrar documento de assinatura: ${docErr.message}`);
    }

    // Atualizar Status da Solicitação para ASSINADO
    const { data: updatedReqData, error: updateErr } = await supabase
      .from("signature_requests" as any)
      .update({
        status: "ASSINADO" as SignatureStatus,
        metodo,
        updated_at: signedAt,
      })
      .eq("id", signature_request_id)
      .select("*")
      .single();

    if (updateErr) {
      throw new Error(`Erro ao atualizar status da assinatura: ${updateErr.message}`);
    }

    // Registrar Evento de Auditoria Concluída
    await this.recordAuditEvent({
      empresa_id: request.empresa_id,
      signature_request_id,
      evento: "ASSINATURA_CONCLUIDA",
      usuario_id: user_id,
      ip,
      user_agent,
      metadata: {
        hash_original: pdfResult.hashOriginal,
        hash_assinado: pdfResult.hashAssinado,
        arquivo_url: arquivoAssinadoUrl,
        metodo,
      },
    });

    return {
      request: updatedReqData as unknown as SignatureRequest,
      signer: signerData as unknown as SignatureSigner,
      document: docData as unknown as SignatureDocument,
      arquivo_assinado_url: arquivoAssinadoUrl,
    };
  }

  /**
   * 3. Invalidar assinatura se o documento for alterado posteriormente
   */
  static async invalidate(signature_request_id: string, motivo: string, usuario_id?: string): Promise<void> {
    const { data: req } = await supabase
      .from("signature_requests" as any)
      .select("empresa_id")
      .eq("id", signature_request_id)
      .single();

    if (!req) return;

    await supabase
      .from("signature_requests" as any)
      .update({ status: "INVALIDADO" as SignatureStatus, updated_at: new Date().toISOString() })
      .eq("id", signature_request_id);

    await this.recordAuditEvent({
      empresa_id: (req as any).empresa_id,
      signature_request_id,
      evento: "DOCUMENTO_INVALIDADO",
      usuario_id,
      metadata: { motivo },
    });
  }

  /**
   * 4. Buscar histórico completo de auditoria
   */
  static async getAuditEvents(signature_request_id: string): Promise<SignatureEvent[]> {
    const { data, error } = await supabase
      .from("signature_events" as any)
      .select("*")
      .eq("signature_request_id", signature_request_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data as unknown as SignatureEvent[]) || [];
  }

  /**
   * 5. Obter validação pública de assinatura (QR Code pública)
   */
  static async getPublicVerification(signature_request_id: string): Promise<PublicSignatureVerification> {
    const { data, error } = await (supabase as any).rpc("get_public_signature_verification", {
      p_request_id: signature_request_id,
    });

    if (error) {
      console.error("Erro ao verificar assinatura via RPC:", error);
      return { valid: false, error: "Falha na verificação pública do documento." };
    }

    return data as unknown as PublicSignatureVerification;
  }

  /**
   * Registrar evento de auditoria imutável
   */
  private static async recordAuditEvent(input: {
    empresa_id: string;
    signature_request_id: string;
    evento: SignatureEventName;
    usuario_id?: string;
    ip?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { empresa_id, signature_request_id, evento, usuario_id, ip, user_agent, metadata } = input;

    await supabase.from("signature_events" as any).insert({
      empresa_id,
      signature_request_id,
      evento,
      usuario_id: usuario_id || null,
      ip: ip || (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1"),
      user_agent: user_agent || (typeof navigator !== "undefined" ? navigator.userAgent : "SaaS App"),
      metadata: metadata || {},
    });
  }
}
