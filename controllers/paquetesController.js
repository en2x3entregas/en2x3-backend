import { readPaquetes, writePaquetes } from "../utils/fileStore.js";
import { normalizePaquete, parseCoord, isValidLatLng } from "../src/models/Paquete.js";
import { geocodeNominatim, sleep } from "../utils/geocode.js";

function anyId(p) {
  return String(p?.idPaquete ?? p?.id ?? "");
}

function findIndexByAnyId(arr, id) {
  const sid = String(id);
  return arr.findIndex((p) => anyId(p) === sid);
}

// GET /api/paquetes  (devuelve ARRAY para compatibilidad con tu frontend)
export async function listarPaquetes(_req, res) {
  const paquetes = await readPaquetes();
  res.json(paquetes);
}

// GET /api/paquetes/:id
export async function obtenerPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  // ✅ compat: data y paquete
  res.json({ ok: true, data: paquetes[idx], paquete: paquetes[idx] });
}

// POST /api/paquetes
export async function crearPaquete(req, res) {
  const paquetes = await readPaquetes();

  // id robusto
  const newId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const input = { ...(req.body || {}), idPaquete: newId, id: newId };
  let nuevo = normalizePaquete(input, null);

  if (!nuevo.direccion) {
    return res.status(400).json({ ok: false, error: "La dirección es obligatoria." });
  }

  // Geocodifica si NO llegan coords válidas
  const hasCoords = Number.isFinite(nuevo.lat) && Number.isFinite(nuevo.lng);
  if (!hasCoords) {
    const query = [nuevo.direccion, nuevo.zona, "Colombia"].filter(Boolean).join(", ");
    const r = await geocodeNominatim(query);
    if (r?.lat && r?.lng) {
      nuevo.lat = r.lat;
      nuevo.lng = r.lng;
    }
  }

  // orden al final si no viene
  if (!nuevo.orden) nuevo.orden = paquetes.length + 1;

  paquetes.push(nuevo);
  await writePaquetes(paquetes);

  // ✅ compat: data y paquete
  res.status(201).json({ ok: true, data: nuevo, paquete: nuevo });
}

// PUT /api/paquetes/:id
export async function actualizarPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const actualizado = normalizePaquete(req.body || {}, paquetes[idx]);
  paquetes[idx] = actualizado;

  await writePaquetes(paquetes);

  // ✅ compat: data y paquete
  res.json({ ok: true, data: actualizado, paquete: actualizado });
}

// PATCH/PUT /api/paquetes/:id/estado
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

  // ✅ compat: data y paquete
  res.json({ ok: true, data: p, paquete: p });
}

// PUT/PATCH /api/paquetes/:id/coords
export async function actualizarCoords(req, res) {
  const lat = parseCoord(req.body?.lat);
  const lng = parseCoord(req.body?.lng);

  if (!isValidLatLng(lat, lng)) {
    return res.status(400).json({
      ok: false,
      error: "Coordenadas inválidas. Lat -90..90; Lng -180..180.",
    });
  }

  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const p = { ...paquetes[idx], lat, lng, actualizadoEn: new Date().toISOString() };
  paquetes[idx] = p;

  await writePaquetes(paquetes);

  // ✅ compat: data y paquete
  res.json({ ok: true, data: p, paquete: p });
}

// DELETE /api/paquetes/:id
export async function eliminarPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexByAnyId(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

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
      errors.push({ id: anyId(p), error: e?.message || "geocode error" });
    }
    await sleep(delay);
  }

  await writePaquetes(paquetes);

  res.json({
    ok: true,
    scanned: objetivo.length,
    updated,
    skipped: objetivo.length - updated,
    errors,
  });
}





