-- XenialRest - Migración: Platos por TipoMenu + Apartado
-- El mismo apartado en distintos tipos de menú puede tener platos diferentes
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-tipo-menu-apartado-platos.sql

-- Tabla: platos asignados a cada combinación tipo_menu + apartado
CREATE TABLE IF NOT EXISTS tipo_menu_apartado_platos (
    tipo_menu_id INT NOT NULL REFERENCES tipos_menu(id) ON DELETE CASCADE,
    apartado_id INT NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
    plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
    orden INT DEFAULT 0,
    PRIMARY KEY (tipo_menu_id, apartado_id, plato_id)
);

CREATE INDEX IF NOT EXISTS idx_tmap_tipo_apartado ON tipo_menu_apartado_platos(tipo_menu_id, apartado_id);
CREATE INDEX IF NOT EXISTS idx_tmap_plato ON tipo_menu_apartado_platos(plato_id);

-- Migrar datos: si existía apartado_platos, copiar a tipo_menu_apartado_platos para cada tipo que use ese apartado
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='apartado_platos') THEN
        INSERT INTO tipo_menu_apartado_platos (tipo_menu_id, apartado_id, plato_id, orden)
        SELECT tma.tipo_menu_id, ap.apartado_id, ap.plato_id, ap.orden
        FROM apartado_platos ap
        JOIN tipo_menu_apartados tma ON tma.apartado_id = ap.apartado_id
        ON CONFLICT (tipo_menu_id, apartado_id, plato_id) DO NOTHING;
        DROP TABLE apartado_platos;
    END IF;
END $$;
