import { supabase } from "@/integrations/supabase/client";
import { extractExifGeoDataFromArrayBuffer } from "@/lib/exifExtractor";

export interface PhotoCoords {
  lat: number;
  lng: number;
  source: "exif" | "ocr" | "municipio";
}

function isImageUrl(url: string): boolean {
  const cleanUrl = url.split("?")[0].toLowerCase();

  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"].some((ext) => cleanUrl.endsWith(ext));
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

export async function resolvePhotoCoords(url: string, options: { tryOcr?: boolean } = {}): Promise<PhotoCoords | null> {
  const { tryOcr = true } = options;

  if (!isImageUrl(url)) return null;

  if (photoCoordsCache.has(url)) {
    return photoCoordsCache.get(url) ?? null;
  }

  try {
    // Cache banco

    const { data: cached } = await supabase
      .from("foto_geolocalizacao_cache")
      .select("latitude, longitude, source")
      .eq("url", url)
      .maybeSingle();

    if (cached) {
      const result: PhotoCoords = {
        lat: cached.latitude,
        lng: cached.longitude,
        source: cached.source as any,
      };

      photoCoordsCache.set(url, result);

      return result;
    }

    const response = await fetch(url);

    if (!response.ok) {
      photoCoordsCache.set(url, null);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    let result: PhotoCoords | null = null;

    // EXIF

    const exif = extractExifGeoDataFromArrayBuffer(arrayBuffer);

    if (exif.hasGps && exif.latitude !== null && exif.longitude !== null) {
      result = {
        lat: exif.latitude,
        lng: exif.longitude,
        source: "exif",
      };
    }

    // OCR VIA CLOUDFLARE WORKER

    if (!result && tryOcr) {
      try {
        const base64 = arrayBufferToBase64(arrayBuffer);

        const workerResponse = await fetch("https://obras-ai-api.brunob1198.workers.dev/extract-geolocation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64: base64,
          }),
        });

        if (workerResponse.ok) {
          const data = await workerResponse.json();

          if (data?.latitude != null && data?.longitude != null) {
            result = {
              lat: Number(data.latitude),
              lng: Number(data.longitude),
              source: "ocr",
            };
          }
        }
      } catch (e) {
        console.warn("Worker geolocation failed:", e);
      }
    }

    if (result) {
      photoCoordsCache.set(url, result);

      await supabase.from("foto_geolocalizacao_cache").upsert({
        url,
        latitude: result.lat,
        longitude: result.lng,
        source: result.source,
      });

      return result;
    }
  } catch (e) {
    console.warn("Failed to fetch photo for geolocation:", url, e);
  }

  photoCoordsCache.set(url, null);

  return null;
}

export async function resolveCoordsFromPhotos(
  urls: string[],
  options: {
    tryOcr?: boolean;
    maxPhotos?: number;
  } = {},
): Promise<PhotoCoords | null> {
  const { maxPhotos = 3, tryOcr = true } = options;

  for (const url of urls.filter(isImageUrl).slice(0, maxPhotos)) {
    const coords = await resolvePhotoCoords(url, { tryOcr });

    if (coords) {
      return coords;
    }
  }

  return null;
}
