import express from "express";
import cors from "cors";
import { db } from "./src/config/db.js";
import authRoutes from "./src/routes/auth.js";
import serviciosRoutes from "./src/routes/servicios.js";
import usuariosRoutes from "./src/routes/usuarios.js";

const app = express();

// Habilitar CORS
app.use(cors());

// Middleware para JSON
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/usuarios", usuariosRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor corriendo correctamente");
});

// Iniciar servidor
app.listen(3000, () => {
  console.log("Servidor escuchando en http://localhost:3000");
});