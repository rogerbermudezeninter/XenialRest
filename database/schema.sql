-- XenialRest - Esquema PostgreSQL
-- TPV/Restaurante: mesas, pedidos, cocina, cobros
-- ================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLAS MAESTRAS
-- ============================================

-- Familias de productos (entrantes, primeros, bebidas, menús...)
CREATE TABLE familias (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    curso VARCHAR(20),  -- entrante, primero, segundo, tercero, cuarto, menu
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    familia_id INT REFERENCES familias(id),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_id INT,  -- FK a impuestos
    ruta_imagen VARCHAR(255),
    hash_imagen VARCHAR(64),
    activo BOOLEAN DEFAULT true,
    orden INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Impuestos
CREATE TABLE impuestos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    porcentaje DECIMAL(5,2) NOT NULL,
    activo BOOLEAN DEFAULT true
);

ALTER TABLE productos ADD CONSTRAINT fk_productos_iva 
    FOREIGN KEY (iva_id) REFERENCES impuestos(id);

-- Salones
CREATE TABLE salones (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mesas
CREATE TABLE mesas (
    id SERIAL PRIMARY KEY,
    salon_id INT REFERENCES salones(id),
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    capacidad INT DEFAULT 4,
    pos_x INT DEFAULT 0,
    pos_y INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    UNIQUE(salon_id, codigo)
);

-- Usuarios / Camareros
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255),
    rol VARCHAR(30) DEFAULT 'camarero',  -- camarero, caja, admin, cocina
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos (opcional, para control fino)
CREATE TABLE permisos (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    permiso VARCHAR(50) NOT NULL,
    concedido BOOLEAN DEFAULT true
);

-- Impresoras (cocina, barra, caja...)
CREATE TABLE impresoras (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) DEFAULT 'cocina',  -- cocina, barra, caja, ticket
    ip_host VARCHAR(100),
    puerto INT DEFAULT 9100,
    familia_ids INT[],  -- familias que imprime (NULL = todas)
    activo BOOLEAN DEFAULT true
);

-- Formas de pago
CREATE TABLE formas_pago (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    requiere_importe BOOLEAN DEFAULT true,
    activo BOOLEAN DEFAULT true
);

-- ============================================
-- TABLAS OPERATIVAS
-- ============================================

-- Tickets (pedidos / comandas)
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    mesa_id INT REFERENCES mesas(id),
    numero_ticket VARCHAR(20) UNIQUE,
    estado VARCHAR(30) NOT NULL DEFAULT 'abierto',  
    -- abierto, enviado_cocina, parcialmente_cobrado, cobrado, anulado
    camarero_id INT REFERENCES usuarios(id),
    comensales INT DEFAULT 1,
    total DECIMAL(12,2) DEFAULT 0,
    total_iva DECIMAL(12,2) DEFAULT 0,
    -- Control de edición concurrente
    editing_device_id VARCHAR(50),
    editing_user_id INT REFERENCES usuarios(id),
    editing_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cerrado_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_mesa ON tickets(mesa_id);
CREATE INDEX idx_tickets_estado ON tickets(estado);
CREATE INDEX idx_tickets_created ON tickets(created_at);

-- Líneas del ticket
CREATE TABLE ticket_lineas (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    descripcion VARCHAR(200) NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(12,2) NOT NULL,
    importe DECIMAL(12,2) NOT NULL,
    iva_porcentaje DECIMAL(5,2) DEFAULT 0,
    estado VARCHAR(30) DEFAULT 'pendiente',  
    -- pendiente, enviado_cocina, en_preparacion, servido, anulado
    notas TEXT,
    orden INT DEFAULT 0,
    impresora_destino VARCHAR(50),
    impreso_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_lineas_ticket ON ticket_lineas(ticket_id);
CREATE INDEX idx_ticket_lineas_estado ON ticket_lineas(estado);

-- Estado actual de mesas (vista materializada o tabla de estado)
CREATE TABLE mesas_estado (
    mesa_id INT PRIMARY KEY REFERENCES mesas(id),
    ticket_id INT REFERENCES tickets(id),
    estado VARCHAR(30) NOT NULL DEFAULT 'libre',  
    -- libre, ocupada, en_edicion, cobrada
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos / historial de mesa (auditoría ligera)
CREATE TABLE movimientos_mesa (
    id SERIAL PRIMARY KEY,
    mesa_id INT REFERENCES mesas(id),
    ticket_id INT REFERENCES tickets(id),
    tipo VARCHAR(30) NOT NULL,  -- abierta, cerrada, transferida, anulada
    usuario_id INT REFERENCES usuarios(id),
    detalles JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets(id),
    forma_pago_id INT REFERENCES formas_pago(id),
    importe DECIMAL(12,2) NOT NULL,
    usuario_id INT REFERENCES usuarios(id),
    referencia VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pagos_ticket ON pagos(ticket_id);

-- Cola de impresión (por si la impresora está offline)
CREATE TABLE impresiones_pendientes (
    id SERIAL PRIMARY KEY,
    ticket_linea_id INT REFERENCES ticket_lineas(id),
    impresora_id INT REFERENCES impresoras(id),
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, enviado, error
    intentos INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auditoría de eventos
CREATE TABLE auditoria_eventos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    entidad VARCHAR(50),
    entidad_id INT,
    usuario_id INT REFERENCES usuarios(id),
    dispositivo_id VARCHAR(50),
    detalles JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auditoria_tipo ON auditoria_eventos(tipo);
CREATE INDEX idx_auditoria_created ON auditoria_eventos(created_at);

-- ============================================
-- CONFIGURACIÓN (cache desde JSON)
-- ============================================
CREATE TABLE config (
    clave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DATOS INICIALES
-- ============================================
INSERT INTO impuestos (codigo, nombre, porcentaje) VALUES 
    ('IVA10', 'IVA 10%', 10),
    ('IVA21', 'IVA 21%', 21);

INSERT INTO formas_pago (codigo, nombre, requiere_importe) VALUES 
    ('EFECTIVO', 'Efectivo', true),
    ('TARJETA', 'Tarjeta', true),
    ('BIZUM', 'Bizum', true);
