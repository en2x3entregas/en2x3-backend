import express from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import User from "./models/User.js";
import { sendResetEmail } from "../utils/mailer.js";

const router = express.Router();

// ========================
// Rate limit Auth
// ========================
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// ========================
// Helpers
// ========================
const safeStr = (v) => String(v ?? "").trim();

function normalizeRole(r) {
  const s = safeStr(r).toLowerCase();
  if (s === "tienda") return "store";
  if (s === "repartidor" || s === "mensajero" || s === "messenger") return "repartidor";
  if (s === "admin" || s === "administrador") return "admin";
  if (["store", "admin", "repartidor"].includes(s)) return s;
  return "";
}

function mustJwtSecret() {
  const secret = safeStr(process.env.JWT_SECRET);
  if (!secret) {
    const err = new Error("Falta JWT_SECRET en variables de entorno");
    err.status = 500;
    throw err;
  }
  return secret;
}

function signToken(user) {
  const secret = mustJwtSecret();
  const exp = safeStr(process.env.JWT_EXPIRES_IN) || "7d";

  const payload = {
    id: String(user._id),
    role: user.role,
    cc: user.cc,
    nombre: user.nombre,
    apellido: user.apellido
  };

  return jwt.sign(payload, secret, { expiresIn: exp });
}

function getBearer(req) {
  const h = safeStr(req.headers.authorization);
  if (!h) return "";
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer") return "";
  return safeStr(token);
}

function authRequired(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Sin token" });

    const secret = mustJwtSecret();
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
}

// ========================
// Seed default admins (solo si lo habilitas)
// ========================
// En producción: pon en Render/Hostinger
// SEED_DEFAULT_ADMINS=true
let __seedDone = false;

async function maybeSeedDefaultAdmins() {
  if (__seedDone) return;
  __seedDone = true;

  const flag = safeStr(process.env.SEED_DEFAULT_ADMINS).toLowerCase();
  const enabled = flag === "true" || flag === "1" || flag === "yes";

  if (!enabled) return;

  const defaults = [
    {
      nombre: "Fernando",
      apellido: "Jojoa",
      cc: "16916526",
      telefono: "0000000",
      email: "admin.fernando@en2x3.local",
      role: "admin",
      password: "16916526"
    },
    {
      nombre: "Hector",
      apellido: "Giraldo",
      cc: "1055833514",
      telefono: "0000000",
      email: "admin.hector@en2x3.local",
      role: "admin",
      password: "1055833514"
    }
  ];

  for (const d of defaults) {
    const cc = safeStr(d.cc).replace(/\D/g, "");
    if (!cc) continue;

    const exists = await User.findOne({ cc }).lean();
    if (exists) continue;

    const passwordHash = await bcrypt.hash(String(d.password), 10);

    await User.create({
      nombre: d.nombre,
      apellido: d.apellido,
      cc,
      telefono: d.telefono,
      email: d.email,
      role: "admin",
      passwordHash
    });
  }
}

// ========================
// POST /api/auth/register
// ========================
router.post("/register", authLimiter, async (req, res) => {
  try {
    await maybeSeedDefaultAdmins();

    const { nombre, apellido, cc, telefono, email, role, password } = req.body || {};

    const n = safeStr(nombre);
    const a = safeStr(apellido);
    const ced = safeStr(cc).replace(/\D/g, "");
    const tel = safeStr(telefono);
    const em = safeStr(email).toLowerCase();
    const rl = normalizeRole(role);

    if (n.length < 2) return res.status(400).json({ ok: false, error: "Nombre inválido" });
    if (a.length < 2) return res.status(400).json({ ok: false, error: "Apellido inválido" });
    if (ced.length < 6) return res.status(400).json({ ok: false, error: "CC inválida" });
    if (tel.length < 7) return res.status(400).json({ ok: false, error: "Teléfono inválido" });
    if (!em.includes("@")) return res.status(400).json({ ok: false, error: "Email inválido" });
    if (!rl) return res.status(400).json({ ok: false, error: "Rol inválido" });

    // En producción NO permitimos registrar admin por formulario,
    // porque tú ya tienes 2 admins fijos.
    const allowAdmin = String(process.env.ALLOW_ADMIN_REGISTER || "").toLowerCase();
    if (rl === "admin" && allowAdmin !== "true" && allowAdmin !== "1") {
      return res.status(403).json({ ok: false, error: "No puedes registrar admin desde aquí." });
    }

    // Clave: si no mandan password, usar cc
    const plain = safeStr(password || ced);
    if (plain.length < 4) return res.status(400).json({ ok: false, error: "Contraseña inválida" });

    const exists = await User.findOne({ $or: [{ email: em }, { cc: ced }] }).lean();
    if (exists) return res.status(409).json({ ok: false, error: "Usuario ya existe" });

    const passwordHash = await bcrypt.hash(plain, 10);

    const user = await User.create({
      nombre: n,
      apellido: a,
      cc: ced,
      telefono: tel,
      email: em,
      role: rl,
      passwordHash
    });

    return res.json({
      ok: true,
      user: {
        nombre: user.nombre,
        apellido: user.apellido,
        cc: user.cc,
        email: user.email,
        role: user.role
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Error registrando" });
  }
});

// ========================
// POST /api/auth/login
// user puede ser email o cc
// ========================
router.post("/login", authLimiter, async (req, res) => {
  try {
    await maybeSeedDefaultAdmins();

    const { user, password } = req.body || {};
    const u = safeStr(user);
    const p = safeStr(password);

    if (!u || !p) return res.status(400).json({ ok: false, error: "Faltan credenciales" });

    const isEmail = u.includes("@");
    const query = isEmail ? { email: u.toLowerCase() } : { cc: u.replace(/\D/g, "") };

    const found = await User.findOne(query);
    if (!found) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(p, found.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const token = signToken(found);

    return res.json({
      ok: true,
      token,
      user: {
        nombre: found.nombre,
        apellido: found.apellido,
        cc: found.cc,
        email: found.email,
        role: found.role
      }
    });
  } catch (e) {
    const msg = String(e?.message || "Error login");
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ========================
// GET /api/auth/me
// ========================
router.get("/me", authRequired, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

// ========================
// POST /api/auth/forgot-password
// (respuesta neutral para no revelar si existe o no)
// ========================
router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    await maybeSeedDefaultAdmins();

    const email = safeStr(req.body?.email).toLowerCase();
    const neutral = { ok: true, message: "Si el correo existe, enviaremos instrucciones." };

    if (!email.includes("@")) return res.json(neutral);

    const user = await User.findOne({ email });
    if (!user) return res.json(neutral);

    // token raw
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");

    user.resetTokenHash = hash;
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save();

    const base =
      safeStr(process.env.CLIENT_URL) ||
      safeStr(process.env.SITE_URL) ||
      safeStr(req.get("origin")) ||
      "";

    const client = base.replace(/\/$/, "");
    const resetLink = `${client}/index.html?mode=reset&email=${encodeURIComponent(email)}&token=${encodeURIComponent(raw)}`;

    await sendResetEmail({ to: email, nombre: user.nombre, resetLink });

    return res.json(neutral);
  } catch {
    // neutral siempre
    return res.json({ ok: true, message: "Si el correo existe, enviaremos instrucciones." });
  }
});

// ========================
// POST /api/auth/reset-password
// ========================
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    await maybeSeedDefaultAdmins();

    const email = safeStr(req.body?.email).toLowerCase();
    const token = safeStr(req.body?.token);
    const newPassword = safeStr(req.body?.newPassword);

    if (!email.includes("@")) return res.status(400).json({ ok: false, error: "Email inválido" });
    if (token.length < 10) return res.status(400).json({ ok: false, error: "Token inválido" });
    if (newPassword.length < 4) return res.status(400).json({ ok: false, error: "Contraseña muy corta" });

    const hash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email,
      resetTokenHash: hash,
      resetTokenExpiresAt: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ ok: false, error: "Token inválido o expirado" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    return res.json({ ok: true, message: "Contraseña actualizada ✅" });
  } catch {
    return res.status(500).json({ ok: false, error: "Error restableciendo" });
  }
});

export default router;
