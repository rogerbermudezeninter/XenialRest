-- XenialRest - Datos de demostración para el módulo caja
-- Ejecutar después de schema.sql: psql -U xenial -d xenialrest -f database/seed-demo.sql

-- Familias (incluye Menús y cursos)
INSERT INTO familias (codigo, nombre, orden, curso) VALUES
    ('MENUS', 'Menús', 0, 'menu'),
    ('ENTRANTES', 'Entrantes', 1, 'entrante'),
    ('PRIMEROS', 'Primeros platos', 2, 'primero'),
    ('SEGUNDOS', 'Segundos platos', 3, 'segundo'),
    ('POSTRES', 'Postres', 4, 'tercero'),
    ('BEBIDAS', 'Bebidas', 5, 'cuarto'),
    ('TERCEROS', 'Terceros', 6, 'tercero'),
    ('CUARTOS', 'Cuartos', 7, 'cuarto')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, curso = COALESCE(EXCLUDED.curso, familias.curso);

-- Productos (usar familia_id de las familias insertadas)
INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'ENT-1', 'Ensalada mixta', 6.50, 1, 1 FROM familias f WHERE f.codigo = 'ENTRANTES' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'ENT-2', 'Bruschetta', 5.00, 1, 2 FROM familias f WHERE f.codigo = 'ENTRANTES' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'PRI-1', 'Paella valenciana', 14.00, 1, 1 FROM familias f WHERE f.codigo = 'PRIMEROS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'PRI-2', 'Sopa de marisco', 8.50, 1, 2 FROM familias f WHERE f.codigo = 'PRIMEROS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'SEG-1', 'Lomo al stroganoff', 16.00, 1, 1 FROM familias f WHERE f.codigo = 'SEGUNDOS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'SEG-2', 'Pollo al horno', 12.00, 1, 2 FROM familias f WHERE f.codigo = 'SEGUNDOS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'POS-1', 'Tarta de queso', 5.50, 1, 1 FROM familias f WHERE f.codigo = 'POSTRES' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'BEB-1', 'Agua mineral', 2.00, 1, 1 FROM familias f WHERE f.codigo = 'BEBIDAS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'BEB-2', 'Coca-Cola', 2.50, 1, 2 FROM familias f WHERE f.codigo = 'BEBIDAS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO productos (familia_id, codigo, nombre, precio_base, iva_id, orden)
SELECT f.id, 'BEB-3', 'Cerveza', 3.00, 1, 3 FROM familias f WHERE f.codigo = 'BEBIDAS' LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

-- Salones (10 salones para 300 mesas)
INSERT INTO salones (codigo, nombre, orden) VALUES
    ('SALON1', 'Salón 1', 1),
    ('SALON2', 'Salón 2', 2),
    ('SALON3', 'Salón 3', 3),
    ('SALON4', 'Salón 4', 4),
    ('SALON5', 'Salón 5', 5),
    ('SALON6', 'Salón 6', 6),
    ('SALON7', 'Salón 7', 7),
    ('SALON8', 'Salón 8', 8),
    ('SALON9', 'Salón 9', 9),
    ('SALON10', 'Salón 10', 10)
ON CONFLICT (codigo) DO NOTHING;

-- 300 Mesas (30 por salón, numeradas 1-300)
DO $$
DECLARE
    s RECORD;
    i INT;
    n INT := 1;
BEGIN
    FOR s IN SELECT id FROM salones ORDER BY orden LOOP
        FOR i IN 1..30 LOOP
            INSERT INTO mesas (salon_id, codigo, nombre, capacidad)
            VALUES (s.id, n::TEXT, 'Mesa ' || n, 4)
            ON CONFLICT (salon_id, codigo) DO NOTHING;
            n := n + 1;
        END LOOP;
    END LOOP;
END $$;

-- Usuarios (camareros + admin)
INSERT INTO usuarios (codigo, nombre, rol) VALUES 
  ('CAM1', 'Camarero 1', 'camarero'),
  ('CAM2', 'Camarero 2', 'camarero'),
  ('CAM3', 'Camarero 3', 'camarero'),
  ('ADM1', 'Administrador', 'admin')
ON CONFLICT (codigo) DO NOTHING;

-- PINs por usuario (1-3=1234, 4=admin 1234 - cambiar en producción)
INSERT INTO config (clave, valor) VALUES 
  ('pins', '{"1":"1234","2":"1234","3":"1234","4":"1234"}'::jsonb)
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
