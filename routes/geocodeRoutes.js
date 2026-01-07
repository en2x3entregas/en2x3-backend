// backend/routes/geocodeRoutes.js
import express from "express";
import { requireAuth, requireRole } from "../src/middleware/auth.js";
import { safeStr } from "../src/utils.js";
import { geocodeNominatim } from "../geocode.js";

const router = express.Router();

// GET /api/geocode?direccion=...
router.get("/", requireAuth, requireRole(["store", "admin"]), async (req, res) => {
  const direccion = safeStr(req.query.direccion || req.query.address || "");
  if (!direccion) return res.status(400).json({ ok: false, found: false, error: "direccion requerida" });

  try {
    const r = await geocodeNominatim(direccion);
    if (!r || r.lat == null || r.lng == null) return res.json({ ok: true, found: false });
    return res.json({ ok: true, found: true, lat: r.lat, lng: r.lng, displayName: r.displayName || "" });
  } catch {
    return res.status(500).json({ ok: false, found: false, error: "No se pudo geocodificar" });
  }
});

export default router;
