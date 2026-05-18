export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const workerUrl = "https://obras-upload-api.brunob1198.workers.dev/";
  
  console.log("UPLOAD ATTEMPT:", file.name, file.size);
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
  console.log("UPLOAD RESPONSE:", data);

  if (!data.success) {
    throw new Error(data.error || "Falha upload");
  }

  return data.url;
}

export async function verifyImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(url, { method: "HEAD" });
    console.log("URL VERIFICATION STATUS:", response.status, url);
    return response.ok;
  } catch (error) {
    console.error("URL VERIFICATION FAILED:", error);
    return false;
  }
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
