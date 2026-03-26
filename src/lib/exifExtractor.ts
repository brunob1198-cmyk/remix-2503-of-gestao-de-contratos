import ExifReader from "exifreader";

export interface ExifGeoData {
  latitude: number | null;
  longitude: number | null;
  dateTime: string | null;
  hasGps: boolean;
}

function convertDMSToDecimal(
  dmsValues: { value: number }[],
  ref: string
): number | null {
  if (!dmsValues || dmsValues.length < 3) return null;
  const degrees = dmsValues[0].value || 0;
  const minutes = dmsValues[1].value || 0;
  const seconds = dmsValues[2].value || 0;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") decimal = -decimal;
  return decimal;
}

export async function extractExifGeoData(file: File): Promise<ExifGeoData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer, { expanded: true });

    let latitude: number | null = null;
    let longitude: number | null = null;
    let dateTime: string | null = null;

    // Extract GPS
    if (tags.gps) {
      latitude = tags.gps.Latitude ?? null;
      longitude = tags.gps.Longitude ?? null;
    }

    // Fallback: try raw GPS tags
    if (latitude === null && tags.exif) {
      const latTag = tags.exif.GPSLatitude;
      const latRef = tags.exif.GPSLatitudeRef;
      const lonTag = tags.exif.GPSLongitude;
      const lonRef = tags.exif.GPSLongitudeRef;

      if (latTag && latRef && lonTag && lonRef) {
        latitude = convertDMSToDecimal(
          latTag.value as any,
          (latRef.value as any)?.[0] || latRef.description || "N"
        );
        longitude = convertDMSToDecimal(
          lonTag.value as any,
          (lonRef.value as any)?.[0] || lonRef.description || "E"
        );
      }
    }

    // Extract date
    if (tags.exif) {
      const dateTag =
        tags.exif.DateTimeOriginal ||
        tags.exif.DateTimeDigitized ||
        tags.exif.DateTime;
      if (dateTag) {
        // EXIF date format: "YYYY:MM:DD HH:MM:SS"
        const raw = dateTag.description || String(dateTag.value);
        const isoDate = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
        dateTime = isoDate;
      }
    }

    return {
      latitude,
      longitude,
      dateTime,
      hasGps: latitude !== null && longitude !== null,
    };
  } catch (err) {
    console.warn("EXIF extraction failed:", err);
    return { latitude: null, longitude: null, dateTime: null, hasGps: false };
  }
}
