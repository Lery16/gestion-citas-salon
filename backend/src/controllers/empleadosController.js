import { db } from "../config/db.js";

// Función auxiliar para sanitizar el estado antes de guardarlo en la BD
const sanitizeEstado = (estado) => {
    return estado ? estado.toLowerCase() : 'disponible';
};

// --- GET: Obtener empleados con sus servicios concatenados ---
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
        console.error(err);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
};

// --- POST: Crear un nuevo empleado ---
export const createEmpleado = async (req, res) => {
    const { 
        nombre, apellido, correo, telefono, rol, estado, contraseña, servicios 
    } = req.body;

    const nombreSplit = nombre.split(' ');
    const nuevoNombre = nombreSplit[0];
    const nuevoApellido = nombreSplit.slice(1).join(' ') || '';
    const estadoSanitizado = sanitizeEstado(estado || 'Disponible');

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const insertEmpQuery = `
            INSERT INTO Empleado (nombre, apellido, rol, telefono, correo, estado, contraseña)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id_empleado
        `;

        const result = await client.query(insertEmpQuery, [
            nuevoNombre, nuevoApellido, rol, telefono, correo, estadoSanitizado, contraseña
        ]);

        const nuevoEmpleadoId = result.rows[0].id_empleado;

        if (servicios && Array.isArray(servicios) && servicios.length > 0) {
            for (const servicioNombre of servicios) {
                const servRes = await client.query(
                    'SELECT id_servicio FROM Tipo_Servicio WHERE nombre_servicio = $1',
                    [servicioNombre]
                );

                if (servRes.rows.length > 0) {
                    await client.query(
                        'INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES ($1, $2)',
                        [nuevoEmpleadoId, servRes.rows[0].id_servicio]
                    );
                } else {
                    console.warn(`Servicio no encontrado en BD: ${servicioNombre}`);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({
            id: nuevoEmpleadoId,
            message: 'Empleado creado exitosamente',
            nombreCompleto: nombre
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en la creación de empleado:", err);

        if (err.code === '23505') {
            return res.status(400).json({
                error: 'El correo electrónico ya está registrado.'
            });
        }

        res.status(500).json({ error: 'Error interno del servidor al crear empleado' });
    } finally {
        client.release();
    }
};

// --- DELETE: Eliminar empleado ---
export const deleteEmpleado = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Empleado WHERE id_empleado = $1', [id]);
        res.json({ message: 'Empleado eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar empleado' });
    }
};

// --- PUT: Actualizar empleado ---
export const updateEmpleado = async (req, res) => {
    const { id } = req.params;
    const datosModificados = req.body; 

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. OBTENER DATOS ACTUALES: Se necesitan los valores actuales para asegurar que
        //    los campos NO modificados (como nombre/apellido/rol) no se pierdan.
        const currentDataRes = await client.query(
            'SELECT nombre, apellido, correo, telefono, estado, rol FROM Empleado WHERE id_empleado = $1',
            [id]
        );

        if (currentDataRes.rows.length === 0) {
            throw new Error('Empleado no encontrado');
        }

        const empleadoActual = currentDataRes.rows[0];

        // 2. CONSTRUIR EL OBJETO FINAL Y LA CONSULTA DINÁMICA
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        // Función auxiliar para agregar campos al UPDATE
        const addField = (dbField, bodyField, sanitizeFunc = null) => {
            if (datosModificados.hasOwnProperty(bodyField)) {
                let value = datosModificados[bodyField];
                if (sanitizeFunc) value = sanitizeFunc(value);

                updateFields.push(`${dbField} = $${paramCount++}`);
                updateValues.push(value);
            }
        };

        // Campos de la tabla Empleado
        addField('nombre', 'nombre');
        addField('apellido', 'apellido');
        addField('correo', 'correo');
        addField('telefono', 'telefono');
        addField('estado', 'estado', sanitizeEstado); // Asumiendo que sanitizeEstado existe

        // Ejecutar UPDATE si hay campos de Empleado para actualizar
        if (updateFields.length > 0) {
            const updateQuery = `
                UPDATE Empleado 
                SET ${updateFields.join(', ')}
                WHERE id_empleado = $${paramCount}
            `;
            updateValues.push(id); 
            await client.query(updateQuery, updateValues);
        }

        // 3. Manejar Servicios (Solo para Trabajadores y si se modificó)
        if (datosModificados.servicios && Array.isArray(datosModificados.servicios)) {
            // Usamos el rol actual del empleado que consultamos al inicio
            if (empleadoActual.rol === 'Trabajador') {

                // Lógica de DELETE e INSERT de servicios... (Tu código original)
                await client.query('DELETE FROM Empleado_Servicio WHERE id_empleado = $1', [id]);

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
                // Previene errores si el frontend accidentalmente intenta enviar servicios
                // para un Administrador.
                console.warn(`Servicios intentaron actualizarse para un empleado no trabajador (ID: ${id})`);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Empleado actualizado correctamente' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en updateEmpleado:", err); // <-- Más específico
        res.status(500).json({ error: 'Error al actualizar empleado' });
    } finally {
        client.release();
    }
};