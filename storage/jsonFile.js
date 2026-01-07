// backend/storage/jsonFile.js
import { promises as fs } from "fs";
import path from "path";

async function ensureFile(filePath, defaultContent = "[]") {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContent, "utf-8");
  }
}

export async function readJson(filePath, fallback) {
  await ensureFile(filePath, JSON.stringify(fallback ?? [], null, 2));
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    const data = JSON.parse(raw || "[]");
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, data) {
  await ensureFile(filePath, "[]");
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data ?? [], null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

