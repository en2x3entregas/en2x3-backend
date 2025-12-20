// src/models/Paquete.js
// ==================================================
// en2x3 Entregas — Normalizador de Paquetes (JSON)
// ==================================================
// No es Mongoose: es un “modelo lógico” para validar/normalizar
// lo que entra/sale del paquetes.json.
// ==================================================

export const parseCoord = (v) => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export const isValidLatLng = (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const safeStr = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const safeNum = (v, fallback = null) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

const normalizeEstado = (v, fallback = "pendiente") => {
  const s = safeStr(v).toLowerCase();
  const map = {
    pendiente: "pendiente",
    "en ruta": "en_ruta",
    enruta: "en_ruta",
    en_ruta: "en_ruta",
    entregado: "entregado",
    entregada: "entregado",
    devuelto: "devuelto",
    devuelta: "devuelto",
    cancelado: "cancelado",
    cancelada: "cancelado",
  };
  return map[s] || fallback;
};

export function normalizePaquete(input = {}, prev = null) {
  const now = new Date().toISOString();

  const id = safeStr(input.idPaquete || input.id || prev?.idPaquete || prev?.id) || undefined;

  const lat = parseCoord(input.lat ?? input.latitude ?? prev?.lat);
  const lng = parseCoord(input.lng ?? input.lon ?? input.longitude ?? prev?.lng);

  const estadoPrev = prev?.estado ? normalizeEstado(prev.estado) : "pendiente";
  const estadoNew = normalizeEstado(input.estado, estadoPrev);

  const out = {
    ...(prev || {}),
    idPaquete: id || prev?.idPaquete,
    id: id || prev?.id,

    codigo: safeStr(input.codigo || input.tracking || prev?.codigo || ""),
    nombreDestinatario: safeStr(
      input.nombreDestinatario || input.nombre || input.destinatario || prev?.nombreDestinatario || prev?.nombre || ""
    ),
    direccion: safeStr(input.direccion || input.address || prev?.direccion || ""),
    zona: safeStr(input.zona || prev?.zona || ""),
    telefono: safeStr(input.telefono || input.celular || prev?.telefono || ""),

    valorProducto: safeNum(input.valorProducto ?? input.valor ?? prev?.valorProducto, prev?.valorProducto ?? null),
    orden: safeNum(input.orden ?? prev?.orden, prev?.orden ?? null),

    estado: estadoNew,

    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,

    notas: safeStr(input.notas || prev?.notas || ""),

    creadoEn: prev?.creadoEn || now,
    actualizadoEn: now,
    fechaRegistro: prev?.fechaRegistro || now,
  };

  // Si vienen coords completas y válidas, perfecto
  if (isValidLatLng(out.lat, out.lng)) {
    // ok
  } else {
    // si no están completas, se quedan como null/number parcial y luego se geocodifica
    if (!Number.isFinite(out.lat)) out.lat = null;
    if (!Number.isFinite(out.lng)) out.lng = null;
  }

  // timestamps por cambio de estado (por si actualizas estado desde update general)
  if (estadoPrev !== estadoNew) {
    if (estadoNew === "entregado") out.horaEntrega = now;
    if (estadoNew === "devuelto") out.horaDevolucion = now;
  }

  return out;
}
