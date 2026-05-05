import { QueryClient } from "@tanstack/react-query";

/**
 * Padrões de configuração para queries do React Query
 * staleTime: 10 minutos (dados considerados frescos)
 * gcTime: 30 minutos (tempo que os dados permanecem em cache sem uso)
 */
export const QUERY_DEFAULTS = {
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  refetchIntervalInBackground: false,
  retry: 1,
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
