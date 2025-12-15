// backend/utils/geocode.js
const UA = process.env.GEOCODE_USER_AGENT || "en2x3-entregas/1.0";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

async function getFetch() {
  if (typeof fetch === "function") return fetch; // Node 18+
  const mod = await import("node-fetch"); // fallback si un día Node es viejo
  return mod.default;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function geocodeNominatim(query) {
  const f = await getFetch();

  const url =
    `${NOMINATIM_URL}?` +
    new URLSearchParams({ format: "json", limit: "1", q: query }).toString();

  const res = await f(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es" }
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

