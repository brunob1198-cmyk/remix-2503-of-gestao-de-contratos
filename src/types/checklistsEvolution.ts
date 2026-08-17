export type PeriodicidadeAgendamento =
  | "UNICA"
  | "DIARIA"
  | "SEMANAL"
  | "QUINZENAL"
  | "MENSAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL";

export type StatusAgendamento = "ATIVO" | "PAUSADO" | "ENCERRADO";

export type StatusAgendamentoExecucao =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "ATRASADA"
  | "CANCELADA";

export type ExigirGeolocalizacaoRegra = "nao" | "iniciar" | "finalizar" | "ambos";

export type QRVinculadoTipo =
  | "projeto"
  | "area"
  | "equipamento"
  | "veiculo"
  | "maquina"
  | "ferramenta"
  | "outro";

export interface ChecklistQRCode {
  id: string;
  empresa_id: string;
  token: string;
  checklist_modelo_id: string;
  vinculado_tipo: QRVinculadoTipo;
  vinculado_id?: string | null;
  vinculado_nome?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Computed / Joined
  modelo?: {
    nome: string;
    categoria: string;
    codigo?: string | null;
  };
}

export interface ChecklistGeolocalizacao {
  id: string;
  empresa_id: string;
  aplicacao_id: string;
  momento: "inicio" | "conclusao";
  latitude: number;
  longitude: number;
  precisao?: number | null;
  registrado_em: string;
}

export interface ChecklistAgendamento {
  id: string;
  empresa_id: string;
  checklist_modelo_id: string;
  responsavel_id?: string | null;
  projeto_id?: string | null;
  area_id?: string | null;
  data_inicial: string;
  data_final?: string | null;
  horario: string;
  periodicidade: PeriodicidadeAgendamento;
  prazo_dias: number;
  status: StatusAgendamento;
  exigir_geolocalizacao: boolean;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  modelo?: {
    nome: string;
    categoria: string;
  };
  responsavel?: {
    nome: string;
    email?: string;
  };
  projeto?: {
    nome: string;
    codigo?: string;
  };
}

export interface ChecklistAgendamentoExecucao {
  id: string;
  empresa_id: string;
  agendamento_id: string;
  aplicacao_id?: string | null;
  competencia: string;
  data_prevista: string;
  prazo: string;
  responsavel_id?: string | null;
  status: StatusAgendamentoExecucao;
  created_at: string;
  updated_at: string;
  // Joined
  agendamento?: ChecklistAgendamento;
  responsavel?: {
    nome: string;
  };
}

export interface ChecklistNotificacao {
  id: string;
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
  lida: boolean;
  created_at: string;
}

export interface PublicChecklistQRInfo {
  valid: boolean;
  error?: string;
  token?: string;
  modelo_id?: string;
  modelo_nome?: string;
  modelo_categoria?: string;
  exigir_geolocalizacao?: ExigirGeolocalizacaoRegra;
  vinculado_tipo?: QRVinculadoTipo;
  vinculado_id?: string;
  vinculado_nome?: string;
}
