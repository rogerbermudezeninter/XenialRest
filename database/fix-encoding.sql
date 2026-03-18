-- Corregir caracteres con encoding incorrecto (Menú, etc.)
-- Ejecutar: psql -U xenial -d xenialrest -f database/fix-encoding.sql

UPDATE familias SET nombre = 'Menús' WHERE codigo = 'MENUS';
