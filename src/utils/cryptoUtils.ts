/**
 * Cryptographic hashing helper (SHA-256)
 * Funciona tanto em ambientes browser (Web Crypto API) quanto em ambientes de teste (Node / Vitest).
 */

export async function calculateSHA256(data: string | ArrayBuffer | Blob | Uint8Array): Promise<string> {
  let arrayBuffer: ArrayBuffer;

  if (typeof data === "string") {
    const encoder = new TextEncoder();
    arrayBuffer = encoder.encode(data).buffer as ArrayBuffer;
  } else if (data instanceof Blob) {
    arrayBuffer = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else {
    arrayBuffer = data;
  }

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback para Node environment (Vitest)
  try {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(Buffer.from(arrayBuffer)).digest("hex");
  } catch (e) {
    throw new Error("Ambiente não suporta digest de SHA-256");
  }
}
