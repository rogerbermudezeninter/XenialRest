-- XenialRest - Migración: Usuarios idioma_id, Familias de menús (separadas de familias carta)
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-familias-menu-usuarios.sql
-- Requiere: migration-idiomas-proveedores-clientes, migration-menus

-- ============================================
-- USUARIOS - idioma por defecto
-- ============================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS idioma_id INT REFERENCES idiomas(id);
UPDATE usuarios SET idioma_id = (SELECT id FROM idiomas WHERE codigo = 'es' LIMIT 1) WHERE idioma_id IS NULL;

-- ============================================
-- FAMILIAS_MENU - familias para menús (distintas de familias carta)
-- ============================================
CREATE TABLE IF NOT EXISTS familias_menu (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un plato puede estar en varias familias de menú
CREATE TABLE IF NOT EXISTS plato_familias_menu (
    plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
    familia_menu_id INT NOT NULL REFERENCES familias_menu(id) ON DELETE CASCADE,
    PRIMARY KEY (plato_id, familia_menu_id)
);

CREATE INDEX IF NOT EXISTS idx_plato_familias_menu_plato ON plato_familias_menu(plato_id);
CREATE INDEX IF NOT EXISTS idx_plato_familias_menu_familia ON plato_familias_menu(familia_menu_id);

-- Cada tipo de menú usa una o más familias de menú (qué platos puede incluir)
CREATE TABLE IF NOT EXISTS tipo_menu_familias_menu (
    tipo_menu_id INT NOT NULL REFERENCES tipos_menu(id) ON DELETE CASCADE,
    familia_menu_id INT NOT NULL REFERENCES familias_menu(id) ON DELETE CASCADE,
    PRIMARY KEY (tipo_menu_id, familia_menu_id)
);

-- Familia menú por defecto (todos los platos si no se asigna)
INSERT INTO familias_menu (codigo, nombre, orden) VALUES ('ESTANDAR', 'Estándar', 1)
ON CONFLICT (codigo) DO NOTHING;
