/**
 * Detects WebP encoding support in the current browser.
 */
function supportsWebP(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Compresses an image file before upload.
 * Defaults tuned for construction site photos (not e-commerce).
 * Outputs WebP when supported, otherwise JPEG.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const useWebP = supportsWebP();
        const outputType = useWebP ? 'image/webp' : 'image/jpeg';
        const ext = useWebP ? '.webp' : '.jpg';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const outputName = `${baseName}${ext}`;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], outputName, {
                type: outputType,
                lastModified: Date.now(),
              });
              if (import.meta.env.DEV) {
                console.log(
                  `Compressão: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${Math.round((1 - compressed.size / file.size) * 100)}% menor)`
                );
              }
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}
