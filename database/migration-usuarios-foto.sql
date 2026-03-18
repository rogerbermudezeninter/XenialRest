-- XenialRest - Migración: Foto de usuario
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-usuarios-foto.sql

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ruta_foto VARCHAR(255);
