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
router.post("/", crearPaquete);

// Extra
router.post("/geocode-lote", geocodificarLote);
router.patch("/:id/estado", actualizarEstado);
router.put("/:id/coords", actualizarCoords);

// CRUD por ID
router.get("/:id", obtenerPaquete);
router.put("/:id", actualizarPaquete);
router.delete("/:id", eliminarPaquete);

export default router;
