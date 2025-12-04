import express from "express";
import {
    obtenerServicios,
    empleadosPorServicio,
    crearServicio,
    actualizarServicio,
    eliminarServicio,
    guardarServiciosSeleccionados
} from "../controllers/serviciosController.js";

const router = express.Router();

// Rutas de administración y lectura
router.get("/", obtenerServicios);
router.post("/", crearServicio);
router.put("/:id", actualizarServicio);
router.delete("/:id", eliminarServicio);
// Nota: router.delete("/:id", verificarToken, empleadosPorServicio); (Este DELETE parece un error, debería ser GET o POST para la consulta)
router.get("/empleados/:id", empleadosPorServicio); // Asumiendo que esta es la ruta correcta

// ⚡️ RUTA NUEVA: Conexión con el formulario de Servicios del Frontend
router.post('/guardar', guardarServiciosSeleccionados); 

export default router;