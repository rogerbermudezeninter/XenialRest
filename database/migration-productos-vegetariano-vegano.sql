-- XenialRest - Migración: Vegetariano, Vegano en productos
-- Ejecutar (usa el usuario de tu config.json, ej. administrador o xenial):
--   psql -U administrador -d xenialrest -f database/migration-productos-vegetariano-vegano.sql

ALTER TABLE productos ADD COLUMN IF NOT EXISTS vegetariano BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS vegano BOOLEAN NOT NULL DEFAULT false;
