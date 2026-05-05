import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  thumb300?: string | null;
  thumb600?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export const ResponsiveImage = ({
  src,
  thumb300,
  thumb600,
  alt,
  className,
  containerClassName,
  ...props
}: ResponsiveImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Construct srcset
  const srcset = [
    thumb300 ? `${thumb300} 300w` : null,
    thumb600 ? `${thumb600} 600w` : null,
    `${src} 1200w`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("relative overflow-hidden bg-muted", containerClassName)}>
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      <img
        src={thumb300 || src}
        srcSet={srcset}
        sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px"
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          !isLoaded ? "opacity-0" : "opacity-100",
          className
        )}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
        {...props}
      />
    </div>
  );
};
