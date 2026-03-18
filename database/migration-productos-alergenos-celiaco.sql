-- XenialRest - Migración: Alérgenos y apto celíaco en productos
-- Ejecutar (usa el usuario de tu config.json, ej. administrador o xenial):
--   psql -U administrador -d xenialrest -f database/migration-productos-alergenos-celiaco.sql

-- Alérgenos: texto con lista separada por comas (gluten, lactosa, huevo, etc.)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS alergenos TEXT;

-- Apto para celíacos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS apto_celiaco BOOLEAN NOT NULL DEFAULT false;
