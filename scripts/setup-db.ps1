# XenialRest - Configuración inicial de PostgreSQL
# Ejecutar en PowerShell. Te pedirá la contraseña de postgres.

$pgBin = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
if (-not (Test-Path $pgBin)) {
    $pgBin = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
}
if (-not (Test-Path $pgBin)) {
    Write-Host "No se encontró psql. Ajusta la ruta en el script." -ForegroundColor Red
    exit 1
}

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Creando usuario xenial y base de datos xenialrest..." -ForegroundColor Cyan
Write-Host "Introduce la contraseña de postgres cuando se solicite." -ForegroundColor Yellow
Write-Host ""

& $pgBin -U postgres -c "CREATE USER xenial WITH PASSWORD 'xenial';" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "(Usuario xenial puede que ya exista)" -ForegroundColor Gray }

& $pgBin -U postgres -c "CREATE DATABASE xenialrest OWNER xenial;" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "(Base de datos xenialrest puede que ya exista)" -ForegroundColor Gray }

& $pgBin -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE xenialrest TO xenial;"
& $pgBin -U postgres -c "ALTER DATABASE xenialrest OWNER TO xenial;"

Write-Host ""
Write-Host "Ejecutando schema.sql..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\schema.sql"

Write-Host ""
Write-Host "Ejecutando migration-menus.sql..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\migration-menus.sql"

Write-Host ""
Write-Host "Ejecutando migration-menus-ticket.sql..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\migration-menus-ticket.sql"

Write-Host ""
Write-Host "Ejecutando migration-empresas-zonas.sql..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\migration-empresas-zonas.sql"

Write-Host ""
Write-Host "Cargando datos demo (familias, productos, mesas, usuarios)..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\seed-demo.sql"

Write-Host ""
Write-Host "Corrigiendo encoding (Menú, etc.)..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\fix-encoding.sql" 2>$null

Write-Host ""
Write-Host "Ejecutando migraciones de productos (vegetariano, vegano, alérgenos, apto celíaco)..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\migration-productos-vegetariano-vegano.sql" 2>$null
& $pgBin -U xenial -d xenialrest -f "$root\database\migration-productos-alergenos-celiaco.sql" 2>$null

Write-Host ""
Write-Host "Ejecutando migración platos (tabla para menús)..." -ForegroundColor Cyan
& $pgBin -U xenial -d xenialrest -f "$root\database\migration-platos.sql" 2>$null

Write-Host ""
Write-Host "Listo. Base de datos xenialrest configurada con datos demo." -ForegroundColor Green
