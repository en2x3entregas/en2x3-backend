import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { safeStr, normRole } from "../utils.js";

export function requireAuth(req, res, next) {
  const h = safeStr(req.headers.authorization || "");
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";

  if (!token) return res.status(401).json({ ok: false, error: "No autorizado" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: safeStr(payload.id || payload.uid || req.headers["x-en2x3-uid"] || ""),
      role: normRole(payload.role || payload.activeRole || req.headers["x-en2x3-role"] || ""),
      nombre: safeStr(payload.nombre || payload.name || req.headers["x-en2x3-name"] || ""),
      cc: safeStr(payload.cc || req.headers["x-en2x3-cc"] || ""),
      email: safeStr(payload.email || req.headers["x-en2x3-email"] || ""),
    };
    if (!req.user.role) req.user.role = "messenger";
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Token inválido o expirado" });
  }
}

export function requireRole(allowed) {
  const roles = (Array.isArray(allowed) ? allowed : [allowed]).map((r) => normRole(r));
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ ok: false, error: "No autorizado" });
    if (role === "admin") return next();
    if (roles.includes(role)) return next();
    return res.status(403).json({ ok: false, error: "Prohibido" });
  };
}
