import { useState, useEffect, useCallback } from "react";
import { uploadImage } from "@/services/uploadImage";

const LOGO_STORAGE_KEY = "custom_logo_url";

export function useCustomLogo() {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    return localStorage.getItem(LOGO_STORAGE_KEY);
  });

  const uploadLogo = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("O arquivo precisa ser uma imagem");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("A imagem deve ter no máximo 5MB");
    }
    
    const publicUrl = await uploadImage(file);
    localStorage.setItem(LOGO_STORAGE_KEY, publicUrl);
    setCustomLogo(publicUrl);
    return publicUrl;
  }, []);


  const removeLogo = useCallback(() => {
    localStorage.removeItem(LOGO_STORAGE_KEY);
    setCustomLogo(null);
  }, []);

  return { customLogo, uploadLogo, removeLogo };
}
