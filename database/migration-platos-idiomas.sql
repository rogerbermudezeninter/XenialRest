-- XenialRest - Migración: Platos nombre_corto, comentarios, platos_idiomas, empresas idioma_base
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-platos-idiomas.sql
-- Requiere: schema, migration-idiomas-proveedores-clientes, migration-platos

-- ============================================
-- IDIOMAS - añadir ES, EN, IT, PT, DE, CA, EU, GL
-- ============================================
INSERT INTO idiomas (codigo, nombre) VALUES
  ('es', 'Español'),
  ('en', 'English'),
  ('it', 'Italiano'),
  ('pt', 'Português'),
  ('de', 'Deutsch'),
  ('ca', 'Català'),
  ('eu', 'Euskara'),
  ('gl', 'Galego')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- EMPRESAS - idioma_base_id
-- ============================================
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS idioma_base_id INT REFERENCES idiomas(id);
-- Por defecto: español (codigo 'es')
UPDATE empresas SET idioma_base_id = (SELECT id FROM idiomas WHERE codigo = 'es' LIMIT 1)
WHERE idioma_base_id IS NULL;

-- ============================================
-- PLATOS - nombre_corto (25 chars), comentarios
-- ============================================
ALTER TABLE platos ADD COLUMN IF NOT EXISTS nombre_corto VARCHAR(25);
ALTER TABLE platos ADD COLUMN IF NOT EXISTS comentarios TEXT;
-- Inicializar nombre_corto desde nombre (truncar a 25)
UPDATE platos SET nombre_corto = LEFT(nombre, 25) WHERE nombre_corto IS NULL OR nombre_corto = '';

-- ============================================
-- PLATOS_IDIOMAS - traducciones por idioma
-- ============================================
CREATE TABLE IF NOT EXISTS platos_idiomas (
    id SERIAL PRIMARY KEY,
    plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
    idioma_id INT NOT NULL REFERENCES idiomas(id) ON DELETE CASCADE,
    nombre VARCHAR(150),
    nombre_corto VARCHAR(25),
    comentarios TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plato_id, idioma_id)
);

CREATE INDEX IF NOT EXISTS idx_platos_idiomas_plato ON platos_idiomas(plato_id);
CREATE INDEX IF NOT EXISTS idx_platos_idiomas_idioma ON platos_idiomas(idioma_id);
