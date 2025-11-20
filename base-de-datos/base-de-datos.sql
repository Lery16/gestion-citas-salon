CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- ACTIVAR EXTENSIÓN (Necesaria para contraseñas)

-- 1. LIMPIEZA TOTAL
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
DROP TABLE IF EXISTS Disponibilidad CASCADE;
DROP TABLE IF EXISTS Tipo_Servicio CASCADE;
DROP TABLE IF EXISTS Empleado CASCADE;
DROP TABLE IF EXISTS Cliente CASCADE;

DROP TYPE IF EXISTS estado_empleado_enum CASCADE;
DROP TYPE IF EXISTS estado_servicio_enum CASCADE;
DROP TYPE IF EXISTS estado_dia_enum CASCADE;
DROP TYPE IF EXISTS estado_cita_enum CASCADE;
DROP TYPE IF EXISTS dia_semana_enum CASCADE;

-- 2. DEFINICIÓN DE TIPOS (ENUMS)
CREATE TYPE estado_empleado_enum AS ENUM ('ocupado', 'disponible', 'vacaciones');
CREATE TYPE estado_servicio_enum AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_dia_enum AS ENUM ('abierto', 'cerrado');
CREATE TYPE estado_cita_enum AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');
CREATE TYPE dia_semana_enum AS ENUM ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo');

-- 3. CREACIÓN DE TABLAS
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
    rol VARCHAR(50) NOT NULL,
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

CREATE TABLE Disponibilidad_Diaria_Empleado (
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    horas_disponibles_restantes DECIMAL(6,2) NOT NULL DEFAULT 9.00,
    PRIMARY KEY (id_empleado, fecha),
    CONSTRAINT fk_Disponibilidad_Diaria_Empleado_Empleado
        FOREIGN KEY (id_empleado)
        REFERENCES Empleado (id_empleado)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE Cita (
    id_cita SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    estado estado_cita_enum NOT NULL DEFAULT 'confirmada',
    
    CONSTRAINT fk_Cita_Cliente FOREIGN KEY (id_cliente) REFERENCES Cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_Cita_Tipo_Servicio FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_Cita_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Índices creados por separado para PostgreSQL
CREATE INDEX fk_cita_cliente_idx ON Cita(id_cliente);
CREATE INDEX fk_cita_tipo_servicio_idx ON Cita(id_servicio);
CREATE INDEX fk_cita_empleado_idx ON Cita(id_empleado);
ALTER SEQUENCE cita_id_cita_seq RESTART WITH 41;

CREATE TABLE Disponibilidad (
    id_disponibilidad SERIAL PRIMARY KEY,
    id_empleado INTEGER NOT NULL,
    fecha_disponible DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    CONSTRAINT fk_Disponibilidad_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX fk_disponibilidad_empleado_idx ON Disponibilidad(id_empleado);
ALTER SEQUENCE disponibilidad_id_disponibilidad_seq RESTART WITH 51;

CREATE TABLE Empleado_Servicio (
    id_empleado INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    PRIMARY KEY (id_empleado, id_servicio),
    CONSTRAINT fk_Empleado_Servicio_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_Empleado_Servicio_Servicio FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX fk_empleado_servicio_servicio_idx ON Empleado_Servicio(id_servicio);

-- Tabla de Horario Semanal (Normalización 3FN)
CREATE TABLE Horario_Semanal_Empleado (
    id_horario SERIAL PRIMARY KEY,
    id_empleado INTEGER NOT NULL,
    dia dia_semana_enum NOT NULL,
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL,
    CONSTRAINT fk_Horario_Semanal_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_horario_logico CHECK (hora_cierre > hora_apertura),
    UNIQUE (id_empleado, dia) 
);
CREATE INDEX idx_horario_empleado ON Horario_Semanal_Empleado(id_empleado);

-- 4. FUNCIONES Y TRIGGERS
-- Trigger BEFORE INSERT (Validaciones)
CREATE OR REPLACE FUNCTION tr_cita_before_insert_func()
RETURNS TRIGGER AS $$
DECLARE
    salon_abierto estado_dia_enum;
    duracion DECIMAL(6,2);
    horas_restantes DECIMAL(6,2);
    hora_apertura_salon TIME;
    hora_cierre_salon TIME;
    hora_fin_cita TIME;
BEGIN
    SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;

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

    -- Validación de hora de inicio
    IF NEW.hora < hora_apertura_salon OR NEW.hora >= hora_cierre_salon THEN
        RAISE EXCEPTION 'La cita debe iniciar entre % y antes de %.', hora_apertura_salon, hora_cierre_salon;
    END IF;

    -- Validación de hora de fin (AQUÍ ESTABA EL ERROR DE DATOS)
    hora_fin_cita := NEW.hora + (duracion * INTERVAL '1 hour');
    IF hora_fin_cita > hora_cierre_salon THEN
        RAISE EXCEPTION 'La duración del servicio (%) excede el horario de cierre (%).', duracion, hora_cierre_salon;
    END IF;

    -- Validación de disponibilidad del empleado (Horas restantes)
    SELECT COALESCE(horas_disponibles_restantes, 9.00) INTO horas_restantes
    FROM Disponibilidad_Diaria_Empleado
    WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;

    IF horas_restantes < duracion THEN
        RAISE EXCEPTION 'El empleado % no tiene suficiente tiempo (% horas necesarias).', NEW.id_empleado, duracion;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_before_insert
BEFORE INSERT ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_before_insert_func();

-- Trigger AFTER INSERT (Actualizar disponibilidad)
CREATE OR REPLACE FUNCTION tr_cita_after_insert_func()
RETURNS TRIGGER AS $$
DECLARE
    duracion DECIMAL(6,2);
BEGIN
    -- Asegurar que la fecha exista en Dia_Salon_Estado antes de usarla
    INSERT INTO Dia_Salon_Estado (fecha) VALUES (NEW.fecha) ON CONFLICT (fecha) DO NOTHING;
    
    IF NEW.estado = 'confirmada' THEN
        SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;
        
        -- Actualizar o insertar la disponibilidad diaria del empleado
        INSERT INTO Disponibilidad_Diaria_Empleado (id_empleado, fecha, horas_disponibles_restantes)
        VALUES (NEW.id_empleado, NEW.fecha, 9.00 - duracion)
        ON CONFLICT (id_empleado, fecha) 
        DO UPDATE SET horas_disponibles_restantes = Disponibilidad_Diaria_Empleado.horas_disponibles_restantes - duracion;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_after_insert
AFTER INSERT ON Cita
FOR EACH ROW EXECUTE FUNCTION tr_cita_after_insert_func();

-- Trigger AFTER UPDATE (Cambio de estados)
CREATE OR REPLACE FUNCTION tr_cita_after_update_func()
RETURNS TRIGGER AS $$
DECLARE
    duracion DECIMAL(6,2);
BEGIN
    IF OLD.id_empleado = NEW.id_empleado AND OLD.fecha = NEW.fecha THEN
        SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;

        IF OLD.estado = 'confirmada'::estado_cita_enum AND NEW.estado = 'cancelada'::estado_cita_enum THEN
            -- Si se cancela, se libera el tiempo del empleado
            UPDATE Disponibilidad_Diaria_Empleado
            SET horas_disponibles_restantes = horas_disponibles_restantes + duracion
            WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;
        
        ELSEIF OLD.estado = 'cancelada'::estado_cita_enum AND NEW.estado = 'confirmada'::estado_cita_enum THEN
            -- Si se reconfirma, se vuelve a restar el tiempo
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

-- 5. INSERCIÓN DE DATOS
INSERT INTO Cliente (nombre, apellido, telefono, correo) VALUES
('Ana', 'García', '5551234567', 'ana.garcia@mail.com'),
('Benito', 'López', '5559876543', 'benito.lopez@mail.com'),
('Carla', 'Martínez', '5551112233', 'carla.martinez@mail.com'),
('David', 'Sánchez', '5554445566', 'david.sanchez@mail.com'),
('Elena', 'Ruiz', '5557778899', 'elena.ruiz@mail.com'),
('Felipe', 'Hernández', '5550001122', 'felipe.hernandez@mail.com'),
('Gloria', 'Díaz', '5553334455', 'gloria.diaz@mail.com'),
('Héctor', 'Pérez', '5556667788', 'hector.perez@mail.com'),
('Irene', 'Gómez', '5559990011', 'irene.gomez@mail.com'),
('Javier', 'Rodríguez', '5552223344', 'javier.rodriguez@mail.com');

INSERT INTO Empleado (nombre, apellido, rol, telefono, correo, estado, contraseña) VALUES
('Laura', 'Vargas', 'admin', '5551000001', 'laura.vargas@salon.com', 'disponible', ENCODE(DIGEST('contraseña1', 'sha256'), 'hex')),
('Miguel', 'Rojas', 'trabajador', '5551000002', 'miguel.rojas@salon.com', 'disponible', ENCODE(DIGEST('contraseña2', 'sha256'), 'hex')),
('Sofía', 'Castro', 'trabajador', '5551000003', 'sofia.castro@salon.com', 'disponible', ENCODE(DIGEST('contraseña3', 'sha256'), 'hex')),
('Pablo', 'Mora', 'trabajador', '5551000004', 'pablo.mora@salon.com', 'disponible', ENCODE(DIGEST('contraseña4', 'sha256'), 'hex')),
('Diana', 'Fuentes', 'trabajador', '5551000005', 'diana.fuentes@salon.com', 'disponible', ENCODE(DIGEST('contraseña5', 'sha256'), 'hex')),
('Andrés', 'Guzmán', 'trabajador', '5551000006', 'andres.guzman@salon.com', 'disponible', ENCODE(DIGEST('contraseña6', 'sha256'), 'hex')),
('Fernanda', 'Lira', 'trabajador', '5551000007', 'fernanda.lira@salon.com', 'disponible', ENCODE(DIGEST('contraseña7', 'sha256'), 'hex')),
('Ricardo', 'Paz', 'trabajador', '5551000008', 'ricardo.paz@salon.com', 'disponible', ENCODE(DIGEST('contraseña8', 'sha256'), 'hex')),
('Valeria', 'Cruz', 'trabajador', '5551000009', 'valeria.cruz@salon.com', 'vacaciones', ENCODE(DIGEST('contraseña9', 'sha256'), 'hex')),
('Jorge', 'Nieto', 'trabajador', '5551000010', 'jorge.nieto@salon.com', 'disponible', ENCODE(DIGEST('contraseña10', 'sha256'), 'hex'));

INSERT INTO Tipo_Servicio (nombre_servicio, duracion_horas, precio, estado) VALUES
('Corte Dama y Peinado', 1.50, 45.00, 'activo'),
('Masaje Relajante (60m)', 1.00, 60.00, 'activo'),
('Tinte Completo + Tratamiento', 2.00, 85.50, 'activo'),
('Manicura y Pedicura Deluxe', 1.50, 55.00, 'activo'),
('Masaje Deportivo (90m)', 1.50, 90.00, 'activo'),
('Diseño de Cejas', 0.50, 20.00, 'activo'),
('Corte Caballero', 0.75, 30.00, 'activo'),
('Tratamiento Capilar Profundo', 1.00, 40.00, 'activo'),
('Extensiones de Pestañas', 2.50, 120.00, 'activo'),
('Peinado para Eventos', 1.00, 50.00, 'activo');

INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES
(21, 31), (21, 33), (21, 37), (21, 38), (21, 40),
(22, 32), (22, 35),
(23, 31), (23, 33), (23, 38), (23, 39), (23, 40),
(24, 34), (24, 36),
(26, 31), (26, 37), (26, 38),
(27, 36), (27, 39),
(28, 37),
(29, 32), (29, 34), (29, 36), (29, 39), (29, 38), (29, 40),
(30, 32), (30, 35);

INSERT INTO Disponibilidad (id_empleado, fecha_disponible, hora_inicio, hora_fin) VALUES
(21, '2025-11-01', '09:00:00', '17:00:00'),
(21, '2025-11-02', '09:00:00', '17:00:00'),
(22, '2025-11-01', '10:00:00', '18:00:00'),
(23, '2025-11-01', '08:00:00', '16:00:00'),
(23, '2025-11-03', '08:00:00', '16:00:00'),
(24, '2025-11-01', '11:00:00', '19:00:00'),
(26, '2025-11-02', '10:00:00', '18:00:00'),
(27, '2025-11-02', '12:00:00', '20:00:00'),
(28, '2025-11-03', '09:00:00', '17:00:00'),
(29, '2025-11-03', '10:00:00', '18:00:00'),
(30, '2025-11-01', '09:00:00', '17:00:00'),
(30, '2025-11-02', '09:00:00', '17:00:00'),
(30, '2025-11-03', '09:00:00', '17:00:00'),
(22, '2025-11-03', '10:00:00', '18:00:00'),
(24, '2025-11-03', '11:00:00', '19:00:00');

-- Precarga de días para triggers
INSERT INTO Dia_Salon_Estado (fecha) VALUES
('2025-11-01'), ('2025-11-02'), ('2025-11-03');

INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(11, 31, 21, '2025-11-01', '09:00:00', 'confirmada'),
(12, 32, 22, '2025-11-01', '10:00:00', 'confirmada'),
(13, 33, 23, '2025-11-01', '08:00:00', 'confirmada'),
(14, 34, 24, '2025-11-01', '11:00:00', 'confirmada'),
(15, 35, 22, '2025-11-03', '12:00:00', 'cancelada'),
(16, 37, 28, '2025-11-03', '09:00:00', 'confirmada'),
(17, 31, 21, '2025-11-01', '10:30:00', 'confirmada'),
(18, 32, 30, '2025-11-02', '09:00:00', 'confirmada'),
(19, 39, 27, '2025-11-02', '12:00:00', 'confirmada'),
(20, 38, 26, '2025-11-02', '10:00:00', 'confirmada'),
(11, 33, 23, '2025-11-01', '12:00:00', 'confirmada'),
(12, 34, 24, '2025-11-03', '14:00:00', 'confirmada'),
(13, 35, 30, '2025-11-01', '11:00:00', 'confirmada'),
(14, 36, 24, '2025-11-03', '16:00:00', 'confirmada'),
(15, 37, 28, '2025-11-03', '13:00:00', 'confirmada'),
(16, 38, 21, '2025-11-02', '14:00:00', 'confirmada'),
-- LÍNEA CORREGIDA: Cambiado de 15:00:00 a 14:30:00 (14:30 + 2.5h = 17:00, justo a la hora de cierre)
(17, 39, 23, '2025-11-01', '14:30:00', 'cancelada'), 
(18, 40, 23, '2025-11-01', '10:30:00', 'confirmada'),
(19, 31, 21, '2025-11-01', '13:30:00', 'confirmada'),
(20, 32, 22, '2025-11-01', '16:00:00', 'confirmada');

-- Datos de Horario Semanal
INSERT INTO Horario_Semanal_Empleado (id_empleado, dia, hora_apertura, hora_cierre) VALUES
(21, 'Lunes', '09:00', '17:00'), (21, 'Martes', '09:00', '17:00'), (21, 'Miércoles', '09:00', '17:00'), (21, 'Jueves', '09:00', '17:00'), (21, 'Viernes', '09:00', '17:00'),
(22, 'Martes', '10:00', '19:00'), (22, 'Miércoles', '10:00', '19:00'), (22, 'Jueves', '10:00', '19:00'), (22, 'Viernes', '10:00', '19:00'), (22, 'Sábado', '09:00', '14:00'),
(23, 'Lunes', '08:00', '14:00'), (23, 'Martes', '08:00', '14:00'), (23, 'Miércoles', '08:00', '14:00'), (23, 'Jueves', '08:00', '14:00'), (23, 'Viernes', '08:00', '14:00'), (23, 'Sábado', '08:00', '13:00');