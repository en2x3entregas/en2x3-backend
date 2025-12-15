export async function geocodeNominatim(query) {
  const ua =
    process.env.GEOCODE_USER_AGENT ||
    "en2x3-entregas/1.0 (admin@en2x3entregas.com)";

  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(query);

  const res = await fetch(url, {
    headers: { "User-Agent": ua, "Accept-Language": "es" }
  });

  if (!res.ok) return null;

  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const item = arr[0];
  const lat = Number(item.lat);
  const lng = Number(item.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    displayName: item.display_name || ""
  };
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
