import React from "react";
import { SmartImage } from "./SmartImage";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  fallbackSrc?: string;
  containerClassName?: string;
}

/**
 * Componente legado SafeImage refatorado para usar o SmartImage internamente.
 * Mantido para compatibilidade enquanto a transição para SmartImage é feita.
 */
export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  fallbackSrc, 
  containerClassName,
  ...props 
}) => {
  return (
    <SmartImage 
      src={src} 
      fallbackUrls={fallbackSrc ? [fallbackSrc] : []}
      containerClassName={containerClassName}
      {...props} 
    />
  );
};
