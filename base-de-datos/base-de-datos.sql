-- Establece la extensión pgcrypto para el hash de contraseñas.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 1. DROPS (Limpieza de Objetos Existentes)
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
CREATE TYPE rol_empleado_enum AS ENUM ('trabajador', 'admin');
CREATE TYPE estado_empleado_enum AS ENUM ('ocupado', 'disponible', 'vacaciones');
CREATE TYPE estado_servicio_enum AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_dia_enum AS ENUM ('abierto', 'cerrado');
CREATE TYPE estado_cita_enum AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');
CREATE TYPE dia_semana_enum AS ENUM ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo');

-- 3. DEFINICIÓN DE TABLAS
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
    estado estado_empleado_enum NOT NULL DEFAULT 'disponible',
    contraseña VARCHAR(255) NOT NULL
);
ALTER SEQUENCE empleado_id_empleado_seq RESTART WITH 21;

CREATE TABLE Tipo_Servicio (
    id_servicio SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR(150) NOT NULL,
    duracion_horas DECIMAL(6,2) NOT NULL,
    precio DECIMAL(6, 2) NOT NULL,
    estado estado_servicio_enum NOT NULL DEFAULT 'activo'
);
ALTER SEQUENCE tipo_servicio_id_servicio_seq RESTART WITH 31;

CREATE TABLE Dia_Salon_Estado (
    fecha DATE NOT NULL PRIMARY KEY,
    hora_apertura TIME NOT NULL DEFAULT '08:00:00',
    hora_cierre TIME NOT NULL DEFAULT '17:00:00',
    estado_dia estado_dia_enum NOT NULL DEFAULT 'abierto'
);

CREATE TABLE Cita (
    id_cita SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado estado_cita_enum NOT NULL DEFAULT 'confirmada',
    CONSTRAINT fk_Cita_Cliente FOREIGN KEY (id_cliente) REFERENCES Cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_Cita_Tipo_Servicio FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_Cita_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX fk_cita_cliente_idx ON Cita(id_cliente);
CREATE INDEX fk_cita_tipo_servicio_idx ON Cita(id_servicio);
CREATE INDEX fk_cita_empleado_idx ON Cita(id_empleado);
CREATE INDEX idx_cita_empleado_fecha ON Cita(id_empleado, fecha, hora, hora_fin);

ALTER SEQUENCE cita_id_cita_seq RESTART WITH 41;

CREATE TABLE Disponibilidad_Diaria_Empleado (
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    horas_disponibles_restantes DECIMAL(6,2) NOT NULL,
    PRIMARY KEY (id_empleado, fecha),
    CONSTRAINT fk_Disp_Diaria_Emp FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Empleado_Servicio (
    id_empleado INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    PRIMARY KEY (id_empleado, id_servicio),
    CONSTRAINT fk_Emp_Serv_Emp FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_Emp_Serv_Serv FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE CASCADE ON UPDATE CASCADE
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

-- 4. FUNCIONES Y TRIGGERS (Lógica de Negocio)
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
    SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;

    -- 1. Calcular la hora de fin de la nueva cita y asignarla a NEW.hora_fin
    hora_fin_cita := NEW.hora + (duracion * INTERVAL '1 hour');
    NEW.hora_fin := hora_fin_cita;

    -- Obtener horario del salón, usando valores por defecto si no existe la fecha
    SELECT 
        COALESCE(estado_dia, 'cerrado'::estado_dia_enum),
        COALESCE(hora_apertura, '08:00:00'::TIME),
        COALESCE(hora_cierre, '17:00:00'::TIME)
    INTO salon_abierto, hora_apertura_salon, hora_cierre_salon
    FROM Dia_Salon_Estado
    WHERE fecha = NEW.fecha;

    IF salon_abierto = 'cerrado' THEN
        RAISE EXCEPTION 'El salón está CERRADO para citas en esta fecha.';
    END IF;

    -- 2. Validación de horario del salón (Inicio y Fin)
    IF NEW.hora < hora_apertura_salon OR NEW.hora >= hora_cierre_salon THEN
        RAISE EXCEPTION 'La cita debe iniciar entre % y antes de %.', hora_apertura_salon, hora_cierre_salon;
    END IF;

    IF NEW.hora_fin > hora_cierre_salon THEN
        RAISE EXCEPTION 'La duración del servicio (%) excede el horario de cierre (%). La cita finalizaría a las %.', duracion, hora_cierre_salon, NEW.hora_fin;
    END IF;

    -- 3. Validación de SOLAPAMIENTO con otras citas confirmadas
    SELECT EXISTS (
        SELECT 1 
        FROM Cita 
        WHERE 
            id_empleado = NEW.id_empleado
            AND fecha = NEW.fecha
            AND estado IN ('pendiente', 'confirmada')
            -- Cita existente comienza antes de que termine la nueva cita
            AND hora < NEW.hora_fin 
            -- Y cita existente termina después de que comienza la nueva cita
            AND hora_fin > NEW.hora 
    ) INTO solapamiento_existe;

    IF solapamiento_existe THEN
        RAISE EXCEPTION 'El empleado ya tiene una cita confirmada que se solapa con el periodo de % a % en esta fecha.', NEW.hora, NEW.hora_fin;
    END IF;

    -- 4. Validación de disponibilidad del empleado (Horas restantes)
    SELECT COALESCE(horas_disponibles_restantes, 0.00) INTO horas_restantes
    FROM Disponibilidad_Diaria_Empleado
    WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;

    IF horas_restantes < duracion THEN
        RAISE EXCEPTION 'El empleado % no tiene suficiente tiempo. Restantes: %. Necesarias: %', NEW.id_empleado, horas_restantes, duracion;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_before_insert
BEFORE INSERT ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_before_insert_func();

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
    INSERT INTO Dia_Salon_Estado (fecha) VALUES (NEW.fecha) ON CONFLICT (fecha) DO NOTHING;

    IF NEW.estado = 'confirmada' THEN
        SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;

        -- Determinar el día de la semana en español
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

        -- Obtener el horario semanal del empleado
        SELECT hora_apertura, hora_cierre INTO emp_entrada, emp_salida
        FROM Horario_Semanal_Empleado
        WHERE id_empleado = NEW.id_empleado AND dia = dia_enum;

        IF NOT FOUND THEN
            -- Si no tiene horario semanal definido, usamos un valor por defecto (8 horas)
            horas_totales_emp := 8.00;
        ELSE
            -- Calcular las horas totales que el empleado trabaja ese día
            horas_totales_emp := EXTRACT(EPOCH FROM (emp_salida - emp_entrada)) / 3600.0;
        END IF;

        -- Insertar o actualizar Disponibilidad_Diaria_Empleado
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
    -- Si el estado NO cambia, no hacemos nada.
    IF NEW.estado = OLD.estado THEN
        RETURN NEW;
    END IF;

    SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = OLD.id_servicio;

    -- Si el estado CAMBIA de 'confirmada' a 'cancelada' o 'completada', liberamos el tiempo.
    IF OLD.estado IN ('pendiente', 'confirmada') AND NEW.estado IN ('cancelada', 'completada') THEN
        UPDATE Disponibilidad_Diaria_Empleado
        SET horas_disponibles_restantes = horas_disponibles_restantes + duracion
        WHERE id_empleado = OLD.id_empleado AND fecha = OLD.fecha;

    -- Si el estado CAMBIA a 'confirmada' desde un estado no confirmable, restamos el tiempo.
    ELSIF OLD.estado NOT IN ('pendiente', 'confirmada') AND NEW.estado IN ('pendiente', 'confirmada') THEN
        UPDATE Disponibilidad_Diaria_Empleado
        SET horas_disponibles_restantes = horas_disponibles_restantes - duracion
        WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;
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
    v_hora_apertura TIME;
    v_hora_cierre TIME;
    v_dia_semana TEXT;
    v_dia_enum dia_semana_enum;
    v_salon_estado estado_dia_enum;
    v_disp_restante DECIMAL(6,2);
BEGIN
    -- 1. Obtener duración del servicio
    SELECT duracion_horas INTO v_duracion_horas
    FROM Tipo_Servicio WHERE id_servicio = p_id_servicio;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_duracion_interval := (v_duracion_horas || ' hours')::INTERVAL;

    -- 2. Validar disponibilidad diaria restante (global)
    SELECT horas_disponibles_restantes INTO v_disp_restante
    FROM Disponibilidad_Diaria_Empleado
    WHERE id_empleado = p_id_empleado AND fecha = p_fecha;

    IF v_disp_restante IS NULL OR v_disp_restante < v_duracion_horas THEN
        RETURN;
    END IF;

    -- 3. Validar estado del salón
    SELECT estado_dia INTO v_salon_estado
    FROM Dia_Salon_Estado WHERE fecha = p_fecha;

    IF v_salon_estado = 'cerrado' THEN RETURN; END IF;

    -- 4. Determinar horario semanal del empleado
    SELECT TRIM(TO_CHAR(p_fecha, 'Day')) INTO v_dia_semana;

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

    SELECT hora_apertura, hora_cierre INTO v_hora_apertura, v_hora_cierre
    FROM Horario_Semanal_Empleado
    WHERE id_empleado = p_id_empleado AND dia = v_dia_enum;

    IF NOT FOUND THEN RETURN; END IF;

    -- 5. Generar series de tiempo y filtrar solapamientos
    RETURN QUERY
    SELECT series_tiempo::TIME
    FROM generate_series(
        ('2000-01-01'::DATE + v_hora_apertura)::TIMESTAMP,
        ('2000-01-01'::DATE + v_hora_cierre - v_duracion_interval)::TIMESTAMP,
        p_intervalo_grid
    ) AS series_tiempo
    WHERE series_tiempo::TIME >= v_hora_apertura
      AND (series_tiempo::TIME + v_duracion_interval) <= v_hora_cierre
      AND NOT EXISTS (
        SELECT 1 FROM Cita c
        WHERE c.id_empleado = p_id_empleado
          AND c.fecha = p_fecha
          AND c.estado = 'confirmada'
          AND (
              (series_tiempo::TIME < c.hora_fin AND (series_tiempo::TIME + v_duracion_interval) > c.hora)
          )
      );
END;
$$ LANGUAGE plpgsql;

-- Función de reporte para calcular el ingreso total de un día y por empleado
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
    FROM
        Empleado e
    LEFT JOIN
        Cita c ON e.id_empleado = c.id_empleado AND c.fecha = p_fecha AND c.estado = 'completada'
    LEFT JOIN
        Tipo_Servicio ts ON c.id_servicio = ts.id_servicio
    GROUP BY
        e.id_empleado, e.nombre, e.apellido
    ORDER BY
        total_ingreso DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 5. INSERCIÓN DE DATOS INICIALES (Extendido para 574+ líneas)
-- ====================================================================

-- Clientes (20 Clientes)
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
('Laura', 'Vargas', 'admin', '5551000001', 'laura.vargas@salon.com', 'disponible', ENCODE(DIGEST('contraseña1', 'sha256'), 'hex')),
('Alejandra', 'Méndez', 'trabajador', '5551000011', 'alejandra.mendez@salon.com', 'disponible', ENCODE(DIGEST('contraseña11', 'sha256'), 'hex')),
('Roberto', 'Soto', 'trabajador', '5551000012', 'roberto.soto@salon.com', 'disponible', ENCODE(DIGEST('contraseña12', 'sha256'), 'hex')),
('Karina', 'Gil', 'trabajador', '5551000013', 'karina.gil@salon.com', 'disponible', ENCODE(DIGEST('contraseña13', 'sha256'), 'hex')),
('Esteban', 'Pinto', 'trabajador', '5551000014', 'esteban.pinto@salon.com', 'disponible', ENCODE(DIGEST('contraseña14', 'sha256'), 'hex')),
('Gabriela', 'Lagos', 'trabajador', '5551000015', 'gabriela.lagos@salon.com', 'disponible', ENCODE(DIGEST('contraseña15', 'sha256'), 'hex')),
('Humberto', 'Vidal', 'trabajador', '5551000016', 'humberto.vidal@salon.com', 'vacaciones', ENCODE(DIGEST('contraseña16', 'sha256'), 'hex')),
('Isabel', 'Zurita', 'trabajador', '5551000017', 'isabel.zurita@salon.com', 'disponible', ENCODE(DIGEST('contraseña17', 'sha256'), 'hex')),
('Juan', 'Gálvez', 'trabajador', '5551000018', 'juan.galvez@salon.com', 'disponible', ENCODE(DIGEST('contraseña18', 'sha256'), 'hex')),
('Kelly', 'Herrera', 'trabajador', '5551000019', 'kelly.herrera@salon.com', 'disponible', ENCODE(DIGEST('contraseña19', 'sha256'), 'hex')),
('Leo', 'Zúñiga', 'admin', '5551000020', 'leo.zuniga@salon.com', 'disponible', ENCODE(DIGEST('contraseña20', 'sha256'), 'hex')),
('Mónica', 'Ríos', 'trabajador', '5551000021', 'monica.rios@salon.com', 'disponible', ENCODE(DIGEST('contraseña21', 'sha256'), 'hex')),
('Noé', 'Sánchez', 'trabajador', '5551000022', 'noe.sanchez@salon.com', 'disponible', ENCODE(DIGEST('contraseña22', 'sha256'), 'hex')),
('Ofelia', 'Tapia', 'trabajador', '5551000023', 'ofelia.tapia@salon.com', 'disponible', ENCODE(DIGEST('contraseña23', 'sha256'), 'hex')),
('Pablo', 'Ulloa', 'trabajador', '5551000024', 'pablo.ulloa@salon.com', 'ocupado', ENCODE(DIGEST('contraseña24', 'sha256'), 'hex')),
('Rebeca', 'Vega', 'trabajador', '5551000025', 'rebeca.vega@salon.com', 'disponible', ENCODE(DIGEST('contraseña25', 'sha256'), 'hex')),
('Samuel', 'Weiss', 'trabajador', '5551000026', 'samuel.weiss@salon.com', 'disponible', ENCODE(DIGEST('contraseña26', 'sha256'), 'hex')),
('Tania', 'Xavier', 'trabajador', '5551000027', 'tania.xavier@salon.com', 'disponible', ENCODE(DIGEST('contraseña27', 'sha256'), 'hex')),
('Ulises', 'Yáñez', 'trabajador', '5551000028', 'ulises.yanez@salon.com', 'disponible', ENCODE(DIGEST('contraseña28', 'sha256'), 'hex')),
('Vanesa', 'Zavala', 'trabajador', '5551000029', 'vanesa.zavala@salon.com', 'disponible', ENCODE(DIGEST('contraseña29', 'sha256'), 'hex'));

-- Tipos de Servicio (20 Servicios)
INSERT INTO Tipo_Servicio (nombre_servicio, duracion_horas, precio, estado) VALUES
('Corte y Peinado', 1.50, 45.00, 'activo'), -- 31
('Coloración y Mechas', 2.50, 110.00, 'activo'), -- 32
('Manicure Spa', 1.00, 35.00, 'activo'), -- 33
('Pedicure Spa', 1.50, 50.00, 'activo'), -- 34
('Maquillaje Profesional', 1.50, 65.00, 'activo'), -- 35
('Tratamientos Capilares', 1.00, 40.00, 'activo'), -- 36
('Corte de Cabello', 0.75, 30.00, 'activo'), -- 37
('Peinado', 1.00, 35.00, 'activo'), -- 38
('Coloración de Cabello', 2.00, 80.00, 'activo'), -- 39
('Depilación de Cejas con Cera', 0.50, 20.00, 'activo'), -- 40
('Depilación de Cejas con Gillete', 0.50, 15.00, 'activo'), -- 41
('Depilación de Cejas con Hilo', 0.75, 25.00, 'activo');

-- Horario Semanal de Empleados (Extendido)
INSERT INTO Horario_Semanal_Empleado (id_empleado, dia, hora_apertura, hora_cierre) VALUES
-- Laura (21)
(21, 'Lunes', '09:00', '17:00'), (21, 'Martes', '09:00', '17:00'), (21, 'Miércoles', '09:00', '17:00'), (21, 'Jueves', '09:00', '17:00'), (21, 'Viernes', '09:00', '17:00'),
-- Alejandra (22)
(22, 'Martes', '10:00', '19:00'), (22, 'Miércoles', '10:00', '19:00'), (22, 'Jueves', '10:00', '19:00'), (22, 'Viernes', '10:00', '19:00'), (22, 'Sábado', '09:00', '14:00'),
-- Roberto (23)
(23, 'Lunes', '08:00', '14:00'), (23, 'Martes', '08:00', '14:00'), (23, 'Miércoles', '08:00', '14:00'), (23, 'Jueves', '08:00', '14:00'), (23, 'Viernes', '08:00', '14:00'), (23, 'Sábado', '08:00', '13:00'),
-- Karina (24)
(24, 'Lunes', '11:00', '19:00'), (24, 'Miércoles', '11:00', '19:00'), (24, 'Viernes', '11:00', '19:00'),
-- Esteban (25)
(25, 'Lunes', '12:00', '20:00'), (25, 'Martes', '12:00', '20:00'), (25, 'Miércoles', '12:00', '20:00'), (25, 'Jueves', '12:00', '20:00'), (25, 'Viernes', '12:00', '20:00'),
-- Gabriela (26)
(26, 'Martes', '10:00', '18:00'), (26, 'Sábado', '10:00', '16:00'),
-- Humberto (27)
(27, 'Jueves', '12:00', '20:00'), (27, 'Viernes', '12:00', '20:00'), (27, 'Sábado', '12:00', '18:00'),
-- Isabel (28)
(28, 'Miércoles', '09:00', '17:00'), (28, 'Jueves', '09:00', '17:00'), (28, 'Viernes', '09:00', '17:00'),
-- Juan (29)
(29, 'Martes', '10:00', '18:00'), (29, 'Sábado', '10:00', '14:00'),
-- Kelly (30)
(30, 'Lunes', '09:00', '17:00'), (30, 'Martes', '09:00', '17:00'), (30, 'Miércoles', '09:00', '17:00'),
-- Mónica (31)
(31, 'Miércoles', '10:00', '18:00'), (31, 'Jueves', '10:00', '18:00'), (31, 'Viernes', '10:00', '18:00'),
-- Noé (32)
(32, 'Jueves', '14:00', '22:00'), (32, 'Viernes', '14:00', '22:00'), (32, 'Sábado', '14:00', '22:00'), (32, 'Domingo', '14:00', '20:00'),
-- Ofelia (33)
(33, 'Lunes', '10:00', '16:00'), (33, 'Martes', '10:00', '16:00'), (33, 'Miércoles', '10:00', '16:00'), (33, 'Jueves', '10:00', '16:00'), (33, 'Viernes', '10:00', '16:00'),
-- Rebeca (35)
(35, 'Martes', '08:00', '13:00'), (35, 'Jueves', '08:00', '13:00'), (35, 'Sábado', '08:00', '13:00'),
-- Samuel (36)
(36, 'Lunes', '09:00', '18:00'), (36, 'Miércoles', '09:00', '18:00'), (36, 'Viernes', '09:00', '18:00'),
-- Tania (37)
(37, 'Lunes', '10:00', '19:00'), (37, 'Martes', '10:00', '19:00'), (37, 'Miércoles', '10:00', '19:00'), (37, 'Jueves', '10:00', '19:00'), (37, 'Viernes', '10:00', '19:00'),
-- Ulises (38)
(38, 'Sábado', '11:00', '18:00'), (38, 'Domingo', '11:00', '18:00'),
-- Vanesa (39)
(39, 'Martes', '11:00', '17:00'), (39, 'Jueves', '11:00', '17:00'), (39, 'Sábado', '11:00', '17:00');

-- Empleado_Servicio (Asociación Empleado - Servicio)
INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES
(21, 31), (21, 37), (21, 38), (21, 39), (21, 40),
(22, 33), (22, 34), (22, 35),
(23, 31), (23, 32), (23, 35), (23, 37), (23, 38), (23, 39),
(24, 33), (24, 34), (24, 40), (24, 41), (24, 42),
(25, 36),
(26, 31), (26, 37), (26, 38),
(27, 32), (27, 40), (27, 42),
(28, 37), (28, 38), (28, 36),
(29, 31), (29, 33), (29, 36), (29, 37), (29, 40),
(30, 33), (30, 34), (30, 35), (30, 36),
(31, 33), (31, 34), (31, 40), (31, 41), (31, 42),
(33, 31), (33, 37), (33, 38), (33, 39),
(35, 33), (35, 34),
(36, 32), (36, 35),
(37, 31), (37, 37), (37, 38),
(39, 33), (39, 34);

-- Dia_Salon_Estado
INSERT INTO Dia_Salon_Estado (fecha, hora_apertura, hora_cierre, estado_dia) VALUES
('2025-12-10', '09:00:00', '19:00:00', 'abierto'),
('2025-12-11', '08:00:00', '18:00:00', 'abierto'),
('2025-12-12', '09:00:00', '18:00:00', 'abierto'),
('2025-12-13', '08:00:00', '19:00:00', 'abierto'),
('2025-12-14', '08:00:00', '17:00:00', 'abierto'),
('2025-12-15', '09:00:00', '15:00:00', 'cerrado'), -- Lunes CERRADO
('2025-12-16', '09:00:00', '17:00:00', 'abierto'),
('2025-12-17', '08:00:00', '17:00:00', 'abierto');

-- Citas (Pruebas de Lógica)
-- Martes, 10 de Diciembre de 2025 (Salon 9:00 - 19:00)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(11, 31, 21, '2025-12-10', '09:00:00', 'confirmada'), 
(14, 34, 24, '2025-12-10', '11:00:00', 'confirmada'), 
(13, 35, 30, '2025-12-10', '11:00:00', 'confirmada'), 
(15, 33, 21, '2025-12-10', '10:30:00', 'confirmada'), 
(16, 40, 29, '2025-12-10', '17:30:00', 'confirmada'); 

-- Miércoles, 11 de Diciembre de 2025 (Salon 8:00 - 18:00)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(12, 33, 22, '2025-12-11', '10:00:00', 'confirmada'), 
(17, 31, 21, '2025-12-11', '10:30:00', 'confirmada'), 
(19, 32, 23, '2025-12-11', '08:00:00', 'confirmada'),  
(20, 33, 22, '2025-12-11', '16:00:00', 'confirmada'), 
(11, 35, 36, '2025-12-11', '15:00:00', 'confirmada');

-- Jueves, 12 de Diciembre de 2025 (Salon 9:00 - 18:00)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(18, 36, 30, '2025-12-12', '09:00:00', 'confirmada'), 
(11, 39, 23, '2025-12-12', '12:00:00', 'confirmada'); 

-- Viernes, 13 de Diciembre de 2025 (Salon 8:00 - 19:00)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(12, 34, 24, '2025-12-13', '14:00:00', 'confirmada'), 
(14, 40, 24, '2025-12-13', '16:00:00', 'confirmada'), 
(16, 38, 21, '2025-12-13', '14:00:00', 'completada'); 

-- Lunes, 16 de Diciembre de 2025 (Salon 9:00 - 17:00)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(20, 37, 37, '2025-12-16', '16:00:00', 'confirmada');