import { Router } from "express";
import {
  listarPaquetes,
  obtenerPaquete,
  crearPaquete,
  actualizarPaquete,
  eliminarPaquete,
  actualizarEstado,
  actualizarCoords,
  geocodificarLote,
} from "../controllers/paquetesController.js";

const router = Router();

// Base: /api/paquetes
router.get("/", listarPaquetes);
router.post("/", crearPaquete);

// Extra (geocode) → antes del /:id
router.post("/geocode-lote", geocodificarLote);

router.get("/:id", obtenerPaquete);
router.put("/:id", actualizarPaquete);
router.delete("/:id", eliminarPaquete);

// Extra (estado / coords)
router.patch("/:id/estado", actualizarEstado);
router.put("/:id/coords", actualizarCoords);

export default router;


