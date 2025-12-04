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
            WHERE c.fecha = $1 AND c.estado = 'Confirmada'
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

export const getCitasListado = async (req, res) => {
    // 1. Recibir 'fecha' y 'userId' de la query
    const { fecha, userId } = req.query; // Ejemplo: '22/03/2024', '21'

    if (!fecha) {
        return res.status(400).json({ error: "Falta el parámetro 'fecha' en la consulta." });
    }
    // **Añadir validación para userId**
    if (!userId) {
        return res.status(400).json({ error: "Falta el parámetro 'userId' (ID del empleado)." });
    }


    // 🚨 CORRECCIÓN CLAVE: Reformatear la fecha de DD/MM/YYYY a YYYY-MM-DD para la DB
    const partesFecha = fecha.split('/'); 
    if (partesFecha.length !== 3) {
        return res.status(400).json({ error: "Formato de fecha inválido. Se espera DD/MM/YYYY." });
    }
    const fechaSQL = `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`; // Resultado: '2024-03-22'
    
    // **Convertir userId a número**
    const empleadoId = parseInt(userId, 10);
    if (isNaN(empleadoId)) {
        return res.status(400).json({ error: "El 'userId' debe ser un número entero válido." });
    }

    try {
        const sql = `
            SELECT 
                cl.nombre || ' ' || cl.apellido AS nombre_cliente,
                TO_CHAR(c.fecha, 'DD/MM/YYYY') AS dia_cita,
                ts.nombre_servicio AS servicio_cita,
                TO_CHAR(c.hora, 'HH24:MI') AS hora_cita,
                ts.precio AS precio_cita,
                c.estado AS estado_cita
            FROM 
                Cita c
            JOIN 
                Cliente cl ON c.id_cliente = cl.id_cliente
            JOIN 
                Tipo_Servicio ts ON c.id_servicio = ts.id_servicio
            WHERE 
                c.fecha = $1 AND c.id_empleado = $2 -- 🚨 FILTRO POR EMPLEADO AÑADIDO
            ORDER BY 
                c.hora ASC;
        `;
        
        // 2. Usar fechaSQL como $1 y empleadoId como $2
        const result = await db.query(sql, [fechaSQL, empleadoId]); // <-- ¡CAMBIO AQUÍ!

        if (result.rows.length === 0) {
            return res.json([]); 
        }

        const citasFormateadas = result.rows.map(cita => ({
            nombre: cita.nombre_cliente,
            dia: cita.dia_cita,
            servicio: cita.servicio_cita,
            hora: cita.hora_cita,
            precio: cita.precio_cita,
            estado: cita.estado_cita,
        }));
        
        res.json(citasFormateadas); 

    } catch (err) {
        console.error("Error al obtener citas del listado:", err);
        res.status(500).json({ error: "Error en el servidor al consultar citas" });
    }
};

export const buscarCitasFiltradas = async (req, res) => {
    // Filtros recibidos del body
    const { nombre, estado, fecha } = req.body; // 'fecha' es el filtro específico

    const parametros = [];
    let condiciones = [];
    let contador = 1;

    // 1. Filtro por nombre inteligente: soporta "Ana", "Ana Pérez", "Pérez", etc.
    if (nombre) {
        const partes = nombre.trim().split(/\s+/);

        if (partes.length === 1) {
            // Solo una palabra: buscar en nombre O apellido
            condiciones.push(`(cl.nombre ILIKE $${contador} OR cl.apellido ILIKE $${contador})`);
            parametros.push(`%${partes[0]}%`);
            contador++;
        } else {
            // Varias palabras: buscar en nombre completo concatenado
            condiciones.push(`(cl.nombre || ' ' || cl.apellido) ILIKE $${contador}`);
            parametros.push(`%${nombre}%`);
            contador++;
        }
    }

    // 2. Filtro de estado
    if (estado && estado !== "") {
        condiciones.push(`c.estado = $${contador}`);
        parametros.push(estado);
        contador++;
    }

    // 3. Filtro de fecha
    if (fecha) {
        condiciones.push(`c.fecha = $${contador}`);
        parametros.push(fecha);
        contador++;
    }
    
    // **NUEVA LÓGICA DE ORDENAMIENTO:**
    // Si se aplica un filtro de FECHA específica, es probable que se quiera ver lo más reciente/relevante primero (DESC).
    // Si NO se aplica un filtro de FECHA, se quiere ordenar por las citas más PRÓXIMAS (ASC).
    const ordenacion = fecha ? 'DESC' : 'ASC';

    // 4. Consulta SQL base
    let sql = `
        SELECT 
            c.id_cita AS id,
            cl.nombre || ' ' || cl.apellido AS cliente,
            ts.nombre_servicio AS servicio,
            c.fecha || 'T' || c.hora AS fecha, -- ISO string
            c.estado
        FROM Cita c
        JOIN Cliente cl ON c.id_cliente = cl.id_cliente
        JOIN Tipo_Servicio ts ON c.id_servicio = ts.id_servicio
    `;

    // 5. Agregar WHERE si hay condiciones
    if (condiciones.length > 0) {
        sql += ` WHERE ${condiciones.join(' AND ')}`;
    }

    // 6. Agregar ORDER BY dinámico
    sql += ` ORDER BY c.fecha ${ordenacion}, c.hora ASC;`;

    try {
        // 7. Ejecutar la consulta
        const result = await db.query(sql, parametros);

        // 8. Formatear resultados para el frontend
        const citasFormateadas = result.rows.map(cita => ({
            id: cita.id,
            cliente: cita.cliente,
            servicio: cita.servicio,
            fecha: cita.fecha,  // ya viene en formato ISO
            estado: cita.estado,
        }));

        res.json(citasFormateadas);

    } catch (err) {
        console.error("Error al buscar citas filtradas:", err);
        res.status(500).json({ error: "Error en el servidor al consultar citas" });
    }
};

// gestion_citas admin
export const actualizarCitasLote = async (req, res) => {
    const { cambios } = req.body; // Espera un array: [{ id: 1, estado: 'cancelada' }, ...]

    if (!cambios || !Array.isArray(cambios) || cambios.length === 0) {
        return res.status(400).json({ error: "No se proporcionaron cambios válidos." });
    }

    // Iniciamos una transacción
    const client = await db.connect(); // Asumiendo que usas 'pg' pool
    
    try {
        await client.query('BEGIN'); // Iniciar transacción

        // Iteramos sobre cada cambio y ejecutamos el UPDATE
        const queryUpdate = `UPDATE Cita SET estado = $1 WHERE id_cita = $2`;

        for (const cambio of cambios) {
            // Validar que existan los datos necesarios
            if (cambio.id && cambio.estado) {
                await client.query(queryUpdate, [cambio.estado, cambio.id]);
            }
        }

        await client.query('COMMIT'); // Confirmar cambios si todo salió bien
        
        res.json({ 
            mensaje: `Se actualizaron ${cambios.length} citas exitosamente.`,
            success: true 
        });

    } catch (err) {
        await client.query('ROLLBACK'); // Deshacer cambios si hubo error
        console.error("Error al actualizar lote:", err);
        res.status(500).json({ error: "Error en el servidor al actualizar citas." });
    } finally {
        client.release(); // Liberar el cliente de la base de datos
    }
};