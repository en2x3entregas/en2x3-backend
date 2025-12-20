// backend/server.js — en2x3 Entregas (API PRO + AUTH + COMPAT)
// ==========================================================
// ✅ /api/paquetes  (rutas por router)
// ✅ /api/auth      (JWT + reset password)
// ✅ /api/geocode   (compat legacy)
// ✅ CORS por CORS_ORIGINS (o ALLOWED_ORIGIN legacy)
// ✅ Mongo opcional (si hay MONGO_URI/MONGODB_URI)
// ✅ Render friendly (usa process.env.PORT)
// ==========================================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import paquetesRoutes from "./routes/paquetesRoutes.js";
import authRoutes from "./src/routes/auth.routes.js";
import { connectDB } from "./src/db.js";
import { geocodeNominatim } from "./utils/geocode.js";

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 4000;

// ---------------------
// CORS (nuevo + legacy)
// ---------------------
function parseCorsOrigins() {
  const rawNew = String(process.env.CORS_ORIGINS || "").trim();
  const rawOld = String(process.env.ALLOWED_ORIGIN || "").trim();
  const raw = rawNew || rawOld || "*";

  if (raw === "*") return ["*"];

  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return list.length ? list : ["*"];
}

const allowList = parseCorsOrigins();
const allowAll = allowList.includes("*");

// ---------------------
// Middlewares
// ---------------------
app.use(
  helmet({
    // para APIs suele evitar bloqueos raros
    crossOriginResourcePolicy: false,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite requests sin origin (curl/postman/apps)
      if (!origin) return cb(null, true);
      if (allowAll) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      return cb(new Error("CORS bloqueado para: " + origin), false);
    },
    credentials: !allowAll,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-en2x3-cc",
      "x-en2x3-role",
      "x-en2x3-name",
    ],
    optionsSuccessStatus: 204,
  })
);

// ---------------------
// Health
// ---------------------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "en2x3-backend",
    env: process.env.NODE_ENV || "dev",
    time: new Date().toISOString(),
    commit: process.env.RENDER_GIT_COMMIT || null,
  });
});

// ---------------------
// AUTH + PAQUETES
// ---------------------
app.use("/api/auth", authRoutes);
app.use("/api/paquetes", paquetesRoutes);

// Legacy (por si algún front viejo usa sin /api)
app.use("/auth", authRoutes);
app.use("/paquetes", paquetesRoutes);

// ---------------------
// ✅ Geocode legacy: GET /api/geocode?direccion=...
// ---------------------
app.get(["/api/geocode", "/geocode"], async (req, res) => {
  const direccion = String(req.query?.direccion || "").trim();
  if (!direccion) return res.status(400).json({ ok: false, error: "Falta direccion" });

  try {
    const q = direccion.toUpperCase().includes("CALI")
      ? direccion
      : `${direccion}, Cali, Colombia`;

    const r = await geocodeNominatim(q);
    if (!r) return res.json({ ok: true, found: false });

    res.json({ ok: true, found: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "En2x3 backend funcionando ✅",
    tips: {
      health: "/api/health",
      paquetes: "/api/paquetes",
      auth: "/api/auth/login",
      geocode: "/api/geocode?direccion=...",
    },
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || "Error interno");
  const isCors = msg.toLowerCase().includes("cors bloqueado");
  const status = isCors ? 403 : 500;
  console.error("❌ API error:", msg);
  res.status(status).json({ ok: false, error: msg });
});

// ---------------------
// Start + Mongo opcional
// ---------------------
async function start() {
  const hasMongo =
    String(process.env.MONGO_URI || "").trim() ||
    String(process.env.MONGODB_URI || "").trim();

  if (hasMongo) {
    try {
      await connectDB();
      console.log("✅ DB conectada");
    } catch (e) {
      console.error("❌ DB error:", e?.message || e);
      // NO frenamos el server: paquetes.json puede seguir funcionando
    }
  } else {
    console.log("ℹ️ Sin MONGO_URI/MONGODB_URI: DB no se conecta (modo JSON OK).");
  }

  app.listen(PORT, () => {
    console.log("✅ En2x3 backend en puerto:", PORT);
    console.log("🌍 CORS allowList:", allowList);
  });
}

start();



