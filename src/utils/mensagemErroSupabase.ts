/**
 * Traduz o erro do PostgREST/Postgres para uma frase que diz o que fazer.
 *
 * O caso que motivou isto: tentar criar requisição de compra devolvia
 *
 *   Could not find the 'tipo_compra' column of 'requisicoes_compra'
 *   in the schema cache
 *
 * O defeito não estava na tela nem no preenchimento — a coluna simplesmente não
 * existia no banco, porque a migration da fase não tinha sido executada. A
 * mensagem crua não diz isso, e manda quem lê procurar o erro no lugar errado.
 *
 * A regra aqui: quando o erro identifica uma CAUSA acionável, diz a causa e a
 * ação. Quando não identifica, devolve a mensagem original inalterada — inventar
 * uma tradução genérica ("erro ao salvar") esconderia a única pista que havia.
 */

interface ErroSupabase {
  message?: string;
  code?: string;
  details?: string;
}

/** Coluna que o app usa e o banco não tem: migration pendente. */
const COLUNA_AUSENTE = [
  /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i,
  /column ([\w.]+) does not exist/i,
];

/** Tabela inteira ausente: migration pendente. */
const TABELA_AUSENTE = [
  /Could not find the table '(?:public\.)?([^']+)' in the schema cache/i,
  /relation "([^"]+)" does not exist/i,
];

const AVISO_MIGRATION =
  "O banco está atrás do aplicativo: falta rodar a migration desta função. " +
  "Nada foi gravado.";

export function mensagemDeErroSupabase(erro: unknown): string {
  const e = (erro ?? {}) as ErroSupabase;
  const msg = e.message ?? "";

  for (const re of COLUNA_AUSENTE) {
    const m = msg.match(re);
    if (m) {
      const alvo = m[2] ? `${m[2]}.${m[1]}` : m[1];
      return `A coluna "${alvo}" não existe no banco. ${AVISO_MIGRATION}`;
    }
  }

  for (const re of TABELA_AUSENTE) {
    const m = msg.match(re);
    if (m) {
      return `A tabela "${m[1]}" não existe no banco. ${AVISO_MIGRATION}`;
    }
  }

  switch (e.code) {
    case "23505":
      // Índice único. Não é "erro do sistema": o registro já está lá.
      return "Este registro já existe. Confira se não foi lançado duas vezes.";
    case "23503":
      return (
        "O registro está vinculado a outro e não pode ser gravado ou removido assim. " +
        "Desfaça o vínculo primeiro."
      );
    case "23514":
      // Regra de coerência do banco. A mensagem do CHECK costuma nomear a regra,
      // então vale mantê-la à vista.
      return `O valor informado não passa numa regra de coerência do banco.${
        msg ? ` (${msg})` : ""
      }`;
    case "42501":
      return (
        "Sem permissão para esta operação nesta empresa. " +
        "Se você deveria ter acesso, é caso de ajustar o perfil."
      );
    default:
      break;
  }

  // Sem causa reconhecida: devolve o que veio. Uma frase genérica no lugar disto
  // apagaria a única informação disponível.
  return msg || "Não foi possível concluir a operação.";
}
