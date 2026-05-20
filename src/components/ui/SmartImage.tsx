
import React, { useState, useEffect } from "react";
import { buildPossibleImageUrls } from "@/utils/imageFallbackUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  fallbackUrls?: (string | null | undefined)[];
  containerClassName?: string;
  showSkeleton?: boolean;
}

/**
 * Componente de imagem inteligente com fallback progressivo robusto.
 * Tenta carregar várias versões da imagem (thumb -> original -> fallback)
 * antes de desistir.
 */
export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  fallbackUrls = [],
  className,
  containerClassName,
  showSkeleton = true,
  alt = "Imagem",
  ...props
}) => {
  const [possibleUrls, setPossibleUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailedAll, setHasFailedAll] = useState(false);

  useEffect(() => {
    const urls = buildPossibleImageUrls(src, fallbackUrls);
    setPossibleUrls(urls);
    setCurrentIndex(0);
    setIsLoading(true);
    setHasFailedAll(urls.length === 0);
  }, [src, JSON.stringify(fallbackUrls)]);

  const handleError = () => {
    const nextIndex = currentIndex + 1;
    
    console.log(`[SmartImage] Fallback: falha em ${possibleUrls[currentIndex]}. Tentando ${possibleUrls[nextIndex] || 'nenhuma'}`);

    if (nextIndex < possibleUrls.length) {
      setCurrentIndex(nextIndex);
    } else {
      setIsLoading(false);
      setHasFailedAll(true);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (!src && fallbackUrls.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {isLoading && showSkeleton && (
        <Skeleton className={cn("absolute inset-0 z-10", className)} />
      )}
      
      {!hasFailedAll ? (
        <img
          src={possibleUrls[currentIndex]}
          alt={alt}
          className={cn(
            className,
            isLoading ? "opacity-0" : "opacity-100 transition-opacity duration-300"
          )}
          onError={handleError}
          onLoad={handleLoad}
          loading="lazy"
          {...props}
        />
      ) : (
        <div className={cn("bg-muted flex items-center justify-center text-muted-foreground text-xs p-2", className)}>
          Erro ao carregar imagem
        </div>
      )}
    </div>
  );
};
