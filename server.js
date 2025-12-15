import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import paquetesRoutes from "./routes/paquetesRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;

const rawAllowed = (process.env.ALLOWED_ORIGIN || "*").trim();
const allowedList =
  rawAllowed === "*"
    ? ["*"]
    : rawAllowed.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman / server-to-server
      if (allowedList.includes("*")) return cb(null, true);
      if (allowedList.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS bloqueado para origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => res.json({ ok: true, mensaje: "API en2x3 funcionando ✅" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, message: "En2x3 backend funcionando ✅" }));

app.use("/api/paquetes", paquetesRoutes);

app.use((_req, res) => res.status(404).json({ ok: false, error: "Ruta no encontrada" }));

app.listen(PORT, () => console.log(`🚀 en2x3 Backend activo en puerto ${PORT}`));
