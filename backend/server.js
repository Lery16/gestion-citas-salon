import 'dotenv/config';
import express from "express";
import cors from "cors";

// Asegúrate de que esta ruta apunte al archivo que creamos, 
// o cambia el nombre del archivo routes/empleado.js a routes/empleados.js
import authRoutes from "./src/routes/auth.js";
import serviciosRoutes from "./src/routes/servicios.js";
import usuariosRoutes from "./src/routes/usuarios.js";
import citasRoutes from "./src/routes/citas.js";
import empleadoRoutes from "./src/routes/empleados.js";
import "./cron/limpiezaCitas.js";
import { ejecutarLimpieza } from "./cron/limpiezaCitas.js"; 

const app = express();

await ejecutarLimpieza();

// Habilitar CORS
app.use(cors());

// Middleware para JSON
app.use(express.json());

// --- Rutas ---

app.use("/api/auth", authRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/citas", citasRoutes);
// AÑADIDO: Ruta para el manejo de Empleados (GET, PUT, DELETE)
app.use("/api/empleados", empleadoRoutes); 

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor corriendo correctamente");
});

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor arrancado en puerto ${PORT}`);
});

app.use((req, res, next) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});