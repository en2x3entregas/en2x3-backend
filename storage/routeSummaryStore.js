// backend/storage/routeSummaryStore.js
import { ROUTE_SUMMARIES_FILE } from "../src/config.js";
import { readJson, writeJson } from "./jsonFile.js";
import { makeId, nowIso } from "../src/utils.js";

export async function readRouteSummaries() {
  const data = await readJson(ROUTE_SUMMARIES_FILE, []);
  return Array.isArray(data) ? data : [];
}

export async function createRouteSummary(payload) {
  const list = await readRouteSummaries();
  const summary = {
    id: makeId(),
    createdAt: nowIso(),
    ...payload,
  };
  list.push(summary);
  await writeJson(ROUTE_SUMMARIES_FILE, list);
  return summary;
}
