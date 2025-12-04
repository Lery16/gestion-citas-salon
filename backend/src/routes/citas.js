import express from 'express';
import { 
    getCitasHoy, 
    getCitasListado, 
    buscarCitasFiltradas, 
    actualizarCitasLote,
    // Nuevas importaciones:
    getSlotsDisponibles,
    getCitasOcupadas,
    agendarCita
} from '../controllers/citasController.js';

const router = express.Router();

router.get('/hoy', getCitasHoy);
router.post('/buscar', buscarCitasFiltradas);
router.put('/actualizar-lote', actualizarCitasLote);
router.get('/listado', getCitasListado);

// --- NUEVAS RUTAS PARA EL AGENDAMIENTO ---
router.get('/slots-disponibles', getSlotsDisponibles);
router.get('/ocupadas', getCitasOcupadas);             
router.post('/agendar', agendarCita);                 

export default router;