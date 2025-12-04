import { db } from "../config/db.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = "mi_super_secreto_123";

export const login = async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password)
    return res.status(400).json({ error: "Faltan datos" });

  try {
    const sql = `SELECT * FROM empleado WHERE correo = $1`;
    const result = await db.query(sql, [correo]);

    if (result.rows.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const user = result.rows[0];

    // Hash de la contraseña (igual que antes)
    const hashPassword = crypto.createHash("sha256").update(password).digest("hex");

    if (hashPassword !== user.contraseña)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    // Generar token
    const token = jwt.sign(
      { id: user.id_empleado, rol: user.rol },
      JWT_SECRET,
      { expiresIn: "0.25h" }
    );

    // 🚨 CAMBIO AQUÍ: Se añade user.id_empleado a la respuesta
    res.json({
      mensaje: "Inicio de sesión exitoso",
      token,
      rol: user.rol,
      id_usuario: user.id_empleado, // <--- CAMBIO CLAVE
    });

  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
};