import { db } from '../config/db.js';

/**
 * Obtiene todos los servicios (Tipo_Servicio).
 * GET /api/servicios
 */
export const obtenerServicios = async (req, res) => {
    console.log("Petición recibida a /api/servicios");
    // Usamos Tipo_Servicio y seleccionamos columnas relevantes
    const sql = `SELECT id_servicio, nombre_servicio, duracion_horas, precio, estado 
                 FROM Tipo_Servicio 
                 ORDER BY id_servicio ASC`;
    try {
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener servicios:", err);
        res.status(500).json({ error: "Error al obtener servicios" });
    }
};

/**
 * Crea un nuevo servicio en Tipo_Servicio.
 * POST /api/servicios
 */
export const crearServicio = async (req, res) => {
    const { nombre_servicio, duracion_horas, precio } = req.body;
    const sql = `INSERT INTO Tipo_Servicio (nombre_servicio, duracion_horas, precio, estado) 
                 VALUES ($1, $2, $3, 'Activo') 
                 RETURNING id_servicio`;
    try {
        const result = await db.query(sql, [nombre_servicio, duracion_horas, precio]);
        res.status(201).json({ 
            mensaje: "Servicio creado correctamente",
            id_servicio: result.rows[0].id_servicio
        });
    } catch (err) {
        console.error("Error al crear servicio:", err);
        if (err.code === '23505') { // Código de error de duplicado en PostgreSQL
             return res.status(400).json({ error: "El nombre del servicio ya existe." });
        }
        res.status(500).json({ error: "Error interno al crear servicio" });
    }
};

/**
 * Actualiza los datos de un servicio por ID.
 * PUT /api/servicios/:id
 */
export const actualizarServicio = async (req, res) => {
    const { id } = req.params; // id es id_servicio
    const { nombre_servicio, duracion_horas, precio, estado } = req.body;
    
    // Construcción dinámica del query de UPDATE (opcional: usar una tabla temporal para mayor seguridad)
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (nombre_servicio !== undefined) {
        updateFields.push(`nombre_servicio = $${paramCount++}`);
        updateValues.push(nombre_servicio);
    }
    if (duracion_horas !== undefined) {
        updateFields.push(`duracion_horas = $${paramCount++}`);
        updateValues.push(duracion_horas);
    }
    if (precio !== undefined) {
        updateFields.push(`precio = $${paramCount++}`);
        updateValues.push(precio);
    }
    if (estado !== undefined) {
        updateFields.push(`estado = $${paramCount++}`);
        updateValues.push(estado);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: "No se proporcionaron campos para actualizar." });
    }

    updateValues.push(id); // El ID es el último parámetro
    const sql = `
        UPDATE Tipo_Servicio 
        SET ${updateFields.join(', ')} 
        WHERE id_servicio = $${paramCount}
    `;

    try {
        const result = await db.query(sql, updateValues);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Servicio no encontrado." });
        }
        res.json({ mensaje: "Servicio actualizado correctamente" });
    } catch (err) {
        console.error("Error al actualizar servicio:", err);
        res.status(500).json({ error: "Error interno al actualizar servicio" });
    }
};

/**
 * Obtiene empleados disponibles por ID de servicio.
 * GET /api/servicios/empleados/:id (o la ruta que hayas configurado)
 */
export const empleadosPorServicio = async (req, res) => {
    const idServicio = req.params.id;
    const sql = `
        SELECT 
            e.id_empleado AS id, 
            e.nombre, 
            e.apellido, 
            e.estado,
            e.rol
        FROM Empleado e
        INNER JOIN Empleado_Servicio es ON e.id_empleado = es.id_empleado
        WHERE es.id_servicio = $1 AND e.estado = 'Disponible' AND e.rol = 'Trabajador';
    `;
    try {
        const result = await db.query(sql, [idServicio]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener empleados por servicio:", err);
        res.status(500).json({ error: "Error al obtener empleados por servicio" });
    }
};

/**
 * Elimina un servicio por ID.
 * DELETE /api/servicios/:id
 */
export const eliminarServicio = async (req, res) => {
    const { id } = req.params; // id es id_servicio
    // PostgreSQL maneja la eliminación de registros relacionados en Empleado_Servicio
    // gracias a la cláusula ON DELETE CASCADE que tienes definida.
    const sql = "DELETE FROM Tipo_Servicio WHERE id_servicio = $1";
    try {
        const result = await db.query(sql, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Servicio no encontrado." });
        }
        res.json({ mensaje: "Servicio eliminado correctamente" });
    } catch (err) {
        // Error '23503' si hay referencias de Cita (RESTRICT)
        if (err.code === '23503') { 
            return res.status(409).json({ error: "No se puede eliminar el servicio porque tiene citas asociadas." });
        }
        console.error("Error al eliminar servicio:", err);
        res.status(500).json({ error: "Error interno al eliminar servicio" });
    }
};


/**
 * Recibe una lista de nombres de servicios del frontend y los procesa.
 * POST /api/servicios/guardar
 */
export const guardarServiciosSeleccionados = async (req, res) => {
    // El frontend envía: { servicios: ["Corte de Pelo", "Manicure"] }
    const { servicios } = req.body; 

    if (!servicios || !Array.isArray(servicios) || servicios.length === 0) {
        return res.status(400).json({ error: "Debe proporcionar una lista de servicios válida." });
    }

    console.log("Recibida solicitud para guardar servicios:", servicios);

    let client;
    let serviciosEncontradosConId = [];

    try {
        client = await db.connect();
        await client.query('BEGIN'); 

        // 1. Buscar los IDs de los servicios seleccionados
        for (const nombreServicio of servicios) {
            const result = await client.query(
                'SELECT id_servicio FROM Tipo_Servicio WHERE nombre_servicio = $1 AND estado = $2',
                [nombreServicio, 'Activo']
            );
            
            if (result.rows.length > 0) {
                serviciosEncontradosConId.push(result.rows[0].id_servicio);
            }
        }
        
        if (serviciosEncontradosConId.length === 0) {
            await client.query('ROLLBACK'); 
            return res.status(404).json({ error: "Ningún servicio válido o activo encontrado en la base de datos." });
        }

        // 2. Lógica de negocio faltante (por ejemplo, registrar una cita o asociar a un empleado)

        // --- SIMULACIÓN DE ÉXITO ---
        await client.query('COMMIT'); 

        res.status(200).json({
            message: "Servicios recibidos, validados y listos para uso (lógica de guardado pendiente de implementar).",
            servicios_ids: serviciosEncontradosConId,
            total_servicios_validados: serviciosEncontradosConId.length
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error en guardarServiciosSeleccionados:", err);
        res.status(500).json({ error: 'Error interno del servidor al procesar los servicios.' });
    } finally {
        if (client) client.release();
    }
};