
export const UF_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  'AC': { minLat: -11.145, maxLat: -7.111, minLng: -73.99, maxLng: -66.62 },
  'AL': { minLat: -10.5, maxLat: -8.81, minLng: -38.23, maxLng: -35.15 },
  'AM': { minLat: -9.81, maxLat: 2.25, minLng: -73.8, maxLng: -56.09 },
  'AP': { minLat: -1.2, maxLat: 4.43, minLng: -54.8, maxLng: -49.8 },
  'BA': { minLat: -18.34, maxLat: -8.53, minLng: -46.61, maxLng: -37.33 },
  'CE': { minLat: -7.85, maxLat: -2.78, minLng: -41.42, maxLng: -37.24 },
  'DF': { minLat: -16.05, maxLat: -15.5, minLng: -48.28, maxLng: -47.3 },
  'ES': { minLat: -21.3, maxLat: -17.88, minLng: -41.88, maxLng: -39.66 },
  'GO': { minLat: -19.49, maxLat: -12.39, minLng: -53.24, maxLng: -45.92 },
  'MA': { minLat: -10.22, maxLat: -1.04, minLng: -48.75, maxLng: -41.79 },
  'MG': { minLat: -22.92, maxLat: -14.23, minLng: -51.01, maxLng: -39.85 },
  'MS': { minLat: -24.06, maxLat: -17.13, minLng: -58.15, maxLng: -51.11 },
  'MT': { minLat: -18.04, maxLat: -7.34, minLng: -61.64, maxLng: -50.1 },
  'PA': { minLat: -9.84, maxLat: 2.58, minLng: -58.89, maxLng: -46.06 },
  'PB': { minLat: -8.3, maxLat: -6.02, minLng: -38.79, maxLng: -34.79 },
  'PE': { minLat: -9.48, maxLat: -7.35, minLng: -41.35, maxLng: -34.8 },
  'PI': { minLat: -10.92, maxLat: -2.74, minLng: -45.99, maxLng: -40.37 },
  'PR': { minLat: -26.71, maxLat: -22.51, minLng: -54.61, maxLng: -48.02 },
  'RJ': { minLat: -23.36, maxLat: -20.76, minLng: -44.88, maxLng: -40.95 },
  'RN': { minLat: -6.98, maxLat: -4.83, minLng: -38.58, maxLng: -34.97 },
  'RO': { minLat: -13.69, maxLat: -7.96, minLng: -66.81, maxLng: -59.77 },
  'RR': { minLat: -1.58, maxLat: 5.27, minLng: -64.8, maxLng: -58.88 },
  'RS': { minLat: -33.75, maxLat: -27.08, minLng: -57.64, maxLng: -49.69 },
  'SC': { minLat: -29.35, maxLat: -25.92, minLng: -53.83, maxLng: -48.35 },
  'SE': { minLat: -11.57, maxLat: -9.51, minLng: -38.24, maxLng: -36.39 },
  'SP': { minLat: -25.31, maxLat: -19.77, minLng: -53.1, maxLng: -44.16 },
  'TO': { minLat: -13.46, maxLat: -5.16, minLng: -50.74, maxLng: -45.74 },
};

/**
 * Validates if a point is within or very close to a UF boundary.
 * Includes a tolerance offset to handle coordinate rounding/precision issues.
 */
export function isPointInUF(lat: number, lng: number, uf: string, tolerance = 0.05): boolean {
  const bounds = UF_BOUNDS[uf.toUpperCase()];
  if (!bounds) return true; // Fail-safe if UF not in list
  
  return (
    lat >= bounds.minLat - tolerance &&
    lat <= bounds.maxLat + tolerance &&
    lng >= bounds.minLng - tolerance &&
    lng <= bounds.maxLng + tolerance
  );
}
