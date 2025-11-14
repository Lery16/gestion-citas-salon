import express from "express";
import { registrarUsuario } from "../controllers/usuariosController.js";
import { verificarToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/registrar", verificarToken, registrarUsuario);

export default router;
