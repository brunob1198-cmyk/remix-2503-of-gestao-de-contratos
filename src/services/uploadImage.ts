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

export async function uploadImage(file: File): Promise<string> {
  const compressedFile = await compressImage(file);
  
  const formData = new FormData();
  formData.append("file", compressedFile);

  const workerUrl = "https://obras-upload-api.brunob1198.workers.dev/";
  
  console.log("UPLOAD ATTEMPT:", compressedFile.name, (compressedFile.size / 1024).toFixed(2), "KB");
  console.log("UPLOAD URL:", workerUrl);

  const response = await fetch(
    workerUrl,
    {
      method: "POST",
      body: formData,
    }
  );

  console.log("UPLOAD STATUS:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("UPLOAD ERROR RESPONSE:", errorText);
    throw new Error(`Erro upload: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("UPLOAD SUCCESS:", data.url);
  
  if (!data.success) {
    throw new Error(data.error || "Falha upload");
  }

  // Garantir que retornamos uma URL absoluta
  const uploadedUrl = getPublicUrl(data.url);
  console.log("IMAGE SAVED:", uploadedUrl);

  return uploadedUrl;
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
