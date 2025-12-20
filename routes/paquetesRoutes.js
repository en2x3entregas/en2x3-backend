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

// ✅ Estado: soporte PATCH y PUT (para compatibilidad con front antiguo)
router.patch("/:id/estado", actualizarEstado);
router.put("/:id/estado", actualizarEstado);

// ✅ Coords: soporte PUT y PATCH (por si lo llaman distinto)
router.put("/:id/coords", actualizarCoords);
router.patch("/:id/coords", actualizarCoords);

export default router;
