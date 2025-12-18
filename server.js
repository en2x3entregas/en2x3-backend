// backend/server.js — en2x3 Entregas (API PRO FINAL UNIFICADA)
// ==========================================================
// ✅ GET /api/paquetes -> ARRAY (compat app.js)
// ✅ POST /api/paquetes -> { ok, paquete }
// ✅ PUT/PATCH /api/paquetes/:id/estado
// ✅ PUT/PATCH /api/paquetes/:id/coords
// ✅ PUT/PATCH /api/paquetes/:id (compat app.js)
// ✅ FIX definitivo: id === idPaquete (nunca se desincronizan)
// ✅ /api/geocode?direccion=...
// ==========================================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Puedes opcionalmente definir DATA_PATH en .env
const DATA_PATH =
  process.env.DATA_PATH?.trim() ||
  path.join(__dirname, "paquetes.json");

// ---------------------
// CORS
// ---------------------
const allowedList =
  ALLOWED_ORIGIN === "*"
    ? "*"
    : ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedList === "*") return cb(null, true);
      if (allowedList.includes(origin)) return cb(null, true);
      return cb(new Error("CORS bloqueado para: " + origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-en2x3-cc",
      "x-en2x3-role",
      "x-en2x3-name",
    ],
  })
);

app.use(express.json({ limit: "2mb" }));

// ---------------------
// Utils
// ---------------------
const nowISO = () => new Date().toISOString();
const safeStr = (v) => String(v ?? "").trim();
const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const genId = () => crypto.randomBytes(10).toString("hex");

function normalizeEstado(e) {
  const s = String(e || "pendiente").toLowerCase();
  if (s === "delivered") return "entregado";
  if (s === "returned") return "devuelto";
  if (s === "pending") return "pendiente";
  if (["pendiente", "entregado", "devuelto"].includes(s)) return s;
  return "pendiente";
}

// fetch compatible (node18+ ya trae fetch, pero dejamos fallback)
async function fetchFn(...args) {
  if (typeof fetch === "function") return fetch(...args);
  const mod = await import("node-fetch");
  return mod.default(...args);
}

// ---------------------
// Helpers JSON file
// ---------------------
async function asegurarArchivo() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, JSON.stringify([], null, 2), "utf8");
  }
}

async function leerPaquetes() {
  await asegurarArchivo();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function guardarPaquetes(paquetes) {
  await fs.writeFile(DATA_PATH, JSON.stringify(paquetes, null, 2), "utf8");
}

// ✅ FIX: encontrar por id O por idPaquete (para no romper nada)
function findIndexByAnyId(paquetes, id) {
  const sid = safeStr(id);
  return paquetes.findIndex(
    (p) => safeStr(p.id) === sid || safeStr(p.idPaquete) === sid
  );
}

// ✅ FIX: el ID real del registro será SIEMPRE idPaquete
function pickUnifiedId(body, paquetes) {
  const incoming = safeStr(
    body?.idPaquete || body?.id || body?._id || body?.codigo || body?.qr || ""
  );

  const id = incoming || genId();

  const exists = paquetes.some(
    (p) => safeStr(p.id) === id || safeStr(p.idPaquete) === id
  );

  // Mejor 409 (duplicado) para no “cambiar” IDs silenciosamente
  return { id, exists };
}

// ---------------------
// Geocode (Nominatim)
// ---------------------
async function geocodeNominatim(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(query);

  const r = await fetchFn(url, {
    headers: {
      "User-Agent": "en2x3-entregas/1.0 (geocode)",
      Accept: "application/json",
    },
  });

  if (!r.ok) throw new Error("Geocode HTTP " + r.status);

  const data = await r.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const item = data[0];
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, provider: "nominatim" };
}

// ---------------------
// Router (montado en /api y / para compat)
// ---------------------
const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, message: "En2x3 backend funcionando ✅" });
});

// ✅ 1) GET /api/paquetes (ARRAY)
router.get("/paquetes", async (_req, res, next) => {
  try {
    const paquetes = await leerPaquetes();
    res.json(paquetes);
  } catch (e) {
    next(e);
  }
});

// ✅ 2) POST /api/paquetes
router.post("/paquetes", async (req, res, next) => {
  try {
    const body = req.body || {};
    const paquetes = await leerPaquetes();

    const { id, exists } = pickUnifiedId(body, paquetes);
    if (exists) {
      return res.status(409).json({ ok: false, error: "ID duplicado (ya existe ese paquete)." });
    }

    const nombreFinal = safeStr(body.nombreDestinatario || body.nombre || body.destinatario);
    const direccionFinal = safeStr(body.direccion || body.address);
    const zonaFinal = safeStr(body.zona);

    const latN = body.lat !== undefined ? num(body.lat, NaN) : NaN;
    const lngN = body.lng !== undefined ? num(body.lng, NaN) : NaN;

    const nuevo = {
      // ✅ FIX definitivo:
      id,          // backend key
      idPaquete: id, // frontend key (mismo valor)

      // opcionales/compat
      codigo: safeStr(body.codigo || body.qr || ""),
      nombreDestinatario: nombreFinal || undefined,
      nombre: nombreFinal || undefined,
      destinatario: nombreFinal || undefined,
      direccion: direccionFinal || "",
      address: direccionFinal || "",
      zona: zonaFinal || "",
      telefono: safeStr(body.telefono),
      valorProducto: num(body.valorProducto, 0),

      estado: normalizeEstado(body.estado),
      orden:
        body.orden !== undefined && body.orden !== ""
          ? num(body.orden, paquetes.length + 1)
          : paquetes.length + 1,

      lat: Number.isFinite(latN) ? latN : null,
      lng: Number.isFinite(lngN) ? lngN : null,

      fechaRegistro: new Date().toISOString().slice(0, 10),
      creadoEn: nowISO(),
      actualizadoEn: nowISO(),
      horaEntrega: body.horaEntrega || null,
      horaDevolucion: body.horaDevolucion || null,
      notas: safeStr(body.notas || ""),
    };

    paquetes.push(nuevo);
    await guardarPaquetes(paquetes);

    res.status(201).json({ ok: true, paquete: nuevo });
  } catch (e) {
    next(e);
  }
});

// ✅ PUT/PATCH /api/paquetes/:id (compat con tu app.js: manda {estado})
async function handlerActualizarPaquete(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const paquetes = await leerPaquetes();
    const idx = findIndexByAnyId(paquetes, id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "No existe" });

    const p = paquetes[idx];

    const estado = body.estado !== undefined ? normalizeEstado(body.estado) : normalizeEstado(p.estado);

    const patch = {
      // NO permitimos cambiar id/idPaquete
      codigo: body.codigo !== undefined ? safeStr(body.codigo) : p.codigo,
      nombreDestinatario:
        body.nombreDestinatario !== undefined
          ? safeStr(body.nombreDestinatario)
          : safeStr(body.nombre ?? body.destinatario ?? p.nombreDestinatario),
      nombre:
        body.nombre !== undefined
          ? safeStr(body.nombre)
          : safeStr(body.nombreDestinatario ?? body.destinatario ?? p.nombre),
      destinatario:
        body.destinatario !== undefined
          ? safeStr(body.destinatario)
          : safeStr(body.nombreDestinatario ?? body.nombre ?? p.destinatario),
      direccion: body.direccion !== undefined ? safeStr(body.direccion) : p.direccion,
      address: body.address !== undefined ? safeStr(body.address) : safeStr(body.direccion ?? p.address),
      zona: body.zona !== undefined ? safeStr(body.zona) : p.zona,
      telefono: body.telefono !== undefined ? safeStr(body.telefono) : p.telefono,
      valorProducto: body.valorProducto !== undefined ? num(body.valorProducto, 0) : num(p.valorProducto, 0),
      orden: body.orden !== undefined ? num(body.orden, p.orden) : p.orden,
      estado,
      notas: body.notas !== undefined ? safeStr(body.notas) : safeStr(p.notas || ""),
    };

    if (body.lat !== undefined) patch.lat = Number.isFinite(num(body.lat, NaN)) ? num(body.lat) : null;
    if (body.lng !== undefined) patch.lng = Number.isFinite(num(body.lng, NaN)) ? num(body.lng) : null;

    // Horas coherentes si cambia estado
    const prev = normalizeEstado(p.estado);
    if (estado !== prev) {
      if (estado === "entregado") {
        patch.horaEntrega = body.horaEntrega || nowISO();
        patch.horaDevolucion = null;
      } else if (estado === "devuelto") {
        patch.horaDevolucion = body.horaDevolucion || nowISO();
        patch.horaEntrega = null;
      } else {
        patch.horaEntrega = null;
        patch.horaDevolucion = null;
      }
    } else {
      if (body.horaEntrega !== undefined) patch.horaEntrega = body.horaEntrega || null;
      if (body.horaDevolucion !== undefined) patch.horaDevolucion = body.horaDevolucion || null;
    }

    paquetes[idx] = { ...p, ...patch, actualizadoEn: nowISO() };
    await guardarPaquetes(paquetes);

    res.json({ ok: true, paquete: paquetes[idx] });
  } catch (e) {
    next(e);
  }
}

router.put("/paquetes/:id", handlerActualizarPaquete);
router.patch("/paquetes/:id", handlerActualizarPaquete);

// ✅ 3) PUT/PATCH /api/paquetes/:id/estado
async function handlerEstado(req, res, next) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};
    const est = normalizeEstado(estado);

    const paquetes = await leerPaquetes();
    const idx = findIndexByAnyId(paquetes, id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "No existe" });

    const p = paquetes[idx];
    const nuevo = { ...p, estado: est, actualizadoEn: nowISO() };

    if (est === "entregado") {
      nuevo.horaEntrega = nowISO();
      nuevo.horaDevolucion = null;
    } else if (est === "devuelto") {
      nuevo.horaDevolucion = nowISO();
      nuevo.horaEntrega = null;
    } else {
      nuevo.horaEntrega = null;
      nuevo.horaDevolucion = null;
    }

    paquetes[idx] = nuevo;
    await guardarPaquetes(paquetes);

    res.json({ ok: true, paquete: nuevo });
  } catch (e) {
    next(e);
  }
}

router.put("/paquetes/:id/estado", handlerEstado);
router.patch("/paquetes/:id/estado", handlerEstado);

// ✅ 4) PUT/PATCH /api/paquetes/:id/coords
async function handlerCoords(req, res, next) {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body || {};

    const la = num(lat, NaN);
    const ln = num(lng, NaN);

    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      return res.status(400).json({ ok: false, error: "lat/lng inválidos" });
    }

    const paquetes = await leerPaquetes();
    const idx = findIndexByAnyId(paquetes, id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "No existe" });

    paquetes[idx] = { ...paquetes[idx], lat: la, lng: ln, actualizadoEn: nowISO() };
    await guardarPaquetes(paquetes);

    res.json({ ok: true, paquete: paquetes[idx] });
  } catch (e) {
    next(e);
  }
}

router.put("/paquetes/:id/coords", handlerCoords);
router.patch("/paquetes/:id/coords", handlerCoords);

// DELETE /api/paquetes/:id
router.delete("/paquetes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const paquetes = await leerPaquetes();
    const idx = findIndexByAnyId(paquetes, id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "No existe" });

    paquetes.splice(idx, 1);
    await guardarPaquetes(paquetes);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ✅ Geocode (para tu app.js)
router.get("/geocode", async (req, res) => {
  const direccion = safeStr(req.query.direccion);
  if (!direccion) return res.status(400).json({ ok: false, error: "Falta direccion" });

  try {
    const q = direccion.toUpperCase().includes("CALI")
      ? direccion
      : `${direccion}, Cali, Colombia`;

    const r = await geocodeNominatim(q);
    if (!r) return res.json({ ok: true, found: false });

    res.json({ ok: true, found: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---------------------
// Root + mounts
// ---------------------
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "En2x3 backend funcionando ✅",
    tips: { health: "/api/health", paquetes: "/api/paquetes" },
  });
});

// Canonical
app.use("/api", router);
// Legacy (si algún front viejo usa sin /api)
app.use("/", router);

// Error handler (mejorado)
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || "Server error");
  const isCors = msg.startsWith("CORS bloqueado para:");
  const status = isCors ? 403 : 500;
  console.error("❌ API error:", msg);
  res.status(status).json({ ok: false, error: msg });
});

app.listen(PORT, () => {
  console.log("✅ En2x3 backend PRO en puerto", PORT);
  console.log("📦 DATA_PATH:", DATA_PATH);
});

