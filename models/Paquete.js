export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseCoord(v) {
  if (v === null || typeof v === "undefined" || v === "") return NaN;
  const s = String(v).trim().replace(",", ".");
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

// Mantiene compatibilidad con tu frontend actual (idPaquete/id, creadoEn/actualizadoEn)
export function normalizePaquete(input = {}, existing = null) {
  const now = new Date().toISOString();
  const base = existing ? { ...existing } : {};

  const idFinal = (input.idPaquete ?? input.id ?? base.idPaquete ?? base.id ?? "")
    .toString()
    .trim();

  // estado controlado
  const estadoRaw = (input.estado ?? base.estado ?? "pendiente").toString().toLowerCase();
  const estado = ["pendiente", "entregado", "devuelto"].includes(estadoRaw)
    ? estadoRaw
    : "pendiente";

  // coords
  let lat = base.lat ?? null;
  let lng = base.lng ?? null;

  if (typeof input.lat !== "undefined" || typeof input.lng !== "undefined") {
    const latN = parseCoord(input.lat);
    const lngN = parseCoord(input.lng);
    if (isValidLatLng(latN, lngN)) {
      lat = latN;
      lng = lngN;
    } else {
      lat = null;
      lng = null;
    }
  }

  return {
    ...base,

    idPaquete: idFinal || base.idPaquete || base.id || "",
    id: idFinal || base.id || base.idPaquete || "",

    nombreDestinatario: (input.nombreDestinatario ?? input.nombre ?? base.nombreDestinatario ?? base.nombre ?? "Sin nombre")
      .toString()
      .trim(),

    nombre: (input.nombre ?? input.nombreDestinatario ?? base.nombre ?? base.nombreDestinatario ?? "Sin nombre")
      .toString()
      .trim(),

    direccion: (input.direccion ?? base.direccion ?? "").toString().trim(),
    zona: (input.zona ?? base.zona ?? "").toString().trim(),
    telefono: (input.telefono ?? base.telefono ?? "").toString().trim(),

    valorProducto: toNumber(input.valorProducto ?? base.valorProducto ?? 0),
    estado,
    orden: toNumber(input.orden ?? base.orden ?? 0) || (base.orden ?? 0),

    lat,
    lng,

    fechaRegistro: (input.fechaRegistro ?? base.fechaRegistro ?? now.slice(0, 10)).toString(),

    creadoEn: base.creadoEn ?? now,
    actualizadoEn: now,

    horaEntrega: base.horaEntrega ?? null,
    horaDevolucion: base.horaDevolucion ?? null,
  };
}

