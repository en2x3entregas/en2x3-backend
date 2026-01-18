// backend/server.js — En2x3 Backend (VPS/Render ready)
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { PORT, NODE_ENV, CORS_ORIGINS } from "./src/config.js";

// ✅ Paso 4: ping Mongo al arrancar (falla rápido si la URI está mal)
import { pingMongo } from "./src/mongo.js";

import authRoutes from "./routes/auth.routes.js";
import paquetesRoutes from "./routes/paquetesRoutes.js";
import routeSummaryRoutes from "./routes/routeSummaryRoutes.js";
import geocodeRoutes from "./routes/geocodeRoutes.js";

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// ---------------------
// CORS (robusto)
// ---------------------
const allowAll = Array.isArray(CORS_ORIGINS) && CORS_ORIGINS.includes("*");

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman/server-to-server
    if (allowAll) return cb(null, true);

    const o = String(origin).replace(/\/$/, "");
    const list = (Array.isArray(CORS_ORIGINS) ? CORS_ORIGINS : [])
      .map((x) => String(x || "").trim().replace(/\/$/, ""))
      .filter(Boolean);

    if (list.includes(o)) return cb(null, true);
    return cb(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-en2x3-cc",
    "x-en2x3-role",
    "x-en2x3-name",
    "x-en2x3-email",
    "x-en2x3-uid",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// rate limit básico para auth
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api/auth", authLimiter);

// health
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({
    ok: true,
    status: "up",
    env: NODE_ENV,
    time: new Date().toISOString(),
    commit: process.env.RENDER_GIT_COMMIT || null,
  });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/paquetes", paquetesRoutes);
app.use("/api/route-summary", routeSummaryRoutes);
app.use("/api/geocode", geocodeRoutes);

// root
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "En2x3 backend funcionando ✅",
    endpoints: {
      health: "/api/health",
      login: "/api/auth/login",
      paquetes: "/api/paquetes",
      geocode: "/api/geocode?direccion=...",
      routeSummary: "/api/route-summary",
    },
  });
});

// 404
app.use((_req, res) =>
  res.status(404).json({ ok: false, error: "Ruta no encontrada" })
);

// error handler
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || err || "Error");
  const status = msg.toLowerCase().includes("cors bloqueado") ? 403 : 500;
  res.status(status).json({ ok: false, error: msg });
});

async function start() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "";
  if (mongoUri) {
    await pingMongo();
    console.log("✅ MongoDB conectado OK");
  } else {
    console.log("⚠️ MONGODB_URI no está definida. (Mongo no se está usando)");
  }

  app.listen(PORT, () => {
    console.log(`✅ en2x3 backend escuchando en puerto ${PORT}`);
    console.log(
      `🌍 CORS_ORIGINS: ${(Array.isArray(CORS_ORIGINS) ? CORS_ORIGINS : []).join(", ")}`
    );
  });
}

start().catch((e) => {
  console.error("❌ Fallo al iniciar el backend:", e?.message || e);
  process.exit(1);
});



