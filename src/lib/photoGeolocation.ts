import { supabase } from "@/integrations/supabase/client";
import { extractExifGeoDataFromArrayBuffer } from "@/lib/exifExtractor";

export interface PhotoCoords {
  lat: number;
  lng: number;
  source: "exif" | "ocr" | "municipio";
}

function isImageUrl(url: string): boolean {
  const cleanUrl = url.split("?")[0].toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"].some((ext) =>
    cleanUrl.endsWith(ext)
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

const photoCoordsCache = new Map<string, PhotoCoords | null>();

/**
 * Resolve coordinates of a single photo following the priority:
 * 1. EXIF metadata
 * 2. OCR (coordinates written/burned in the image) via AI
 * 3. null (caller may fallback to municipio)
 */
export async function resolvePhotoCoords(
  url: string,
  options: { tryOcr?: boolean } = {}
): Promise<PhotoCoords | null> {
  const { tryOcr = true } = options;
  if (!isImageUrl(url)) return null;
  if (photoCoordsCache.has(url)) return photoCoordsCache.get(url) ?? null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      photoCoordsCache.set(url, null);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();

    // 1. EXIF
    const exif = extractExifGeoDataFromArrayBuffer(arrayBuffer);
    if (exif.hasGps && exif.latitude !== null && exif.longitude !== null) {
      const result: PhotoCoords = {
        lat: exif.latitude,
        lng: exif.longitude,
        source: "exif",
      };
      photoCoordsCache.set(url, result);
      return result;
    }

    // 2. OCR via edge function
    if (tryOcr) {
      try {
        const base64 = arrayBufferToBase64(arrayBuffer);
        const { data, error } = await supabase.functions.invoke(
          "extract-geolocation",
          { body: { imageBase64: base64 } }
        );
        if (!error && data?.latitude != null && data?.longitude != null) {
          const result: PhotoCoords = {
            lat: Number(data.latitude),
            lng: Number(data.longitude),
            source: "ocr",
          };
          photoCoordsCache.set(url, result);
          return result;
        }
      } catch (e) {
        console.warn("OCR geolocation failed:", e);
      }
    }
  } catch (e) {
    console.warn("Failed to fetch photo for geolocation:", url, e);
  }

  photoCoordsCache.set(url, null);
  return null;
}

/**
 * Try to resolve coordinates from a list of photo URLs.
 * Returns the first non-null match.
 */
export async function resolveCoordsFromPhotos(
  urls: string[],
  options: { tryOcr?: boolean; maxPhotos?: number } = {}
): Promise<PhotoCoords | null> {
  const { maxPhotos = 3, tryOcr = true } = options;
  for (const url of urls.filter(isImageUrl).slice(0, maxPhotos)) {
    const coords = await resolvePhotoCoords(url, { tryOcr });
    if (coords) return coords;
  }
  return null;
}
