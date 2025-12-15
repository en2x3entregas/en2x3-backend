export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseCoord(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

// Compatibilidad con tu frontend: idPaquete/id, creadoEn/actualizadoEn
export function normalizePaquete(input = {}, existing = null) {
  const now = new Date().toISOString();
  const base = existing ? { ...existing } : {};

  const idFinal = (input.idPaquete ?? input.id ?? base.idPaquete ?? base.id ?? "")
    .toString()
    .trim();

  return {
    ...base,

    idPaquete: idFinal || base.idPaquete || base.id || "",
    id: idFinal || base.id || base.idPaquete || "",

    nombreDestinatario: (input.nombreDestinatario ?? input.nombre ?? base.nombreDestinatario ?? base.nombre ?? "Sin nombre")
      .toString().trim(),

    nombre: (input.nombre ?? input.nombreDestinatario ?? base.nombre ?? base.nombreDestinatario ?? "Sin nombre")
      .toString().trim(),

    direccion: (input.direccion ?? base.direccion ?? "").toString().trim(),
    zona: (input.zona ?? base.zona ?? "").toString().trim(),
    telefono: (input.telefono ?? base.telefono ?? "").toString().trim(),

    valorProducto: toNumber(input.valorProducto ?? base.valorProducto ?? 0),
    estado: (input.estado ?? base.estado ?? "pendiente").toString().toLowerCase(),
    orden: toNumber(input.orden ?? base.orden ?? 0) || (base.orden ?? 0),

    lat: typeof input.lat !== "undefined" ? input.lat : base.lat ?? null,
    lng: typeof input.lng !== "undefined" ? input.lng : base.lng ?? null,

    creadoEn: base.creadoEn ?? now,
    actualizadoEn: now,

    horaEntrega: base.horaEntrega ?? null,
    horaDevolucion: base.horaDevolucion ?? null
  };
}

