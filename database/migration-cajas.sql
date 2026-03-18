-- XenialRest - Migración: Cajas y excepciones de precio
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-cajas.sql
-- Cajas (Caja 1, Caja 2...), asignación usuario-caja, precios por caja/plato

-- ============================================
-- TABLA CAJAS
-- ============================================
CREATE TABLE IF NOT EXISTS cajas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USUARIO-CAJAS (un usuario puede acceder a varias cajas)
-- ============================================
CREATE TABLE IF NOT EXISTS usuario_cajas (
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    caja_id INT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, caja_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_cajas_usuario ON usuario_cajas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_cajas_caja ON usuario_cajas(caja_id);

-- ============================================
-- EXCEPCIONES PRECIO: caja + plato → precio distinto
-- ============================================
CREATE TABLE IF NOT EXISTS caja_plato_precio (
    caja_id INT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
    plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
    precio_base DECIMAL(12,2) NOT NULL,
    precio_suplemento_menu DECIMAL(12,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (caja_id, plato_id)
);

CREATE INDEX IF NOT EXISTS idx_caja_plato_precio_caja ON caja_plato_precio(caja_id);
CREATE INDEX IF NOT EXISTS idx_caja_plato_precio_plato ON caja_plato_precio(plato_id);

-- ============================================
-- TICKETS: añadir caja_id (opcional, para auditoría)
-- ============================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS caja_id INT REFERENCES cajas(id);

-- ============================================
-- DATOS INICIALES: Caja 1 por defecto
-- ============================================
INSERT INTO cajas (codigo, nombre, orden) VALUES ('CAJA1', 'Caja 1', 0)
ON CONFLICT (codigo) DO NOTHING;
