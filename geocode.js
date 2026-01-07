// backend/geocode.js
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function geocodeNominatim(address) {
  const q = String(address || "").trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "en2x3-backend/1.0 (contact: soporte@en2x3.local)",
      "Accept-Language": "es",
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    displayName: String(first.display_name || ""),
  };
}
