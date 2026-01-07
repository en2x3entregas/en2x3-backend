import crypto from "crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function todayISO(tz = "America/Bogota") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function normRole(v) {
  const r = safeStr(v).toLowerCase();
  if (r === "repartidor" || r === "mensajero" || r === "delivery") return "messenger";
  return r;
}

export function makeId() {
  return crypto.randomUUID();
}

export function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
