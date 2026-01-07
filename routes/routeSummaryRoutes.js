// backend/routes/routeSummaryRoutes.js
import express from "express";
import { requireAuth, requireRole } from "../src/middleware/auth.js";
import { createRouteSummary, readRouteSummaries } from "../storage/routeSummaryStore.js";
import { safeStr, todayISO } from "../src/utils.js";
import { TZ } from "../src/config.js";

const router = express.Router();

// POST /api/route-summary (repartidor envía cierre)
router.post("/", requireAuth, requireRole(["messenger", "admin"]), async (req, res) => {
  const b = req.body || {};
  const day = safeStr(b.day || b.dia || "") || todayISO(TZ);

  const summary = await createRouteSummary({
    day,
    repartidorId: req.user.id || "",
    repartidorNombre: req.user.nombre || "",
    startTime: safeStr(b.startTime || b.start || ""),
    endTime: safeStr(b.endTime || b.end || ""),
    durationMs: Number(b.durationMs || 0),
    totals: b.totals || {},
    notes: safeStr(b.notes || ""),
    syncedAt: new Date().toISOString(),
  });

  return res.status(201).json({ ok: true, summary });
});

// GET /api/route-summary?day=YYYY-MM-DD&repartidorId=...
router.get("/", requireAuth, async (req, res) => {
  const user = req.user;
  const day = safeStr(req.query.day || "");
  const repartidorId = safeStr(req.query.repartidorId || "");

  let list = await readRouteSummaries();
  if (day) list = list.filter((x) => safeStr(x.day) === day);

  if (user.role === "messenger") {
    list = list.filter((x) => safeStr(x.repartidorId) === safeStr(user.id));
  } else {
    if (repartidorId) list = list.filter((x) => safeStr(x.repartidorId) === repartidorId);
  }

  return res.json({ ok: true, list });
});

export default router;
