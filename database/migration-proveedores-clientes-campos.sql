-- XenialRest - Migración: Proveedores y clientes con mismos campos que empresas
-- Ejecutar: psql -U xenial -d xenialrest -f database/migration-proveedores-clientes-campos.sql

-- ============================================
-- PROVEEDORES - mismos campos que empresas
-- ============================================
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS cif_nif VARCHAR(20);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(10);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS localidad VARCHAR(100);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS ruta_logo VARCHAR(255);

-- ============================================
-- CLIENTES - mismos campos que empresas
-- ============================================
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(10);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS localidad VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ruta_logo VARCHAR(255);
-- clientes ya tiene: codigo, nombre, nif_cif (equivale a cif_nif), direccion, telefono, email, notas
