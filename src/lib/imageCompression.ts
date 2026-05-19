import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file before upload using browser-image-compression library.
 * Outputs WebP.
 */
export async function compressImage(file: File): Promise<File> {
  // If it's not an image, return original file
  if (!file.type.startsWith('image/')) {
    console.log("SKIP COMPRESSION (NOT AN IMAGE):", file.name, file.type);
    return file;
  }

  const options = {
    maxSizeMB: 0.7,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp" as string,
    initialQuality: 0.7,
  };

  try {
    console.log("ORIGINAL SIZE:", (file.size / 1024).toFixed(2), "KB");
    
    const compressedFile = await imageCompression(file, options);
    
    console.log("COMPRESSED SIZE:", (compressedFile.size / 1024).toFixed(2), "KB");
    
    // Create a new file with the .webp extension
    const baseName = file.name.split('.').slice(0, -1).join('.');
    const fileName = `${baseName || 'image'}.webp`;
    
    const finalFile = new File([compressedFile], fileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    return finalFile;
  } catch (error) {
    console.error("COMPRESSION ERROR:", error);
    return file; // Return original on error
  }
}
