import imageCompression from 'browser-image-compression';

export interface ImageVariants {
  thumb: File;
  medium: File;
  original: File;
}

export async function generateImageVariants(file: File): Promise<ImageVariants> {
  // If it's not an image, we can't generate variants
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  console.log("GENERATING VARIANTS FOR:", file.name, (file.size / 1024).toFixed(2), "KB");

  const baseOptions = {
    useWebWorker: true,
    fileType: "image/webp" as string,
  };

  // THUMB: maxWidthOrHeight: 300, initialQuality: 0.6
  const thumbOptions = {
    ...baseOptions,
    maxWidthOrHeight: 300,
    initialQuality: 0.6,
  };

  // MEDIUM: maxWidthOrHeight: 1200, initialQuality: 0.7
  const mediumOptions = {
    ...baseOptions,
    maxWidthOrHeight: 1200,
    initialQuality: 0.7,
  };

  // ORIGINAL OTIMIZADA: maxWidthOrHeight: 1600, initialQuality: 0.75
  const originalOptions = {
    ...baseOptions,
    maxWidthOrHeight: 1600,
    initialQuality: 0.75,
  };

  try {
    const [thumbBlob, mediumBlob, originalBlob] = await Promise.all([
      imageCompression(file, thumbOptions),
      imageCompression(file, mediumOptions),
      imageCompression(file, originalOptions),
    ]);

    const baseName = file.name.split('.').slice(0, -1).join('.') || 'image';

    const thumb = new File([thumbBlob], `${baseName}_thumb.webp`, { type: 'image/webp' });
    const medium = new File([mediumBlob], `${baseName}_medium.webp`, { type: 'image/webp' });
    const original = new File([originalBlob], `${baseName}_original.webp`, { type: 'image/webp' });

    console.log("THUMB SIZE:", (thumb.size / 1024).toFixed(2), "KB");
    console.log("MEDIUM SIZE:", (medium.size / 1024).toFixed(2), "KB");
    console.log("ORIGINAL SIZE:", (original.size / 1024).toFixed(2), "KB");

    return { thumb, medium, original };
  } catch (error) {
    console.error("VARIANT GENERATION ERROR:", error);
    throw error;
  }
}
