export function registerChecklistsServiceWorker(): void {
  if (typeof window === "undefined") return;

  // O service worker antigo era registrado no escopo raiz e armazenava o
  // index.html e chunks de toda a aplicação. Depois de um deploy, esse cache
  // podia restaurar um manifesto antigo que apontava para arquivos já removidos.
  // Removemos somente o worker/cache legado de Checklists; os dados offline em
  // IndexedDB não são afetados.
  const removeLegacyCache = async (): Promise<void> => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => registration.active?.scriptURL.includes("/sw-checklists.js"))
            .map((registration) => registration.unregister()),
        );
      }

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("checklists-pwa-"))
            .map((cacheName) => caches.delete(cacheName)),
        );
      }
    } catch (error) {
      console.warn("[PWA Checklists] Não foi possível remover o cache legado:", error);
    }
  };

  void removeLegacyCache();
}
