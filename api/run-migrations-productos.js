/**
 * Ejecuta migraciones de productos (vegetariano, vegano, alérgenos, apto celíaco)
 * Usa credenciales de config/config.json
 * Uso: cd api && node run-migrations-productos.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let config = {};
try {
  const configPath = path.join(__dirname, '..', 'config', 'config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {}

const pool = new Pool(config.database || {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'xenialrest',
  user: process.env.PG_USER || 'xenial',
  password: process.env.PG_PASSWORD || 'xenial',
});

const migrations = [
  'migration-productos-vegetariano-vegano.sql',
  'migration-productos-alergenos-celiaco.sql',
  'migration-platos.sql',
];

async function run() {
  const client = await pool.connect();
  try {
    for (const file of migrations) {
      const sqlPath = path.join(__dirname, '..', 'database', file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log('OK:', file);
    }
    console.log('Migraciones ejecutadas correctamente.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
