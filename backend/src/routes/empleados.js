import express from 'express'; // Importación con desestructuración y consistencia ESM
import * as empleadosController from '../controllers/empleadosController.js';  // Importar todo como un objeto

const router = express.Router(); // Iniciar el enrutador

// GET /api/empleados
router.get('/', empleadosController.getEmpleados);

// POST /api/empleados
router.post('/', empleadosController.createEmpleado);

// PUT /api/empleados/:id
router.put('/:id', empleadosController.updateEmpleado);

// DELETE /api/empleados/:id
router.delete('/:id', empleadosController.deleteEmpleado);

// 2. Coherencia de Módulos: Usar export default para que pueda ser importado
//    fácilmente en el archivo principal (server.js, etc.).
export default router;