import { Router } from 'express';
import * as clienteController from '../controllers/clienteController.js';

const router = Router();

// Ruta POST para registrar un nuevo cliente y obtener su ID
// y obtener el ID del servicio
router.post('/', clienteController.registrarClienteYObtenerIds);

export default router;