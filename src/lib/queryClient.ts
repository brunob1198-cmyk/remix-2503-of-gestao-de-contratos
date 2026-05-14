import { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";
import { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

/**
 * Padrões de configuração para queries do React Query
 * staleTime: 2 minutos (dados considerados frescos)
 * gcTime: 10 minutos (tempo que os dados permanecem em cache sem uso)
 */
export const QUERY_DEFAULTS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false as const,
  refetchIntervalInBackground: false,
  retry: 1,
};

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

