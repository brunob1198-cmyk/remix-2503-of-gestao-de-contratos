export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Captura a geolocalização do dispositivo através do navegador com suporte a timeout e alta precisão.
 */
export async function getCurrentDeviceLocation(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Navegador não possui suporte a Geolocalização."));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let msg = "Falha ao obter localização.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Permissão de localização foi negada pelo usuário no navegador.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Sinal de localização (GPS) indisponível.";
            break;
          case error.TIMEOUT:
            msg = "Tempo esgotado ao buscar localização do dispositivo.";
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas utilizando a Fórmula de Haversine.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000; // Raio médio da Terra em metros

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Valida se uma localização atual está dentro do raio permitido em metros a partir de um ponto alvo.
 */
export function isWithinRadius(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  allowedRadiusMeters: number
): { inside: boolean; distanceMeters: number } {
  const distanceMeters = calculateHaversineDistanceMeters(currentLat, currentLon, targetLat, targetLon);
  return {
    inside: distanceMeters <= allowedRadiusMeters,
    distanceMeters,
  };
}
