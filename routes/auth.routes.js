// backend/routes/auth.routes.js
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { JWT_SECRET, JWT_EXPIRES_IN, ALLOW_ADMIN_REGISTER, TZ, NODE_ENV } from "../src/config.js";
import { safeStr, todayISO } from "../src/utils.js";
import { requireAuth } from "../src/middleware/auth.js";

import {
  createUser,
  verifyUserCredentials,
  setResetToken,
  resetPasswordWithToken,
} from "../storage/usersStore.js";

import { sendResetEmail } from "../mailer.js";

const router = express.Router();

function signToken(user) {
  const payload = {
    id: user.id,
    uid: user.id,
    role: safeStr(user.role || "messenger"),
    nombre: safeStr(user.nombre || ""),
    cc: safeStr(user.cc || ""),
    email: safeStr(user.email || ""),
    iss: "en2x3",
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post("/login", async (req, res) => {
  const body = req.body || {};
  const password = safeStr(body.password);
  const userOrCc = safeStr(body.userOrCc || body.user || body.cc || "");
  const email = safeStr(body.email || "");

  if (!password || (!userOrCc && !email)) {
    return res.status(400).json({ ok: false, error: "Faltan credenciales" });
  }

  const user = await verifyUserCredentials({ userOrCc, email, password });
  if (!user) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

  const token = signToken(user);
  return res.json({ ok: true, token, user, activeRole: safeStr(user.role || "messenger") });
});

router.post("/register", async (req, res) => {
  const b = req.body || {};
  const nombre = safeStr(b.nombre || b.name);
  const apellido = safeStr(b.apellido || "");
  const cc = safeStr(b.cc).replace(/\D/g, "");
  const telefono = safeStr(b.telefono || b.phone || "");
  const email = safeStr(b.email).toLowerCase();
  const password = safeStr(b.password);

  let role = safeStr(b.role || b.perfil || "messenger").toLowerCase();
  if (role === "repartidor" || role === "mensajero") role = "messenger";
  if (role === "tienda") role = "store";
  if (role === "administrador") role = "admin";

  if (!nombre || !email || !password) {
    return res.status(400).json({ ok: false, error: "Faltan datos (nombre, email, password)" });
  }

  if (role === "admin" && !ALLOW_ADMIN_REGISTER) {
    return res.status(403).json({ ok: false, error: "Registro de admin deshabilitado" });
  }

  try {
    const user = await createUser({ nombre, apellido, cc, telefono, email, password, role });
    const token = signToken(user);
    return res.status(201).json({ ok: true, token, user, activeRole: safeStr(user.role) });
  } catch (e) {
    return res.status(400).json({ ok: false, error: safeStr(e?.message) || "No se pudo registrar" });
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ ok: true, user: req.user }));

router.post("/forgot-password", async (req, res) => {
  const email = safeStr(req.body?.email).toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "Email requerido" });

  const token = crypto.randomBytes(24).toString("hex");
  const expIso = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

  const info = await setResetToken(email, token, expIso); // no falla si no existe
  if (info?.ok && info?.exists) {
    const resetLink = `${safeStr(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/?reset=${token}`;
    await sendResetEmail({ to: email, resetLink }).catch(() => {});
  }

  const day = todayISO(TZ);
  return res.json({
    ok: true,
    message: `Si el correo existe, se envió un enlace de recuperación. (${day})`,
    tokenDev: NODE_ENV !== "production" ? token : undefined,
  });
});

router.post("/reset-password", async (req, res) => {
  const token = safeStr(req.body?.token);
  const password = safeStr(req.body?.password);
  if (!token || !password) {
    return res.status(400).json({ ok: false, error: "Token y password son requeridos" });
  }

  const r = await resetPasswordWithToken(token, password);
  if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
  return res.json({ ok: true, message: "Contraseña actualizada" });
});

export default router;
