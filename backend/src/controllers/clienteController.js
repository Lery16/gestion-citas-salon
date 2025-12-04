import { db } from '../config/db.js';

/**
 * Registra un cliente y devuelve el ID del cliente y el ID del servicio
 *
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
export const registrarClienteYObtenerIds = async (req, res) => {
    const { email, celular, nombre, apellido, servicioNombre } = req.body;

    // Validación básica de datos
    if (!nombre || !apellido || !email || !servicioNombre) {
        return res.status(400).json({ message: 'Faltan datos requeridos (nombre, apellido, email, servicioNombre).' });
    }

    try {
        // 1. Iniciar una transacción para asegurar que ambas operaciones se completen
        await db.query('BEGIN');

        // 2. Buscar el ID del servicio por su nombre
        // NOTA: El nombre del servicio en el SELECT debe coincidir exactamente con el que viene del HTML.
        const servicioQuery = `
            SELECT id_servicio 
            FROM Tipo_Servicio 
            WHERE nombre_servicio = $1
        `;
        const servicioResult = await db.query(servicioQuery, [servicioNombre]);

        if (servicioResult.rows.length === 0) {
            await db.query('ROLLBACK'); // Deshacer la transacción si el servicio no se encuentra
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }

        const id_servicio = servicioResult.rows[0].id_servicio;

        // 3. Insertar el nuevo cliente y obtener su ID de vuelta
        const clienteQuery = `
            INSERT INTO Cliente (nombre, apellido, telefono, correo) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (correo) DO UPDATE 
            SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, telefono = EXCLUDED.telefono
            RETURNING id_cliente;
        `;
        
        // El campo 'celular' del HTML se mapea a 'telefono' en la BD.
        const clienteResult = await db.query(clienteQuery, [nombre, apellido, celular, email]);
        
        const id_cliente = clienteResult.rows[0].id_cliente;

        // 4. Confirmar la transacción
        await db.query('COMMIT');

        // 5. Enviar respuesta con ambos IDs
        res.status(201).json({ 
            message: 'Cliente registrado y IDs obtenidos con éxito.',
            id_cliente: id_cliente,
            id_servicio: id_servicio
        });

    } catch (error) {
        await db.query('ROLLBACK'); // Deshacer en caso de cualquier error
        console.error('Error en registrarClienteYObtenerIds:', error);
        // Manejar el caso de un UNIQUE constraint violation si se intenta hacer la inserción dos veces
        // con un correo que ya existe si el ON CONFLICT no fuera suficiente o hay otro error
        if (error.code === '23505') { // Código de error de duplicado en PostgreSQL
             return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
        }
        res.status(500).json({ message: 'Error interno del servidor al registrar cliente.', error: error.message });
    }
};