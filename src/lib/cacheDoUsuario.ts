import type { QueryClient } from "@tanstack/react-query";
import { indexedDBPersister } from "@/lib/queryClient";

/**
 * De quem é o cache que está no disco?
 *
 * O QUE ACONTECEU
 *
 * O cache de dados do React Query é gravado no IndexedDB e sobrevive a
 * recarregamentos — o que é o ponto dele. O que faltava era dono: a chave de
 * cada consulta é só `["contratos"]`, `["projetos"]`, sem usuário nem empresa,
 * e o `buster` do persistidor só muda a cada build. Ou seja, o arquivo no disco
 * era o mesmo para qualquer pessoa que usasse aquele navegador, e nada o
 * apagava no logout.
 *
 * Isso produz dois problemas distintos:
 *
 *   1. DADOS SOMEM. Uma consulta que roda sem sessão válida não dá erro: o
 *      Supabase aplica o RLS e devolve lista VAZIA, com sucesso. O React Query
 *      guarda esse `[]` como resposta boa e o persistidor grava no disco. No
 *      login seguinte a tela reidrata o `[]` e mostra "Nenhum contrato
 *      cadastrado", mesmo com tudo intacto no banco.
 *
 *   2. DADOS VAZAM. Duas pessoas no mesmo navegador (o caso de um computador
 *      de obra, ou um tablet compartilhado): a segunda reidrata o cache da
 *      primeira e vê contratos, medições e valores de outra empresa antes de
 *      qualquer consulta nova responder.
 *
 * A REGRA
 *
 * O cache passa a ter dono registrado. Ele só pode ser reaproveitado quando o
 * dono gravado é exatamente o usuário que está entrando. Em qualquer outra
 * situação — ninguém logado, dono diferente, ou dono desconhecido — o cache é
 * descartado, e as telas buscam do servidor.
 *
 * "Dono desconhecido" conta como motivo para descartar de propósito: um cache
 * gravado por uma versão anterior do app não tem como provar de quem é, e
 * adivinhar erraria justamente no caso 2. O custo de descartar é uma busca a
 * mais; o custo de reaproveitar errado é mostrar dado de outra empresa.
 */

/** Chave do localStorage onde fica registrado o dono do cache persistido. */
export const CHAVE_DONO_DO_CACHE = "cache-dono";

export type MotivoDeLimpeza =
  | "sem-usuario"
  | "dono-desconhecido"
  | "outro-usuario";

export interface DecisaoSobreOCache {
  limpar: boolean;
  motivo: MotivoDeLimpeza | null;
}

/**
 * Decide se o cache no disco pode ser reaproveitado pelo usuário que chegou.
 *
 * @param donoGravado  usuário registrado como dono do cache (null se não há registro)
 * @param usuarioAtual usuário da sessão vigente (null quando não há sessão)
 */
export function decidirSobreOCache(
  donoGravado: string | null,
  usuarioAtual: string | null,
): DecisaoSobreOCache {
  if (!usuarioAtual) return { limpar: true, motivo: "sem-usuario" };
  if (!donoGravado) return { limpar: true, motivo: "dono-desconhecido" };
  if (donoGravado !== usuarioAtual) return { limpar: true, motivo: "outro-usuario" };
  return { limpar: false, motivo: null };
}

/**
 * Lê o dono registrado. Devolve null se o armazenamento estiver indisponível
 * — navegação privada, cota estourada, política de site. Nesse caso a decisão
 * acima trata como "dono desconhecido", que é o lado seguro.
 */
export function lerDonoDoCache(): string | null {
  try {
    return localStorage.getItem(CHAVE_DONO_DO_CACHE);
  } catch {
    return null;
  }
}

export function gravarDonoDoCache(usuarioId: string): void {
  try {
    localStorage.setItem(CHAVE_DONO_DO_CACHE, usuarioId);
  } catch {
    // Sem registro o próximo login descarta o cache por precaução. Perder
    // desempenho é aceitável; reaproveitar cache de dono incerto não é.
  }
}

export function esquecerDonoDoCache(): void {
  try {
    localStorage.removeItem(CHAVE_DONO_DO_CACHE);
  } catch {
    // idem
  }
}

/**
 * Aplica a regra acima ao cache real e devolve o motivo, quando limpou.
 *
 * Fica fora do componente de propósito: recebe o `QueryClient` por parâmetro,
 * não captura nada do React e por isso não tem como ficar com uma referência
 * velha de um render anterior.
 */
/**
 * Chave da cópia de leitura do logotipo da empresa.
 *
 * O valor definitivo mora em `empresas.logo_url`; esta cópia existe porque o
 * RDO e o detalhe da medição montam HTML fora do React e leem a chave direto.
 */
export const CHAVE_COPIA_DO_LOGOTIPO = "custom_logo_url";

function esquecerCopiaDoLogotipo(): void {
  try {
    localStorage.removeItem(CHAVE_COPIA_DO_LOGOTIPO);
  } catch {
    // Armazenamento bloqueado: nada a limpar, e falhar aqui derrubaria o login.
  }
}

export function aplicarPoliticaDoCache(
  queryClient: QueryClient,
  usuarioId: string | null,
): MotivoDeLimpeza | null {
  const decisao = decidirSobreOCache(lerDonoDoCache(), usuarioId);

  if (!decisao.limpar) return null;

  queryClient.clear();
  // O persistidor grava de forma assíncrona; não há o que esperar aqui, e uma
  // falha ao apagar não pode derrubar o login.
  void Promise.resolve(indexedDBPersister.removeClient()).catch(() => undefined);

  /*
    A cópia de leitura do logotipo entra na limpeza pelo mesmo motivo do resto:
    ela é da EMPRESA, e trocar de usuário pode trocar de empresa. Deixada para
    trás, o logotipo da empresa anterior apareceria no cabeçalho e, pior, no PDF
    que o RDO monta — que lê esta chave direto, fora do React.

    O valor definitivo está em `empresas.logo_url`; apagar aqui só força o
    próximo login a buscá-lo de novo.
  */
  esquecerCopiaDoLogotipo();

  if (usuarioId) gravarDonoDoCache(usuarioId);
  else esquecerDonoDoCache();

  return decisao.motivo;
}
