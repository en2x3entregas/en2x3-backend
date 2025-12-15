import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(process.env.DATA_PATH)
  : path.join(process.cwd(), "paquetes.json");

async function ensureFile() {
  const dir = path.dirname(DATA_PATH);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, "[]", "utf-8");
  }
}

export async function readPaquetes() {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  try {
    const data = JSON.parse(raw || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writePaquetes(paquetes) {
  await ensureFile();
  const tmp = `${DATA_PATH}.tmp`;
  const json = JSON.stringify(paquetes ?? [], null, 2);

  await fs.writeFile(tmp, json, "utf-8");
  await fs.rename(tmp, DATA_PATH);
}

export function getDataPath() {
  return DATA_PATH;
}


