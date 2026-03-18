-- XenialRest - Migración: Apartados como catálogo maestro
-- Los apartados son entidades reutilizables. Cada tipo de menú asigna qué apartados usa y en qué orden.
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-apartados-maestro.sql

-- Si ya está migrado (apartados sin tipo_menu_id), no hacer nada
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apartados' AND column_name='tipo_menu_id') THEN

        -- 1. Crear tabla apartados maestro (sin tipo_menu_id)
        CREATE TABLE IF NOT EXISTS apartados_maestro (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(30) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            orden INT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 2. Tabla de asignación: qué apartados usa cada tipo de menú
        CREATE TABLE IF NOT EXISTS tipo_menu_apartados (
            tipo_menu_id INT NOT NULL REFERENCES tipos_menu(id) ON DELETE CASCADE,
            apartado_id INT NOT NULL REFERENCES apartados_maestro(id) ON DELETE CASCADE,
            orden INT DEFAULT 0,
            platos_por_persona DECIMAL(5,2) NOT NULL DEFAULT 1,
            PRIMARY KEY (tipo_menu_id, apartado_id)
        );
        CREATE INDEX IF NOT EXISTS idx_tipo_menu_apartados_tipo ON tipo_menu_apartados(tipo_menu_id);
        CREATE INDEX IF NOT EXISTS idx_tipo_menu_apartados_apartado ON tipo_menu_apartados(apartado_id);

        -- 3. Migrar apartados únicos al maestro
        INSERT INTO apartados_maestro (codigo, nombre, orden)
        SELECT DISTINCT ON (a.nombre)
            UPPER(REGEXP_REPLACE(TRIM(a.nombre), '\s+', '_', 'g')) || '_' || a.id::text,
            a.nombre,
            a.orden
        FROM apartados a
        ORDER BY a.nombre, a.id;

        -- 4. Enlace tipo_menu -> apartados
        INSERT INTO tipo_menu_apartados (tipo_menu_id, apartado_id, orden, platos_por_persona)
        SELECT a.tipo_menu_id, am.id, a.orden, COALESCE(a.platos_por_persona, 1)
        FROM apartados a
        JOIN apartados_maestro am ON am.nombre = a.nombre
        ON CONFLICT (tipo_menu_id, apartado_id) DO UPDATE SET orden = EXCLUDED.orden, platos_por_persona = EXCLUDED.platos_por_persona;

        -- 5. Nueva apartado_platos referenciando maestro
        CREATE TABLE apartado_platos_new (
            apartado_id INT NOT NULL REFERENCES apartados_maestro(id) ON DELETE CASCADE,
            plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
            orden INT DEFAULT 0,
            PRIMARY KEY (apartado_id, plato_id)
        );
        INSERT INTO apartado_platos_new (apartado_id, plato_id, orden)
        SELECT am.id, ap.plato_id, ap.orden
        FROM apartado_platos ap
        JOIN apartados a ON a.id = ap.apartado_id
        JOIN apartados_maestro am ON am.nombre = a.nombre
        ON CONFLICT (apartado_id, plato_id) DO NOTHING;

        DROP TABLE apartado_platos;
        ALTER TABLE apartado_platos_new RENAME TO apartado_platos;
        CREATE INDEX IF NOT EXISTS idx_apartado_platos_apartado ON apartado_platos(apartado_id);
        CREATE INDEX IF NOT EXISTS idx_apartado_platos_plato ON apartado_platos(plato_id);

        DROP TABLE apartados;
        ALTER TABLE apartados_maestro RENAME TO apartados;
    END IF;
END $$;

-- Si no existía apartados (instalación nueva), crear estructura desde cero
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='apartados') THEN
        CREATE TABLE apartados (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(30) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            orden INT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE tipo_menu_apartados (
            tipo_menu_id INT NOT NULL REFERENCES tipos_menu(id) ON DELETE CASCADE,
            apartado_id INT NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
            orden INT DEFAULT 0,
            platos_por_persona DECIMAL(5,2) NOT NULL DEFAULT 1,
            PRIMARY KEY (tipo_menu_id, apartado_id)
        );
        CREATE INDEX idx_tipo_menu_apartados_tipo ON tipo_menu_apartados(tipo_menu_id);
        CREATE INDEX idx_tipo_menu_apartados_apartado ON tipo_menu_apartados(apartado_id);

        CREATE TABLE apartado_platos (
            apartado_id INT NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
            plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
            orden INT DEFAULT 0,
            PRIMARY KEY (apartado_id, plato_id)
        );
        CREATE INDEX idx_apartado_platos_apartado ON apartado_platos(apartado_id);
        CREATE INDEX idx_apartado_platos_plato ON apartado_platos(plato_id);
    END IF;
END $$;
