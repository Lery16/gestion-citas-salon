import { db } from "../config/db.js";

export const getEstadoMes = async (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: "Año y mes requeridos" });
    }

    try {
        // Generamos todas las fechas del mes solicitado y comparamos con las tablas
        // Esta consulta hace lo siguiente:
        // 1. Genera los días del mes.
        // 2. Hace JOIN con Dia_Salon_Estado para ver si hay bloqueos específicos.
        // 3. Hace JOIN con Horario_Semanal_Empleado para ver si el día de la semana (Lunes, etc.) se trabaja.
        
        const sql = `
            WITH fechas_mes AS (
                SELECT generate_series(
                    MAKE_DATE($1::int, $2::int, 1),
                    (MAKE_DATE($1::int, $2::int, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date,
                    '1 day'::interval
                )::date AS fecha
            )
            SELECT 
                to_char(fm.fecha, 'YYYY-MM-DD') as fecha_str,
                CASE 
                    -- 1. Si está explícitamente CERRADO en Dia_Salon_Estado
                    WHEN dse.estado_dia = 'Cerrado' THEN 'Cerrado'
                    -- 2. Si NO existe horario semanal para ese día (NULL) o es horario 00:00 (Cierre técnico)
                    WHEN hse.dia IS NULL OR (hse.hora_apertura = '00:00:00' AND hse.hora_cierre = '00:00:01') THEN 'Cerrado'
                    -- 3. Si existe horario y no está cerrado específicamente
                    ELSE 'Abierto'
                END as estado
            FROM fechas_mes fm
            LEFT JOIN Dia_Salon_Estado dse ON fm.fecha = dse.fecha
            LEFT JOIN Horario_Semanal_Empleado hse ON 
                CASE trim(to_char(fm.fecha, 'Day'))
                    WHEN 'Monday' THEN 'Lunes'
                    WHEN 'Tuesday' THEN 'Martes'
                    WHEN 'Wednesday' THEN 'Miércoles'
                    WHEN 'Thursday' THEN 'Jueves'
                    WHEN 'Friday' THEN 'Viernes'
                    WHEN 'Saturday' THEN 'Sábado'
                    WHEN 'Sunday' THEN 'Domingo'
                END::dia_semana_enum = hse.dia;
        `;

        const result = await db.query(sql, [year, month]);

        // Formateamos para el frontend: { "2024-10-01": "Abierto", "2024-10-02": "Cerrado" }
        const mapaEstados = {};
        result.rows.forEach(row => {
            mapaEstados[row.fecha_str] = row.estado;
        });

        res.json(mapaEstados);

    } catch (err) {
        console.error("Error al obtener estado del calendario:", err);
        res.status(500).json({ error: "Error interno al calcular calendario" });
    }
};