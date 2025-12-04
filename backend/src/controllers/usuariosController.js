import { db } from "../config/db.js";
// import bcrypt from "bcryptjs"; // ❌ ELIMINADO

export const registrarUsuario = async (req, res) => {
    const { usuario, password, rol } = req.body;

    if (!usuario || !password) {
        return res.status(400).json({ mensaje: "Faltan datos (usuario o password)." });
    }

    // ⚠️ ADVERTENCIA: Usamos la contraseña directamente.
    const rawPassword = password; 
    const rolUsuario = rol || "empleado"; 
    
    // Conexión y Transacción
    const client = await db.connect();

    try {
        // --- 1. Definición de la Consulta PostgreSQL ---
        // Utilizamos placeholders de PostgreSQL ($1, $2, $3)
        const sql = "INSERT INTO usuarios (usuario, password, rol) VALUES ($1, $2, $3)";
        
        // --- 2. Ejecución de la Consulta ---
        await client.query(sql, [
            usuario,    // $1
            rawPassword, // $2 (Contraseña sin hashear)
            rolUsuario  // $3
        ]);

        res.status(201).json({ mensaje: "Usuario registrado correctamente." });

    } catch (error) {
        console.error("Error al registrar usuario en PostgreSQL:", error);

        // PostgreSQL error code '23505' es para violación de restricción UNIQUE (como un correo o usuario ya existente)
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: "El nombre de usuario ya está registrado." });
        }
        
        res.status(500).json({ mensaje: "Error interno del servidor." });

    } finally {
        // Asegurarse de liberar el cliente a pesar de si hubo un error o no
        client.release();
    }
};