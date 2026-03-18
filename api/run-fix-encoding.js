/**
 * Corrige encoding en la BD (Menú, etc.)
 * Uso: cd api && node run-fix-encoding.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'config.json'), 'utf8'));
} catch (e) {}

const pool = new Pool(config.database || {});
const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'fix-encoding.sql'), 'utf8');

pool.query(sql)
  .then(() => { console.log('Encoding corregido.'); pool.end(); })
  .catch((e) => { console.error(e.message); pool.end(); process.exit(1); });
