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

  // Prefetch logic using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px", // Start loading when 200px close to viewport
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
      {/* Skeleton - Only shown until the main image starts loading or finishes */}
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full z-10" />
      )}

      {/* Blur-up placeholder (using the smallest thumbnail) */}
      {thumb300 && !isLoaded && isVisible && (
        <img
          src={thumb300}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-50 z-0"
        />
      )}

      {/* Main Responsive Image */}
      {isVisible && (
        <img
          src={thumb300 || src}
          srcSet={srcset}
          sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px"
          alt={alt}
          className={cn(
            "transition-all duration-700 ease-in-out",
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
