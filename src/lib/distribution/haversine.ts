const R = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function centroid(
  points: Array<{ lat: number; lon: number }>,
): { lat: number; lon: number } {
  if (points.length === 0) return { lat: 0, lon: 0 };
  let sLat = 0;
  let sLon = 0;
  for (const p of points) {
    sLat += p.lat;
    sLon += p.lon;
  }
  return { lat: sLat / points.length, lon: sLon / points.length };
}
