export type SignatureStatus =
  | "PENDENTE"
  | "EM_ASSINATURA"
  | "ASSINADO"
  | "RECUSADO"
  | "CANCELADO"
  | "EXPIRADO"
  | "INVALIDADO";

export type SignatureMethod =
  | "ASSINATURA_ELETRONICA_INTERNA"
  | "GOV_BR"
  | "ICP_BRASIL_FUTURO";

export type SignatureEventName =
  | "SOLICITACAO_CRIADA"
  | "DOCUMENTO_GERADO"
  | "ASSINATURA_INICIADA"
  | "ASSINATURA_CONCLUIDA"
  | "ASSINATURA_RECUSADA"
  | "ASSINATURA_CANCELADA"
  | "DOCUMENTO_BAIXADO"
  | "DOCUMENTO_INVALIDADO";

export interface SignatureRequest {
  id: string;
  empresa_id: string;
  documento_id?: string | null;
  modulo_origem: string;
  entidade_tipo: string;
  entidade_id: string;
  status: SignatureStatus;
  metodo: SignatureMethod;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignatureSigner {
  id: string;
  empresa_id: string;
  signature_request_id: string;
  user_id?: string | null;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  cargo?: string | null;
  empresa_nome?: string | null;
  ordem: number;
  status: "PENDENTE" | "ASSINADO" | "RECUSADO";
  signed_at?: string | null;
  created_at: string;
}

export interface SignatureEvent {
  id: string;
  empresa_id: string;
  signature_request_id: string;
  evento: SignatureEventName;
  usuario_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface SignatureDocument {
  id: string;
  empresa_id: string;
  signature_request_id: string;
  arquivo_original: string;
  arquivo_assinado?: string | null;
  hash_original: string;
  hash_assinado?: string | null;
  tamanho: number;
  mime_type: string;
  created_at: string;
}

export interface PublicSignatureVerification {
  valid: boolean;
  error?: string;
  status?: SignatureStatus;
  id?: string;
  modulo_origem?: string;
  metodo?: SignatureMethod;
  empresa_nome?: string;
  created_at?: string;
  signed_at?: string;
  signer_nome?: string;
  signer_cargo?: string;
  hash_original?: string;
  hash_assinado?: string;
  arquivo_assinado_url?: string;
}
