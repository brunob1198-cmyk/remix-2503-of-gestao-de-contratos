export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    "https://obras-upload-api.bruno1198.workers.dev",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Erro no upload para o R2");
  }

  return data.url;
}

export async function deleteImage(url: string): Promise<boolean> {
  if (!url) return false;
  
  try {
    // Standard approach for this worker pattern is usually DELETE with the URL or filename
    const response = await fetch(
      `https://obras-upload-api.bruno1198.workers.dev?url=${encodeURIComponent(url)}`,
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
