import { compressImage } from "@/lib/imageCompression";

const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

export function getPublicUrl(url: string | null | undefined): string {
  if (!url) return "";

  // Se já for uma URL do R2, retorna como está
  if (url.startsWith(R2_PUBLIC_BASE_URL)) return url;
  
  // Se for uma URL do Supabase, tenta converter para R2
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    const parts = url.split("/public/");
    if (parts.length > 1) {
      const bucketAndPath = parts[1];
      // Se o bucket era 'uploads', remove o prefixo pois no R2 os arquivos estão na raiz
      if (bucketAndPath.startsWith("uploads/")) {
        return `${R2_PUBLIC_BASE_URL}/${bucketAndPath.replace("uploads/", "")}`;
      }
      return `${R2_PUBLIC_BASE_URL}/${bucketAndPath}`;
    }
  }

  // Se já for outra URL absoluta (http), retorna como está
  if (url.startsWith("http")) return url;
  
  // Trata caminhos relativos
  let path = url.startsWith("/") ? url.slice(1) : url;
  
  // Se o caminho começa com 'uploads/', remove o prefixo pois no R2 os arquivos estão na raiz
  if (path.startsWith("uploads/")) {
    path = path.replace("uploads/", "");
  }
  
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
