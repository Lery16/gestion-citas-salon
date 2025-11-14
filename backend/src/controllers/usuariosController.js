import { db } from "../config/db.js";
import bcrypt from "bcryptjs";

export const registrarUsuario = async (req, res) => {
    const { usuario, password, rol } = req.body;

    if(!usuario || !password)
        return res.status(400).json({ mensaje: "falta datos" });

    try{
        const hash = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)";
        db.query(sql, [usuario, hash, rol || "empleado" ], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ mensaje: "Error al crear empleado" });

        }   
        res.status(201).json({ mensaje: "Empleado regristrado correctamente" });
        
        });

    } catch (error) {
        res.status(500).json({ mensaje: "Errro interno del servidor "});
    }
    };
    
