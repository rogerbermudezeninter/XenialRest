-- XenialRest - Migración: Menús configurables
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-menus.sql

-- Tipos de menú (Menu diario, Menu fin de semana, etc.)
CREATE TABLE IF NOT EXISTS tipos_menu (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración: cuántos platos por curso en cada tipo de menú
-- curso: entrante, primero, segundo, tercero, cuarto
-- platos_por_persona: ej. 2 primeros = 2 platos de primero por menú
CREATE TABLE IF NOT EXISTS configuracion_menu (
    id SERIAL PRIMARY KEY,
    tipo_menu_id INT NOT NULL REFERENCES tipos_menu(id) ON DELETE CASCADE,
    curso VARCHAR(20) NOT NULL,
    platos_por_persona DECIMAL(5,2) NOT NULL DEFAULT 1,
    UNIQUE(tipo_menu_id, curso)
);

-- Añadir curso a familias (entrante, primero, segundo, tercero, cuarto)
ALTER TABLE familias ADD COLUMN IF NOT EXISTS curso VARCHAR(20);

-- Familia especial Menús (contenedor de tipos de menú)
INSERT INTO familias (codigo, nombre, orden, curso) VALUES 
    ('MENUS', 'Menús', 0, 'menu')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, curso = EXCLUDED.curso;

-- Tipos de menú por defecto
INSERT INTO tipos_menu (codigo, nombre, orden) VALUES 
    ('DIARIO', 'Menu diario', 1),
    ('FIN_SEMANA', 'Menu fin de semana', 2),
    ('ESPECIAL', 'Menu especial', 3),
    ('NOCHE', 'Menu noche', 4)
ON CONFLICT (codigo) DO NOTHING;

-- Configuración por defecto: 1 plato de cada curso por menú
INSERT INTO configuracion_menu (tipo_menu_id, curso, platos_por_persona)
SELECT t.id, c.curso, 1
FROM tipos_menu t
CROSS JOIN (VALUES ('entrante'), ('primero'), ('segundo'), ('tercero'), ('cuarto')) AS c(curso)
ON CONFLICT (tipo_menu_id, curso) DO UPDATE SET platos_por_persona = EXCLUDED.platos_por_persona;

-- Familias para terceros y cuartos (si no existen)
INSERT INTO familias (codigo, nombre, orden, curso) VALUES 
    ('TERCEROS', 'Terceros', 35, 'tercero'),
    ('CUARTOS', 'Cuartos', 36, 'cuarto')
ON CONFLICT (codigo) DO UPDATE SET curso = EXCLUDED.curso;

-- Asignar curso a familias existentes
UPDATE familias SET curso = 'entrante' WHERE codigo IN ('ENTRANTES');
UPDATE familias SET curso = 'primero' WHERE codigo IN ('PRIMEROS');
UPDATE familias SET curso = 'segundo' WHERE codigo IN ('SEGUNDOS');
UPDATE familias SET curso = 'tercero' WHERE codigo IN ('POSTRES', 'TERCEROS');
UPDATE familias SET curso = 'cuarto' WHERE codigo IN ('BEBIDAS', 'CUARTOS');
