-- XenialRest - Migración: Menús en ticket (árbol, precio por menú, suplementos)
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-menus-ticket.sql

-- Precio del menú en tipos_menu
ALTER TABLE tipos_menu ADD COLUMN IF NOT EXISTS precio DECIMAL(12,2) NOT NULL DEFAULT 12.00;

-- Suplemento adicional cuando el plato va dentro de un menú
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_suplemento_menu DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Línea padre (para agrupar platos bajo un menú)
ALTER TABLE ticket_lineas ADD COLUMN IF NOT EXISTS linea_padre_id INT REFERENCES ticket_lineas(id) ON DELETE CASCADE;
ALTER TABLE ticket_lineas ADD COLUMN IF NOT EXISTS tipo_menu_id INT REFERENCES tipos_menu(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ticket_lineas_padre ON ticket_lineas(linea_padre_id);

-- Precios por defecto en tipos_menu
UPDATE tipos_menu SET precio = 12.00 WHERE precio = 0 OR precio IS NULL;
UPDATE tipos_menu SET precio = 15.00 WHERE codigo = 'FIN_SEMANA';
UPDATE tipos_menu SET precio = 18.00 WHERE codigo = 'ESPECIAL';
UPDATE tipos_menu SET precio = 14.00 WHERE codigo = 'NOCHE';
