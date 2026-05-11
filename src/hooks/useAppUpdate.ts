import { useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import React from "react";

/**
 * Hook to detect application updates by monitoring script hash changes in index.html
 * and prompt the user to refresh.
 */
export const useAppUpdate = () => {
  useEffect(() => {
    // Only run in production
    if (import.meta.env.DEV) return;

    let isChecking = false;
    let currentHash: string | null = null;

    const checkUpdate = async () => {
      if (isChecking) return;
      isChecking = true;

      try {
        // Fetch index.html with a timestamp to bypass browser cache
        const response = await fetch(`/?t=${Date.now()}`, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) throw new Error("Failed to fetch index.html");
        
        const html = await response.text();
        
        // Find the main entry script - usually looks like src="/assets/index-HASH.js"
        // We look for any script that contains 'index-' and '.js'
        const match = html.match(/src="\/assets\/index-([^"]+)\.js"/);
        const newHash = match ? match[1] : null;

        if (currentHash && newHash && currentHash !== newHash) {
          console.log(`Update detected: ${currentHash} -> ${newHash}`);
          
          toast.info("Uma nova versão está disponível!", {
            description: "Clique abaixo para atualizar e carregar as melhorias.",
            duration: Infinity,
            id: "app-update-toast",
            action: {
              label: "Atualizar agora",
              onClick: () => {
                window.location.reload();
              },
            },
            icon: React.createElement(RefreshCw, { className: "h-4 w-4 animate-spin" }),
          });
        }

        if (newHash) {
          currentHash = newHash;
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      } finally {
        isChecking = false;
      }
    };

    // Initial check
    checkUpdate();

    // Check every 5 minutes
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);

    // Also check when the user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
