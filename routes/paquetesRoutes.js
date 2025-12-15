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

router.get("/", listarPaquetes);
router.post("/", crearPaquete);

router.post("/geocode-lote", geocodificarLote);
router.patch("/:id/estado", actualizarEstado);
router.put("/:id/coords", actualizarCoords);

router.get("/:id", obtenerPaquete);
router.put("/:id", actualizarPaquete);
router.delete("/:id", eliminarPaquete);

export default router;

