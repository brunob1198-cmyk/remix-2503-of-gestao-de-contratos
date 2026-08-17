import { useState, useEffect } from "react";

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  const statusLabel = isSyncing ? "🟡 Sincronizando" : isOnline ? "🟢 Online" : "🔴 Offline";

  return {
    isOnline,
    isSyncing,
    setIsSyncing,
    statusLabel,
  };
}
