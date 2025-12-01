import 'dotenv/config';
import express from "express";
import cors from "cors";

import authRoutes from "./src/routes/auth.js";
import serviciosRoutes from "./src/routes/servicios.js";
import usuariosRoutes from "./src/routes/usuarios.js";
import citasRoutes from "./src/routes/citas.js";
import empleadosRoutes from "./src/routes/empleados.js";

import 'dotenv/config'; // si usas dotenv y .env

const app = express();

// Habilitar CORS
app.use(cors());

// Middleware para JSON
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/citas", citasRoutes);
app.use("/api/empleados", empleadosRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor corriendo correctamente");
});

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor arrancado en puerto ${PORT}`);
});