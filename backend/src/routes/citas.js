import express from 'express';
import { getCitasHoy, buscarCitasFiltradas, actualizarCitasLote } from '../controllers/citasController.js'; 
// Importa el middleware de autenticación si lo usas, por ejemplo:
// import { verificarToken } from '../middleware/auth.js'; 

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

export default router;