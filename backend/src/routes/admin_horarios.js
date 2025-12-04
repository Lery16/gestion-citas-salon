import express from "express";
import { 
    obtenerConfiguracionHoraria, 
    actualizarHorarioSemanal, 
    guardarExcepciones,
    eliminarExcepciones
} from "../controllers/horarioController.js";

const router = express.Router();

router.get("/", obtenerConfiguracionHoraria);
router.post("/semanal", actualizarHorarioSemanal);
// Ruta para crear/actualizar días CERRADOS
router.post("/excepciones", guardarExcepciones);
// Ruta para eliminar días que el front marcó como 'limpios'
router.post("/excepciones/eliminar", eliminarExcepciones); 

export default router;