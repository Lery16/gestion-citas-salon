// En el backend (archivo de controladores)
import { db } from "../config/db.js";

export const getCitasHoy = async (req, res) => {
    const fechaConsulta = req.query.fecha; 
    
    // Validar si la fecha está presente
    if (!fechaConsulta) {
        return res.status(400).json({ error: "Falta el parámetro 'fecha' en la consulta." });
    }

    try {
        const sql = `
            SELECT 
                c.id_cita, 
                cl.nombre AS nombre_cliente, 
                cl.apellido AS apellido_cliente, 
                ts.nombre_servicio, 
                e.nombre AS nombre_empleado, 
                e.apellido AS apellido_empleado, 
                c.hora, 
                c.hora_fin,
                c.estado 
            FROM Cita c
            JOIN Cliente cl ON c.id_cliente = cl.id_cliente 
            JOIN Tipo_Servicio ts ON c.id_servicio = ts.id_servicio 
            JOIN Empleado e ON c.id_empleado = e.id_empleado 
            WHERE c.fecha = $1 AND c.estado = 'confirmada'
            ORDER BY c.hora ASC;
        `;
        
        // 2. EJECUTAR LA CONSULTA PASANDO LA FECHA COMO PARÁMETRO
        // Esto es crucial para la seguridad (evitar SQL Injection)
        const result = await db.query(sql, [fechaConsulta]); 

        if (result.rows.length === 0) {
            return res.json({ mensaje: `No hay citas confirmadas para la fecha ${fechaConsulta}.`, citas: [] });
        }

        res.json({ 
            mensaje: `Citas confirmadas para ${fechaConsulta}:`, 
            citas: result.rows,
        });

    } catch (err) {
        console.error("Error al obtener citas del día:", err);
        res.status(500).json({ error: "Error en el servidor al consultar citas" });
    }
};