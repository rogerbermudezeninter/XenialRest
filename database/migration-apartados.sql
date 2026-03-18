-- XenialRest - Migración: Apartados por tipo de menú
-- Cada tipo de menú tiene apartados (secciones) con orden, y cada apartado tiene platos asignados
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-apartados.sql

-- Apartados: secciones configurables por tipo de menú (ej. Entrantes, Primeros, Segundos)
CREATE TABLE IF NOT EXISTS apartados (
    id SERIAL PRIMARY KEY,
    tipo_menu_id INT NOT NULL REFERENCES tipos_menu(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    platos_por_persona DECIMAL(5,2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apartados_tipo ON apartados(tipo_menu_id);

-- Platos asignados a cada apartado
CREATE TABLE IF NOT EXISTS apartado_platos (
    apartado_id INT NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
    plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
    orden INT DEFAULT 0,
    PRIMARY KEY (apartado_id, plato_id)
);

CREATE INDEX IF NOT EXISTS idx_apartado_platos_apartado ON apartado_platos(apartado_id);
CREATE INDEX IF NOT EXISTS idx_apartado_platos_plato ON apartado_platos(plato_id);
