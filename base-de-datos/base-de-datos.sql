-- SISTEMA DE GESTIÓN DE CITAS PARA SALÓN DE BELLEZA
--
-- Establece la extensión pgcrypto para el hash de contraseñas (MANDATORY).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. DROPS (Limpieza de Objetos Existentes)
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS obtener_slots_disponibles(INT, DATE, INT, INTERVAL);
DROP FUNCTION IF EXISTS fn_reporte_ingreso_diario(DATE);

DROP TRIGGER IF EXISTS tr_cita_before_insert ON Cita;
DROP TRIGGER IF EXISTS tr_cita_after_insert ON Cita;
DROP TRIGGER IF EXISTS tr_cita_after_update ON Cita;

DROP FUNCTION IF EXISTS tr_cita_before_insert_func();
DROP FUNCTION IF EXISTS tr_cita_after_insert_func();
DROP FUNCTION IF EXISTS tr_cita_after_update_func();


DROP TABLE IF EXISTS Horario_Semanal_Empleado CASCADE;
DROP TABLE IF EXISTS Empleado_Servicio CASCADE;
DROP TABLE IF EXISTS Disponibilidad_Diaria_Empleado CASCADE;
DROP TABLE IF EXISTS Cita CASCADE;
DROP TABLE IF EXISTS Dia_Salon_Estado CASCADE;
DROP TABLE IF EXISTS Tipo_Servicio CASCADE;
DROP TABLE IF EXISTS Empleado CASCADE;
DROP TABLE IF EXISTS Cliente CASCADE;


DROP TYPE IF EXISTS rol_empleado_enum CASCADE;
DROP TYPE IF EXISTS estado_empleado_enum CASCADE;
DROP TYPE IF EXISTS estado_servicio_enum CASCADE;
DROP TYPE IF EXISTS estado_dia_enum CASCADE;
DROP TYPE IF EXISTS estado_cita_enum CASCADE;
DROP TYPE IF EXISTS dia_semana_enum CASCADE;


-- 2. DEFINICIÓN DE TIPOS (ENUMs)
----------------------------------------------------------------------
CREATE TYPE rol_empleado_enum AS ENUM ('Trabajador', 'Administrador');
CREATE TYPE estado_empleado_enum AS ENUM ('Disponible', 'Vacacionando');
CREATE TYPE estado_servicio_enum AS ENUM ('Activo', 'Inactivo');
CREATE TYPE estado_dia_enum AS ENUM ('Abierto', 'Cerrado');
CREATE TYPE estado_cita_enum AS ENUM ('Pendiente', 'Confirmada', 'Cancelada', 'Completada');
CREATE TYPE dia_semana_enum AS ENUM ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo');


-- 3. DEFINICIÓN DE TABLAS
----------------------------------------------------------------------

CREATE TABLE Cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NULL,
    correo VARCHAR(255) UNIQUE
);
ALTER SEQUENCE cliente_id_cliente_seq RESTART WITH 11;


CREATE TABLE Empleado (
    id_empleado SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rol rol_empleado_enum NOT NULL,
    telefono VARCHAR(20) NULL,
    correo VARCHAR(255) UNIQUE,
    estado estado_empleado_enum NOT NULL DEFAULT 'Disponible',
    contraseña VARCHAR(255) NOT NULL
);
ALTER SEQUENCE empleado_id_empleado_seq RESTART WITH 21;


CREATE TABLE Tipo_Servicio (
    id_servicio SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR(255) NOT NULL,
    duracion_horas DECIMAL(4,2) NOT NULL, -- Duración en horas (e.g., 1.5 para 1 hora y 30 minutos)
    precio DECIMAL(10,2) NOT NULL,
    estado estado_servicio_enum NOT NULL DEFAULT 'Activo'
);
ALTER SEQUENCE tipo_servicio_id_servicio_seq RESTART WITH 31;


CREATE TABLE Empleado_Servicio (
    id_empleado INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    PRIMARY KEY (id_empleado, id_servicio),
    CONSTRAINT fk_empleado_es FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_servicio_es FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE Dia_Salon_Estado (
    fecha DATE PRIMARY KEY,
    hora_apertura TIME NOT NULL DEFAULT '09:00:00',
    hora_cierre TIME NOT NULL DEFAULT '19:00:00',
    estado_dia estado_dia_enum NOT NULL DEFAULT 'Abierto',
    CONSTRAINT chk_horario_salon CHECK (hora_cierre > hora_apertura)
);


CREATE TABLE Horario_Semanal_Empleado (
    id_horario SERIAL PRIMARY KEY,
    id_empleado INTEGER NOT NULL,
    dia dia_semana_enum NOT NULL,
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL,
    CONSTRAINT fk_Horario_Semanal FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_horario_logico CHECK (hora_cierre > hora_apertura),
    UNIQUE (id_empleado, dia)
);
CREATE INDEX idx_horario_empleado ON Horario_Semanal_Empleado(id_empleado);


CREATE TABLE Disponibilidad_Diaria_Empleado (
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    -- Horas disponibles iniciales basadas en Horario_Semanal - se resta tiempo con citas
    horas_disponibles_restantes DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id_empleado, fecha),
    CONSTRAINT fk_empleado_dd FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE Cita (
    id_cita SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    hora_fin TIME NULL, -- Se calcula automáticamente por el trigger antes de insertar
    estado estado_cita_enum NOT NULL DEFAULT 'Pendiente',
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cliente_c FOREIGN KEY (id_cliente) REFERENCES Cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_servicio_c FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_empleado_c FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE (id_empleado, fecha, hora) -- Evita duplicidad de citas al mismo tiempo
);
CREATE INDEX idx_cita_empleado_fecha ON Cita(id_empleado, fecha);
CREATE INDEX idx_cita_cliente_fecha ON Cita(id_cliente, fecha);


-- 4. FUNCIONES Y TRIGGERS (Lógica de Negocio)
----------------------------------------------------------------------

-- Función de Trigger BEFORE INSERT/UPDATE en Cita (Validación de horarios y solapamiento)
CREATE OR REPLACE FUNCTION tr_cita_before_insert_func()
RETURNS TRIGGER AS $$
DECLARE
    salon_abierto estado_dia_enum; 
    duracion DECIMAL(6,2);
    horas_restantes DECIMAL(6,2);
    hora_apertura_salon TIME;
    hora_cierre_salon TIME;
    hora_fin_cita TIME;
    solapamiento_existe BOOLEAN;
BEGIN
    -- 1. Obtener la duración del servicio
    SELECT duracion_horas INTO duracion 
    FROM Tipo_Servicio 
    WHERE id_servicio = NEW.id_servicio;

    -- 2. Calcular la hora de fin de la nueva cita y asignarla a NEW.hora_fin
    hora_fin_cita := NEW.hora + (duracion * INTERVAL '1 hour');
    NEW.hora_fin := hora_fin_cita;

    -- 3. Obtener horario del salón, usando los valores por defecto si no existe la fecha
    SELECT 
        COALESCE(estado_dia, 'Cerrado'::estado_dia_enum),
        COALESCE(hora_apertura, '09:00:00'::TIME),
        COALESCE(hora_cierre, '19:00:00'::TIME)
    INTO 
        salon_abierto, 
        hora_apertura_salon, 
        hora_cierre_salon
    FROM 
        Dia_Salon_Estado
    WHERE 
        fecha = NEW.fecha;

    IF salon_abierto = 'Cerrado' THEN
        RAISE EXCEPTION 'El salón está CERRADO para citas en esta fecha.';
    END IF;

    
    -- 4. Validación de horario del salón (Inicio y Fin de la cita)
    IF NEW.hora < hora_apertura_salon OR NEW.hora >= hora_cierre_salon THEN
        RAISE EXCEPTION 'La cita debe iniciar entre % y antes de % (Horario del Salón).', hora_apertura_salon, hora_cierre_salon;
    END IF;

    IF NEW.hora_fin > hora_cierre_salon THEN
        RAISE EXCEPTION 'La duración del servicio (%) excede el horario de cierre (%). La cita finalizaría a las %.', duracion, hora_cierre_salon, NEW.hora_fin;
    END IF;

    -- 5. Validación de SOLAPAMIENTO con otras citas confirmadas
    SELECT EXISTS (
        SELECT 1 
        FROM Cita 
        WHERE 
            id_empleado = NEW.id_empleado
            AND fecha = NEW.fecha
            AND id_cita IS DISTINCT FROM NEW.id_cita -- Excluir la cita actual en caso de UPDATE
            AND estado IN ('Pendiente', 'Confirmada')
            -- Intervalo de tiempo: [hora, hora_fin)
            AND NEW.hora < hora_fin 
            AND NEW.hora_fin > hora 
    ) INTO solapamiento_existe;
    IF solapamiento_existe THEN
        RAISE EXCEPTION 'El empleado ya tiene una cita confirmada que se solapa con el periodo de % a % en esta fecha.', NEW.hora, NEW.hora_fin;
    END IF;

    -- 6. Validación de disponibilidad del empleado (Horas restantes)
    -- Se chequea la disponibilidad global del día
    SELECT COALESCE(horas_disponibles_restantes, 0.00) INTO horas_restantes
    FROM Disponibilidad_Diaria_Empleado
    WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;

    -- Si se inserta una nueva cita confirmada o si se actualiza a confirmada/pendiente
    IF NEW.estado IN ('Confirmada', 'Pendiente') THEN
        -- Si es un UPDATE y se mantiene el estado, no necesitamos chequear disponibilidad, ya está reservada.
        IF TG_OP = 'UPDATE' AND OLD.estado IN ('Confirmada', 'Pendiente') THEN
            RETURN NEW;
        END IF;

        IF horas_restantes < duracion THEN
            RAISE EXCEPTION 'El empleado % no tiene suficiente tiempo. Restantes: %. Necesarias: %', NEW.id_empleado, horas_restantes, duracion;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_before_insert
BEFORE INSERT ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_before_insert_func();


-- Función de Trigger BEFORE INSERT/UPDATE en Empleado_Servicio (Bloquea Administradores)
CREATE OR REPLACE FUNCTION tr_empleado_servicio_admin_check_func()
RETURNS TRIGGER AS $$
DECLARE
    empleado_rol rol_empleado_enum;
BEGIN
    -- 1. Obtener el rol del empleado que se intenta asignar
    SELECT rol INTO empleado_rol
    FROM Empleado
    WHERE id_empleado = NEW.id_empleado;

    -- 2. Verificar si es un Administrador
    IF empleado_rol = 'Administrador' THEN
        RAISE EXCEPTION 'Un empleado con rol "Administrador" no puede ser asignado a servicios (id: %).', NEW.id_empleado
        USING HINT = 'Asigne solo el rol "Trabajador" a los empleados que ofrecen servicios.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ejecutar la función antes de insertar o actualizar en Empleado_Servicio
CREATE TRIGGER tr_empleado_servicio_admin_check
BEFORE INSERT OR UPDATE ON Empleado_Servicio
FOR EACH ROW
EXECUTE FUNCTION tr_empleado_servicio_admin_check_func();

-- Función de Trigger AFTER INSERT en Cita (Actualiza Disponibilidad Diaria)
CREATE OR REPLACE FUNCTION tr_cita_after_insert_func() RETURNS TRIGGER AS $$
DECLARE
    duracion DECIMAL(6,2);
    emp_entrada TIME;
    emp_salida TIME;
    horas_totales_emp DECIMAL(6,2);
    dia_actual_texto TEXT;
    dia_enum dia_semana_enum;
BEGIN
    -- Asegurar que exista una entrada para el día en Dia_Salon_Estado (usando los defaults si es necesario)
    INSERT INTO Dia_Salon_Estado (fecha) VALUES (NEW.fecha) ON CONFLICT (fecha) DO NOTHING;

    IF NEW.estado IN ('Confirmada', 'Pendiente') THEN
        SELECT duracion_horas INTO duracion 
        FROM Tipo_Servicio 
        WHERE id_servicio = NEW.id_servicio;

        -- 1. Determinar el día de la semana en español para buscar en Horario_Semanal_Empleado
        SELECT TRIM(TO_CHAR(NEW.fecha, 'Day')) INTO dia_actual_texto;
        CASE dia_actual_texto
            WHEN 'Monday' THEN dia_enum := 'Lunes';
            WHEN 'Tuesday' THEN dia_enum := 'Martes';
            WHEN 'Wednesday' THEN dia_enum := 'Miércoles';
            WHEN 'Thursday' THEN dia_enum := 'Jueves';
            WHEN 'Friday' THEN dia_enum := 'Viernes';
            WHEN 'Saturday' THEN dia_enum := 'Sábado';
            WHEN 'Sunday' THEN dia_enum := 'Domingo';
            ELSE dia_enum := dia_actual_texto::dia_semana_enum;
        END CASE;
        
        -- 2. Obtener el horario semanal del empleado
        SELECT hora_apertura, hora_cierre INTO emp_entrada, emp_salida
        FROM Horario_Semanal_Empleado
        WHERE id_empleado = NEW.id_empleado AND dia = dia_enum;
        
        -- 3. Calcular horas totales y actualizar/insertar Disponibilidad_Diaria_Empleado
        IF NOT FOUND THEN
            -- Si no tiene horario semanal definido para ese día, se asume un default (0 para ser seguro)
            horas_totales_emp := 0.00;
        ELSE
            -- Calcular las horas totales que el empleado trabaja ese día
            horas_totales_emp := EXTRACT(EPOCH FROM (emp_salida - emp_entrada)) / 3600.0;
        END IF;

        -- Intentar insertar la disponibilidad inicial si no existe (horas_totales_emp - duracion)
        -- Si ya existe, se actualiza restando la duración de la cita.
        INSERT INTO Disponibilidad_Diaria_Empleado (id_empleado, fecha, horas_disponibles_restantes)
        VALUES (NEW.id_empleado, NEW.fecha, horas_totales_emp - duracion)
        ON CONFLICT (id_empleado, fecha)
        DO UPDATE SET horas_disponibles_restantes = Disponibilidad_Diaria_Empleado.horas_disponibles_restantes - duracion;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_after_insert
AFTER INSERT ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_after_insert_func();


-- Función de Trigger AFTER UPDATE en Cita (Recalcula Disponibilidad en caso de cancelación o cambio de estado)
CREATE OR REPLACE FUNCTION tr_cita_after_update_func() RETURNS TRIGGER AS $$
DECLARE
    duracion DECIMAL(6,2);
BEGIN
    -- Si el estado y el empleado no cambian, y el estado antiguo y nuevo son liberadores de tiempo (Completada/Cancelada), no hacemos nada.
    IF NEW.estado = OLD.estado AND NEW.id_empleado = OLD.id_empleado THEN
        RETURN NEW;
    END IF;

    -- Obtener la duración del servicio
    SELECT duracion_horas INTO duracion 
    FROM Tipo_Servicio 
    WHERE id_servicio = OLD.id_servicio; -- Usamos OLD.id_servicio para el servicio original

    -- 1. Si la cita antigua estaba reservando tiempo (Pendiente/Confirmada) y el nuevo estado lo libera (Cancelada/Completada), liberamos.
    IF OLD.estado IN ('Pendiente', 'Confirmada') AND NEW.estado IN ('Cancelada', 'Completada') AND OLD.id_empleado = NEW.id_empleado THEN
        UPDATE Disponibilidad_Diaria_Empleado
        SET horas_disponibles_restantes = horas_disponibles_restantes + duracion
        WHERE id_empleado = OLD.id_empleado AND fecha = OLD.fecha;

    -- 2. Si la cita antigua estaba liberada (Cancelada/Completada) y el nuevo estado reserva tiempo (Pendiente/Confirmada), reservamos.
    ELSIF OLD.estado IN ('Cancelada', 'Completada') AND NEW.estado IN ('Pendiente', 'Confirmada') AND OLD.id_empleado = NEW.id_empleado THEN
        -- El trigger BEFORE ya validó que haya espacio antes de que esto suceda.
        UPDATE Disponibilidad_Diaria_Empleado
        SET horas_disponibles_restantes = horas_disponibles_restantes - duracion
        WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;

    -- 3. Caso de cambio de empleado (requiere liberar del viejo y reservar en el nuevo)
    ELSIF OLD.id_empleado IS DISTINCT FROM NEW.id_empleado THEN
        -- Liberar tiempo del empleado ANTIGUO
        IF OLD.estado IN ('Pendiente', 'Confirmada') THEN
            UPDATE Disponibilidad_Diaria_Empleado
            SET horas_disponibles_restantes = horas_disponibles_restantes + duracion
            WHERE id_empleado = OLD.id_empleado AND fecha = OLD.fecha;
        END IF;

        -- Reservar tiempo en el empleado NUEVO
        IF NEW.estado IN ('Pendiente', 'Confirmada') THEN
            -- El trigger BEFORE ya validó que haya espacio en el nuevo empleado.
            UPDATE Disponibilidad_Diaria_Empleado
            SET horas_disponibles_restantes = horas_disponibles_restantes - duracion
            WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_after_update
AFTER UPDATE ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_after_update_func();


-- Función para obtener los slots de tiempo disponibles para un empleado y servicio en una fecha específica
CREATE OR REPLACE FUNCTION obtener_slots_disponibles(
    p_id_empleado INT,
    p_fecha DATE,
    p_id_servicio INT,
    p_intervalo_grid INTERVAL DEFAULT '30 minutes'
)
RETURNS TABLE (hora_inicio TIME) AS $$
DECLARE
    v_duracion_horas DECIMAL(6,2);
    v_duracion_interval INTERVAL;
    v_hora_apertura_emp TIME; -- Horario de inicio del empleado
    v_hora_cierre_emp TIME; -- Horario de cierre del empleado
    v_salon_apertura TIME; -- Horario de apertura del salón
    v_salon_cierre TIME; -- Horario de cierre del salón
    v_start_time TIME; -- Hora de inicio efectiva (el más tarde entre empleado/salón)
    v_end_time TIME; -- Hora de cierre efectiva (el más temprano entre empleado/salón)
    v_dia_semana TEXT;
    v_dia_enum dia_semana_enum;
    v_salon_estado estado_dia_enum;
    v_disp_restante DECIMAL(6,2);
BEGIN
    -- 1. Obtener duración del servicio
    SELECT duracion_horas INTO v_duracion_horas
    FROM Tipo_Servicio 
    WHERE id_servicio = p_id_servicio;

    IF NOT FOUND THEN
        -- Si el servicio no existe, retornar vacío
        RETURN;
    END IF;

    v_duracion_interval := (v_duracion_horas || ' hours')::INTERVAL;

    -- 2. Validar disponibilidad diaria restante (global)
    SELECT COALESCE(horas_disponibles_restantes, 0.00) 
    INTO v_disp_restante
    FROM Disponibilidad_Diaria_Empleado
    WHERE id_empleado = p_id_empleado 
      AND fecha = p_fecha;

    -- Si el tiempo restante no es suficiente para la duración del servicio
    IF v_disp_restante < v_duracion_horas THEN
        RETURN;
    END IF;

    -- 3. Validar y obtener horario del salón
    SELECT 
        COALESCE(estado_dia, 'Cerrado'::estado_dia_enum),
        COALESCE(hora_apertura, '09:00:00'::TIME),
        COALESCE(hora_cierre, '19:00:00'::TIME)
    INTO v_salon_estado, v_salon_apertura, v_salon_cierre
    FROM Dia_Salon_Estado
    WHERE fecha = p_fecha
    LIMIT 1;  -- asegura que solo traiga un registro

    -- Si no hay registro para la fecha, COALESCE aplica los valores por defecto
    IF v_salon_estado = 'Cerrado' THEN
        RETURN;
    END IF;


    -- 4. Determinar horario semanal del empleado
    SELECT TRIM(TO_CHAR(p_fecha, 'Day')) 
    INTO v_dia_semana;

    CASE v_dia_semana
        WHEN 'Monday' THEN v_dia_enum := 'Lunes';
        WHEN 'Tuesday' THEN v_dia_enum := 'Martes';
        WHEN 'Wednesday' THEN v_dia_enum := 'Miércoles';
        WHEN 'Thursday' THEN v_dia_enum := 'Jueves';
        WHEN 'Friday' THEN v_dia_enum := 'Viernes';
        WHEN 'Saturday' THEN v_dia_enum := 'Sábado';
        WHEN 'Sunday' THEN v_dia_enum := 'Domingo';
        ELSE v_dia_enum := v_dia_semana::dia_semana_enum;
    END CASE;

    SELECT hora_apertura, hora_cierre 
    INTO v_hora_apertura_emp, v_hora_cierre_emp
    FROM Horario_Semanal_Empleado
    WHERE id_empleado = p_id_empleado 
      AND dia = v_dia_enum;

    IF NOT FOUND THEN
        -- Si el empleado no trabaja ese día, retornar vacío
        RETURN;
    END IF;

    -- 5. Determinar horario efectivo final (intersección entre empleado y salón)
    v_start_time := GREATEST(v_hora_apertura_emp, v_salon_apertura);
    v_end_time := LEAST(v_hora_cierre_emp, v_salon_cierre);

    -- Si el tiempo efectivo de trabajo es menor a la duración del servicio, salir
    IF (v_end_time - v_start_time)::INTERVAL < v_duracion_interval THEN
        RETURN;
    END IF;

    -- 6. Generar series y filtrar solapamientos
    RETURN QUERY
    SELECT series_tiempo::TIME
    FROM generate_series(
        ('2000-01-01'::DATE + v_start_time)::TIMESTAMP,
        ('2000-00-00'::DATE + v_end_time - v_duracion_interval)::TIMESTAMP, -- La fecha es irrelevante, usamos 2000-01-01 para la aritmética de tiempo
        p_intervalo_grid
    ) AS series_tiempo
    WHERE series_tiempo::TIME >= v_start_time
      AND (series_tiempo::TIME + v_duracion_interval) <= v_end_time
      AND NOT EXISTS (
            SELECT 1 
            FROM Cita c
            WHERE c.id_empleado = p_id_empleado
              AND c.fecha = p_fecha
              AND c.estado IN ('Pendiente', 'Confirmada')
              AND (
                  -- Check for overlap: [series_tiempo, series_tiempo + v_duracion_interval) vs [c.hora, c.hora_fin)
                  series_tiempo::TIME < c.hora_fin 
                  AND (series_tiempo::TIME + v_duracion_interval) > c.hora
              )
      );
END;
$$ LANGUAGE plpgsql;


-- Función de reporte
CREATE OR REPLACE FUNCTION fn_reporte_ingreso_diario(
    p_fecha DATE
)
RETURNS TABLE (
    empleado_id INT,
    nombre_completo VARCHAR,
    total_ingreso DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id_empleado,
        e.nombre || ' ' || e.apellido AS nombre_completo,
        COALESCE(SUM(ts.precio), 0.00) AS total_ingreso
    FROM Empleado e
    LEFT JOIN Cita c 
        ON e.id_empleado = c.id_empleado 
       AND c.fecha = p_fecha 
       AND c.estado = 'Completada' -- Solo citas completadas generan ingreso
    LEFT JOIN Tipo_Servicio ts 
        ON c.id_servicio = ts.id_servicio
    GROUP BY 
        e.id_empleado, 
        e.nombre, 
        e.apellido
    ORDER BY total_ingreso DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 5. INSERCIÓN DE DATOS INICIALES
-- ====================================================================

INSERT INTO Cliente (nombre, apellido, telefono, correo) VALUES
('Marta', 'Vázquez', '5554123412', 'marta.vazquez@mail.com'),
('Nicolás', 'Torres', '5552098765', 'nicolas.torres@mail.com'),
('Olivia', 'Herrera', '5553331144', 'olivia.herrera@mail.com'),
('Pedro', 'Morales', '5556660099', 'pedro.morales@mail.com'),
('Quetzali', 'Luna', '5551239876', 'quetzali.luna@mail.com'),
('Raúl', 'Castillo', '5558882211', 'raul.castillo@mail.com'),
('Susana', 'Ortiz', '5557005533', 'susana.ortiz@mail.com'),
('Tomás', 'Nuñez', '5551998822', 'tomas.nunez@mail.com'),
('Ursula', 'Cervantes', '5554441177', 'ursula.cervantes@mail.com'),
('Víctor', 'Reyes', '5559090909', 'victor.reyes@mail.com'),
('Ximena', 'Arias', '5551112233', 'ximena.arias@mail.com'),
('Yago', 'Blanco', '5552223344', 'yago.blanco@mail.com'),
('Zoe', 'Díaz', '5553334455', 'zoe.diaz@mail.com'),
('Adrián', 'Flores', '5554445566', 'adrian.flores@mail.com'),
('Beatriz', 'Gómez', '5555556677', 'beatriz.gomez@mail.com'),
('César', 'Ibáñez', '5556667788', 'cesar.ibanez@mail.com'),
('Diana', 'Jiménez', '5557778899', 'diana.jimenez@mail.com'),
('Elías', 'López', '5558889900', 'elias.lopez@mail.com'),
('Fátima', 'Molina', '5559990011', 'fatima.molina@mail.com'),
('Guillermo', 'Pérez', '5550001122', 'guillermo.perez@mail.com');

-- Empleados (20 Empleados)
INSERT INTO Empleado (nombre, apellido, rol, telefono, correo, estado, contraseña) VALUES
    ('Laura', 'Vargas', 'Administrador', '5551000001', 'laura.vargas@salon.com', 'Disponible', ENCODE(DIGEST('contraseña1', 'sha256'), 'hex')),
    ('Alejandra', 'Méndez', 'Trabajador', '5551000011', 'alejandra.mendez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña11', 'sha256'), 'hex')),
    ('Roberto', 'Soto', 'Trabajador', '5551000012', 'roberto.soto@salon.com', 'Disponible', ENCODE(DIGEST('contraseña12', 'sha256'), 'hex')),
    ('Karina', 'Gil', 'Trabajador', '5551000013', 'karina.gil@salon.com', 'Disponible', ENCODE(DIGEST('contraseña13', 'sha256'), 'hex')),
    ('Esteban', 'Pinto', 'Trabajador', '5551000014', 'esteban.pinto@salon.com', 'Disponible', ENCODE(DIGEST('contraseña14', 'sha256'), 'hex')),
    ('Gabriela', 'Lagos', 'Trabajador', '5551000015', 'gabriela.lagos@salon.com', 'Disponible', ENCODE(DIGEST('contraseña15', 'sha256'), 'hex')),
    ('Humberto', 'Vidal', 'Trabajador', '5551000016', 'humberto.vidal@salon.com', 'Vacacionando', ENCODE(DIGEST('contraseña16', 'sha256'), 'hex')),
    ('Isabel', 'Zurita', 'Trabajador', '5551000017', 'isabel.zurita@salon.com', 'Disponible', ENCODE(DIGEST('contraseña17', 'sha256'), 'hex')),
    ('Juan', 'Gálvez', 'Trabajador', '5551000018', 'juan.galvez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña18', 'sha256'), 'hex')),
    ('Kelly', 'Herrera', 'Trabajador', '5551000019', 'kelly.herrera@salon.com', 'Disponible', ENCODE(DIGEST('contraseña19', 'sha256'), 'hex')),
    ('Leo', 'Zúñiga', 'Administrador', '5551000020', 'leo.zuniga@salon.com', 'Disponible', ENCODE(DIGEST('contraseña20', 'sha256'), 'hex')),
    ('Mónica', 'Ríos', 'Trabajador', '5551000021', 'monica.rios@salon.com', 'Disponible', ENCODE(DIGEST('contraseña21', 'sha256'), 'hex')),
    ('Noé', 'Sánchez', 'Trabajador', '5551000022', 'noe.sanchez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña22', 'sha256'), 'hex')),
    ('Ofelia', 'Tapia', 'Trabajador', '5551000023', 'ofelia.tapia@salon.com', 'Disponible', ENCODE(DIGEST('contraseña23', 'sha256'), 'hex')),
    ('Pablo', 'Ulloa', 'Trabajador', '5551000024', 'pablo.ulloa@salon.com', 'Vacacionando', ENCODE(DIGEST('contraseña24', 'sha256'), 'hex')),
    ('Rebeca', 'Vega', 'Trabajador', '5551000025', 'rebeca.vega@salon.com', 'Disponible', ENCODE(DIGEST('contraseña25', 'sha256'), 'hex')),
    ('Samuel', 'Weiss', 'Trabajador', '5551000026', 'samuel.weiss@salon.com', 'Disponible', ENCODE(DIGEST('contraseña26', 'sha256'), 'hex')),
    ('Tania', 'Xavier', 'Trabajador', '5551000027', 'tania.xavier@salon.com', 'Disponible', ENCODE(DIGEST('contraseña27', 'sha256'), 'hex')),
    ('Ulises', 'Yáñez', 'Trabajador', '5551000028', 'ulises.yanez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña28', 'sha256'), 'hex')),
    ('Vanesa', 'Zavala', 'Trabajador', '5551000029', 'vanesa.zavala@salon.com', 'Disponible', ENCODE(DIGEST('contraseña29', 'sha256'), 'hex'));

-- Tipos de Servicio (12 Servicios)
INSERT INTO Tipo_Servicio (nombre_servicio, duracion_horas, precio, estado) VALUES
    ('Corte y Peinado', 1.50, 45.00, 'Activo'),           -- 31
    ('Coloración y Mechas', 2.50, 110.00, 'Activo'),      -- 32
    ('Manicure Spa', 1.00, 35.00, 'Activo'),              -- 33
    ('Pedicure Spa', 1.50, 50.00, 'Activo'),              -- 34
    ('Maquillaje Profesional', 1.50, 65.00, 'Activo'),    -- 35
    ('Tratamientos Capilares', 1.00, 40.00, 'Activo'),     -- 36
    ('Corte de Cabello', 0.75, 30.00, 'Activo'),          -- 37
    ('Peinado', 1.00, 35.00, 'Activo'),                   -- 38
    ('Coloración de Cabello', 2.00, 80.00, 'Activo'),     -- 39
    ('Depilación de Cejas con Cera', 0.50, 20.00, 'Activo'), -- 40
    ('Depilación de Cejas con Gillete', 0.50, 15.00, 'Activo'), -- 41
    ('Depilación de Cejas con Hilo', 0.75, 25.00, 'Activo'); -- 42

-- Horario Semanal de Empleados (Ajustado a 9:00 - 19:00)
-- Nota: Los id_empleado comienzan en 21
INSERT INTO Horario_Semanal_Empleado (id_empleado, dia, hora_apertura, hora_cierre) VALUES
    -- Laura (21)
    (21, 'Lunes', '09:00', '17:00'), (21, 'Martes', '09:00', '17:00'),
    (21, 'Miércoles', '09:00', '17:00'), (21, 'Jueves', '09:00', '17:00'),
    (21, 'Viernes', '09:00', '17:00'),

    -- Alejandra (22)
    (22, 'Martes', '10:00', '19:00'), (22, 'Miércoles', '10:00', '19:00'),
    (22, 'Jueves', '10:00', '19:00'), (22, 'Viernes', '10:00', '19:00'),
    (22, 'Sábado', '09:00', '14:00'),

    -- Roberto (23)
    (23, 'Lunes', '09:00', '14:00'), (23, 'Martes', '09:00', '14:00'),
    (23, 'Miércoles', '09:00', '14:00'), (23, 'Jueves', '09:00', '14:00'),
    (23, 'Viernes', '09:00', '14:00'), (23, 'Sábado', '09:00', '13:00'),

    -- Karina (24)
    (24, 'Lunes', '11:00', '19:00'), (24, 'Miércoles', '11:00', '19:00'),
    (24, 'Viernes', '11:00', '19:00'),

    -- Esteban (25)
    (25, 'Lunes', '12:00', '19:00'), (25, 'Martes', '12:00', '19:00'),
    (25, 'Miércoles', '12:00', '19:00'), (25, 'Jueves', '12:00', '19:00'),
    (25, 'Viernes', '12:00', '19:00'),

    -- Gabriela (26)
    (26, 'Martes', '10:00', '18:00'), (26, 'Sábado', '10:00', '16:00'),

    -- Humberto (27) - Vacacionando
    (27, 'Jueves', '12:00', '19:00'), (27, 'Viernes', '12:00', '19:00'),
    (27, 'Sábado', '12:00', '18:00'),

    -- Isabel (28)
    (28, 'Miércoles', '09:00', '17:00'), (28, 'Jueves', '09:00', '17:00'),
    (28, 'Viernes', '09:00', '17:00'),

    -- Juan (29)
    (29, 'Martes', '10:00', '19:00'), (29, 'Sábado', '10:00', '14:00'),

    -- Kelly (30)
    (30, 'Lunes', '09:00', '17:00'), (30, 'Martes', '09:00', '17:00'),
    (30, 'Miércoles', '09:00', '17:00'),

    -- Mónica (31)
    (31, 'Miércoles', '10:00', '18:00'), (31, 'Jueves', '10:00', '18:00'),
    (31, 'Viernes', '10:00', '18:00'),

    -- Noé (32)
    (32, 'Jueves', '14:00', '19:00'), (32, 'Viernes', '14:00', '19:00'),
    (32, 'Sábado', '14:00', '19:00'), (32, 'Domingo', '14:00', '19:00'),

    -- Ofelia (33)
    (33, 'Lunes', '10:00', '16:00'), (33, 'Martes', '10:00', '16:00'),
    (33, 'Miércoles', '10:00', '16:00'), (33, 'Jueves', '10:00', '16:00'),
    (33, 'Viernes', '10:00', '16:00'),

    -- Rebeca (35)
    (35, 'Martes', '09:00', '13:00'), (35, 'Jueves', '09:00', '13:00'),
    (35, 'Sábado', '09:00', '13:00'),

    -- Samuel (36)
    (36, 'Lunes', '09:00', '18:00'), (36, 'Miércoles', '09:00', '18:00'),
    (36, 'Viernes', '09:00', '18:00'),

    -- Tania (37)
    (37, 'Lunes', '10:00', '19:00'), (37, 'Martes', '10:00', '19:00'),
    (37, 'Miércoles', '10:00', '19:00'), (37, 'Jueves', '10:00', '19:00'),
    (37, 'Viernes', '10:00', '19:00'),

    -- Ulises (38)
    (38, 'Sábado', '11:00', '18:00'), (38, 'Domingo', '11:00', '18:00'),

    -- Vanesa (39)
    (39, 'Martes', '11:00', '17:00'), (39, 'Jueves', '11:00', '17:00'),
    (39, 'Sábado', '11:00', '17:00');

-- Empleado_Servicio (id_empleado y id_servicio)
INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES
    -- Laura (Admin)
    (22, 33), (22, 34), (22, 35),
    (23, 31), (23, 32), (23, 35), (23, 37), (23, 38), (23, 39),
    (24, 33), (24, 34), (24, 40), (24, 41), (24, 42),
    (25, 36),
    (26, 31), (26, 37), (26, 38),
    (27, 32), (27, 40), (27, 42),
    (28, 37), (28, 38), (28, 36),
    (29, 31), (29, 33), (29, 36), (29, 37), (29, 40),
    (30, 33), (30, 34), (30, 40), (30, 41), (30, 42),
    -- (31, ...) Eliminado porque es Admin
    (32, 33), (32, 34),
    (33, 31), (33, 37), (33, 38), (33, 39),
    (34, 33), (34, 34),
    (35, 33), (35, 34),
    (36, 32), (36, 35),
    (37, 31), (37, 37), (37, 38),
    (38, 33), (38, 34),
    (39, 33), (39, 34),
    (40, 33), (40, 34), (40, 35);

-- Dia_Salon_Estado (Establece el horario del salón para algunas fechas)
INSERT INTO Dia_Salon_Estado (fecha, hora_apertura, hora_cierre, estado_dia) VALUES
    ('2025-12-10', '09:00:00', '19:00:00', 'Abierto'),
    ('2025-12-11', '09:00:00', '19:00:00', 'Abierto'),
    ('2025-12-12', '09:00:00', '19:00:00', 'Abierto'),
    ('2025-12-13', '09:00:00', '19:00:00', 'Abierto'),
    ('2025-12-14', '09:00:00', '19:00:00', 'Abierto'),
    ('2025-12-15', '09:00:00', '15:00:00', 'Cerrado'), -- Cerrado a las 3 PM, aunque el estado sea "Cerrado"
    ('2025-12-16', '09:00:00', '19:00:00', 'Abierto'),
    ('2025-12-17', '09:00:00', '19:00:00', 'Abierto');

-- Citas (Ajustadas)
-- Nota: id_cliente comienza en 11, id_empleado en 21, id_servicio en 31
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
    -- Martes 10
    (11, 31, 21, '2025-12-10', '09:00:00', 'Confirmada'), -- Laura (1.5h) -> Fin 10:30
    (14, 34, 24, '2025-12-10', '11:00:00', 'Confirmada'), -- Karina (1.5h) -> Fin 12:30
    (13, 35, 30, '2025-12-10', '11:00:00', 'Confirmada'), -- Kelly (1.5h) -> Fin 12:30
    (15, 33, 21, '2025-12-10', '10:30:00', 'Confirmada'), -- Laura (1.0h) -> Fin 11:30 (Sigue a la anterior)
    (16, 40, 29, '2025-12-10', '17:30:00', 'Confirmada'), -- Juan (0.5h) -> Fin 18:00

    -- Miércoles 11
    (12, 33, 22, '2025-12-11', '10:00:00', 'Confirmada'), -- Alejandra (1.0h) -> Fin 11:00
    (17, 31, 21, '2025-12-11', '10:30:00', 'Confirmada'), -- Laura (1.5h) -> Fin 12:00
    (19, 32, 23, '2025-12-11', '09:00:00', 'Confirmada'), -- Roberto (2.5h) -> Fin 11:30
    (20, 33, 22, '2025-12-11', '16:00:00', 'Confirmada'), -- Alejandra (1.0h) -> Fin 17:00
    (11, 35, 36, '2025-12-11', '15:00:00', 'Confirmada'), -- Samuel (1.5h) -> Fin 16:30

    -- Jueves 12
    (18, 36, 30, '2025-12-12', '09:00:00', 'Confirmada'), -- Kelly (1.0h) -> Fin 10:00
    (11, 39, 23, '2025-12-12', '12:00:00', 'Confirmada'), -- Roberto (2.0h) -> Fin 14:00 (Fin de su turno)

    -- Viernes 13
    (12, 34, 24, '2025-12-13', '14:00:00', 'Confirmada'), -- Karina (1.5h) -> Fin 15:30
    (14, 40, 24, '2025-12-13', '16:00:00', 'Confirmada'), -- Karina (0.5h) -> Fin 16:30
    (16, 38, 21, '2025-12-13', '14:00:00', 'Completada'), -- Laura (1.0h) -> Fin 15:00 (Ingreso)

    -- Lunes 16
    (20, 37, 37, '2025-12-16', '16:00:00', 'Confirmada'); -- Tania (0.75h) -> Fin 16:45