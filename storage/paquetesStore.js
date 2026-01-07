// backend/storage/paquetesStore.js
import { PACKAGES_FILE } from "../src/config.js";
import { readJson, writeJson } from "./jsonFile.js";

export async function readPaquetes() {
  const data = await readJson(PACKAGES_FILE, []);
  return Array.isArray(data) ? data : [];
}

export async function writePaquetes(paquetes) {
  await writeJson(PACKAGES_FILE, Array.isArray(paquetes) ? paquetes : []);
}
