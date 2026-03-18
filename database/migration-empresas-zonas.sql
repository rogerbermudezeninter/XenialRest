-- XenialRest - Migración: Empresas, zonas preparación, precios por empresa
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-empresas-zonas.sql

-- ============================================
-- EMPRESAS
-- ============================================
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    cif_nif VARCHAR(20),
    direccion TEXT,
    codigo_postal VARCHAR(10),
    localidad VARCHAR(100),
    provincia VARCHAR(100),
    telefono VARCHAR(30),
    email VARCHAR(100),
    ruta_logo VARCHAR(255),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Empresa por defecto
INSERT INTO empresas (codigo, nombre) VALUES ('DEFAULT', 'Empresa principal')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- ZONAS DE PREPARACIÓN
-- ============================================
CREATE TABLE IF NOT EXISTS zonas_preparacion (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    impresora_id INT REFERENCES impresoras(id),
    ip_host VARCHAR(100),
    puerto INT DEFAULT 9100,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_zonas_preparacion_empresa ON zonas_preparacion(empresa_id);

-- ============================================
-- IMPRESORAS - añadir empresa_id
-- ============================================
ALTER TABLE impresoras ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);
UPDATE impresoras SET empresa_id = (SELECT id FROM empresas WHERE codigo = 'DEFAULT' LIMIT 1) WHERE empresa_id IS NULL;

-- ============================================
-- PRODUCTOS - zona preparación e imagen
-- ============================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS zona_preparacion_id INT REFERENCES zonas_preparacion(id);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);
UPDATE productos SET empresa_id = (SELECT id FROM empresas WHERE codigo = 'DEFAULT' LIMIT 1) WHERE empresa_id IS NULL;

-- ============================================
-- PRECIOS POR EMPRESA (producto único, precios por empresa)
-- ============================================
CREATE TABLE IF NOT EXISTS producto_precios (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    precio DECIMAL(12,2) NOT NULL DEFAULT 0,
    precio_suplemento_menu DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_precios_empresa ON producto_precios(empresa_id);

-- ============================================
-- OTRAS TABLAS - empresa_id
-- ============================================
ALTER TABLE familias ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);
ALTER TABLE salones ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);
ALTER TABLE tipos_menu ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);

UPDATE familias SET empresa_id = (SELECT id FROM empresas WHERE codigo = 'DEFAULT' LIMIT 1) WHERE empresa_id IS NULL;
UPDATE salones SET empresa_id = (SELECT id FROM empresas WHERE codigo = 'DEFAULT' LIMIT 1) WHERE empresa_id IS NULL;
UPDATE tipos_menu SET empresa_id = (SELECT id FROM empresas WHERE codigo = 'DEFAULT' LIMIT 1) WHERE empresa_id IS NULL;
UPDATE usuarios SET empresa_id = (SELECT id FROM empresas WHERE codigo = 'DEFAULT' LIMIT 1) WHERE empresa_id IS NULL;

-- Mesas heredan de salones (salones tienen empresa_id)
-- Configuracion_menu ya tiene tipo_menu_id
