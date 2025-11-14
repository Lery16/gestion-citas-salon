import express from "express";
import {
  obtenerServicios,
  empleadosPorServicio,
  crearServicio,
  actualizarServicio,
  eliminarServicio
} from "../controllers/serviciosController.js";
import { verificarToken } from "../middleware/authmiddleware.js";

const router = express.Router();

// Solo admin puede modificar
router.get("/", verificarToken, obtenerServicios);
router.post("/", verificarToken, crearServicio);
router.put("/:id", verificarToken, actualizarServicio);
router.delete("/:id", verificarToken, eliminarServicio);
router.delete("/:id", verificarToken, empleadosPorServicio);

export default router;
