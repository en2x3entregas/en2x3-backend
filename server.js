// backend/server.js
// =============================================
// en2x3 Entregas - Backend UNIFICADO con persistencia JSON
// - Geocodificación + coords manuales
// - Guarda en paquetes.json
// - Rutas: GET, POST, PUT (estado), PUT (coords), DELETE
// =============================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// Config desde .env (si existe)
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "paquetes.json");

// Cache en memoria
let paquetesCache = [];

// ==============================
// Helpers archivo JSON
// ==============================
async function asegurarArchivo() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    // Si no existe, lo creamos vacío
    await fs.writeFile(DATA_PATH, "[]", "utf8");
  }
}

async function cargarDesdeArchivo() {
  try {
    await asegurarArchivo();
    const data = await fs.readFile(DATA_PATH, "utf8");
    paquetesCache = JSON.parse(data);
    if (!Array.isArray(paquetesCache)) paquetesCache = [];
  } catch (err) {
    console.error("Error leyendo paquetes.json:", err);
    paquetesCache = [];
  }
}

async function guardarEnArchivo() {
  try {
    await fs.writeFile(
      DATA_PATH,
      JSON.stringify(paquetesCache, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("Error escribiendo paquetes.json:", err);
  }
}

// Acepta id o idPaquete y compara como string
function findIndexByAnyId(id) {
  return paquetesCache.findIndex((p) => {
    const pid = p.idPaquete || p.id;
    return String(pid) === String(id);
  });
}

// ==============================
// Middlewares
// ==============================
app.use(
  cors({
    origin:
      ALLOWED_ORIGIN === "*"
        ? "*"
        : ALLOWED_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

// ==============================
// Rutas básicas
// ==============================
app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API en2x3 funcionando ✅" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "En2x3 backend funcionando" });
});

// Obtener todos los paquetes
app.get("/api/paquetes", async (req, res) => {
  await cargarDesdeArchivo();
  res.json(paquetesCache);
});

// Crear o actualizar paquete (QR o manual)
app.post("/api/paquetes", async (req, res) => {
  await cargarDesdeArchivo();

  const body = req.body || {};
  const {
    idPaquete,
    id,
    nombreDestinatario,
    nombre,
    direccion,
    zona,
    telefono,
    valorProducto,
    estado,
    orden,
    lat,
    lng,
  } = body;

  const idFinal = idPaquete || id || Date.now().toString();
  const index = findIndexByAnyId(idFinal);
  const existente = index !== -1 ? paquetesCache[index] : null;

  const direccionFinal = direccion || existente?.direccion || null;
  if (!direccionFinal) {
    return res
      .status(400)
      .json({ ok: false, error: "La dirección es obligatoria." });
  }

  const zonaFinal = zona || existente?.zona || "";

  let coords = null;
  if (typeof lat === "number" && typeof lng === "number") {
    coords = { lat, lng };
  } else if (
    typeof existente?.lat === "number" &&
    typeof existente?.lng === "number"
  ) {
    coords = { lat: existente.lat, lng: existente.lng };
  } else {
    coords = await geocodificarDireccion(direccionFinal, zonaFinal);
  }

  const ahora = new Date().toISOString();

  const nuevoPaquete = {
    ...(existente || {}),
    idPaquete: idFinal,
    id: idFinal,
    nombreDestinatario:
      nombreDestinatario ||
      nombre ||
      existente?.nombreDestinatario ||
      "Sin nombre",
    nombre: nombre || nombreDestinatario || existente?.nombre || "Sin nombre",
    direccion: direccionFinal,
    zona: zonaFinal,
    telefono: telefono ?? existente?.telefono ?? "",
    valorProducto: Number(valorProducto ?? existente?.valorProducto ?? 0),
    estado: estado || existente?.estado || "pendiente",
    orden: orden || existente?.orden || paquetesCache.length + 1,
    lat: coords?.lat ?? existente?.lat ?? null,
    lng: coords?.lng ?? existente?.lng ?? null,
    creadoEn: existente?.creadoEn || ahora,
    actualizadoEn: ahora,
  };

  if (index !== -1) {
    paquetesCache[index] = nuevoPaquete;
  } else {
    paquetesCache.push(nuevoPaquete);
  }

  await guardarEnArchivo();
  res.status(index !== -1 ? 200 : 201).json(nuevoPaquete);
});

// Cambiar estado (ENTREGADO / DEVUELTO / PENDIENTE)
app.put("/api/paquetes/:id", async (req, res) => {
  await cargarDesdeArchivo();
  const { id } = req.params;
  const { estado } = req.body || {};

  const index = findIndexByAnyId(id);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Paquete no encontrado" });
  }

  if (estado) {
    paquetesCache[index].estado = estado;
  }
  paquetesCache[index].actualizadoEn = new Date().toISOString();

  await guardarEnArchivo();
  res.json(paquetesCache[index]);
});

// Guardar SOLO coordenadas manuales
app.put("/api/paquetes/:id/coords", async (req, res) => {
  await cargarDesdeArchivo();
  const { id } = req.params;
  const { lat, lng } = req.body || {};

  if (
    typeof lat !== "number" ||
    Number.isNaN(lat) ||
    typeof lng !== "number" ||
    Number.isNaN(lng)
  ) {
    return res
      .status(400)
      .json({ ok: false, error: "lat y lng deben ser números" });
  }

  const index = findIndexByAnyId(id);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Paquete no encontrado" });
  }

  paquetesCache[index].lat = lat;
  paquetesCache[index].lng = lng;
  paquetesCache[index].actualizadoEn = new Date().toISOString();

  await guardarEnArchivo();
  console.log("📍 Coordenadas actualizadas:", id, lat, lng);
  res.json(paquetesCache[index]);
});

// Borrar paquete
app.delete("/api/paquetes/:id", async (req, res) => {
  await cargarDesdeArchivo();
  const { id } = req.params;
  const index = findIndexByAnyId(id);

  if (index === -1) {
    return res.status(404).json({ ok: false, error: "No encontrado" });
  }

  const eliminado = paquetesCache.splice(index, 1)[0];
  await guardarEnArchivo();
  res.json({ ok: true, eliminado });
});

// ==============================
// Geocodificación con Nominatim
// ==============================
async function geocodificarDireccion(direccion, zona) {
  try {
    let query = `${direccion}`;
    if (zona) query += `, ${zona}`;
    query += ", Valle del Cauca, Colombia";

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", query);

    console.log("Geocodificando:", url.toString());

    // Node 18+ ya tiene fetch global
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "en2x3-entregas/1.0 (hector-giraldo-app)" },
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || !data[0]) return null;

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    console.error("Error geocodificando dirección:", err);
    return null;
  }
}

// ==============================
// Arrancar servidor
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 en2x3 Backend activo en http://localhost:${PORT}`);
});
