SELECT
    e.id_empleado, -- <--- AGREGAR ESTE CAMPO
    -- 1. Concatenar nombre y apellido
    e.nombre || ' ' || e.apellido AS nombre_completo,
    
    -- 2. Campos adicionales del empleado
    e.rol,
    e.telefono,
    e.correo,
    e.estado,
    e.contraseña,

    -- 3. Concatenar servicios con salto de línea HTML
    STRING_AGG(ts.nombre_servicio, '<br>') AS servicios_ofrecidos
FROM
    empleado e
JOIN
    empleado_servicio es ON e.id_empleado = es.id_empleado
JOIN
    tipo_servicio ts ON es.id_servicio = ts.id_servicio
GROUP BY
    e.id_empleado, e.nombre, e.apellido, e.rol, e.telefono, e.correo, e.estado, e.contraseña -- <--- YA ESTABA AQUÍ
ORDER BY
    nombre_completo;