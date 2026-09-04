import React from "react";

/**
 * Após um novo deploy, os chunks antigos deixam de existir no CDN e o
 * `import()` dinâmico falha com "Failed to fetch dynamically imported module",
 * resultando em tela branca. Aqui tentamos novamente uma vez e, se ainda falhar,
 * forçamos um reload único (controlado por sessionStorage) para buscar o
 * manifesto atualizado.
 */
const RELOAD_FLAG = "lovable:chunk-reload";
/** Janela em que consideramos que o reload já foi tentado para o mesmo deploy. */
const RELOAD_WINDOW_MS = 20_000;

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(
    message,
  );
}

function reloadedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_FLAG);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReload() {
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* storage indisponível: seguimos sem marcar */
  }
}

function clearReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* noop */
  }
}

export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const mod = await factory();
      clearReloadFlag();
      return mod;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      // Segunda tentativa: pode ter sido apenas instabilidade de rede.
      try {
        const mod = await factory();
        clearReloadFlag();
        return mod;
      } catch (retryError) {
        if (!reloadedRecently()) {
          markReload();
          // `reload(true)` não é padrão; trocar a URL força o browser a buscar
          // um index.html novo com o manifesto atualizado.
          const url = new URL(window.location.href);
          url.searchParams.set("_r", String(Date.now()));
          window.location.replace(url.toString());
          // Evita renderizar enquanto a página recarrega.
          return new Promise<{ default: T }>(() => {});
        }
        throw retryError;
      }
    }
  });
}

