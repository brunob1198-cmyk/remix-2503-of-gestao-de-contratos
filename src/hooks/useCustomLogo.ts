import { useState, useEffect, useCallback } from "react";

const LOGO_STORAGE_KEY = "custom_logo_url";

export function useCustomLogo() {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    return localStorage.getItem(LOGO_STORAGE_KEY);
  });

  const uploadLogo = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("O arquivo precisa ser uma imagem"));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error("A imagem deve ter no máximo 2MB"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
        setCustomLogo(dataUrl);
        resolve(dataUrl);
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
      reader.readAsDataURL(file);
    });
  }, []);

  const removeLogo = useCallback(() => {
    localStorage.removeItem(LOGO_STORAGE_KEY);
    setCustomLogo(null);
  }, []);

  return { customLogo, uploadLogo, removeLogo };
}
