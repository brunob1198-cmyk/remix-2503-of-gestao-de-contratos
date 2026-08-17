export function registerChecklistsServiceWorker(): void {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw-checklists.js")
        .then((reg) => {
          console.log("[PWA Checklists] Service Worker registrado com sucesso no escopo:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA Checklists] Falha ao registrar Service Worker:", err);
        });
    });
  }
}
