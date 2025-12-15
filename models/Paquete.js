// backend/models/Paquete.js
// ==================================================
// en2x3 Entregas — Modelo + Normalización (ESM)
// - Guarda en paquetes.json (DATA_PATH)
// - Compatible con "type":"module"
// ==================================================

import dotenv from "dotenv";
dotenv.config();

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Usamos DATA_PATH (recomendado). Si no existe, cae a ../paquetes.json
const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(__dirname, "..", process.env.DATA_PATH)
  : path.resolve(__dirname, "..", "paquetes.json");

// ------------------------
// Helpers JSON
// ------------------------
async function ensureFile() {
  const dir = path.dirname(DATA_PATH);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, "[]", "utf8");
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    // si se dañó el JSON, lo reseteamos
    await fs.writeFile(DATA_PATH, "[]", "utf8");
    return [];
  }
}

async function writeAll(list) {
  await ensureFile();
  const tmp = `${DATA_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, DATA_PATH);
}

// ------------------------
// Normalización y validación
// ------------------------
export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseCoord(v) {
  // soporta "3,4698" y "3.4698"
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

export function normalizePaquete(input = {}, existing = null) {
  const now = new Date().toISOString();
  const base = existing ? { ...existing } : {};

  const estadoRaw = (input.estado ?? base.estado ?? "pendiente")
    .toString()
    .toLowerCase();

  const estado =
    estadoRaw === "pendiente" || estadoRaw === "entregado" || estadoRaw === "devuelto"
      ? estadoRaw
      : "pendiente";

  // coords: si vienen en input, las parseamos; si no, conservamos lo existente
  let lat = base.lat ?? null;
  let lng = base.lng ?? null;

  if (typeof input.lat !== "undefined" || typeof input.lng !== "undefined") {
    const latN = parseCoord(input.lat);
    const lngN = parseCoord(input.lng);

    if (isValidLatLng(latN, lngN)) {
      lat = latN;
      lng = lngN;
    } else {
      // si mandan algo inválido o vacío, lo dejamos en null
      lat = null;
      lng = null;
    }
  }

  const fechaRegistro =
    (input.fechaRegistro ?? base.fechaRegistro ?? now.slice(0, 10)).toString();

  const p = {
    id: (base.id ?? input.id ?? String(Date.now())).toString(),
    nombre: (input.nombre ?? base.nombre ?? "").toString().trim(),
    direccion: (input.direccion ?? base.direccion ?? "").toString().trim(),
    telefono: (input.telefono ?? base.telefono ?? "").toString().trim(),
    zona: (input.zona ?? base.zona ?? "").toString().trim(),

    valorProducto: toNumber(input.valorProducto ?? base.valorProducto ?? 0),
    estado,

    orden: toNumber(input.orden ?? base.orden ?? 0) || 0,

    lat,
    lng,

    fechaRegistro,

    createdAt: base.createdAt ?? now,
    updatedAt: now,

    // opcionales útiles
    horaEntrega: base.horaEntrega ?? null,
    horaDevolucion: base.horaDevolucion ?? null
  };

  return p;
}

// ------------------------
// API del "modelo"
// ------------------------
export async function getAll() {
  return await readAll();
}

export async function getById(id) {
  const list = await readAll();
  return list.find((p) => String(p.id) === String(id)) ?? null;
}

export async function create(input) {
  const list = await readAll();
  const nuevo = normalizePaquete(input, null);

  // si no trae orden, se lo asignamos al final
  if (!nuevo.orden) nuevo.orden = list.length + 1;

  list.push(nuevo);
  await writeAll(list);
  return nuevo;
}

export async function update(id, input) {
  const list = await readAll();
  const idx = list.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return null;

  const actualizado = normalizePaquete(input, list[idx]);
  list[idx] = actualizado;

  await writeAll(list);
  return actualizado;
}

export async function remove(id) {
  const list = await readAll();
  const before = list.length;
  const filtered = list.filter((p) => String(p.id) !== String(id));
  if (filtered.length === before) return false;

  await writeAll(filtered);
  return true;
}

export async function removeAll() {
  await writeAll([]);
  return true;
}

// Default export (por si tus controllers lo importan como default)
const PaqueteModel = { getAll, getById, create, update, remove, removeAll };
export default PaqueteModel;
