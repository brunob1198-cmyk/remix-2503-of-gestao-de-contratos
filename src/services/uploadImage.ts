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
