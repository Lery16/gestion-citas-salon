import 'dotenv/config';
import express from "express";
import cors from "cors";

// Rutas
import authRoutes from "./src/routes/auth.js";
import serviciosRoutes from "./src/routes/servicios.js";
import usuariosRoutes from "./src/routes/usuarios.js";
import citasRoutes from "./src/routes/citas.js";
import empleadoRoutes from "./src/routes/empleados.js";
import horarioRoutes from "./src/routes/admin_horarios.js";

// Cron Jobs
import "./cron/limpiezaCitas.js"; 
import { ejecutarLimpieza } from "./cron/limpiezaCitas.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Configuración básica de CORS para desarrollo
app.use(cors({
    origin: '*', // Permite conexiones desde cualquier origen (ajustar en producción)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Para entender JSON del frontend

// Ejecutar limpieza al iniciar (si es necesario)
try {
    await ejecutarLimpieza();
} catch (error) {
    console.error("Advertencia: No se pudo ejecutar la limpieza inicial:", error.message);
}

// Definición de Rutas API
app.use("/api/auth", authRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/citas", citasRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api/horarios", horarioRoutes);

// Ruta base de prueba
app.get("/", (req, res) => {
    res.send("Servidor corriendo correctamente - Sistema de Salón");
});

// Manejo de errores global (404)
app.use((req, res, next) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor arrancado en puerto ${PORT}`);
    console.log(`Acceso local: http://localhost:${PORT}`);
});