-- XenialRest - Migración: Flag mostrar en pantalla principal
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-familias-pantalla.sql

-- Familias con curso (tercero, cuarto, etc.) solo en selector de menú por defecto
ALTER TABLE familias ADD COLUMN IF NOT EXISTS mostrar_pantalla_principal BOOLEAN DEFAULT true;

-- Terceros y Cuartos (postres como curso) solo en menú; Bebidas (cuarto) sí en principal
UPDATE familias SET mostrar_pantalla_principal = false
WHERE curso = 'tercero';
