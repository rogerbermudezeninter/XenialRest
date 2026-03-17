/**
 * XenialRest - API REST central
 * Servidor que coordina tablets Android, pantalla cocina y caja
 * Base de datos: PostgreSQL
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
let config = {};
try {
  const configPath = path.join(__dirname, '..', 'config', 'config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Usando config por defecto. Copia config.example.json a config.json');
}

// Pool PostgreSQL
const pool = new Pool(config.database || {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'xenialrest',
  user: process.env.PG_USER || 'xenial',
  password: process.env.PG_PASSWORD || 'xenial',
  max: 10,
  idleTimeoutMillis: 30000,
});

// Middleware
app.use(cors(config.server?.cors_origins ? { origin: config.server.cors_origins } : {}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  pool.query('SELECT 1')
    .then(() => res.json({ ok: true, db: 'connected' }))
    .catch(err => res.status(500).json({ ok: false, error: err.message }));
});

// ========== MESAS ==========
app.get('/api/mesas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.*, s.nombre as salon_nombre,
             COALESCE(me.estado, 'libre') as estado,
             me.ticket_id
      FROM mesas m
      JOIN salones s ON s.id = m.salon_id
      LEFT JOIN mesas_estado me ON me.mesa_id = m.id
      WHERE m.activo
      ORDER BY s.orden, m.codigo
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mesas/:id/estado', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT me.*, t.numero_ticket, t.editing_user_id, t.editing_started_at
      FROM mesas_estado me
      LEFT JOIN tickets t ON t.id = me.ticket_id
      WHERE me.mesa_id = $1
    `, [req.params.id]);
    res.json(rows[0] || { estado: 'libre' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== TICKETS ==========
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, m.nombre as mesa_nombre, u.nombre as camarero_nombre
      FROM tickets t
      JOIN mesas m ON m.id = t.mesa_id
      LEFT JOIN usuarios u ON u.id = t.camarero_id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id/lineas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT tl.*, p.nombre as producto_nombre
      FROM ticket_lineas tl
      LEFT JOIN productos p ON p.id = tl.producto_id
      WHERE tl.ticket_id = $1
      ORDER BY tl.orden, tl.id
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  const { mesa_id, camarero_id, comensales = 1 } = req.body || {};
  if (!mesa_id) return res.status(400).json({ error: 'mesa_id requerido' });
  try {
    const result = await pool.query(`
      INSERT INTO tickets (mesa_id, camarero_id, comensales, estado)
      VALUES ($1, $2, $3, 'abierto')
      RETURNING *
    `, [mesa_id, camarero_id || null, comensales]);
    const ticket = result.rows[0];
    await pool.query(
      'INSERT INTO mesas_estado (mesa_id, ticket_id, estado) VALUES ($1, $2, $3) ON CONFLICT (mesa_id) DO UPDATE SET ticket_id=$2, estado=$3, updated_at=NOW()',
      [mesa_id, ticket.id, 'ocupada']
    );
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bloquear/desbloquear mesa para edición
app.post('/api/tickets/:id/bloquear', async (req, res) => {
  const { device_id, user_id } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE tickets SET 
        editing_device_id = $1, 
        editing_user_id = $2, 
        editing_started_at = NOW(),
        updated_at = NOW()
      WHERE id = $3 AND estado NOT IN ('cobrado', 'anulado')
      RETURNING *
    `, [device_id || null, user_id || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ticket no encontrado o cerrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/desbloquear', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      UPDATE tickets SET 
        editing_device_id = NULL, 
        editing_user_id = NULL, 
        editing_started_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Añadir línea al ticket
app.post('/api/tickets/:id/lineas', async (req, res) => {
  const { producto_id, descripcion, cantidad = 1, precio_unitario, notas } = req.body || {};
  const ticketId = req.params.id;
  if (!descripcion && !producto_id) return res.status(400).json({ error: 'descripcion o producto_id requerido' });
  try {
    let precio = precio_unitario;
    let ivaPct = 0;
    if (producto_id) {
      const prod = await pool.query('SELECT precio_base, iva_id FROM productos WHERE id = $1', [producto_id]);
      if (prod.rows[0]) {
        precio = precio ?? prod.rows[0].precio_base;
        if (prod.rows[0].iva_id) {
          const iva = await pool.query('SELECT porcentaje FROM impuestos WHERE id = $1', [prod.rows[0].iva_id]);
          ivaPct = iva.rows[0]?.porcentaje || 0;
        }
      }
    }
    const importe = (parseFloat(precio) || 0) * (parseFloat(cantidad) || 1);
    const { rows } = await pool.query(`
      INSERT INTO ticket_lineas (ticket_id, producto_id, descripcion, cantidad, precio_unitario, importe, iva_porcentaje, estado, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', $8)
      RETURNING *
    `, [ticketId, producto_id || null, descripcion || 'Producto', cantidad, precio || 0, importe, ivaPct, notas || null]);
    await pool.query('UPDATE tickets SET total = total + $1, total_iva = total_iva + ($1 * $2/100), updated_at = NOW() WHERE id = $3',
      [importe, ivaPct, ticketId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enviar ticket a cocina (marcar líneas pendientes)
app.post('/api/tickets/:id/enviar-cocina', async (req, res) => {
  try {
    await pool.query(`UPDATE ticket_lineas SET estado = 'enviado_cocina' WHERE ticket_id = $1 AND estado = 'pendiente'`, [req.params.id]);
    await pool.query(`UPDATE tickets SET estado = 'enviado_cocina', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cobros
app.post('/api/tickets/:id/pagos', async (req, res) => {
  const { forma_pago_id, importe, usuario_id, referencia } = req.body || {};
  if (!forma_pago_id || !importe || importe <= 0) return res.status(400).json({ error: 'forma_pago_id e importe requeridos' });
  try {
    const { rows: pay } = await pool.query(`
      INSERT INTO pagos (ticket_id, forma_pago_id, importe, usuario_id, referencia)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.params.id, forma_pago_id, importe, usuario_id || null, referencia || null]);
    const ticket = await pool.query('SELECT total FROM tickets WHERE id = $1', [req.params.id]);
    const pagado = await pool.query('SELECT COALESCE(SUM(importe),0) as total FROM pagos WHERE ticket_id = $1', [req.params.id]);
    const totalPagado = parseFloat(pagado.rows[0].total);
    const totalTicket = parseFloat(ticket.rows[0]?.total || 0);
    const nuevoEstado = totalPagado >= totalTicket ? 'cobrado' : 'parcialmente_cobrado';
    await pool.query(`UPDATE tickets SET estado = $1, cerrado_at = CASE WHEN $1 = 'cobrado' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2`, [nuevoEstado, req.params.id]);
    if (nuevoEstado === 'cobrado') {
      await pool.query('UPDATE mesas_estado SET ticket_id = NULL, estado = $1, updated_at = NOW() WHERE ticket_id = $2', ['libre', req.params.id]);
    }
    res.status(201).json(pay[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id/pagos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, fp.nombre as forma_pago_nombre
      FROM pagos p
      JOIN formas_pago fp ON fp.id = p.forma_pago_id
      WHERE p.ticket_id = $1
      ORDER BY p.created_at
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== COCINA - pedidos pendientes ==========
app.get('/api/cocina/pendientes', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT tl.*, t.numero_ticket, m.nombre as mesa_nombre, u.nombre as camarero_nombre
      FROM ticket_lineas tl
      JOIN tickets t ON t.id = tl.ticket_id
      JOIN mesas m ON m.id = t.mesa_id
      LEFT JOIN usuarios u ON u.id = t.camarero_id
      WHERE tl.estado IN ('pendiente', 'enviado_cocina', 'en_preparacion')
        AND t.estado NOT IN ('anulado', 'cobrado')
      ORDER BY tl.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/cocina/linea/:id/estado', async (req, res) => {
  const { estado } = req.body; // en_preparacion, servido
  if (!['en_preparacion', 'servido'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE ticket_lineas SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, req.params.id]
    );
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PRODUCTOS ==========
app.get('/api/productos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, f.nombre as familia_nombre
      FROM productos p
      LEFT JOIN familias f ON f.id = p.familia_id
      WHERE p.activo
      ORDER BY f.orden, p.orden, p.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== FORMAS DE PAGO ==========
app.get('/api/formas-pago', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM formas_pago WHERE activo ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CONFIG ==========
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Imágenes estáticas
const imagenesPath = path.join(__dirname, '..', 'imagenes');
if (fs.existsSync(imagenesPath)) {
  app.use('/imagenes', express.static(imagenesPath));
}

// Iniciar servidor
app.listen(PORT, config.server?.host || '0.0.0.0', () => {
  console.log(`XenialRest API en http://0.0.0.0:${PORT}`);
});