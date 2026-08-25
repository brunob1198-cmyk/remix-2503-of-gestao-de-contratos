import React from "react";

/**
 * Após um novo deploy, os chunks antigos deixam de existir no CDN e o
 * `import()` dinâmico falha com "Failed to fetch dynamically imported module",
 * resultando em tela branca. Aqui tentamos novamente uma vez e, se ainda falhar,
 * forçamos um reload único (controlado por sessionStorage) para buscar o
 * manifesto atualizado.
 */
const RELOAD_FLAG = "lovable:chunk-reload";

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(
    message,
  );
}

export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      // Segunda tentativa: pode ter sido apenas instabilidade de rede.
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_FLAG);
        return mod;
      } catch (retryError) {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
          // Evita renderizar enquanto a página recarrega.
          return new Promise<{ default: T }>(() => {});
        }
        throw retryError;
      }
    }
  });
}
