import { supabase } from "@/integrations/supabase/client";

export interface CreateChecklistNotificationInput {
  empresa_id: string;
  user_id: string;
  evento:
    | "ATRIBUIDO"
    | "VENCIMENTO_PROXIMO"
    | "ATRASADO"
    | "PLANO_VENCIMENTO"
    | "PLANO_ATRASADO"
    | "CONCLUIDO"
    | "NOVA_APLICACAO_AGENDADA";
  titulo: string;
  mensagem: string;
  entidade_tipo: string;
  entidade_id: string;
  link?: string;
}

export class ChecklistNotificationService {
  /**
   * Envia uma notificação interna para o usuário no SaaS
   */
  static async sendNotification(input: CreateChecklistNotificationInput): Promise<void> {
    const { empresa_id, user_id, evento, titulo, mensagem, entidade_tipo, entidade_id, link } = input;

    try {
      // 1. Gravar em notificacoes geral (usado pelo NotificationsDropdown no header)
      await supabase.from("notificacoes" as any).insert({
        user_id,
        titulo,
        mensagem,
        lida: false,
        link: link || `/medicoes/checklists`,
      });

      // 2. Gravar em checklist_notificacoes específica do módulo
      await supabase.from("checklist_notificacoes" as any).insert({
        empresa_id,
        user_id,
        evento,
        titulo,
        mensagem,
        entidade_tipo,
        entidade_id,
        lida: false,
      });
    } catch (err) {
      console.error("Erro ao registrar notificação interna de checklist:", err);
    }
  }
}
