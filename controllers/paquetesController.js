import { readPaquetes, writePaquetes } from "../utils/fileStore.js";
import { normalizePaquete, parseCoord, isValidLatLng } from "../models/Paquete.js";
import { geocodeNominatim, sleep } from "../utils/geocode.js";

function findIndexByAnyId(arr, id) {
  const sid = String(id);
  return arr.findIndex((p) => String(p.idPaquete ?? p.id) === sid);
}

export async function listarPaquetes(_req, res) {
  const paquetes = await readPaquetes();
  // Compatibilidad: devuelve ARRAY (como tu server.js viejo)
  res.json(paquetes);
}

export async function obtenerPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });
  res.json(paquetes[idx]);
}

// POST /api/paquetes (UPSERT: si existe, actualiza; si no, crea)
export async function crearPaquete(req, res) {
  const paquetes = await readPaquetes();
  const body = req.body || {};

  const candidateId = body.idPaquete || body.id;
  const idx = candidateId ? findIndexByAnyId(paquetes, candidateId) : -1;

  const existing = idx !== -1 ? paquetes[idx] : null;
  const nuevo = normalizePaquete(body, existing);

  if (!nuevo.direccion) {
    return res.status(400).json({ ok: false, error: "La dirección es obligatoria." });
  }

  // Si es nuevo y no trae id, generamos uno robusto
  if (!nuevo.idPaquete) {
    const gen = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    nuevo.idPaquete = gen;
    nuevo.id = gen;
  }

  // NO geocodificamos aquí para evitar bloqueo por rate limit (usa geocode-lote)
  // Si llega lat/lng, se guardan tal cual (el front también tiene coords manuales)

  if (idx !== -1) {
    paquetes[idx] = nuevo;
    await writePaquetes(paquetes);
    return res.status(200).json(nuevo);
  } else {
    // orden automático si no viene
    if (!nuevo.orden) nuevo.orden = paquetes.length + 1;

    paquetes.push(nuevo);
    await writePaquetes(paquetes);
    return res.status(201).json(nuevo);
  }
}

// PUT /api/paquetes/:id (actualización general)
// También funciona si solo mandas {estado:"entregado"} (compatibilidad)
export async function actualizarPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const actualizado = normalizePaquete(req.body || {}, paquetes[idx]);

  // lógica de tiempos según estado
  const est = String(actualizado.estado || "").toLowerCase();
  if (est === "entregado") actualizado.horaEntrega = actualizado.horaEntrega ?? new Date().toISOString();
  if (est === "devuelto") actualizado.horaDevolucion = actualizado.horaDevolucion ?? new Date().toISOString();
  if (est === "pendiente") {
    actualizado.horaEntrega = null;
    actualizado.horaDevolucion = null;
  }

  paquetes[idx] = actualizado;
  await writePaquetes(paquetes);

  res.json(actualizado);
}

// PATCH /api/paquetes/:id/estado
export async function actualizarEstado(req, res) {
  const { estado } = req.body || {};
  const est = String(estado || "").toLowerCase();

  const valid = ["pendiente", "entregado", "devuelto"];
  if (!valid.includes(est)) {
    return res.status(400).json({ ok: false, error: "Estado inválido (pendiente|entregado|devuelto)" });
  }

  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const p = { ...paquetes[idx], estado: est, actualizadoEn: new Date().toISOString() };

  if (est === "entregado") p.horaEntrega = new Date().toISOString();
  if (est === "devuelto") p.horaDevolucion = new Date().toISOString();
  if (est === "pendiente") {
    p.horaEntrega = null;
    p.horaDevolucion = null;
  }

  paquetes[idx] = p;
  await writePaquetes(paquetes);

  res.json(p);
}

// PUT /api/paquetes/:id/coords
export async function actualizarCoords(req, res) {
  const lat = parseCoord(req.body?.lat);
  const lng = parseCoord(req.body?.lng);

  if (!isValidLatLng(lat, lng)) {
    return res.status(400).json({
      ok: false,
      error: "Coordenadas inválidas. Lat -90..90; Lng -180..180."
    });
  }

  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const p = { ...paquetes[idx], lat, lng, actualizadoEn: new Date().toISOString() };
  paquetes[idx] = p;

  await writePaquetes(paquetes);
  res.json(p);
}

// DELETE /api/paquetes/:id
export async function eliminarPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "No encontrado" });

  const eliminado = paquetes.splice(idx, 1)[0];
  await writePaquetes(paquetes);

  res.json({ ok: true, eliminado });
}

// POST /api/paquetes/geocode-lote
export async function geocodificarLote(req, res) {
  const limit = Math.max(1, Math.min(Number(req.body?.limit || 30), 120));
  const force = Boolean(req.body?.force || false);
  const delay = Math.max(800, Number(process.env.GEOCODE_DELAY_MS || 1100));

  const paquetes = await readPaquetes();

  const candidatos = paquetes.filter((p) => {
    const has = Number.isFinite(p.lat) && Number.isFinite(p.lng);
    return force ? true : !has;
  });

  const objetivo = candidatos.slice(0, limit);

  let updated = 0;
  const errors = [];

  for (const p of objetivo) {
    try {
      const query = [p.direccion, p.zona, "Colombia"].filter(Boolean).join(", ");
      const r = await geocodeNominatim(query);

      if (r?.lat && r?.lng) {
        p.lat = r.lat;
        p.lng = r.lng;
        p.actualizadoEn = new Date().toISOString();
        updated++;
      }
    } catch (e) {
      errors.push({ id: p.idPaquete ?? p.id, error: e?.message || "geocode error" });
    }

    await sleep(delay);
  }

  await writePaquetes(paquetes);

  res.json({
    ok: true,
    scanned: objetivo.length,
    updated,
    skipped: objetivo.length - updated,
    errors
  });
}

