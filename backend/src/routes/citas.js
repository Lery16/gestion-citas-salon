import express from 'express';
import { getCitasHoy, getCitasListado, buscarCitasFiltradas, actualizarCitasLote } from '../controllers/citasController.js'; 

const router = express.Router();

// 1. Ruta /hoy (la mantienes si la usas)
router.get('/hoy', 
    // verificarToken, // Descomentar si usas autenticación
    getCitasHoy
);

// 2. NUEVA RUTA: Endpoint para el frontend de gestiónCitas.js
// La función obtenerCitasFiltradas del frontend apunta a '/api/citas/buscar'
router.post('/buscar',
    // verificarToken, 
    buscarCitasFiltradas
);

// 3. Necesitas una ruta para actualizar el estado por lote (PUT/PATCH)
router.put('/actualizar-lote', actualizarCitasLote);

router.get('/listado', getCitasListado); 

export default router;