import { db } from "../config/db.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = "mi_super_secreto_123";

export const login = (req, res) => {
  const { correo, password } = req.body;

  console.log("Correo recibido:", correo);
  console.log("Contraseña recibida:", password);

  if (!correo || !password)
    return res.status(400).json({ error: "Faltan datos" });

  const sql = "SELECT * FROM Empleado WHERE correo = ?";

  db.query(sql, [correo], (err, result) => {
    if (err) return res.status(500).json({ error: "Error en el servidor" });
    if (result.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const user = result[0];

    // Hash de la contraseña recibida para comparar con la base (SHA256)
    const hashPassword = crypto.createHash('sha256').update(password).digest('hex');

    const passwordValida = hashPassword === user.contraseña;

    if (!passwordValida)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id_empleado, rol: user.rol },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      mensaje: "Inicio de sesión exitoso",
      token,
      rol: user.rol,
    });
  });
};