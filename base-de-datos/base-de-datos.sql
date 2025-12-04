-- SISTEMA DE GESTIÓN DE CITAS PARA SALÓN DE BELLEZA
-- CÓDIGO NORMALIZADO (3FN) - Horario Universal (9:00 - 19:00, L-S)
-- CORREGIDO: Inclusión de NEW.id_empleado en el mensaje de error de solapamiento.

-- Establece la extensión pgcrypto para el hash de contraseñas (MANDATORY).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. DROPS (Limpieza de Objetos Existentes)
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS obtener_slots_disponibles(INT, DATE, INT, INTERVAL);

DROP TRIGGER IF EXISTS tr_cita_before_insert ON Cita;
DROP TRIGGER IF EXISTS tr_empleado_servicio_admin_check ON Empleado_Servicio;
DROP TRIGGER IF EXISTS tr_dia_salon_estado_check ON Dia_Salon_Estado;


DROP FUNCTION IF EXISTS tr_cita_before_insert_func();
DROP FUNCTION IF EXISTS tr_empleado_servicio_admin_check_func();
DROP FUNCTION IF EXISTS tr_dia_salon_estado_check_func();


DROP TABLE IF EXISTS Horario_Semanal_Empleado CASCADE; 
DROP TABLE IF EXISTS Disponibilidad_Diaria_Empleado CASCADE; 
DROP TABLE IF EXISTS Empleado_Servicio CASCADE;
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


-- TABLA UNIVERSAL SOLICITADA PARA EL HORARIO SEMANAL DE TRABAJO (SIN FK A EMPLEADO)
CREATE TABLE Horario_Semanal_Empleado (
    dia dia_semana_enum PRIMARY KEY, -- Clave primaria basada en el día de la semana
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL,
    CONSTRAINT chk_horario_trabajo CHECK (hora_cierre > hora_apertura)
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

-- Control de Días Cerrados del Salón

-- Función de Trigger BEFORE INSERT/UPDATE en Dia_Salon_Estado (Solo acepta entradas con estado_dia 'Cerrado')
CREATE OR REPLACE FUNCTION tr_dia_salon_estado_check_func()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado_dia = 'Abierto' THEN
        RAISE EXCEPTION 'Solo se permite registrar un día si su estado es "Cerrado". El estado "Abierto" es el predeterminado para cualquier fecha no registrada.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_dia_salon_estado_check
BEFORE INSERT OR UPDATE ON Dia_Salon_Estado
FOR EACH ROW
EXECUTE FUNCTION tr_dia_salon_estado_check_func();

-- Validación de Horario y Disponibilidad de Citas

-- Función de Trigger BEFORE INSERT/UPDATE en Cita (Validación de horarios y solapamiento)
CREATE OR REPLACE FUNCTION tr_cita_before_insert_func()
RETURNS TRIGGER AS $$
DECLARE
    -- Horario universal de empleado (OBTENIDO DE LA NUEVA TABLA Horario_Semanal_Empleado)
    HORA_APERTURA_EMP TIME; 
    HORA_CIERRE_EMP TIME;
    
    salon_abierto estado_dia_enum; 
    duracion DECIMAL(6,2);
    hora_apertura_salon TIME;
    hora_cierre_salon TIME;
    hora_fin_cita TIME;
    solapamiento_existe BOOLEAN;
    empleado_estado estado_empleado_enum;
    dia_cita dia_semana_enum;
    dia_actual_texto TEXT;
BEGIN
    -- 1. Obtener la duración del servicio
    SELECT duracion_horas INTO duracion 
    FROM Tipo_Servicio 
    WHERE id_servicio = NEW.id_servicio;

    -- 2. Obtener el estado del empleado
    SELECT estado INTO empleado_estado
    FROM Empleado
    WHERE id_empleado = NEW.id_empleado;

    IF empleado_estado = 'Vacacionando' THEN
        RAISE EXCEPTION 'El empleado con ID % está de vacaciones y no puede tomar citas.', NEW.id_empleado;
    END IF;

    -- 3. Calcular el día de la semana y obtener el horario universal del empleado
    SELECT TRIM(TO_CHAR(NEW.fecha, 'Day')) INTO dia_actual_texto;
    CASE dia_actual_texto
        WHEN 'Monday' THEN dia_cita := 'Lunes';
        WHEN 'Tuesday' THEN dia_cita := 'Martes';
        WHEN 'Wednesday' THEN dia_cita := 'Miércoles';
        WHEN 'Thursday' THEN dia_cita := 'Jueves';
        WHEN 'Friday' THEN dia_cita := 'Viernes';
        WHEN 'Saturday' THEN dia_cita := 'Sábado';
        WHEN 'Sunday' THEN dia_cita := 'Domingo';
        ELSE dia_cita := dia_actual_texto::dia_semana_enum;
    END CASE;

    -- Obtener el horario de la tabla Horario_Semanal_Empleado
    SELECT hora_apertura, hora_cierre INTO HORA_APERTURA_EMP, HORA_CIERRE_EMP
    FROM Horario_Semanal_Empleado
    WHERE dia = dia_cita;

    -- Validar si el día está registrado como laboral
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El día % no está registrado en el horario semanal universal y se considera no laborable.', dia_cita;
    END IF;

    -- 4. Obtener horario del salón (o el horario por defecto si no hay registro)
    SELECT 
        COALESCE(estado_dia, 'Abierto'::estado_dia_enum),
        COALESCE(hora_apertura, HORA_APERTURA_EMP), -- Usar HORA_APERTURA_EMP como default si no hay registro
        COALESCE(hora_cierre, HORA_CIERRE_EMP)      -- Usar HORA_CIERRE_EMP como default si no hay registro
    INTO 
        salon_abierto, 
        hora_apertura_salon, 
        hora_cierre_salon
    FROM 
        Dia_Salon_Estado
    WHERE 
        fecha = NEW.fecha;

    -- 5. Validación: No se permiten citas en días con salón cerrado
    IF salon_abierto = 'Cerrado' THEN
        RAISE EXCEPTION 'El salón está CERRADO para citas en la fecha %.', NEW.fecha;
    END IF;

    -- 6. Calcular la hora de fin de la nueva cita y asignarla a NEW.hora_fin
    hora_fin_cita := NEW.hora + (duracion * INTERVAL '1 hour');
    NEW.hora_fin := hora_fin_cita;

    -- 7. Validación de horario EFECTIVO (Intersección Empleado/Salón)
    hora_apertura_salon := GREATEST(HORA_APERTURA_EMP, hora_apertura_salon);
    hora_cierre_salon := LEAST(HORA_CIERRE_EMP, hora_cierre_salon);
    
    IF NEW.hora < hora_apertura_salon THEN
        RAISE EXCEPTION 'La cita debe iniciar a las % o después (Horario efectivo de inicio: % a %).', hora_apertura_salon, hora_apertura_salon, hora_cierre_salon;
    END IF;

    IF NEW.hora_fin > hora_cierre_salon THEN
        RAISE EXCEPTION 'La duración del servicio (%) excede el horario efectivo de cierre (%). La cita finalizaría a las %.', duracion, hora_cierre_salon, NEW.hora_fin;
    END IF;

    -- 8. Validación de SOLAPAMIENTO con otras citas (FIX: Uso de COALESCE)
    SELECT EXISTS (
        SELECT 1 
        FROM Cita c
        WHERE 
            c.id_empleado = NEW.id_empleado
            AND c.fecha = NEW.fecha
            AND c.id_cita IS DISTINCT FROM NEW.id_cita 
            AND c.estado IN ('Pendiente', 'Confirmada')
            -- FIX: Calculamos c.hora_fin sobre la marcha si es NULL, usando la duración del servicio.
            AND NEW.hora < COALESCE(c.hora_fin, c.hora + (
                SELECT ts.duracion_horas * INTERVAL '1 hour'
                FROM Tipo_Servicio ts WHERE ts.id_servicio = c.id_servicio
            ))
            AND NEW.hora_fin > c.hora 
    ) INTO solapamiento_existe;
    
    IF solapamiento_existe THEN
        -- CORRECCIÓN APLICADA: Se incluye NEW.id_empleado en la lista de variables de la excepción.
        RAISE EXCEPTION 'El empleado con ID % ya tiene una cita confirmada que se solapa con el periodo de % a % en esta fecha.', NEW.id_empleado, NEW.hora, NEW.hora_fin;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_before_insert
BEFORE INSERT OR UPDATE ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_before_insert_func();

-- Control de Servicios por Administradores

-- Función de Trigger BEFORE INSERT/UPDATE en Empleado_Servicio (Bloquea Administradores)
CREATE OR REPLACE FUNCTION tr_empleado_servicio_admin_check_func()
RETURNS TRIGGER AS $$
DECLARE
    empleado_rol rol_empleado_enum;
BEGIN
    SELECT rol INTO empleado_rol
    FROM Empleado
    WHERE id_empleado = NEW.id_empleado;

    IF empleado_rol = 'Administrador' THEN
        RAISE EXCEPTION 'Un empleado con rol "Administrador" no puede ser asignado a servicios (id: %).', NEW.id_empleado
        USING HINT = 'Asigne solo el rol "Trabajador" a los empleados que ofrecen servicios.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_empleado_servicio_admin_check
BEFORE INSERT OR UPDATE ON Empleado_Servicio
FOR EACH ROW
EXECUTE FUNCTION tr_empleado_servicio_admin_check_func();


-- Función de Consulta de Slots Disponibles

-- Función para obtener los slots de tiempo disponibles para un empleado y servicio en una fecha específica
CREATE OR REPLACE FUNCTION obtener_slots_disponibles(
    p_id_empleado INT,
    p_fecha DATE,
    p_id_servicio INT,
    p_intervalo_grid INTERVAL DEFAULT '30 minutes'
)
RETURNS TABLE (hora_inicio TIME) AS $$
DECLARE
    -- Horario universal de empleado (OBTENIDO DE LA NUEVA TABLA Horario_Semanal_Empleado)
    HORA_APERTURA_EMP TIME; 
    HORA_CIERRE_EMP TIME;
    
    v_duracion_horas DECIMAL(6,2);
    v_duracion_interval INTERVAL;
    v_salon_apertura TIME;
    v_salon_cierre TIME;
    v_start_time TIME; 
    v_end_time TIME; 
    v_dia_semana TEXT;
    v_dia_enum dia_semana_enum;
    v_salon_estado estado_dia_enum;
    v_empleado_estado estado_empleado_enum;
BEGIN
    -- 1. Obtener duración del servicio
    SELECT duracion_horas INTO v_duracion_horas
    FROM Tipo_Servicio 
    WHERE id_servicio = p_id_servicio;

    IF NOT FOUND THEN RETURN; END IF;

    v_duracion_interval := (v_duracion_horas || ' hours')::INTERVAL;

    -- 2. Validar estado del empleado
    SELECT estado INTO v_empleado_estado
    FROM Empleado
    WHERE id_empleado = p_id_empleado;

    IF v_empleado_estado = 'Vacacionando' THEN RETURN; END IF;

    -- 3. Determinar el día de la semana y obtener el horario universal
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

    -- Obtener el horario de la tabla Horario_Semanal_Empleado
    SELECT hora_apertura, hora_cierre INTO HORA_APERTURA_EMP, HORA_CIERRE_EMP
    FROM Horario_Semanal_Empleado
    WHERE dia = v_dia_enum;

    -- Si el día no está en la tabla, se considera no laborable
    IF NOT FOUND THEN RETURN; END IF;
    
    -- 4. Validar y obtener horario del salón
    SELECT 
        COALESCE(estado_dia, 'Abierto'::estado_dia_enum),
        COALESCE(hora_apertura, HORA_APERTURA_EMP),
        COALESCE(hora_cierre, HORA_CIERRE_EMP)
    INTO v_salon_estado, v_salon_apertura, v_salon_cierre
    FROM Dia_Salon_Estado
    WHERE fecha = p_fecha
    LIMIT 1;

    IF v_salon_estado = 'Cerrado' THEN RETURN; END IF;

    -- 5. Determinar horario efectivo final (intersección entre empleado y salón)
    v_start_time := GREATEST(HORA_APERTURA_EMP, v_salon_apertura);
    v_end_time := LEAST(HORA_CIERRE_EMP, v_salon_cierre);

    IF (v_end_time - v_start_time)::INTERVAL < v_duracion_interval THEN RETURN; END IF;

    -- 6. Generar series y filtrar solapamientos (Uso de COALESCE)
    RETURN QUERY
    SELECT series_tiempo::TIME
    FROM generate_series(
        ('2000-01-01'::DATE + v_start_time)::TIMESTAMP,
        ('2000-00-00'::DATE + v_end_time - v_duracion_interval)::TIMESTAMP,
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
              -- Asegura que se use la hora de fin correcta para el chequeo
              AND series_tiempo::TIME < COALESCE(c.hora_fin, c.hora + (
                    SELECT ts.duracion_horas * INTERVAL '1 hour'
                    FROM Tipo_Servicio ts WHERE ts.id_servicio = c.id_servicio
                )) 
              AND (series_tiempo::TIME + v_duracion_interval) > c.hora
      );
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
('Susana', 'Ortiz', '5557005533', 'susana.ortiz@solon.com'),
('Tomás', 'Nuñez', '5551998822', 'tomas.nunez@solon.com'),
('Ursula', 'Cervantes', '5554441177', 'ursula.cervantes@solon.com'),
('Víctor', 'Reyes', '5559090909', 'victor.reyes@solon.com'),
('Ximena', 'Arias', '5551112233', 'ximena.arias@solon.com'),
('Yago', 'Blanco', '5552223344', 'yago.blanco@solon.com'),
('Zoe', 'Díaz', '5553334455', 'zoe.diaz@solon.com'),
('Adrián', 'Flores', '5554445566', 'adrian.flores@solon.com'),
('Beatriz', 'Gómez', '5555556677', 'beatriz.gomez@solon.com'),
('César', 'Ibáñez', '5556667788', 'cesar.ibanez@solon.com'),
('Diana', 'Jiménez', '5557778899', 'diana.jimenez@solon.com'),
('Elías', 'López', '5558889900', 'elias.lopez@solon.com'),
('Fátima', 'Molina', '5559990011', 'fatima.molina@solon.com'),
('Guillermo', 'Pérez', '5550001122', 'guillermo.perez@solon.com');

-- Empleados (20 Empleados)
INSERT INTO Empleado (nombre, apellido, rol, telefono, correo, estado, contraseña) VALUES
    ('Laura', 'Vargas', 'Administrador', '5551000001', 'laura.vargas@salon.com', 'Disponible', ENCODE(DIGEST('contraseña1', 'sha256'), 'hex')), -- 21
    ('Alejandra', 'Méndez', 'Trabajador', '5551000011', 'alejandra.mendez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña11', 'sha256'), 'hex')), -- 22
    ('Roberto', 'Soto', 'Trabajador', '5551000012', 'roberto.soto@salon.com', 'Disponible', ENCODE(DIGEST('contraseña12', 'sha256'), 'hex')), -- 23
    ('Karina', 'Gil', 'Trabajador', '5551000013', 'karina.gil@salon.com', 'Disponible', ENCODE(DIGEST('contraseña13', 'sha256'), 'hex')), -- 24
    ('Esteban', 'Pinto', 'Trabajador', '5551000014', 'esteban.pinto@salon.com', 'Disponible', ENCODE(DIGEST('contraseña14', 'sha256'), 'hex')), -- 25
    ('Gabriela', 'Lagos', 'Trabajador', '5551000015', 'gabriela.lagos@salon.com', 'Disponible', ENCODE(DIGEST('contraseña15', 'sha256'), 'hex')), -- 26
    ('Humberto', 'Vidal', 'Trabajador', '5551000016', 'humberto.vidal@salon.com', 'Vacacionando', ENCODE(DIGEST('contraseña16', 'sha256'), 'hex')), -- 27
    ('Isabel', 'Zurita', 'Trabajador', '5551000017', 'isabel.zurita@salon.com', 'Disponible', ENCODE(DIGEST('contraseña17', 'sha256'), 'hex')), -- 28
    ('Juan', 'Gálvez', 'Trabajador', '5551000018', 'juan.galvez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña18', 'sha256'), 'hex')), -- 29
    ('Kelly', 'Herrera', 'Trabajador', '5551000019', 'kelly.herrera@salon.com', 'Disponible', ENCODE(DIGEST('contraseña19', 'sha256'), 'hex')), -- 30
    ('Leo', 'Zúñiga', 'Administrador', '5551000020', 'leo.zuniga@salon.com', 'Disponible', ENCODE(DIGEST('contraseña20', 'sha256'), 'hex')), -- 31
    ('Mónica', 'Ríos', 'Trabajador', '5551000021', 'monica.rios@salon.com', 'Disponible', ENCODE(DIGEST('contraseña21', 'sha256'), 'hex')), -- 32
    ('Noé', 'Sánchez', 'Trabajador', '5551000022', 'noe.sanchez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña22', 'sha256'), 'hex')), -- 33
    ('Ofelia', 'Tapia', 'Trabajador', '5551000023', 'ofelia.tapia@salon.com', 'Disponible', ENCODE(DIGEST('contraseña23', 'sha256'), 'hex')), -- 34
    ('Pablo', 'Ulloa', 'Trabajador', '5551000024', 'pablo.ulloa@salon.com', 'Vacacionando', ENCODE(DIGEST('contraseña24', 'sha256'), 'hex')), -- 35
    ('Rebeca', 'Vega', 'Trabajador', '5551000025', 'rebeca.vega@salon.com', 'Disponible', ENCODE(DIGEST('contraseña25', 'sha256'), 'hex')), -- 36
    ('Samuel', 'Weiss', 'Trabajador', '5551000026', 'samuel.weiss@salon.com', 'Disponible', ENCODE(DIGEST('contraseña26', 'sha256'), 'hex')), -- 37
    ('Tania', 'Xavier', 'Trabajador', '5551000027', 'tania.xavier@salon.com', 'Disponible', ENCODE(DIGEST('contraseña27', 'sha256'), 'hex')), -- 38
    ('Ulises', 'Yáñez', 'Trabajador', '5551000028', 'ulises.yanez@salon.com', 'Disponible', ENCODE(DIGEST('contraseña28', 'sha256'), 'hex')), -- 39
    ('Vanesa', 'Zavala', 'Trabajador', '5551000029', 'vanesa.zavala@salon.com', 'Disponible', ENCODE(DIGEST('contraseña29', 'sha256'), 'hex')); -- 40

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

-- Horario_Semanal_Empleado (Inserción de datos solicitados)
INSERT INTO Horario_Semanal_Empleado (dia, hora_apertura, hora_cierre) VALUES
    ('Lunes', '09:00:00', '19:00:00'),
    ('Martes', '09:00:00', '19:00:00'),
    ('Miércoles', '09:00:00', '19:00:00'),
    ('Jueves', '09:00:00', '19:00:00'),
    ('Viernes', '09:00:00', '19:00:00'),
    ('Sábado', '09:00:00', '19:00:00'),
    ('Domingo', '00:00:00', '00:00:01'); -- Domingo se registra como cerrado/no laborable


-- Empleado_Servicio (Asignación de servicios a trabajadores)
INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES
    (22, 33), (22, 34), (22, 35),
    (23, 31), (23, 32), (23, 35), (23, 37), (23, 38), (23, 39),
    (24, 33), (24, 34), (24, 40), (24, 41), (24, 42),
    (25, 36),
    (26, 31), (26, 37), (26, 38),
    (27, 32), (27, 40), (27, 42),
    (28, 37), (28, 38), (28, 36),
    (29, 31), (29, 33), (29, 36), (29, 37), (29, 40),
    (30, 33), (30, 34), (30, 40), (30, 41), (30, 42),
    (32, 33), (32, 34),
    (33, 31), (33, 37), (33, 38), (33, 39),
    (34, 33), (34, 34),
    (35, 33), (35, 34),
    (36, 32), (36, 35),
    (37, 31), (37, 37), (37, 38),
    (38, 33), (38, 34),
    (39, 33), (39, 34),
    (40, 33), (40, 34), (40, 35);

-- Dia_Salon_Estado (Solo inserciones con estado 'Cerrado' para fechas específicas)
INSERT INTO Dia_Salon_Estado (fecha, hora_apertura, hora_cierre, estado_dia) VALUES
    ('2025-12-15', '09:00:00', '15:00:00', 'Cerrado'), -- Lunes cerrado temprano
    ('2025-12-25', '00:00:00', '00:00:01', 'Cerrado'); -- Navidad (día totalmente cerrado)

-- Citas (Datos de ejemplo)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
    -- Martes 10 (Horario universal 09:00-19:00)
    (11, 31, 22, '2025-12-10', '09:00:00', 'Confirmada'), -- Alejandra (1.5h) -> Fin 10:30
    (14, 34, 24, '2025-12-10', '11:00:00', 'Confirmada'), 
    (13, 35, 30, '2025-12-10', '11:00:00', 'Confirmada'), 
    (15, 33, 22, '2025-12-10', '10:30:00', 'Confirmada'), -- Alejandra (1.0h) -> Fin 11:30 (No solapa, solo se toca)
    (16, 40, 29, '2025-12-10', '17:30:00', 'Confirmada'), 

    -- Miércoles 11
    (12, 33, 22, '2025-12-11', '10:00:00', 'Confirmada'), 
    (17, 31, 23, '2025-12-11', '10:30:00', 'Confirmada'),  
    (20, 33, 22, '2025-12-11', '16:00:00', 'Confirmada'), 
    (11, 35, 26, '2025-12-11', '15:00:00', 'Confirmada'), 

    -- Jueves 12
    (18, 36, 30, '2025-12-12', '09:00:00', 'Confirmada'), 
    (11, 39, 23, '2025-12-12', '16:00:00', 'Confirmada'), 

    -- Viernes 13
    (12, 34, 24, '2025-12-13', '14:00:00', 'Confirmada'), 
    (14, 40, 24, '2025-12-13', '16:00:00', 'Confirmada'), 
    (16, 38, 26, '2025-12-13', '14:00:00', 'Completada'), 

    -- Lunes 16 
    (20, 37, 37, '2025-12-16', '16:00:00', 'Confirmada');