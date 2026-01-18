// backend/storage/jsonFile.js
import fs from "fs/promises";
import path from "path";
import { getCol } from "../src/mongo.js";

function mapFileToCollection(filePath) {
  const f = String(filePath).replace(/\\/g, "/").toLowerCase();

  if (f.includes("users")) return "users";
  if (f.includes("paquetes")) return "paquetes";
  if (f.includes("route_summaries") || f.includes("route-summary") || f.includes("routesummary"))
    return "route_summaries";

  return null;
}

function stripMongoId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const { _id, ...rest } = doc;
  return rest;
}

export async function readJson(filePath, fallback) {
  // ✅ Si hay Mongo, leemos desde la colección equivalente
  if (process.env.MONGODB_URI) {
    const colName = mapFileToCollection(filePath);
    if (!colName) return fallback;

    const col = await getCol(colName);
    const docs = await col.find({}).toArray();
    return docs.map(stripMongoId);
  }

  // ✅ Modo archivo (fallback)
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, data) {
  // ✅ Si hay Mongo, escribimos en la colección equivalente
  if (process.env.MONGODB_URI) {
    const colName = mapFileToCollection(filePath);
    if (!colName) return;

    const col = await getCol(colName);

    const arr = Array.isArray(data) ? data : [];
    const ids = arr.map((d) => String(d?.id || "")).filter(Boolean);

    // Upsert masivo por "id"
    const ops = arr
      .filter((d) => d && d.id)
      .map((d) => ({
        replaceOne: {
          filter: { id: String(d.id) },
          replacement: d,
          upsert: true,
        },
      }));

    if (ops.length) {
      await col.bulkWrite(ops, { ordered: false });
    }

    // Para imitar el comportamiento del JSON (que reemplaza todo):
    // borramos lo que ya no exista
    if (ids.length) {
      await col.deleteMany({ id: { $nin: ids } });
    } else {
      await col.deleteMany({});
    }

    return;
  }

  // ✅ Modo archivo (fallback)
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}


