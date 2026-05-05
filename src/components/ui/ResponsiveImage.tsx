import React, { useState, useEffect, useRef } from "react";
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
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disable prefetching during print - check if printing media is active
    const isPrinting = window.matchMedia("print").matches;
    if (isPrinting) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px",
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Construct srcset
  const srcset = [
    thumb300 ? `${thumb300} 300w` : null,
    thumb600 ? `${thumb600} 600w` : null,
    `${src} 1200w`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden bg-muted transition-all duration-500", containerClassName)}
    >
      {/* Blur-up placeholder - Always visible in background while loading */}
      {thumb300 && !isLoaded && (
        <img
          src={thumb300}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-70 z-0"
        />
      )}

      {/* Skeleton - Overlays everything until main image finishes */}
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full z-10" />
      )}

      {/* Main Responsive Image */}
      {isVisible && (
        <img
          src={thumb300 || src}
          srcSet={srcset}
          sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px"
          alt={alt}
          className={cn(
            "relative z-20 transition-all duration-700 ease-in-out",
            !isLoaded ? "opacity-0 scale-105 blur-sm" : "opacity-100 scale-100 blur-0",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          {...props}
        />
      )}
    </div>
  );
};
