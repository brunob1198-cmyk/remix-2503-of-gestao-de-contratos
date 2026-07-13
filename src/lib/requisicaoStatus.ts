// Central helper for requisicoes_compra workflow_status labels/variants.
// Use this everywhere in the UI instead of duplicating translation maps.

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const WORKFLOW_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  SUBMITTED: { label: "Aguardando Aprovação", variant: "outline" },
  PENDING_APPROVAL: { label: "Aguardando Aprovação", variant: "outline" },
  QUOTING: { label: "Em Cotação", variant: "outline" },
  QUOTE_COMPLETED: { label: "Cotação Concluída", variant: "outline" },
  APPROVED: { label: "Aprovada", variant: "default" },
  REJECTED: { label: "Rejeitada", variant: "destructive" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  PURCHASE_ORDER_CREATED: { label: "Pedido Emitido", variant: "outline" },
  PURCHASED: { label: "Pedido Emitido", variant: "outline" },
  PARTIALLY_RECEIVED: { label: "Recebimento Parcial", variant: "secondary" },
  RECEIVED: { label: "Recebido", variant: "default" },
  CLOSED: { label: "Encerrada", variant: "default" },
};

export function getStatusLabel(workflow_status?: string | null): string {
  if (!workflow_status) return "—";
  return WORKFLOW_STATUS_MAP[workflow_status]?.label ?? workflow_status;
}

export function getStatusVariant(workflow_status?: string | null): BadgeVariant {
  if (!workflow_status) return "outline";
  return WORKFLOW_STATUS_MAP[workflow_status]?.variant ?? "outline";
}

export const WORKFLOW_STATUS_OPTIONS = Object.entries(WORKFLOW_STATUS_MAP).map(
  ([value, cfg]) => ({ value, label: cfg.label })
);
