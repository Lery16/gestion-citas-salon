import { db } from '../config/db.js';

export const obtenerConfiguracionHoraria = async (req, res) => {
    let client;
    try {
        client = await db.connect();
        
        const sqlHorarioSemanal = `
            SELECT dia, TO_CHAR(hora_apertura, 'HH24:MI:SS') AS hora_apertura, TO_CHAR(hora_cierre, 'HH24:MI:SS') AS hora_cierre
            FROM Horario_Semanal_Empleado
            ORDER BY CASE dia
                WHEN 'Domingo' THEN 0
                WHEN 'Lunes' THEN 1
                WHEN 'Martes' THEN 2
                WHEN 'Miércoles' THEN 3
                WHEN 'Jueves' THEN 4
                WHEN 'Viernes' THEN 5
                WHEN 'Sábado' THEN 6
            END;
        `;
        const resultHorarioSemanal = await client.query(sqlHorarioSemanal);

        // Se selecciona la fecha límite (ej: 6 meses en el futuro) para las excepciones
        const fechaLimite = new Date();
        fechaLimite.setMonth(fechaLimite.getMonth() + 6);
        const fechaLimiteISO = fechaLimite.toISOString().split('T')[0];

        const sqlExcepciones = `
            SELECT fecha, TO_CHAR(hora_apertura, 'HH24:MI') AS hora_apertura, TO_CHAR(hora_cierre, 'HH24:MI') AS hora_cierre, estado_dia
            FROM Dia_Salon_Estado
            WHERE fecha >= CURRENT_DATE AND fecha <= $1;
        `;
        const resultExcepciones = await client.query(sqlExcepciones, [fechaLimiteISO]);

        res.json({
            horarios_semanales: resultHorarioSemanal.rows,
            excepciones: resultExcepciones.rows
        });
    } catch (err) {
        console.error("Error al obtener la configuración horaria:", err);
        res.status(500).json({ error: "Error interno al obtener la configuración horaria." });
    } finally {
        if (client) client.release();
    }
};

export const actualizarHorarioSemanal = async (req, res) => {
    const { horarios } = req.body;
    if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
        return res.status(400).json({ error: "Debe proporcionar una lista de horarios válida." });
    }

    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');

        for (const h of horarios) {
            const { dia, hora_apertura, hora_cierre } = h;
            // Si el front-end envía '00:00' para hora_apertura y hora_cierre, se usa '00:00:00' en BD.
            const apertura = hora_apertura ? `${hora_apertura}:00` : '00:00:00';
            const cierre = hora_cierre ? `${hora_cierre}:00` : '00:00:00';
            
            const sql = `
                INSERT INTO Horario_Semanal_Empleado (dia, hora_apertura, hora_cierre)
                VALUES ($1, $2::TIME, $3::TIME)
                ON CONFLICT (dia) DO UPDATE
                SET hora_apertura = EXCLUDED.hora_apertura,
                    hora_cierre = EXCLUDED.hora_cierre;
            `;
            await client.query(sql, [dia, apertura, cierre]);
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: "Horarios semanales actualizados correctamente." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al actualizar horario semanal:", err);
        if (err.code === '23514') {
            return res.status(400).json({ error: "Error de validación: La hora de cierre debe ser posterior a la hora de apertura. Verifique los horarios." });
        }
        res.status(500).json({ error: "Error interno al actualizar horario semanal." });
    } finally {
        if (client) client.release();
    }
};

export const guardarExcepciones = async (req, res) => {
    const { excepciones } = req.body;
    if (!excepciones || !Array.isArray(excepciones) || excepciones.length === 0) {
        return res.status(400).json({ error: "Debe proporcionar una lista de excepciones válida." });
    }

    // Filtra para procesar solo las excepciones marcadas como CERRADO
    const excepcionesCerradas = excepciones.filter(e => e.estado_dia && e.estado_dia.toLowerCase() === 'cerrado');
    
    if (excepcionesCerradas.length === 0) {
        return res.status(200).json({ mensaje: "No se encontraron días marcados como 'Cerrado' para guardar." });
    }

    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');

        for (const ex of excepcionesCerradas) {
            const { fecha } = ex;
            
            // Se usan horas dummy ya que es un día CERRADO.
            const aperturaBD = '00:00:00';
            const cierreBD = '00:00:01'; 
            const estadoBD = 'Cerrado';
            
            const sql = `
                INSERT INTO Dia_Salon_Estado (fecha, hora_apertura, hora_cierre, estado_dia)
                VALUES ($1, $2::TIME, $3::TIME, $4::estado_dia_enum)
                ON CONFLICT (fecha) DO UPDATE
                SET hora_apertura = EXCLUDED.hora_apertura,
                    hora_cierre = EXCLUDED.hora_cierre,
                    estado_dia = EXCLUDED.estado_dia;
            `;
            await client.query(sql, [fecha, aperturaBD, cierreBD, estadoBD]);
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: `Se guardaron ${excepcionesCerradas.length} excepciones de cierre.` });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al guardar excepciones:", err);
        // Error específico para el check constraint si se intenta insertar un Abierto/Cerrado con horarios inválidos
        if (err.code === 'P0001') { 
            return res.status(400).json({ error: "Error de la BD: Solo se pueden insertar o actualizar días con estado 'Cerrado' en la tabla de excepciones." });
        }
        res.status(500).json({ error: "Error interno al guardar excepciones." });
    } finally {
        if (client) client.release();
    }
};

export const eliminarExcepciones = async (req, res) => {
    const { fechas } = req.body;
    if (!fechas || !Array.isArray(fechas) || fechas.length === 0) {
        return res.status(400).json({ error: "Debe proporcionar una lista de fechas para eliminar." });
    }

    let client;
    try {
        client = await db.connect();
        
        // Crea los placeholders ($1, $2, $3...) para el array de fechas
        const placeholders = fechas.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `
            DELETE FROM Dia_Salon_Estado
            WHERE fecha IN (${placeholders});
        `;
        
        const result = await client.query(sql, fechas);

        res.status(200).json({ 
            mensaje: `Se eliminaron ${result.rowCount} excepciones de calendario.`, 
            eliminadas: result.rowCount 
        });
    } catch (err) {
        console.error("Error al eliminar excepciones:", err);
        res.status(500).json({ error: "Error interno al eliminar excepciones." });
    } finally {
        if (client) client.release();
    }
};