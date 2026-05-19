import { compressImage } from "@/lib/imageCompression";

const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

export function getPublicUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  
  // Se for um caminho relativo que começa com uploads/, anexa o domínio base do R2
  // Caso contrário, assume que é um caminho na raiz do bucket
  const path = url.startsWith("/") ? url.slice(1) : url;
  return `${R2_PUBLIC_BASE_URL}/${path}`;
}

export async function uploadImage(file: File, folder?: "thumb" | "medium" | "original"): Promise<string> {
  let fileToUpload = file;
  
  // Se não for um upload de variante e for uma imagem, aplica a compressão padrão
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
    console.error("UPLOAD ERROR RESPONSE:", errorText);
    throw new Error(`Erro upload: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || "Falha upload");
  }

  // Garantir que retornamos uma URL absoluta
  const uploadedUrl = getPublicUrl(data.url);
  console.log("IMAGE SAVED:", uploadedUrl);

  return uploadedUrl;
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
      {
        method: "DELETE",
      }
    );

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Erro ao deletar imagem do R2:", error);
    return false;
  }
}
