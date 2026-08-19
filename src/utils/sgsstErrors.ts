/**
 * Classificacao dos erros que as telas SGSST podem receber do Supabase.
 *
 * Antes, uma tabela inexistente, um bloqueio de RLS e uma lista genuinamente
 * vazia produziam a mesma mensagem ("Nenhum registro encontrado"), o que tornava
 * qualquer problema de banco indistinguivel de ausencia de dados. Aqui cada
 * causa recebe titulo, explicacao e acao propria.
 *
 * Fica em utils (e nao junto do componente) porque e logica pura, sem JSX.
 */

export type ErrorKind = "schema" | "permissao" | "conexao" | "desconhecido";

export interface ClassifiedError {
  kind: ErrorKind;
  titulo: string;
  descricao: string;
  detalhe?: string;
}

function readCode(err: unknown): string {
  const e = err as { code?: unknown } | null;
  return e && typeof e.code === "string" ? e.code : "";
}

function readMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as { message?: unknown };
  return typeof e.message === "string" ? e.message : "";
}

export function classifySgsstError(err: unknown, modulo: string): ClassifiedError {
  const code = readCode(err);
  const message = readMessage(err);
  const detalhe = [code, message].filter(Boolean).join(" — ") || undefined;

  // PGRST205: tabela ausente do schema cache do PostgREST.
  // 42P01: undefined_table direto do Postgres.
  const semTabela =
    code === "PGRST205" ||
    code === "42P01" ||
    /does not exist|could not find the table|schema cache/i.test(message);

  if (semTabela) {
    return {
      kind: "schema",
      titulo: `O módulo ${modulo} ainda não foi instalado no banco`,
      descricao:
        "As tabelas deste módulo existem no repositório, mas não foram aplicadas neste ambiente. " +
        "Rode as migrations pendentes (supabase db push) para liberar a tela. Nenhum dado foi perdido.",
      detalhe,
    };
  }

  // 42501: insufficient_privilege. PGRST301: JWT ausente/expirado.
  const semPermissao =
    code === "42501" ||
    code === "PGRST301" ||
    /permission denied|row-level security|acesso negado|jwt/i.test(message);

  if (semPermissao) {
    return {
      kind: "permissao",
      titulo: "Você não tem acesso a estes registros",
      descricao:
        "Sua sessão pode ter expirado ou seu perfil não tem permissão para ver os dados desta empresa. " +
        "Faça login novamente; se o problema continuar, peça liberação ao administrador.",
      detalhe,
    };
  }

  const semRede = /failed to fetch|networkerror|load failed|timeout/i.test(message);

  if (semRede) {
    return {
      kind: "conexao",
      titulo: "Não foi possível falar com o servidor",
      descricao:
        "A conexão caiu no meio da consulta. Verifique sua internet e tente carregar novamente.",
      detalhe,
    };
  }

  return {
    kind: "desconhecido",
    titulo: `Não foi possível carregar ${modulo}`,
    descricao:
      "A consulta falhou por um motivo inesperado. Tente novamente; se persistir, " +
      "encaminhe o detalhe técnico abaixo ao suporte.",
    detalhe,
  };
}
