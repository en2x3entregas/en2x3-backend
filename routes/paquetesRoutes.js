import express from "express";
import {
  listarPaquetes,
  obtenerPaquete,
  crearPaquete,
  actualizarPaquete,
  actualizarEstado,
  actualizarCoords,
  eliminarPaquete,
  geocodificarLote
} from "../controllers/paquetesController.js";

const router = express.Router();

// CRUD
router.get("/paquetes", listarPaquetes);
router.get("/paquetes/:id", obtenerPaquete);
router.post("/paquetes", crearPaquete);
router.put("/paquetes/:id", actualizarPaquete);
router.delete("/paquetes/:id", eliminarPaquete);

// Acciones específicas
router.put("/paquetes/:id/estado", actualizarEstado);
router.put("/paquetes/:id/coords", actualizarCoords);

// Geocoding en lote (para tu widget)
router.post("/paquetes/geocode-lote", geocodificarLote);

export default router;
