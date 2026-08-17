import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SignatureService, CreateSignatureRequestInput, SignDocumentInput } from "@/services/SignatureService";
import { toast } from "sonner";

export function useSignatureService(signatureRequestId?: string) {
  const queryClient = useQueryClient();

  const createRequest = useMutation({
    mutationFn: (input: CreateSignatureRequestInput) => SignatureService.createRequest(input),
    onError: (err: any) => {
      toast.error(`Erro ao iniciar solicitação de assinatura: ${err.message || err}`);
    },
  });

  const signDocument = useMutation({
    mutationFn: (input: SignDocumentInput) => SignatureService.sign(input),
    onSuccess: (data) => {
      toast.success("Documento assinado com sucesso e arquivado no Cloudflare R2!");
      queryClient.invalidateQueries({ queryKey: ["signature_request", data.request.id] });
      queryClient.invalidateQueries({ queryKey: ["signature_audit", data.request.id] });
    },
    onError: (err: any) => {
      toast.error(`Falha ao assinar documento: ${err.message || err}`);
    },
  });

  const invalidateSignature = useMutation({
    mutationFn: ({ requestId, motivo, userId }: { requestId: string; motivo: string; userId?: string }) =>
      SignatureService.invalidate(requestId, motivo, userId),
    onSuccess: (_, variables) => {
      toast.warning("Assinatura do documento foi invalidada.");
      queryClient.invalidateQueries({ queryKey: ["signature_request", variables.requestId] });
    },
  });

  const { data: auditEvents = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["signature_audit", signatureRequestId],
    enabled: !!signatureRequestId,
    queryFn: () => SignatureService.getAuditEvents(signatureRequestId!),
  });

  return {
    createRequest,
    signDocument,
    invalidateSignature,
    auditEvents,
    loadingAudit,
  };
}
