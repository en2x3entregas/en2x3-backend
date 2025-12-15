// backend/routes/paquetesRoutes.js
import { Router } from "express";
import {
  listarPaquetes,
  obtenerPaquete,
  crearPaquete,
  actualizarPaquete,
  eliminarPaquete,
  actualizarEstado,
  actualizarCoords,
  geocodificarLote
} from "../controllers/paquetesController.js";

const router = Router();

// Base: /api/paquetes
router.get("/", listarPaquetes);
router.get("/:id", obtenerPaquete);
router.post("/", crearPaquete);
router.put("/:id", actualizarPaquete);
router.delete("/:id", eliminarPaquete);

// Extra (estado / coords / geocode)
router.patch("/:id/estado", actualizarEstado);
router.put("/:id/coords", actualizarCoords);
router.post("/geocode-lote", geocodificarLote);

export default router;
