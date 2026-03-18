-- XenialRest - Migración: Idiomas, proveedores, clientes, comentarios cocina
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-idiomas-proveedores-clientes.sql

-- ============================================
-- IDIOMAS
-- ============================================
CREATE TABLE IF NOT EXISTS idiomas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(5) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO idiomas (codigo, nombre) VALUES ('es', 'Español'), ('en', 'English'), ('ca', 'Català')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- PROVEEDORES
-- ============================================
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    contacto VARCHAR(100),
    telefono VARCHAR(30),
    email VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTES
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    nif_cif VARCHAR(20),
    direccion TEXT,
    telefono VARCHAR(30),
    email VARCHAR(100),
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTOS - proveedor principal
-- ============================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS proveedor_principal_id INT REFERENCES proveedores(id);
-- ruta_imagen ya existe en productos

-- ============================================
-- PRODUCTO TRADUCCIONES (idiomas por producto)
-- ============================================
CREATE TABLE IF NOT EXISTS producto_traducciones (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    idioma_id INT NOT NULL REFERENCES idiomas(id) ON DELETE CASCADE,
    nombre VARCHAR(150),
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, idioma_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_traducciones_producto ON producto_traducciones(producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_traducciones_idioma ON producto_traducciones(idioma_id);

-- ============================================
-- TICKET_LINEAS - comentarios para cocina
-- ============================================
ALTER TABLE ticket_lineas ADD COLUMN IF NOT EXISTS comentarios_cocina TEXT;
