import express from 'express';
import { getEstadoMes } from '../controllers/calendarioController.js';

const router = express.Router();

// GET /api/calendario/estado-mes?year=2024&month=10
router.get('/estado-mes', getEstadoMes);

export default router;