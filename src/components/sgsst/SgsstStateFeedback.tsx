import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  DatabaseZap,
  Inbox,
  Loader2,
  Lock,
  RefreshCw,
  WifiOff,
} from "lucide-react";

/**
 * Feedback padronizado das telas SGSST.
 *
 * Antes, uma tabela inexistente, um bloqueio de RLS e uma lista genuinamente
 * vazia produziam a mesma mensagem ("Nenhum registro encontrado"), o que
 * tornava qualquer problema de banco indistinguivel de ausencia de dados.
 * Aqui cada causa recebe titulo, explicacao e acao propria.
 */

type ErrorKind = "schema" | "permissao" | "conexao" | "desconhecido";

interface ClassifiedError {
  kind: ErrorKind;
  titulo: string;
  descricao: string;
  detalhe?: string;
  icon: typeof AlertTriangle;
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
      icon: DatabaseZap,
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
      icon: Lock,
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
      icon: WifiOff,
    };
  }

  return {
    kind: "desconhecido",
    titulo: `Não foi possível carregar ${modulo}`,
    descricao:
      "A consulta falhou por um motivo inesperado. Tente novamente; se persistir, " +
      "encaminhe o detalhe técnico abaixo ao suporte.",
    detalhe,
    icon: AlertTriangle,
  };
}

interface SgsstErrorStateProps {
  error: unknown;
  /** Nome do módulo, usado nas mensagens. Ex.: "PGR", "Inspeções". */
  modulo: string;
  onRetry?: () => void;
  /** Renderiza sem borda/padding próprios, para uso dentro de uma célula de tabela. */
  inline?: boolean;
}

export function SgsstErrorState({ error, modulo, onRetry, inline }: SgsstErrorStateProps) {
  const { titulo, descricao, detalhe, icon: Icon, kind } = classifySgsstError(error, modulo);

  const tone =
    kind === "schema"
      ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
      : kind === "permissao"
        ? "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800"
        : "text-destructive bg-destructive/5 border-destructive/20";

  return (
    <div
      role="alert"
      className={[
        "flex flex-col items-center gap-3 text-center",
        inline ? "py-10 px-4" : "rounded-lg border p-8",
        inline ? "" : tone,
      ].join(" ")}
    >
      <div className={inline ? `rounded-full border p-3 ${tone}` : "rounded-full bg-background/60 p-3"}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>

      <div className="space-y-1.5 max-w-xl">
        <p className="font-semibold text-foreground">{titulo}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
      </div>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-1">
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}

      {detalhe && (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            Detalhe técnico
          </summary>
          <code className="mt-2 block max-w-lg break-words rounded bg-muted px-2 py-1.5 text-left font-mono">
            {detalhe}
          </code>
        </details>
      )}
    </div>
  );
}

interface SgsstEmptyStateProps {
  /** O que não existe ainda. Ex.: "PGR cadastrado". */
  titulo: string;
  descricao?: string;
  /** Botão de criação, quando o usuário tem permissão. */
  action?: ReactNode;
  /** True quando há busca/filtro ativo: muda a mensagem e sugere limpar. */
  filtrado?: boolean;
  onLimparFiltros?: () => void;
}

export function SgsstEmptyState({
  titulo,
  descricao,
  action,
  filtrado,
  onLimparFiltros,
}: SgsstEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-3">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <p className="font-semibold text-foreground">
          {filtrado ? "Nenhum resultado para esses filtros" : titulo}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {filtrado
            ? "Os registros existem, mas nenhum atende à busca e aos filtros aplicados."
            : descricao}
        </p>
      </div>

      {filtrado && onLimparFiltros ? (
        <Button variant="outline" size="sm" onClick={onLimparFiltros} className="gap-2 mt-1">
          <RefreshCw className="h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      ) : (
        action
      )}
    </div>
  );
}

export function SgsstLoadingState({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" aria-live="polite" aria-busy="true">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}…</p>
    </div>
  );
}

/**
 * Resolve os três estados de uma tabela numa única chamada, para as telas não
 * precisarem repetir a cadeia isLoading / error / vazio em cada `<TableBody>`.
 * Retorna null quando há dados e a tabela deve renderizar normalmente.
 */
export function resolveTableState(opts: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  modulo: string;
  onRetry?: () => void;
  emptyTitulo: string;
  emptyDescricao?: string;
  emptyAction?: ReactNode;
  filtrado?: boolean;
  onLimparFiltros?: () => void;
}): ReactNode | null {
  if (opts.isLoading) {
    return <SgsstLoadingState label={`Carregando ${opts.modulo}`} />;
  }
  if (opts.error) {
    return (
      <SgsstErrorState error={opts.error} modulo={opts.modulo} onRetry={opts.onRetry} inline />
    );
  }
  if (opts.isEmpty) {
    return (
      <SgsstEmptyState
        titulo={opts.emptyTitulo}
        descricao={opts.emptyDescricao}
        action={opts.emptyAction}
        filtrado={opts.filtrado}
        onLimparFiltros={opts.onLimparFiltros}
      />
    );
  }
  return null;
}
