import React from "react";
import { resolveFileUrl } from "@/utils/fileUrlResolver";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  fallbackSrc?: string;
}

/**
 * Componente de imagem que resolve URLs automaticamente e tenta fallback
 * caso a imagem (como uma thumbnail antiga) falhe ao carregar.
 */
export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  fallbackSrc, 
  onError, 
  ...props 
}) => {
  const [currentSrc, setCurrentSrc] = React.useState<string>("");
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setCurrentSrc(resolveFileUrl(src));
    setHasError(false);
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setHasError(true);
      
      // 1. Tentar remover /thumbs/ se existir na URL atual
      if (currentSrc.includes("/thumbs/")) {
        const originalUrl = currentSrc.replace(/\/thumbs\/(300|600|900)\//, "/");
        if (originalUrl !== currentSrc) {
          setCurrentSrc(originalUrl);
          return;
        }
      }

      // 2. Se falhar no R2, tentar no Supabase como fallback de emergência
      if (currentSrc.includes(".r2.dev")) {
        const SUPABASE_BASE = 'https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public';
        const urlObj = new URL(currentSrc);
        const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
        const supabaseFallback = `${SUPABASE_BASE}/${path}`;
        
        if (supabaseFallback !== currentSrc) {
          console.warn("Fallback R2 -> Supabase para:", path);
          setCurrentSrc(supabaseFallback);
          return;
        }
      }

      // 3. Se houver um fallback explícito
      if (fallbackSrc) {
        setCurrentSrc(resolveFileUrl(fallbackSrc));
        return;
      }
    }

    if (onError) {
      onError(e);
    }
  };

  if (!src) return null;

  return (
    <img 
      src={currentSrc} 
      onError={handleError} 
      {...props} 
    />
  );
};
