// backend/routes/paquetesRoutes.js
import express from "express";
import { requireAuth, requireRole } from "../src/middleware/auth.js";
import { TZ } from "../src/config.js";
import { clampNum, safeStr, todayISO, nowIso, makeId } from "../src/utils.js";
import { readPaquetes, writePaquetes } from "../storage/paquetesStore.js";
import { geocodeNominatim, sleep as sleepMs } from "../geocode.js";

const router = express.Router();
const norm = (v) => safeStr(v).toLowerCase();

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function userIdentifiers(user) {
  const u = user || {};
  return uniq([
    norm(u.id),
    norm(u.uid),
    norm(u.cc),
    norm(u.email),
    norm(u.nombre),
    norm(u.name),
  ]);
}

function paqueteAssignedTo(p) {
  const x = p || {};
  return norm(
    x.assignedTo ??
      x.repartidorId ??
      x.repartidorUid ??
      x.repartidorCC ??
      x.repartidor ??
      x.mensajero ??
      x.courier ??
      ""
  );
}

function paqueteDay(p) {
  const x = p || {};
  return safeStr(x.assignedDay || x.dia || x.fechaEntrega || x.fecha || x.fechaPedido || "");
}

function canAccessPaquete(user, p) {
  const role = norm(user?.role);
  if (role === "admin" || role === "store") return true;
  if (role === "messenger") {
    const ids = userIdentifiers(user);
    const assigned = paqueteAssignedTo(p);
    return Boolean(assigned) && ids.includes(assigned);
  }
  return false;
}

function normalizeExistingId(p) {
  if (!p) return p;
  if (p.id) return p;
  if (p._id && !p.id) return { ...p, id: safeStr(p._id) };
  return p;
}

function normalizePaqueteFromBody(body, existing = null) {
  const b = body || {};
  const out = existing ? { ...existing } : { id: makeId(), createdAt: nowIso() };

  // tienda
  if (b.store !== undefined) out.store = safeStr(b.store);
  if (b.tienda !== undefined) out.store = safeStr(b.tienda);
  if (b.tiendaNombre !== undefined) out.store = safeStr(b.tiendaNombre);

  // cliente
  if (b.nombreDestinatario !== undefined) out.cliente = safeStr(b.nombreDestinatario);
  if (b.cliente !== undefined) out.cliente = safeStr(b.cliente);
  if (b.nombre !== undefined && !out.cliente) out.cliente = safeStr(b.nombre);

  // contacto
  if (b.telefono !== undefined) out.telefono = safeStr(b.telefono);
  if (b.phone !== undefined && !out.telefono) out.telefono = safeStr(b.phone);

  // ubicación
  if (b.direccion !== undefined) out.direccion = safeStr(b.direccion);
  if (b.barrio !== undefined) out.barrio = safeStr(b.barrio);
  if (b.ciudad !== undefined) out.ciudad = safeStr(b.ciudad);

  // día
  const dia = safeStr(b.dia || b.fechaEntrega || b.fecha || b.fechaPedido || "");
  if (dia) out.dia = dia;
  else if (!existing && !out.dia) out.dia = todayISO(TZ);

  if (b.assignedDay !== undefined) out.assignedDay = safeStr(b.assignedDay);

  // orden
  if (b.orden !== undefined) {
    const v = clampNum(b.orden, 1, 99999);
    if (v !== null) out.orden = v;
  }

  // asignación
  if (b.assignedTo !== undefined) out.assignedTo = safeStr(b.assignedTo);
  if (b.repartidor !== undefined) out.repartidor = safeStr(b.repartidor);
  if (b.mensajero !== undefined && !out.repartidor) out.repartidor = safeStr(b.mensajero);

  // estado devolución
  if (b.estado !== undefined) out.estado = safeStr(b.estado);
  if (b.motivoDevolucion !== undefined) out.motivoDevolucion = safeStr(b.motivoDevolucion);
  if (b.motivoDevolucionOtro !== undefined) out.motivoDevolucionOtro = safeStr(b.motivoDevolucionOtro);

  // coords
  const lat =
    b.lat ?? b.latitude ?? (b.coords && b.coords.lat) ?? (b.coordenadas && b.coordenadas.lat);
  const lng =
    b.lng ?? b.lon ?? b.longitude ?? (b.coords && b.coords.lng) ?? (b.coordenadas && b.coordenadas.lng);

  if (lat !== null && lng !== null && lat !== "" && lng !== "") {
    const nlat = Number(lat);
    const nlng = Number(lng);
    if (Number.isFinite(nlat) && Number.isFinite(nlng)) out.coords = { lat: nlat, lng: nlng };
  }

  if (b.notes !== undefined) out.notes = safeStr(b.notes);

  out.updatedAt = nowIso();
  return out;
}

function sortForRoute(a, b) {
  const ab = norm(a?.barrio);
  const bb = norm(b?.barrio);
  if (ab !== bb) return ab.localeCompare(bb);

  const ao = Number(a?.orden || 999999);
  const bo = Number(b?.orden || 999999);
  if (ao !== bo) return ao - bo;

  return norm(a?.direccion).localeCompare(norm(b?.direccion));
}

// GET /api/paquetes?day=YYYY-MM-DD
router.get("/", requireAuth, async (req, res) => {
  const user = req.user;
  const day = safeStr(req.query.day || req.query.dia || "");
  const estado = norm(req.query.estado || "");
  const barrio = norm(req.query.barrio || "");

  let list = (await readPaquetes()).map(normalizeExistingId);

  if (day) list = list.filter((p) => paqueteDay(p) === day || safeStr(p.dia) === day);
  if (estado) list = list.filter((p) => norm(p.estado) === estado);
  if (barrio) list = list.filter((p) => norm(p.barrio) === barrio);

  list = list.filter((p) => canAccessPaquete(user, p));
  list.sort(sortForRoute);

  return res.json({ ok: true, list });
});

// POST /api/paquetes (crear)
router.post("/", requireAuth, requireRole(["store", "admin"]), async (req, res) => {
  const b = req.body || {};
  const paquetes = (await readPaquetes()).map(normalizeExistingId);

  const p = normalizePaqueteFromBody(b, null);
  paquetes.push(p);
  await writePaquetes(paquetes);

  return res.status(201).json({ ok: true, paquete: p });
});

// PATCH /api/paquetes/:id (actualizar)
router.patch("/:id", requireAuth, async (req, res) => {
  const id = safeStr(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "id requerido" });

  const user = req.user;
  let paquetes = (await readPaquetes()).map(normalizeExistingId);

  const idx = paquetes.findIndex((x) => safeStr(x.id) === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Paquete no encontrado" });

  const current = paquetes[idx];

  // permisos
  if (!canAccessPaquete(user, current)) {
    return res.status(403).json({ ok: false, error: "Prohibido" });
  }

  // si es messenger, limitar campos que puede cambiar
  const role = norm(user?.role);
  const body = req.body || {};
  let allowedBody = body;

  if (role === "messenger") {
    allowedBody = {
      estado: body.estado,
      motivoDevolucion: body.motivoDevolucion,
      motivoDevolucionOtro: body.motivoDevolucionOtro,
      notes: body.notes,
      lat: body.lat,
      lng: body.lng,
      coords: body.coords,
      orden: body.orden,
    };
  }

  const updated = normalizePaqueteFromBody(allowedBody, current);
  paquetes[idx] = updated;
  await writePaquetes(paquetes);

  return res.json({ ok: true, paquete: updated });
});

// DELETE /api/paquetes/:id
router.delete("/:id", requireAuth, requireRole(["store", "admin"]), async (req, res) => {
  const id = safeStr(req.params.id);
  let paquetes = (await readPaquetes()).map(normalizeExistingId);

  const before = paquetes.length;
  paquetes = paquetes.filter((p) => safeStr(p.id) !== id);

  if (paquetes.length === before) return res.status(404).json({ ok: false, error: "No encontrado" });

  await writePaquetes(paquetes);
  return res.json({ ok: true });
});

// POST /api/paquetes/assign  (admin asigna)
router.post("/assign", requireAuth, requireRole(["admin"]), async (req, res) => {
  const b = req.body || {};
  const ids = Array.isArray(b.ids) ? b.ids.map(safeStr).filter(Boolean) : [];
  const assignedTo = safeStr(b.assignedTo || b.repartidorId || b.uid || "");
  const repartidor = safeStr(b.repartidor || b.nombre || "");
  const assignedDay = safeStr(b.assignedDay || b.day || b.dia || "");

  if (!ids.length || !assignedTo) {
    return res.status(400).json({ ok: false, error: "ids y assignedTo requeridos" });
  }

  const paquetes = (await readPaquetes()).map(normalizeExistingId);
  let changed = 0;

  for (let i = 0; i < paquetes.length; i++) {
    const p = paquetes[i];
    if (ids.includes(safeStr(p.id))) {
      paquetes[i] = {
        ...p,
        assignedTo,
        repartidor: repartidor || p.repartidor || "",
        assignedDay: assignedDay || p.assignedDay || p.dia || todayISO(TZ),
        updatedAt: nowIso(),
      };
      changed++;
    }
  }

  await writePaquetes(paquetes);
  return res.json({ ok: true, changed });
});

// POST /api/paquetes/geocode-missing (admin/store)
router.post("/geocode-missing", requireAuth, requireRole(["store", "admin"]), async (req, res) => {
  const b = req.body || {};
  const day = safeStr(b.day || b.dia || "");
  const limit = Number(b.limit || 10);
  const waitMs = Number(b.sleepMs || 800);

  let paquetes = (await readPaquetes()).map(normalizeExistingId);
  if (day) paquetes = paquetes.filter((p) => safeStr(p.dia) === day || safeStr(p.assignedDay) === day);

  const targets = paquetes.filter((p) => !p.coords?.lat && safeStr(p.direccion)).slice(0, Math.max(1, limit));

  let okCount = 0;
  for (const p of targets) {
    try {
      const r = await geocodeNominatim(`${safeStr(p.direccion)}, ${safeStr(p.ciudad || "Colombia")}`);
      if (r?.lat != null && r?.lng != null) {
        p.coords = { lat: r.lat, lng: r.lng };
        p.updatedAt = nowIso();
        okCount++;
      }
    } catch {
      // ignore
    }
    if (waitMs > 0) await sleepMs(waitMs);
  }

  const all = (await readPaquetes()).map(normalizeExistingId);
  const mapById = new Map(all.map((x) => [safeStr(x.id), x]));
  for (const p of targets) mapById.set(safeStr(p.id), p);

  const merged = Array.from(mapById.values());
  await writePaquetes(merged);

  return res.json({ ok: true, processed: targets.length, geocoded: okCount });
});

export default router;
