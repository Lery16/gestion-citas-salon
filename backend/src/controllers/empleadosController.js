import { db } from "../config/db.js";

// Obtener empleados (con sus servicios si los tienen)
export const getEmpleados = async (req, res) => {
    const { nombre } = req.query;
    let query = `
        SELECT 
            e.id_empleado AS id, 
            e.nombre, 
            e.apellido, 
            e.correo, 
            e.rol, 
            e.telefono, 
            e.estado, 
            COALESCE(ARRAY_AGG(ts.nombre_servicio) FILTER (WHERE ts.nombre_servicio IS NOT NULL), '{}') as servicios 
        FROM Empleado e
        LEFT JOIN Empleado_Servicio es ON e.id_empleado = es.id_empleado
        LEFT JOIN Tipo_Servicio ts ON es.id_servicio = ts.id_servicio
    `;
    
    const values = [];

    if (nombre) {
        query += ` WHERE CONCAT(e.nombre, ' ', e.apellido) ILIKE $1 `;
        values.push(`%${nombre}%`);
    }

    query += ` GROUP BY e.id_empleado ORDER BY e.id_empleado ASC`;

    try {
        const result = await db.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error("Error en getEmpleados:", err);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
};

export const createEmpleado = async (req, res) => {
    // Desestructuración
    const { nombre, apellido, correo, telefono, rol, contraseña, servicios } = req.body; 

    // 🚩 VALIDACIÓN:
    if (!nombre || !apellido || !correo || !contraseña || !rol) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, apellido, correo, contraseña, rol).' });
    }
    
    // --- 1. Gestión de la Contraseña (SIN HASHING) ---
    // ⚠️ ALERTA: La contraseña se usa directamente sin hasheo.
    const rawContraseña = contraseña;
    // ------------------------------------------------

    // 🚀 LÍNEAS DE SANEAMIENTO SIMPLIFICADAS:
    const nombreLimpio = nombre; 
    const apellidoLimpio = apellido;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // --- 2. Insertar en la tabla Empleado ---
        const insertEmpQuery = `
            INSERT INTO Empleado (nombre, apellido, rol, telefono, correo, contraseña)
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id_empleado
        `;
        
        const result = await client.query(insertEmpQuery, [
            nombreLimpio, // $1
            apellidoLimpio, // $2
            rol, // $3
            telefono, // $4
            correo, // $5
            rawContraseña // $6 (Usando la contraseña sin hashear)
        ]);
        const nuevoEmpleadoId = result.rows[0].id_empleado;

        // --- 3. Lógica Condicional para Empleado_Servicio (Solo si es Trabajador) ---
        if (rol !== 'Administrador' && servicios && Array.isArray(servicios) && servicios.length > 0) {
            
            // Recorrer la lista de nombres de servicios recibidos del frontend
            for (const servicioNombre of servicios) {
                // Obtener el id_servicio a partir del nombre
                const servRes = await client.query(
                    'SELECT id_servicio FROM Tipo_Servicio WHERE nombre_servicio = $1',
                    [servicioNombre]
                );
                
                if (servRes.rows.length > 0) {
                    // 🚩 Insertar en la tabla de asociación Empleado_Servicio
                    await client.query(
                        'INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES ($1, $2)',
                        [nuevoEmpleadoId, servRes.rows[0].id_servicio]
                    );
                } else {
                    console.warn(`Servicio no encontrado en BD: ${servicioNombre}. No se asociará.`);
                }
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ id: nuevoEmpleadoId, message: 'Empleado creado exitosamente', nombreCompleto: nombreLimpio + ' ' + apellidoLimpio });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en la creación de empleado:", err);

        if (err.code === '23505') { 
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }
        if (err.constraint === 'tr_empleado_servicio_admin_check') {
            return res.status(400).json({ error: 'El rol de Administrador no puede tener servicios asignados.' });
        }
        
        res.status(500).json({ error: 'Error interno del servidor al crear empleado' });
    } finally {
        client.release();
    }
};

// Eliminar Empleado
export const deleteEmpleado = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM Empleado WHERE id_empleado = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Empleado no encontrado." });
        }
        res.json({ message: 'Empleado eliminado correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar empleado' });
    }
};

// Actualizar Empleado
export const updateEmpleado = async (req, res) => {
    const { id } = req.params;
    const datosModificados = req.body;
    
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // Verificar existencia
        const currentDataRes = await client.query(
            'SELECT nombre, apellido, correo, telefono, estado, rol FROM Empleado WHERE id_empleado = $1', 
            [id]
        );

        if (currentDataRes.rows.length === 0) {
            throw new Error('Empleado no encontrado');
        }

        const empleadoActual = currentDataRes.rows[0];
        
        // Construir Query dinámica
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        const addField = (dbField, bodyField, sanitizeFunc = null) => {
            if (datosModificados.hasOwnProperty(bodyField)) {
                let value = datosModificados[bodyField];
                if (sanitizeFunc) value = sanitizeFunc(value);
                updateFields.push(`${dbField} = $${paramCount++}`);
                updateValues.push(value);
            }
        };

        addField('nombre', 'nombre');
        addField('apellido', 'apellido');
        addField('correo', 'correo');
        addField('telefono', 'telefono');
        addField('estado', 'estado', sanitizeEstado);
        // Permitir cambio de rol
        addField('rol', 'rol');

        if (updateFields.length > 0) {
            const updateQuery = `
                UPDATE Empleado 
                SET ${updateFields.join(', ')} 
                WHERE id_empleado = $${paramCount}
            `;
            updateValues.push(id);
            await client.query(updateQuery, updateValues);
        }

        // Determinar el rol final (puede haber cambiado en esta petición o mantenerse el anterior)
        const nuevoRol = datosModificados.rol || empleadoActual.rol;

        // Actualizar servicios SOLO si el rol final es Trabajador
        if (datosModificados.servicios && Array.isArray(datosModificados.servicios)) {
            
            // Primero limpiamos servicios anteriores para evitar duplicados o errores
            await client.query('DELETE FROM Empleado_Servicio WHERE id_empleado = $1', [id]);

            if (nuevoRol === 'Trabajador') {
                for (const servicioNombre of datosModificados.servicios) {
                    const servRes = await client.query(
                        'SELECT id_servicio FROM Tipo_Servicio WHERE nombre_servicio = $1', 
                        [servicioNombre]
                    );

                    if (servRes.rows.length > 0) {
                        await client.query(
                            'INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES ($1, $2)',
                            [id, servRes.rows[0].id_servicio]
                        );
                    }
                }
            } else {
                console.log(`Empleado ID ${id} es ${nuevoRol}. Se eliminaron sus asociaciones de servicios (si tenía).`);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Empleado actualizado correctamente' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en updateEmpleado:", err);
        res.status(500).json({ error: 'Error al actualizar empleado' });
    } finally {
        client.release();
    }
};

// Obtener horario semanal general (NO requiere ID de Empleado en la URL)
export const getHorarioSemanal = async (req, res) => {
    try {
        // La consulta trae todos los registros de la tabla de horario.
        // Asumiendo que esta tabla representa el horario del salón o el horario base.
        const sql = `
            SELECT dia, hora_apertura, hora_cierre
            FROM public.horario_semanal_empleado
            ORDER BY dia ASC
        `; 
        const result = await db.query(sql);

        // El frontend espera un array de objetos con el horario semanal
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener el horario semanal:", err);
        res.status(500).json({ error: "Error interno al obtener el horario." });
    }
};

// Obtener servicios que realiza un empleado específico
export const getServiciosEmpleado = async (req, res) => {
    const { id } = req.params;

    try {
        // Hacemos JOIN entre Tipo_Servicio y Empleado_Servicio
        const sql = `
            SELECT ts.nombre_servicio 
            FROM Tipo_Servicio ts
            JOIN Empleado_Servicio es ON ts.id_servicio = es.id_servicio
            WHERE es.id_empleado = $1 AND ts.estado = 'Activo'
        `;
        const result = await db.query(sql, [id]);

        // El frontend espera un array de objetos con {nombre_servicio}
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener servicios del empleado:", err);
        res.status(500).json({ error: "Error interno al obtener los servicios." });
    }
};