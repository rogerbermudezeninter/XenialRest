/**
 * Ejecuta migration-apartados.sql
 * Uso: cd api && node run-migration-apartados.js
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

const sqlPath = path.join(__dirname, '..', 'database', 'migration-apartados.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migración apartados ejecutada correctamente.');
  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
