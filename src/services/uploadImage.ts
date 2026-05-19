import { compressImage } from "@/lib/imageCompression";

const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

/**
 * Converte qualquer URL ou caminho relativo para a URL absoluta final no R2,
 * removendo prefixos de buckets antigos do Supabase que não existem mais na estrutura do R2.
 */
export function getPublicUrl(url: string | null | undefined): string {
  if (!url || url.trim() === "") return "";

  let cleanPath = url.trim();

  // 1. Extrai o caminho relativo se for uma URL completa
  if (cleanPath.includes(R2_PUBLIC_BASE_URL)) {
    cleanPath = cleanPath.replace(R2_PUBLIC_BASE_URL, "");
  } else if (cleanPath.includes("supabase.co/storage/v1/object/public/")) {
    const parts = cleanPath.split("/public/");
    if (parts.length > 1) {
      cleanPath = parts[1];
    }
  }

  // 2. Remove / inicial se houver
  if (cleanPath.startsWith("/")) {
    cleanPath = cleanPath.slice(1);
  }

  // 3. Remove prefixos de buckets conhecidos (recursivamente ou via regex para garantir limpeza)
  // No R2, os arquivos migrados costumam estar na raiz do bucket.
  const prefixesToRemove = [
    /^uploads\//,
    /^diario-fotos\//,
    /^dsl-uploads\//,
    /^contratos\//,
    /^clientes\//,
    /^logos\//,
    /^diario-fotos\/[a-f0-9-]+\//, // Novo: Remove pastas de UUID dentro de diario-fotos
    /^[a-f0-9-]+\// // Novo: Remove qualquer UUID inicial (folder do usuário/empresa)
  ];

  let pathChanged = true;
  while (pathChanged) {
    pathChanged = false;
    for (const prefix of prefixesToRemove) {
      if (prefix.test(cleanPath)) {
        cleanPath = cleanPath.replace(prefix, "");
        pathChanged = true;
      }
    }
  }
  
  // 4. Retorna a URL absoluta final no R2
  return `${R2_PUBLIC_BASE_URL}/${cleanPath}`;
}

export function getAbsoluteUrl(url: string | null | undefined): string {
  return getPublicUrl(url);
}

export async function uploadImage(file: File, folder?: "thumb" | "medium" | "original"): Promise<string> {
  let fileToUpload = file;
  
  if (!folder && file.type.startsWith('image/')) {
    fileToUpload = await compressImage(file);
  }

  const formData = new FormData();
  formData.append("file", fileToUpload);
  if (folder) {
    formData.append("folder", folder);
  }

  const workerUrl = "https://obras-upload-api.brunob1198.workers.dev/";
  
  console.log("UPLOAD ATTEMPT:", file.name, (file.size / 1024).toFixed(2), "KB", folder ? `FOLDER: ${folder}` : "");

  const response = await fetch(
    workerUrl,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro upload: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || "Falha upload");
  }

  // O worker retorna o path relativo (ex: "arquivo.pdf"). getPublicUrl gera a URL final.
  return getPublicUrl(data.url);
}

export interface UploadedVariants {
  thumbUrl: string;
  mediumUrl: string;
  originalUrl: string;
}

export async function uploadImageWithVariants(file: File): Promise<UploadedVariants> {
  const { generateImageVariants } = await import("@/lib/generateImageVariants");
  const variants = await generateImageVariants(file);
  
  const [thumbUrl, mediumUrl, originalUrl] = await Promise.all([
    uploadImage(variants.thumb, "thumb"),
    uploadImage(variants.medium, "medium"),
    uploadImage(variants.original, "original")
  ]);

  return { thumbUrl, mediumUrl, originalUrl };
}

export async function verifyImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  return true;
}

export async function deleteImage(url: string): Promise<boolean> {
  if (!url) return false;
  const workerUrl = "https://obras-upload-api.brunob1198.workers.dev";
  try {
    const response = await fetch(
      `${workerUrl}?url=${encodeURIComponent(url)}`,
      { method: "DELETE" }
    );
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Erro ao deletar imagem do R2:", error);
    return false;
  }
}
