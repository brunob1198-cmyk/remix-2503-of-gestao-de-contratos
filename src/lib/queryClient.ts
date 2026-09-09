import { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";
import { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

/**
 * Padrões de configuração para queries do React Query
 * staleTime: 2 minutos (dados considerados frescos)
 * gcTime: 10 minutos (tempo que os dados permanecem em cache sem uso)
 */
export const QUERY_DEFAULTS = {
  staleTime: 1000 * 60 * 5, // 5 minutos por padrão
  gcTime: 1000 * 60 * 15, // 15 minutos em cache sem uso

  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false as const,
  refetchIntervalInBackground: false,
  retry: 1,
};

/**
 * Buster do cache persistido: muda a cada build (carimbo de horário injetado
 * por `define` em vite.config.ts). Sem isso, o React Query restaura do
 * IndexedDB o resultado de uma consulta ANTIGA — de antes do deploy mais
 * recente — e o navegador de quem já estava com a tela aberta continua vendo
 * dado desatualizado (ex: uma coluna nova que passou a ser buscada) por até
 * `maxAge`, mesmo que o servidor já esteja correto.
 */
export const CACHE_BUSTER =
  typeof __APP_BUILD_TIME__ !== "undefined" ? __APP_BUILD_TIME__ : "dev";

/**
 * Persister customizado usando IndexedDB para maior capacidade e performance
 */
export const indexedDBPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set("react-query-cache", client);
  },
  restoreClient: async () => {
    return await get<PersistedClient>("react-query-cache");
  },
  removeClient: async () => {
    await del("react-query-cache");
  },
};

/**
 * Cria uma instância configurada do QueryClient com persistência desativada para background
 * e flags de refetch padronizadas.
 */
export const createConfiguredQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: QUERY_DEFAULTS,
      mutations: {
        retry: 1,
      },
    },
  });
};

