import { compressImage } from "@/lib/compressImage";

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

  const uploadedUrl = data.url;
  console.log("IMAGE SAVED:", uploadedUrl);

  return uploadedUrl;
}

export async function verifyImageUrl(url: string): Promise<boolean> {
  // REMOVED: CORS HEAD check as requested by user.
  // We trust the Worker's response.
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
