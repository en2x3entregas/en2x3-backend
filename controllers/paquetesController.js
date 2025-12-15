import { readPaquetes, writePaquetes, getDataPath } from "../utils/fileStore.js";
import { normalizePaquete, parseCoord, isValidLatLng } from "../models/Paquete.js";
import { geocodeNominatim, sleep } from "../utils/geocode.js";

function findIndexById(arr, id) {
  const sid = String(id);
  return arr.findIndex(p => String(p.id) === sid);
}

export async function listarPaquetes(_req, res) {
  const paquetes = await readPaquetes();
  res.json({ ok: true, count: paquetes.length, data: paquetes, store: getDataPath() });
}

export async function obtenerPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexById(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });
  res.json({ ok: true, data: paquetes[idx] });
}

export async function crearPaquete(req, res) {
  const paquetes = await readPaquetes();

  const nuevo = normalizePaquete(req.body || {}, null);

  if (!nuevo.nombre || !nuevo.direccion) {
    return res.status(400).json({ ok: false, error: "nombre y direccion son obligatorios" });
  }

  // id más robusto (si llegan muchos en el mismo ms)
  nuevo.id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  paquetes.push(nuevo);
  await writePaquetes(paquetes);

  res.status(201).json({ ok: true, data: nuevo });
}

export async function actualizarPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexById(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const actualizado = normalizePaquete(req.body || {}, paquetes[idx]);
  paquetes[idx] = actualizado;

  await writePaquetes(paquetes);
  res.json({ ok: true, data: actualizado });
}

export async function actualizarEstado(req, res) {
  const { estado } = req.body || {};
  const est = String(estado || "").toLowerCase();

  const valid = ["pendiente", "entregado", "devuelto"];
  if (!valid.includes(est)) {
    return res.status(400).json({ ok: false, error: "Estado inválido (pendiente|entregado|devuelto)" });
  }

  const paquetes = await readPaquetes();
  const idx = findIndexById(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const p = { ...paquetes[idx], estado: est, updatedAt: new Date().toISOString() };

  if (est === "entregado") p.horaEntrega = new Date().toISOString();
  if (est === "devuelto") p.horaDevolucion = new Date().toISOString();
  if (est === "pendiente") {
    p.horaEntrega = null;
    p.horaDevolucion = null;
  }

  paquetes[idx] = p;
  await writePaquetes(paquetes);

  res.json({ ok: true, data: p });
}

export async function actualizarCoords(req, res) {
  const lat = parseCoord(req.body?.lat);
  const lng = parseCoord(req.body?.lng);

  if (!isValidLatLng(lat, lng)) {
    return res.status(400).json({
      ok: false,
      error: "Coordenadas inválidas. Lat debe estar entre -90 y 90; Lng entre -180 y 180."
    });
  }

  const paquetes = await readPaquetes();
  const idx = findIndexById(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const p = {
    ...paquetes[idx],
    lat,
    lng,
    updatedAt: new Date().toISOString()
  };

  paquetes[idx] = p;
  await writePaquetes(paquetes);

  res.json({ ok: true, data: p });
}

export async function eliminarPaquete(req, res) {
  const paquetes = await readPaquetes();
  const idx = findIndexById(paquetes, req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const eliminado = paquetes.splice(idx, 1)[0];
  await writePaquetes(paquetes);

  res.json({ ok: true, data: eliminado });
}

export async function geocodificarLote(req, res) {
  const limit = Math.max(1, Math.min(Number(req.body?.limit || 30), 120));
  const force = Boolean(req.body?.force || false);

  const delay = Math.max(800, Number(process.env.GEOCODE_DELAY_MS || 1100));

  const paquetes = await readPaquetes();

  const candidatos = paquetes.filter(p => {
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
        p.updatedAt = new Date().toISOString();
        updated++;
      }
    } catch (e) {
      errors.push({ id: p.id, error: e?.message || "geocode error" });
    }

    // respetar rate limit
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
