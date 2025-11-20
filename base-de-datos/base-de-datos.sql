-- Configuración inicial
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. LIMPIEZA DE TRIGGERS, FUNCIONES, TABLAS Y TIPOS
DROP TRIGGER IF EXISTS tr_cita_before_insert ON Cita;
DROP TRIGGER IF EXISTS tr_cita_after_insert ON Cita;
DROP TRIGGER IF EXISTS tr_cita_after_update ON Cita;

DROP FUNCTION IF EXISTS tr_cita_before_insert_func();
DROP FUNCTION IF EXISTS tr_cita_after_insert_func();
DROP FUNCTION IF EXISTS tr_cita_after_update_func();

DROP TABLE IF EXISTS Empleado_Servicio CASCADE;
DROP TABLE IF EXISTS Disponibilidad_Diaria_Empleado CASCADE;
DROP TABLE IF EXISTS Cita CASCADE;
DROP TABLE IF EXISTS Dia_Salon_Estado CASCADE;
DROP TABLE IF EXISTS Disponibilidad CASCADE;
DROP TABLE IF EXISTS Tipo_Servicio CASCADE;
DROP TABLE IF EXISTS Empleado CASCADE;
DROP TABLE IF EXISTS Cliente CASCADE;

DROP TYPE IF EXISTS estado_empleado_enum;
DROP TYPE IF EXISTS estado_servicio_enum;
DROP TYPE IF EXISTS estado_dia_enum;
DROP TYPE IF EXISTS estado_cita_enum;

-- 2. DEFINICIÓN DE TIPOS ENUM (Actualizado con los nuevos estados de cita)

CREATE TYPE estado_empleado_enum AS ENUM ('ocupado', 'disponible', 'vacaciones');
CREATE TYPE estado_servicio_enum AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_dia_enum AS ENUM ('abierto', 'cerrado');
-- AQUÍ ESTÁ EL CAMBIO SOLICITADO:
CREATE TYPE estado_cita_enum AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');

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
        FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Cita (
    id_cita SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    id_empleado INTEGER NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    estado estado_cita_enum NOT NULL DEFAULT 'pendiente', 
    
    CONSTRAINT fk_Cita_Cliente FOREIGN KEY (id_cliente) REFERENCES Cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_Cita_Tipo_Servicio FOREIGN KEY (id_servicio) REFERENCES Tipo_Servicio (id_servicio) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_Cita_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleado (id_empleado) ON DELETE RESTRICT ON UPDATE CASCADE
);
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

-- 4. FUNCIONES Y TRIGGERS ACTUALIZADOS

-- Trigger BEFORE INSERT (Validaciones de horario y disponibilidad)
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
    
    SELECT COALESCE(estado_dia, 'cerrado'::estado_dia_enum), COALESCE(hora_apertura, '08:00:00'::TIME), COALESCE(hora_cierre, '17:00:00'::TIME)
    INTO salon_abierto, hora_apertura_salon, hora_cierre_salon
    FROM Dia_Salon_Estado WHERE fecha = NEW.fecha;

    IF salon_abierto = 'cerrado' THEN RAISE EXCEPTION 'El salón está CERRADO en esta fecha.'; END IF;
    IF NEW.hora < hora_apertura_salon OR NEW.hora >= hora_cierre_salon THEN RAISE EXCEPTION 'La cita debe ser entre % y %.', hora_apertura_salon, hora_cierre_salon; END IF;

    hora_fin_cita := NEW.hora + (duracion * INTERVAL '1 hour');
    IF hora_fin_cita > hora_cierre_salon THEN RAISE EXCEPTION 'La cita excede el horario de cierre.'; END IF;

    -- Solo validamos horas disponibles si la cita entra CONFIRMADA o COMPLETADA
    IF NEW.estado IN ('confirmada', 'completada') THEN
        SELECT COALESCE(horas_disponibles_restantes, 9.00) INTO horas_restantes
        FROM Disponibilidad_Diaria_Empleado WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;
        
        IF horas_restantes < duracion THEN RAISE EXCEPTION 'El empleado no tiene tiempo suficiente.'; END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_before_insert BEFORE INSERT ON Cita FOR EACH ROW EXECUTE FUNCTION tr_cita_before_insert_func();

-- Trigger AFTER INSERT (Descuento de horas si es confirmada)
CREATE OR REPLACE FUNCTION tr_cita_after_insert_func()
RETURNS TRIGGER AS $$
DECLARE
    duracion DECIMAL(6,2);
BEGIN
    INSERT INTO Dia_Salon_Estado (fecha) VALUES (NEW.fecha) ON CONFLICT (fecha) DO NOTHING;
    
    IF NEW.estado IN ('confirmada', 'completada') THEN
        SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;
        INSERT INTO Disponibilidad_Diaria_Empleado (id_empleado, fecha, horas_disponibles_restantes)
        VALUES (NEW.id_empleado, NEW.fecha, 9.00 - duracion)
        ON CONFLICT (id_empleado, fecha) 
        DO UPDATE SET horas_disponibles_restantes = Disponibilidad_Diaria_Empleado.horas_disponibles_restantes - duracion;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_after_insert AFTER INSERT ON Cita FOR EACH ROW EXECUTE FUNCTION tr_cita_after_insert_func();

-- Trigger AFTER UPDATE (Manejo de cambios de estado Pendiente <-> Confirmada <-> Cancelada)
CREATE OR REPLACE FUNCTION tr_cita_after_update_func()
RETURNS TRIGGER AS $$
DECLARE
    duracion DECIMAL(6,2);
BEGIN
    IF OLD.id_empleado = NEW.id_empleado AND OLD.fecha = NEW.fecha THEN
        SELECT duracion_horas INTO duracion FROM Tipo_Servicio WHERE id_servicio = NEW.id_servicio;

        -- Caso 1: La cita pasa a consumir tiempo (de Pendiente/Cancelada -> Confirmada/Completada)
        IF OLD.estado IN ('pendiente', 'cancelada') AND NEW.estado IN ('confirmada', 'completada') THEN
             UPDATE Disponibilidad_Diaria_Empleado
             SET horas_disponibles_restantes = horas_disponibles_restantes - duracion
             WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;
        
        -- Caso 2: La cita libera tiempo (de Confirmada -> Cancelada/Pendiente)
        -- NOTA: Si pasa a 'completada', NO libera tiempo, porque el servicio ya se dio.
        ELSIF OLD.estado = 'confirmada' AND NEW.estado IN ('cancelada', 'pendiente') THEN
             UPDATE Disponibilidad_Diaria_Empleado
             SET horas_disponibles_restantes = horas_disponibles_restantes + duracion
             WHERE id_empleado = NEW.id_empleado AND fecha = NEW.fecha;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cita_after_update AFTER UPDATE ON Cita FOR EACH ROW EXECUTE FUNCTION tr_cita_after_update_func();

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
('Laura', 'Vargas', 'admin', '5551000001', 'laura.vargas@salon.com', 'disponible', 'pass123'),
('Miguel', 'Rojas', 'trabajador', '5551000002', 'miguel.rojas@salon.com', 'disponible', 'pass123'),
('Sofía', 'Castro', 'trabajador', '5551000003', 'sofia.castro@salon.com', 'disponible', 'pass123'),
('Pablo', 'Mora', 'trabajador', '5551000004', 'pablo.mora@salon.com', 'disponible', 'pass123'),
('Diana', 'Fuentes', 'trabajador', '5551000005', 'diana.fuentes@salon.com', 'disponible', 'pass123'),
('Andrés', 'Guzmán', 'trabajador', '5551000006', 'andres.guzman@salon.com', 'disponible', 'pass123'),
('Fernanda', 'Lira', 'trabajador', '5551000007', 'fernanda.lira@salon.com', 'disponible', 'pass123'),
('Ricardo', 'Paz', 'trabajador', '5551000008', 'ricardo.paz@salon.com', 'disponible', 'pass123'),
('Valeria', 'Cruz', 'trabajador', '5551000009', 'valeria.cruz@salon.com', 'vacaciones', 'pass123'),
('Jorge', 'Nieto', 'trabajador', '5551000010', 'jorge.nieto@salon.com', 'disponible', 'pass123');

-- AQUÍ ESTÁ LA LISTA DE SERVICIOS SOLICITADA CON PRECIOS Y DURACIONES
INSERT INTO Tipo_Servicio (nombre_servicio, duracion_horas, precio, estado) VALUES
('Corte y Peinado', 1.50, 45.00, 'activo'),        -- ID 31
('Coloración y Mechas', 2.50, 95.00, 'activo'),    -- ID 32
('Manicure Spa', 1.00, 35.00, 'activo'),           -- ID 33
('Pedicure Spa', 1.00, 40.00, 'activo'),           -- ID 34
('Maquillaje Profesional', 1.00, 60.00, 'activo'), -- ID 35
('Tratamientos Capilares', 1.00, 55.00, 'activo'), -- ID 36
('Corte', 0.75, 25.00, 'activo'),                  -- ID 37
('Peinado', 0.75, 30.00, 'activo'),                -- ID 38
('Coloración de Cabello', 2.00, 70.00, 'activo'),  -- ID 39
('Mechas', 2.00, 85.00, 'activo'),                 -- ID 40
('Corte de Caballero', 0.50, 20.00, 'activo'),     -- ID 41
('Depilación de Cejas', 0.25, 15.00, 'activo');    -- ID 42

-- Mapeo de empleados a servicios (simplificado para que funcionen las citas)
INSERT INTO Empleado_Servicio (id_empleado, id_servicio) VALUES
-- Laura hace cortes y color
(21, 31), (21, 32), (21, 37), (21, 39), (21, 40),
-- Miguel hace manicure/pedicure
(22, 33), (22, 34),
-- Sofia hace maquillaje y peinados
(23, 35), (23, 38), (23, 31), (23, 42),
-- Pablo hace tratamientos
(24, 36), (24, 41),
-- Otros mapeos generales
(26, 37), (26, 39), (26, 40),
(27, 32), (27, 39),
(28, 31), (28, 37),
(29, 33), (29, 34), (29, 42),
(30, 35), (30, 38);

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
(30, '2025-11-03', '09:00:00', '17:00:00');

INSERT INTO Dia_Salon_Estado (fecha) VALUES ('2025-11-01'), ('2025-11-02'), ('2025-11-03');

-- Citas de ejemplo (Aseguradas para que coincidan con los nuevos servicios)
INSERT INTO Cita (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES
(11, 31, 21, '2025-11-01', '09:00:00', 'confirmada'), -- Corte y peinado
(12, 33, 22, '2025-11-01', '10:00:00', 'pendiente'),  -- Manicure (Pendiente)
(13, 35, 23, '2025-11-01', '08:00:00', 'confirmada'), -- Maquillaje
(14, 36, 24, '2025-11-01', '11:00:00', 'confirmada'), -- Tratamiento
(15, 33, 22, '2025-11-03', '12:00:00', 'cancelada'),  -- Manicure (Cancelada)
(16, 37, 28, '2025-11-03', '09:00:00', 'completada'), -- Corte (Completada)
(17, 31, 21, '2025-11-01', '10:30:00', 'confirmada'), -- Corte y peinado
(18, 35, 30, '2025-11-02', '09:00:00', 'confirmada'), -- Maquillaje
(19, 39, 27, '2025-11-02', '12:00:00', 'confirmada'), -- Color
(20, 40, 26, '2025-11-02', '10:00:00', 'confirmada'); -- Mechas