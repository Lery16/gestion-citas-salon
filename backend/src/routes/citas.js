import express from 'express';
import { getCitasHoy } from '../controllers/citasController.js'; 
// Importa el middleware de autenticación si lo usas, por ejemplo:
// import { verificarToken } from '../middleware/auth.js'; 

const router = express.Router();

// Define la ruta /hoy
router.get('/hoy', 
    // verificarToken, // Descomentar si usas autenticación
    getCitasHoy
);

export default router;