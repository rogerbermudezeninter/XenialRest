-- XenialRest - Migración: Tabla platos (para menús; eventualmente escandallo de productos)
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-platos.sql
-- Requiere: schema + migration-empresas-zonas, migration-idiomas-proveedores-clientes,
--           migration-menus, migration-menus-ticket, migration-productos-*

-- ============================================
-- TABLA PLATOS (misma estructura que productos)
-- ============================================
CREATE TABLE IF NOT EXISTS platos (
    id SERIAL PRIMARY KEY,
    familia_id INT REFERENCES familias(id),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_id INT REFERENCES impuestos(id),
    ruta_imagen VARCHAR(255),
    hash_imagen VARCHAR(64),
    activo BOOLEAN DEFAULT true,
    orden INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    alergenos TEXT,
    apto_celiaco BOOLEAN NOT NULL DEFAULT false,
    vegetariano BOOLEAN NOT NULL DEFAULT false,
    vegano BOOLEAN NOT NULL DEFAULT false,
    precio_suplemento_menu DECIMAL(12,2) NOT NULL DEFAULT 0,
    zona_preparacion_id INT REFERENCES zonas_preparacion(id),
    empresa_id INT REFERENCES empresas(id),
    proveedor_principal_id INT REFERENCES proveedores(id)
);

CREATE INDEX IF NOT EXISTS idx_platos_familia ON platos(familia_id);
CREATE INDEX IF NOT EXISTS idx_platos_activo ON platos(activo);

-- ============================================
-- TICKET_LINEAS - añadir plato_id (para líneas de menú)
-- ============================================
ALTER TABLE ticket_lineas ADD COLUMN IF NOT EXISTS plato_id INT REFERENCES platos(id);
CREATE INDEX IF NOT EXISTS idx_ticket_lineas_plato ON ticket_lineas(plato_id);

-- ============================================
-- COPIAR productos → platos (familias con curso de menú)
-- ============================================
INSERT INTO platos (
    familia_id, codigo, nombre, descripcion, precio_base, iva_id,
    ruta_imagen, activo, orden, alergenos, apto_celiaco, vegetariano, vegano,
    precio_suplemento_menu, zona_preparacion_id, empresa_id, proveedor_principal_id
)
SELECT
    p.familia_id, p.codigo, p.nombre, p.descripcion, COALESCE(p.precio_base, 0), p.iva_id,
    p.ruta_imagen, COALESCE(p.activo, true), COALESCE(p.orden, 0),
    p.alergenos,
    COALESCE(p.apto_celiaco, false),
    COALESCE(p.vegetariano, false),
    COALESCE(p.vegano, false),
    COALESCE(p.precio_suplemento_menu, 0),
    p.zona_preparacion_id,
    p.empresa_id,
    p.proveedor_principal_id
FROM productos p
INNER JOIN familias f ON f.id = p.familia_id
WHERE f.curso IN ('entrante', 'primero', 'segundo', 'tercero', 'cuarto')
  AND p.activo = true
ON CONFLICT (codigo) DO NOTHING;
