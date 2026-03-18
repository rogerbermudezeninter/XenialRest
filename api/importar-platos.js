/**
 * Borra platos y productos actuales, importa desde carta_importar.json
 * Uso: node importar-platos.js [ruta_json]
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

const jsonPath = process.argv[2] || path.join(__dirname, '..', 'Importar', 'carta_importar.json');

async function run() {
  if (!fs.existsSync(jsonPath)) {
    console.error('No existe', jsonPath);
    console.error('Ejecuta primero: python Importar/importar_carta_pdf.py');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const client = await pool.connect();

  try {
    console.log('Eliminando platos actuales y vaciando productos...');
    await client.query('UPDATE ticket_lineas SET plato_id = null, producto_id = null');
    await client.query('DELETE FROM platos');
    await client.query('DELETE FROM productos');
    console.log('  Hecho.\n');

    const familias = {};
    for (const curso of ['entrante', 'primero', 'segundo', 'tercero', 'cuarto']) {
      const r = await client.query(
        'SELECT id FROM familias WHERE curso = $1 AND activo = true LIMIT 1',
        [curso]
      );
      familias[curso] = r.rows[0]?.id;
    }

    let platosInsertados = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const familiaId = familias[it.curso];
      if (!familiaId) {
        console.warn('Sin familia para curso', it.curso, '-', it.nombre);
        continue;
      }
      const codigo = `IMP-${it.curso.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(3, '0')}`;
      try {
        const nombreCorto = (it.nombre || '').slice(0, 25)
        await client.query(
          `INSERT INTO platos (codigo, nombre, nombre_corto, familia_id, precio_base, precio_suplemento_menu)
           VALUES ($1, $2, $3, $4, $5, 0)`,
          [codigo, it.nombre, nombreCorto, familiaId, it.precio_base]
        );
        platosInsertados++;
        console.log('  ', it.nombre.slice(0, 55), it.precio_base + '€');
      } catch (err) {
        console.error('Error:', it.nombre, err.message);
      }
    }
    console.log('\nImportados:', platosInsertados, 'platos (productos vacío)');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
