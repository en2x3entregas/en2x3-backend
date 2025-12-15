export function normalizePaquete(input = {}, existing = null) {
  const now = new Date().toISOString();

  const base = existing ? { ...existing } : {};

  const p = {
    id: base.id ?? String(Date.now()),
    nombre: (input.nombre ?? base.nombre ?? "").toString().trim(),
    direccion: (input.direccion ?? base.direccion ?? "").toString().trim(),
    telefono: (input.telefono ?? base.telefono ?? "").toString().trim(),
    zona: (input.zona ?? base.zona ?? "").toString().trim(),
    valorProducto: toNumber(input.valorProducto ?? base.valorProducto ?? 0),
    estado: (input.estado ?? base.estado ?? "pendiente").toString().toLowerCase(),
    lat: typeof input.lat !== "undefined" ? input.lat : base.lat,
    lng: typeof input.lng !== "undefined" ? input.lng : base.lng,

    createdAt: base.createdAt ?? now,
    updatedAt: now,

    // opcionales útiles
    horaEntrega: base.horaEntrega ?? null,
    horaDevolucion: base.horaDevolucion ?? null
  };

  return p;
}

export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseCoord(v) {
  // soporta "3,4698" y "3.4698"
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
