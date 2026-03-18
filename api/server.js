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

// Middleware - CORS: permitir localhost (Vite/Electron) y orígenes configurados
const corsOpts = config.server?.cors_origins?.length && !config.server.cors_origins.includes('*')
  ? { origin: config.server.cors_origins }
  : { origin: true };
app.use(cors(corsOpts));
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
      SELECT tl.*,
             COALESCE(pl.nombre, p.nombre) as producto_nombre,
             COALESCE(pl.precio_suplemento_menu, p.precio_suplemento_menu) as precio_suplemento_menu,
             tm.nombre as tipo_menu_nombre
      FROM ticket_lineas tl
      LEFT JOIN productos p ON p.id = tl.producto_id
      LEFT JOIN platos pl ON pl.id = tl.plato_id
      LEFT JOIN tipos_menu tm ON tm.id = tl.tipo_menu_id
      WHERE tl.ticket_id = $1
      ORDER BY tl.linea_padre_id NULLS FIRST, tl.orden, tl.id
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  const { mesa_id, camarero_id, comensales = 1, caja_id } = req.body || {};
  if (!mesa_id) return res.status(400).json({ error: 'mesa_id requerido' });
  try {
    const result = await pool.query(`
      INSERT INTO tickets (mesa_id, camarero_id, comensales, estado, caja_id)
      VALUES ($1, $2, $3, 'abierto', $4)
      RETURNING *
    `, [mesa_id, camarero_id || null, comensales, caja_id || null]);
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

app.patch('/api/tickets/:id', async (req, res) => {
  const { comensales } = req.body || {};
  if (comensales === undefined) return res.status(400).json({ error: 'comensales requerido' });
  const n = Math.max(1, parseInt(comensales, 10) || 1);
  try {
    const { rows } = await pool.query(
      'UPDATE tickets SET comensales = $1, updated_at = NOW() WHERE id = $2 AND estado NOT IN (\'cobrado\', \'anulado\') RETURNING *',
      [n, req.params.id]
    );
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

async function getPrecioPlatoParaCaja(pool, platoId, cajaId, esLineaMenu) {
  if (cajaId) {
    const ex = await pool.query('SELECT precio_base, precio_suplemento_menu FROM caja_plato_precio WHERE caja_id = $1 AND plato_id = $2', [cajaId, platoId]);
    if (ex.rows[0]) {
      return esLineaMenu ? (parseFloat(ex.rows[0].precio_suplemento_menu) || 0) : (parseFloat(ex.rows[0].precio_base) || 0);
    }
  }
  const plato = await pool.query('SELECT precio_base, precio_suplemento_menu FROM platos WHERE id = $1', [platoId]);
  if (plato.rows[0]) {
    return esLineaMenu ? (parseFloat(plato.rows[0].precio_suplemento_menu) || 0) : (parseFloat(plato.rows[0].precio_base) || 0);
  }
  return 0;
}

// Añadir línea al ticket
app.post('/api/tickets/:id/lineas', async (req, res) => {
  const { producto_id, plato_id, descripcion, cantidad = 1, precio_unitario, notas, comentarios_cocina, linea_padre_id, tipo_menu_id, caja_id } = req.body || {};
  const ticketId = req.params.id;
  if (!descripcion && !producto_id && !plato_id && !tipo_menu_id) return res.status(400).json({ error: 'descripcion, producto_id, plato_id o tipo_menu_id requerido' });
  try {
    let cajaId = caja_id;
    if (!cajaId) {
      const t = await pool.query('SELECT caja_id FROM tickets WHERE id = $1', [ticketId]);
      cajaId = t.rows[0]?.caja_id;
    }
    let precio = precio_unitario;
    let ivaPct = 0;
    if (plato_id) {
      const plato = await pool.query('SELECT precio_base, precio_suplemento_menu, iva_id FROM platos WHERE id = $1', [plato_id]);
      if (plato.rows[0]) {
        const esLineaMenu = linea_padre_id != null;
        if (precio == null) precio = await getPrecioPlatoParaCaja(pool, plato_id, cajaId, esLineaMenu);
        if (plato.rows[0].iva_id) {
          const iva = await pool.query('SELECT porcentaje FROM impuestos WHERE id = $1', [plato.rows[0].iva_id]);
          ivaPct = iva.rows[0]?.porcentaje || 0;
        }
      }
    } else if (producto_id) {
      const prod = await pool.query('SELECT precio_base, precio_suplemento_menu, iva_id FROM productos WHERE id = $1', [producto_id]);
      if (prod.rows[0]) {
        const esLineaMenu = linea_padre_id != null;
        precio = precio ?? (esLineaMenu ? (parseFloat(prod.rows[0].precio_suplemento_menu) || 0) : prod.rows[0].precio_base);
        if (prod.rows[0].iva_id) {
          const iva = await pool.query('SELECT porcentaje FROM impuestos WHERE id = $1', [prod.rows[0].iva_id]);
          ivaPct = iva.rows[0]?.porcentaje || 0;
        }
      }
    } else if (tipo_menu_id) {
      const tm = await pool.query('SELECT precio FROM tipos_menu WHERE id = $1', [tipo_menu_id]);
      precio = precio ?? (tm.rows[0]?.precio || 0);
    }
    const importe = (parseFloat(precio) || 0) * (parseFloat(cantidad) || 1);
    const { rows } = await pool.query(`
      INSERT INTO ticket_lineas (ticket_id, producto_id, plato_id, descripcion, cantidad, precio_unitario, importe, iva_porcentaje, estado, notas, comentarios_cocina, linea_padre_id, tipo_menu_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9, $10, $11, $12)
      RETURNING *
    `, [ticketId, producto_id || null, plato_id || null, descripcion || 'Producto', cantidad, precio || 0, importe, ivaPct, notas || null, comentarios_cocina || null, linea_padre_id || null, tipo_menu_id || null]);
    await pool.query('UPDATE tickets SET total = total + $1, total_iva = total_iva + ($1 * $2/100), updated_at = NOW() WHERE id = $3',
      [importe, ivaPct, ticketId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Añadir platos a un menú existente - DEBE ir antes de /:lineaId
app.post('/api/tickets/:id/lineas/:padreId/platos', async (req, res) => {
  const { id: ticketId, padreId } = req.params;
  const { platos, caja_id } = req.body || {};
  const platosArr = Array.isArray(platos) ? platos : [];
  if (platosArr.length === 0) return res.status(400).json({ error: 'platos requeridos' });
  try {
    let cajaId = caja_id;
    if (!cajaId) {
      const t = await pool.query('SELECT caja_id FROM tickets WHERE id = $1', [ticketId]);
      cajaId = t.rows[0]?.caja_id;
    }
    const { rows: [padre] } = await pool.query(
      'SELECT id, tipo_menu_id FROM ticket_lineas WHERE id = $1 AND ticket_id = $2 AND tipo_menu_id IS NOT NULL',
      [padreId, ticketId]
    );
    if (!padre) return res.status(404).json({ error: 'Menú no encontrado' });
    let totalImporte = 0;
    let totalIva = 0;
    for (const p of platosArr) {
      const platoId = p.plato_id ?? p.id;
      const suplemento = await getPrecioPlatoParaCaja(pool, platoId, cajaId, true);
      await pool.query(`
        INSERT INTO ticket_lineas (ticket_id, plato_id, descripcion, cantidad, precio_unitario, importe, linea_padre_id, estado, comentarios_cocina)
        VALUES ($1, $2, $3, 1, $4, $4, $5, 'pendiente', $6)
      `, [ticketId, platoId, p.descripcion || p.nombre, suplemento, padreId, p.comentarios_cocina || null]);
      totalImporte += suplemento;
    }
    await pool.query(
      'UPDATE tickets SET total = total + $1, total_iva = total_iva + $2, updated_at = NOW() WHERE id = $3',
      [totalImporte, totalIva, ticketId]
    );
    res.status(201).json({ parent: padre, added: platosArr.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tickets/:id/lineas/:lineaId', async (req, res) => {
  const { comentarios_cocina, cantidad } = req.body || {};
  try {
    if (cantidad != null && parseFloat(cantidad) >= 0) {
      const { rows: prev } = await pool.query(
        'SELECT cantidad, precio_unitario, importe, iva_porcentaje, estado FROM ticket_lineas WHERE id = $1 AND ticket_id = $2',
        [req.params.lineaId, req.params.id]
      );
      if (!prev[0]) return res.status(404).json({ error: 'Línea no encontrada' });
      if (prev[0].estado !== 'pendiente') return res.status(400).json({ error: 'No se puede modificar: la línea ya fue enviada a cocina' });
      const cant = parseFloat(cantidad) || 0;
      const precio = parseFloat(prev[0].precio_unitario) || 0;
      const importe = precio * cant;
      const diff = importe - (parseFloat(prev[0].importe) || 0);
      const ivaPct = parseFloat(prev[0].iva_porcentaje) || 0;
      const ivaDiff = diff * ivaPct / 100;
      await pool.query(
        'UPDATE ticket_lineas SET cantidad = $1, importe = $2 WHERE id = $3 AND ticket_id = $4',
        [cant, importe, req.params.lineaId, req.params.id]
      );
      await pool.query(
        'UPDATE tickets SET total = GREATEST(0, total + $1), total_iva = GREATEST(0, total_iva + $2), updated_at = NOW() WHERE id = $3',
        [diff, ivaDiff, req.params.id]
      );
      const { rows } = await pool.query('SELECT * FROM ticket_lineas WHERE id = $1', [req.params.lineaId]);
      return res.json(rows[0]);
    }
    const { rows: check } = await pool.query(
      'SELECT estado FROM ticket_lineas WHERE id = $1 AND ticket_id = $2',
      [req.params.lineaId, req.params.id]
    );
    if (!check[0]) return res.status(404).json({ error: 'Línea no encontrada' });
    if (check[0].estado !== 'pendiente') return res.status(400).json({ error: 'No se pueden modificar comentarios en líneas ya enviadas a cocina' });
    const { rows } = await pool.query(`
      UPDATE ticket_lineas SET comentarios_cocina = COALESCE($1, comentarios_cocina)
      WHERE id = $2 AND ticket_id = $3
      RETURNING *
    `, [comentarios_cocina ?? null, req.params.lineaId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Línea no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Añadir bloque de menú completo (padre + hijos)
app.post('/api/tickets/:id/lineas-menu', async (req, res) => {
  const { tipo_menu_id, cantidad = 1, platos, caja_id } = req.body || {};
  const ticketId = req.params.id;
  if (!tipo_menu_id) return res.status(400).json({ error: 'tipo_menu_id requerido' });
  const platosArr = Array.isArray(platos) ? platos : [];
  try {
    let cajaId = caja_id;
    if (!cajaId) {
      const t = await pool.query('SELECT caja_id FROM tickets WHERE id = $1', [ticketId]);
      cajaId = t.rows[0]?.caja_id;
    }
    const tm = await pool.query('SELECT id, nombre, precio FROM tipos_menu WHERE id = $1', [tipo_menu_id]);
    if (!tm.rows[0]) return res.status(404).json({ error: 'Tipo de menú no encontrado' });
    const precioMenu = parseFloat(tm.rows[0].precio) || 0;
    const descripcionMenu = tm.rows[0].nombre;
    const importeMenu = precioMenu * cantidad;
    const { rows: [parentRow] } = await pool.query(`
      INSERT INTO ticket_lineas (ticket_id, tipo_menu_id, descripcion, cantidad, precio_unitario, importe, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
      RETURNING *
    `, [ticketId, tipo_menu_id, descripcionMenu, cantidad, precioMenu, importeMenu]);
    let totalImporte = importeMenu;
    let totalIva = 0;
    for (const p of platosArr) {
      const platoId = p.plato_id ?? p.id;
      const suplemento = await getPrecioPlatoParaCaja(pool, platoId, cajaId, true);
      totalImporte += suplemento;
      await pool.query(`
        INSERT INTO ticket_lineas (ticket_id, plato_id, descripcion, cantidad, precio_unitario, importe, linea_padre_id, estado, comentarios_cocina)
        VALUES ($1, $2, $3, 1, $4, $4, $5, 'pendiente', $6)
      `, [ticketId, platoId, p.descripcion || p.nombre, suplemento, parentRow.id, p.comentarios_cocina || null]);
    }
    await pool.query(
      'UPDATE tickets SET total = total + $1, total_iva = total_iva + $2, updated_at = NOW() WHERE id = $3',
      [totalImporte, totalIva, ticketId]
    );
    res.status(201).json({ parent: parentRow, platos: platosArr.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar todas las líneas que son menús (solo bloques donde padre e hijos están pendientes) - debe ir antes de /:lineaId
app.delete('/api/tickets/:id/lineas/menus', async (req, res) => {
  const ticketId = req.params.id;
  try {
    const { rows: padres } = await pool.query(
      `SELECT p.id, p.importe, p.iva_porcentaje FROM ticket_lineas p
       WHERE p.ticket_id = $1 AND p.tipo_menu_id IS NOT NULL AND p.estado = 'pendiente'
       AND NOT EXISTS (SELECT 1 FROM ticket_lineas h WHERE h.linea_padre_id = p.id AND h.estado != 'pendiente')`,
      [ticketId]
    );
    const idsPadres = padres.map((r) => r.id);
    if (idsPadres.length === 0) {
      return res.json({ deleted: 0 });
    }
    const { rows: hijos } = await pool.query(
      'SELECT id, importe, iva_porcentaje FROM ticket_lineas WHERE ticket_id = $1 AND linea_padre_id = ANY($2) AND estado = $3',
      [ticketId, idsPadres, 'pendiente']
    );
    const idsBorrar = [...idsPadres, ...hijos.map((r) => r.id)];
    const todas = [...padres, ...hijos];
    const totalRestar = todas.reduce((s, r) => s + parseFloat(r.importe || 0), 0);
    const ivaRestar = todas.reduce((s, r) => s + parseFloat(r.importe || 0) * (parseFloat(r.iva_porcentaje || 0) / 100), 0);
    await pool.query('DELETE FROM ticket_lineas WHERE id = ANY($1)', [idsBorrar]);
    await pool.query(
      'UPDATE tickets SET total = GREATEST(0, total - $1), total_iva = GREATEST(0, total_iva - $2), updated_at = NOW() WHERE id = $3',
      [totalRestar, ivaRestar, ticketId]
    );
    res.json({ deleted: idsBorrar.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar una línea (solo si estado = pendiente; si es padre de menú, todos los hijos deben estar pendientes)
app.delete('/api/tickets/:id/lineas/:lineaId', async (req, res) => {
  const { id: ticketId, lineaId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT id, importe, iva_porcentaje, estado, linea_padre_id, tipo_menu_id FROM ticket_lineas WHERE id = $1 AND ticket_id = $2',
      [lineaId, ticketId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Línea no encontrada' });
    if (rows[0].estado !== 'pendiente') {
      return res.status(400).json({ error: 'No se puede eliminar: la línea ya fue enviada a cocina' });
    }
    let imp = parseFloat(rows[0].importe) || 0;
    let iva = imp * (parseFloat(rows[0].iva_porcentaje) || 0) / 100;
    if (rows[0].tipo_menu_id) {
      const { rows: hijos } = await pool.query(
        'SELECT id, importe, iva_porcentaje, estado FROM ticket_lineas WHERE linea_padre_id = $1',
        [lineaId]
      );
      const algunEnviado = hijos.some((h) => h.estado !== 'pendiente');
      if (algunEnviado) {
        return res.status(400).json({ error: 'No se puede eliminar: el menú tiene platos ya enviados a cocina' });
      }
      hijos.forEach((h) => {
        imp += parseFloat(h.importe) || 0;
        iva += (parseFloat(h.importe) || 0) * (parseFloat(h.iva_porcentaje) || 0) / 100;
      });
    }
    await pool.query('DELETE FROM ticket_lineas WHERE id = $1', [lineaId]);
    await pool.query(
      'UPDATE tickets SET total = GREATEST(0, total - $1), total_iva = GREATEST(0, total_iva - $2), updated_at = NOW() WHERE id = $3',
      [imp, iva, ticketId]
    );
    res.json({ deleted: true });
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

// ========== EMPRESAS ==========
app.get('/api/empresas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM empresas WHERE activo ORDER BY nombre
    `);
    res.json(rows);
  } catch (err) {
    if (err.message?.includes('empresas')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/empresas', async (req, res) => {
  const { codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, idioma_base_id } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO empresas (codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, idioma_base_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [codigo, nombre, cif_nif || null, direccion || null, codigo_postal || null, localidad || null, provincia || null, telefono || null, email || null, idioma_base_id || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/empresas/:id', async (req, res) => {
  const { codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, idioma_base_id } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE empresas SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), cif_nif=COALESCE($3,cif_nif),
        direccion=COALESCE($4,direccion), codigo_postal=COALESCE($5,codigo_postal), localidad=COALESCE($6,localidad),
        provincia=COALESCE($7,provincia), telefono=COALESCE($8,telefono), email=COALESCE($9,email),
        idioma_base_id=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, idioma_base_id ?? null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/empresas/:id', async (req, res) => {
  try {
    await pool.query('UPDATE empresas SET activo=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== IDIOMAS ==========
app.get('/api/idiomas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM idiomas WHERE activo ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    if (err.message?.includes('idiomas')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/idiomas', async (req, res) => {
  const { codigo, nombre } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query('INSERT INTO idiomas (codigo, nombre) VALUES ($1, $2) RETURNING *', [codigo, nombre]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/idiomas/:id', async (req, res) => {
  const { codigo, nombre } = req.body || {};
  try {
    const { rows } = await pool.query('UPDATE idiomas SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre) WHERE id=$3 RETURNING *', [codigo, nombre, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Idioma no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/idiomas/:id', async (req, res) => {
  try {
    await pool.query('UPDATE idiomas SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PROVEEDORES ==========
app.get('/api/proveedores', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proveedores WHERE activo ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    if (err.message?.includes('proveedores')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/proveedores', async (req, res) => {
  const { codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, ruta_logo } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO proveedores (codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, ruta_logo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [codigo, nombre, cif_nif || null, direccion || null, codigo_postal || null, localidad || null, provincia || null, telefono || null, email || null, ruta_logo || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/proveedores/:id', async (req, res) => {
  const { codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, ruta_logo } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE proveedores SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), cif_nif=COALESCE($3,cif_nif),
        direccion=COALESCE($4,direccion), codigo_postal=COALESCE($5,codigo_postal), localidad=COALESCE($6,localidad),
        provincia=COALESCE($7,provincia), telefono=COALESCE($8,telefono), email=COALESCE($9,email),
        ruta_logo=COALESCE($10,ruta_logo), updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [codigo, nombre, cif_nif, direccion, codigo_postal, localidad, provincia, telefono, email, ruta_logo, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/proveedores/:id', async (req, res) => {
  try {
    await pool.query('UPDATE proveedores SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CLIENTES ==========
app.get('/api/clientes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clientes WHERE activo ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    if (err.message?.includes('clientes')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  const { codigo, nombre, cif_nif, nif_cif, direccion, codigo_postal, localidad, provincia, telefono, email, notas, ruta_logo } = req.body || {};
  const nif = cif_nif ?? nif_cif;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO clientes (codigo, nombre, nif_cif, direccion, codigo_postal, localidad, provincia, telefono, email, notas, ruta_logo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `, [codigo || null, nombre, nif || null, direccion || null, codigo_postal || null, localidad || null, provincia || null, telefono || null, email || null, notas || null, ruta_logo || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  const { codigo, nombre, cif_nif, nif_cif, direccion, codigo_postal, localidad, provincia, telefono, email, notas, ruta_logo } = req.body || {};
  const nif = cif_nif ?? nif_cif;
  try {
    const { rows } = await pool.query(`
      UPDATE clientes SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), nif_cif=COALESCE($3,nif_cif),
        direccion=COALESCE($4,direccion), codigo_postal=COALESCE($5,codigo_postal), localidad=COALESCE($6,localidad),
        provincia=COALESCE($7,provincia), telefono=COALESCE($8,telefono), email=COALESCE($9,email),
        notas=COALESCE($10,notas), ruta_logo=COALESCE($11,ruta_logo), updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [codigo, nombre, nif, direccion, codigo_postal, localidad, provincia, telefono, email, notas, ruta_logo, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await pool.query('UPDATE clientes SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ZONAS PREPARACIÓN ==========
app.get('/api/zonas-preparacion', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT zp.*, i.nombre as impresora_nombre, i.ip_host as impresora_ip
      FROM zonas_preparacion zp
      LEFT JOIN impresoras i ON i.id = zp.impresora_id
      WHERE zp.activo ORDER BY zp.nombre
    `);
    res.json(rows);
  } catch (err) {
    if (err.message?.includes('zonas_preparacion')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zonas-preparacion', async (req, res) => {
  const { empresa_id, codigo, nombre, impresora_id, ip_host, puerto } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  const empId = empresa_id || 1;
  const impId = (impresora_id === '' || impresora_id == null) ? null : impresora_id;
  try {
    const { rows } = await pool.query(`
      INSERT INTO zonas_preparacion (empresa_id, codigo, nombre, impresora_id, ip_host, puerto)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [empId, codigo, nombre, impId, ip_host || null, puerto ?? 9100]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message?.includes('zonas_preparacion') || err.message?.includes('empresas')) {
      return res.status(500).json({ error: 'Tabla no existe. Ejecuta: psql -U xenial -d xenialrest -f database/migration-empresas-zonas.sql' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/zonas-preparacion/:id', async (req, res) => {
  const { codigo, nombre, impresora_id, ip_host, puerto } = req.body || {};
  const impId = (impresora_id === '' || impresora_id === null || impresora_id === undefined) ? null : impresora_id;
  try {
    const { rows } = await pool.query(`
      UPDATE zonas_preparacion SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre),
        impresora_id=COALESCE($3,impresora_id), ip_host=COALESCE($4,ip_host), puerto=COALESCE($5,puerto)
      WHERE id=$6 RETURNING *
    `, [codigo, nombre, impId, ip_host || null, puerto, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Zona no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/zonas-preparacion/:id', async (req, res) => {
  try {
    await pool.query('UPDATE zonas_preparacion SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== IMPRESORAS ==========
app.get('/api/impresoras', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM impresoras WHERE activo ORDER BY nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/impresoras', async (req, res) => {
  const { codigo, nombre, tipo, ip_host, puerto } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO impresoras (codigo, nombre, tipo, ip_host, puerto)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [codigo, nombre, tipo || 'cocina', ip_host || null, puerto || 9100]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/impresoras/:id', async (req, res) => {
  const { codigo, nombre, tipo, ip_host, puerto } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE impresoras SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), tipo=COALESCE($3,tipo),
        ip_host=COALESCE($4,ip_host), puerto=COALESCE($5,puerto) WHERE id=$6 RETURNING *
    `, [codigo, nombre, tipo, ip_host, puerto, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Impresora no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/impresoras/:id', async (req, res) => {
  try {
    await pool.query('UPDATE impresoras SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== FAMILIAS ==========
app.get('/api/familias', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, codigo, nombre, orden, activo, curso, COALESCE(mostrar_pantalla_principal, true) as mostrar_pantalla_principal
      FROM familias WHERE activo ORDER BY orden, nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/familias', async (req, res) => {
  const { codigo, nombre, orden = 0, curso, mostrar_pantalla_principal } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  const mostrar = mostrar_pantalla_principal !== false;
  try {
    const { rows } = await pool.query(`
      INSERT INTO familias (codigo, nombre, orden, curso, mostrar_pantalla_principal)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [codigo, nombre, orden || 0, curso || null, mostrar]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/familias/:id', async (req, res) => {
  const { codigo, nombre, orden, curso, mostrar_pantalla_principal } = req.body || {};
  const mostrar = mostrar_pantalla_principal === undefined ? undefined : (mostrar_pantalla_principal !== false);
  try {
    const { rows } = await pool.query(`
      UPDATE familias SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), orden=COALESCE($3,orden), curso=COALESCE($4,curso),
        mostrar_pantalla_principal=COALESCE($5,mostrar_pantalla_principal)
      WHERE id=$6 RETURNING *
    `, [codigo, nombre, orden, curso, mostrar, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Familia no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/familias/:id', async (req, res) => {
  try {
    await pool.query('UPDATE familias SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== FAMILIAS MENU (para menús, distintas de familias carta) ==========
app.get('/api/familias-menu', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM familias_menu WHERE activo ORDER BY orden, nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/familias-menu', async (req, res) => {
  const { codigo, nombre, orden = 0 } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO familias_menu (codigo, nombre, orden) VALUES ($1, $2, $3) RETURNING *
    `, [codigo, nombre, orden || 0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/familias-menu/:id', async (req, res) => {
  const { codigo, nombre, orden } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE familias_menu SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), orden=COALESCE($3,orden)
      WHERE id=$4 RETURNING *
    `, [codigo, nombre, orden, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Familia menú no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/familias-menu/:id', async (req, res) => {
  try {
    await pool.query('UPDATE familias_menu SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Platos de una familia menú / familias menú de un plato
app.get('/api/platos/:id/familias-menu', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fm.* FROM familias_menu fm
      JOIN plato_familias_menu pfm ON pfm.familia_menu_id = fm.id
      WHERE pfm.plato_id = $1 AND fm.activo
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/platos/:id/familias-menu', async (req, res) => {
  const familiaIds = Array.isArray(req.body) ? req.body : (req.body?.familia_menu_ids || []);
  const platoId = parseInt(req.params.id, 10);
  try {
    await pool.query('DELETE FROM plato_familias_menu WHERE plato_id = $1', [platoId]);
    for (const fid of familiaIds) {
      if (fid) await pool.query('INSERT INTO plato_familias_menu (plato_id, familia_menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [platoId, fid]);
    }
    const { rows } = await pool.query(`
      SELECT fm.* FROM familias_menu fm
      JOIN plato_familias_menu pfm ON pfm.familia_menu_id = fm.id
      WHERE pfm.plato_id = $1 AND fm.activo
    `, [platoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Familias menú de un tipo de menú
app.get('/api/tipos-menu/:id/familias-menu', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fm.* FROM familias_menu fm
      JOIN tipo_menu_familias_menu tmfm ON tmfm.familia_menu_id = fm.id
      WHERE tmfm.tipo_menu_id = $1 AND fm.activo
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tipos-menu/:id/familias-menu', async (req, res) => {
  const familiaIds = Array.isArray(req.body) ? req.body : (req.body?.familia_menu_ids || []);
  const tipoId = parseInt(req.params.id, 10);
  try {
    await pool.query('DELETE FROM tipo_menu_familias_menu WHERE tipo_menu_id = $1', [tipoId]);
    for (const fid of familiaIds) {
      if (fid) await pool.query('INSERT INTO tipo_menu_familias_menu (tipo_menu_id, familia_menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tipoId, fid]);
    }
    const { rows } = await pool.query(`
      SELECT fm.* FROM familias_menu fm
      JOIN tipo_menu_familias_menu tmfm ON tmfm.familia_menu_id = fm.id
      WHERE tmfm.tipo_menu_id = $1 AND fm.activo
    `, [tipoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== APARTADOS (catálogo maestro, reutilizables) ==========
app.get('/api/apartados', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM apartados ORDER BY orden, nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/apartados/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM apartados WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Apartado no encontrado' });
    rows[0].platos = [];
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apartados', async (req, res) => {
  const { codigo, nombre, orden = 0 } = req.body || {};
  const nom = (nombre && String(nombre).trim()) || '';
  if (!nom) return res.status(400).json({ error: 'El nombre del apartado es obligatorio' });
  const cod = (codigo && String(codigo).trim()) || (nom.toUpperCase().replace(/\s+/g, '_').slice(0, 30));
  try {
    const { rows } = await pool.query(`
      INSERT INTO apartados (codigo, nombre, orden) VALUES ($1, $2, $3) RETURNING *
    `, [cod, nom, orden || 0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/apartados/:id', async (req, res) => {
  const { codigo, nombre, orden } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE apartados SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), orden=COALESCE($3,orden)
      WHERE id=$4 RETURNING *
    `, [codigo, nombre, orden, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Apartado no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/apartados/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM apartados WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Platos por apartado: ya no se usa (platos son por tipo+apartado). Mantener por compatibilidad, devuelve vacío.
app.put('/api/apartados/:id/platos', async (req, res) => {
  res.json([]);
});

// Platos de un tipo+apartado concreto (debe ir ANTES de /:id/apartados)
app.get('/api/tipos-menu/:tipoId/apartados/:apartadoId/platos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, f.nombre as familia_nombre, f.curso as familia_curso
      FROM tipo_menu_apartado_platos tmap
      JOIN platos p ON p.id = tmap.plato_id AND p.activo
      LEFT JOIN familias f ON f.id = p.familia_id
      WHERE tmap.tipo_menu_id = $1 AND tmap.apartado_id = $2
      ORDER BY tmap.orden, p.nombre
    `, [req.params.tipoId, req.params.apartadoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tipos-menu/:tipoId/apartados/:apartadoId/platos', async (req, res) => {
  const platoIds = Array.isArray(req.body) ? req.body : (req.body?.plato_ids || []);
  const tipoId = parseInt(req.params.tipoId, 10);
  const apartadoId = parseInt(req.params.apartadoId, 10);
  try {
    await pool.query('DELETE FROM tipo_menu_apartado_platos WHERE tipo_menu_id = $1 AND apartado_id = $2', [tipoId, apartadoId]);
    for (let idx = 0; idx < platoIds.length; idx++) {
      const pid = platoIds[idx];
      if (pid) await pool.query(`
        INSERT INTO tipo_menu_apartado_platos (tipo_menu_id, apartado_id, plato_id, orden) VALUES ($1, $2, $3, $4)
      `, [tipoId, apartadoId, pid, idx]);
    }
    const { rows } = await pool.query(`
      SELECT p.*, f.nombre as familia_nombre, f.curso as familia_curso
      FROM tipo_menu_apartado_platos tmap
      JOIN platos p ON p.id = tmap.plato_id AND p.activo
      LEFT JOIN familias f ON f.id = p.familia_id
      WHERE tmap.tipo_menu_id = $1 AND tmap.apartado_id = $2
      ORDER BY tmap.orden, p.nombre
    `, [tipoId, apartadoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apartados que usa un tipo de menú (con platos desde tipo_menu_apartado_platos)
app.get('/api/tipos-menu/:id/apartados', async (req, res) => {
  const cajaId = req.query.caja_id ? parseInt(req.query.caja_id, 10) : null;
  try {
    const { rows } = await pool.query(`
      SELECT a.*, tma.orden, tma.platos_por_persona,
             (SELECT COALESCE(json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'nombre_corto', p.nombre, 'precio_base', p.precio_base, 'precio_suplemento_menu', COALESCE(p.precio_suplemento_menu, 0), 'ruta_imagen', p.ruta_imagen, 'vegetariano', COALESCE(p.vegetariano, false), 'vegano', COALESCE(p.vegano, false), 'apto_celiaco', COALESCE(p.apto_celiaco, false), 'familia_id', p.familia_id, 'familia_nombre', f.nombre, 'familia_curso', f.curso) ORDER BY tmap.orden, p.nombre), '[]'::json)
              FROM tipo_menu_apartado_platos tmap
              JOIN platos p ON p.id = tmap.plato_id AND p.activo
              LEFT JOIN familias f ON f.id = p.familia_id
              WHERE tmap.tipo_menu_id = $1 AND tmap.apartado_id = a.id) as platos
      FROM apartados a
      JOIN tipo_menu_apartados tma ON tma.apartado_id = a.id
      WHERE tma.tipo_menu_id = $1
      ORDER BY tma.orden, a.nombre
    `, [req.params.id]);
    rows.forEach((r) => {
      r.platos = r.platos || [];
      if (typeof r.platos === 'string') r.platos = JSON.parse(r.platos || '[]');
    });
    if (cajaId) {
      const { rows: exRows } = await pool.query(
        'SELECT plato_id, precio_base, precio_suplemento_menu FROM caja_plato_precio WHERE caja_id = $1',
        [cajaId]
      );
      const exMap = exRows.reduce((m, e) => { m[e.plato_id] = e; return m; }, {});
      rows.forEach((r) => {
        (r.platos || []).forEach((p) => {
          const ex = exMap[p.id];
          if (ex) { p.precio_base = parseFloat(ex.precio_base) || 0; p.precio_suplemento_menu = parseFloat(ex.precio_suplemento_menu) || 0; }
        });
      });
    }
    res.json(rows);
  } catch (err) {
    console.error('GET /api/tipos-menu/:id/apartados', err);
    res.status(500).json({ error: err.message });
  }
});

// Asignar apartados a un tipo de menú (body: [{ apartado_id, orden, platos_por_persona }, ...])
app.put('/api/tipos-menu/:id/apartados', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : (req.body?.apartados || []);
  const tipoId = parseInt(req.params.id, 10);
  try {
    await pool.query('DELETE FROM tipo_menu_apartados WHERE tipo_menu_id = $1', [tipoId]);
    for (let i = 0; i < items.length; i++) {
      const { apartado_id, orden = i, platos_por_persona = 1 } = items[i] || {};
      if (apartado_id) {
        await pool.query(`
          INSERT INTO tipo_menu_apartados (tipo_menu_id, apartado_id, orden, platos_por_persona) VALUES ($1, $2, $3, $4)
        `, [tipoId, apartado_id, orden, platos_por_persona || 1]);
      }
    }
    const { rows } = await pool.query(`
      SELECT a.*, tma.orden, tma.platos_por_persona
      FROM apartados a
      JOIN tipo_menu_apartados tma ON tma.apartado_id = a.id
      WHERE tma.tipo_menu_id = $1 ORDER BY tma.orden
    `, [tipoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PRODUCTOS ==========
app.get('/api/productos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, f.nombre as familia_nombre, f.curso as familia_curso, zp.nombre as zona_preparacion_nombre,
             pr.nombre as proveedor_principal_nombre
      FROM productos p
      LEFT JOIN familias f ON f.id = p.familia_id
      LEFT JOIN zonas_preparacion zp ON zp.id = p.zona_preparacion_id
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_principal_id
      WHERE p.activo
      ORDER BY f.orden, p.orden, p.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/productos', async (req, res) => {
  const body = req.body || {};
  const codigo = body.codigo;
  const nombre = body.nombre;
  const familia_id = body.familia_id || null;
  const precio_base = body.precio_base ?? 0;
  const precio_suplemento_menu = body.precio_suplemento_menu ?? 0;
  const zona_preparacion_id = (body.zona_preparacion_id && body.zona_preparacion_id !== '') ? body.zona_preparacion_id : null;
  const ruta_imagen = body.ruta_imagen || null;
  const proveedor_principal_id = (body.proveedor_principal_id && body.proveedor_principal_id !== '') ? body.proveedor_principal_id : null;
  const alergenos = (body.alergenos && String(body.alergenos).trim()) ? String(body.alergenos).trim() : null;
  const apto_celiaco = !!body.apto_celiaco;
  const vegetariano = !!body.vegetariano;
  const vegano = !!body.vegano;
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO productos (codigo, nombre, familia_id, precio_base, precio_suplemento_menu, zona_preparacion_id, ruta_imagen, proveedor_principal_id, alergenos, apto_celiaco, vegetariano, vegano)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `, [codigo, nombre, familia_id || null, precio_base, precio_suplemento_menu, zona_preparacion_id || null, ruta_imagen || null, proveedor_principal_id || null, alergenos || null, apto_celiaco, vegetariano, vegano]);
    res.status(201).json(rows[0]);
  } catch (err) {
    try {
      const { rows } = await pool.query(`
        INSERT INTO productos (codigo, nombre, familia_id, precio_base, ruta_imagen, alergenos, apto_celiaco, vegetariano, vegano)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
      `, [codigo, nombre, familia_id || null, precio_base, ruta_imagen || null, alergenos || null, apto_celiaco, vegetariano, vegano]);
      res.status(201).json(rows[0]);
    } catch (err2) {
      res.status(500).json({ error: err2.message });
    }
  }
});

app.put('/api/productos/:id', async (req, res) => {
  const body = req.body || {};
  const codigo = body.codigo;
  const nombre = body.nombre;
  const familia_id = body.familia_id || null;
  const precio_base = body.precio_base;
  const precio_suplemento_menu = body.precio_suplemento_menu;
  const zona_preparacion_id = (body.zona_preparacion_id && body.zona_preparacion_id !== '') ? body.zona_preparacion_id : null;
  const ruta_imagen = body.ruta_imagen || null;
  const proveedor_principal_id = (body.proveedor_principal_id && body.proveedor_principal_id !== '') ? body.proveedor_principal_id : null;
  const alergenos = body.alergenos !== undefined ? (String(body.alergenos).trim() || null) : null;
  const apto_celiaco = !!body.apto_celiaco;
  const vegetariano = !!body.vegetariano;
  const vegano = !!body.vegano;
  try {
    const { rows } = await pool.query(`
      UPDATE productos SET
        codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), familia_id=COALESCE($3,familia_id),
        precio_base=COALESCE($4,precio_base), precio_suplemento_menu=COALESCE($5,precio_suplemento_menu),
        zona_preparacion_id=COALESCE($6,zona_preparacion_id), ruta_imagen=COALESCE($7,ruta_imagen),
        proveedor_principal_id=COALESCE($8,proveedor_principal_id), alergenos=$9, apto_celiaco=$10, vegetariano=$11, vegano=$12, updated_at=NOW()
      WHERE id=$13 RETURNING *
    `, [codigo, nombre, familia_id, precio_base, precio_suplemento_menu, zona_preparacion_id, ruta_imagen, proveedor_principal_id, alergenos, apto_celiaco, vegetariano, vegano, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    await pool.query('UPDATE productos SET activo=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: obtener idioma_base_id para un plato (por empresa_id)
async function getIdiomaBaseParaPlato(empresaId) {
  const emp = await pool.query(
    'SELECT idioma_base_id FROM empresas WHERE id = $1',
    [empresaId]
  );
  if (emp.rows[0]?.idioma_base_id) return emp.rows[0].idioma_base_id;
  const es = await pool.query("SELECT id FROM idiomas WHERE codigo = 'es' LIMIT 1");
  return es.rows[0]?.id || null;
}

// Helper: sincronizar plato a platos_idiomas (idioma base)
async function syncPlatoIdiomaBase(platoId, nombre, nombreCorto, comentarios, empresaId) {
  const idiomaId = await getIdiomaBaseParaPlato(empresaId);
  if (!idiomaId) return;
  await pool.query(`
    INSERT INTO platos_idiomas (plato_id, idioma_id, nombre, nombre_corto, comentarios, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (plato_id, idioma_id) DO UPDATE SET
      nombre = EXCLUDED.nombre, nombre_corto = EXCLUDED.nombre_corto, comentarios = EXCLUDED.comentarios, updated_at = NOW()
  `, [platoId, idiomaId, nombre || null, (nombreCorto || '').slice(0, 25) || null, comentarios || null]);
}

// ========== PLATOS (para menús; eventualmente escandallo de productos) ==========
app.get('/api/platos', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const cajaId = req.query.caja_id ? parseInt(req.query.caja_id, 10) : null;
    const searchPattern = `%${q}%`;
    const { rows } = await pool.query(q
      ? `
      SELECT p.*, f.nombre as familia_nombre, f.curso as familia_curso, zp.nombre as zona_preparacion_nombre,
             pr.nombre as proveedor_principal_nombre,
             (SELECT COALESCE(json_agg(fm.id), '[]'::json) FROM plato_familias_menu pfm
              JOIN familias_menu fm ON fm.id = pfm.familia_menu_id AND fm.activo
              WHERE pfm.plato_id = p.id) as familia_menu_ids
      FROM platos p
      LEFT JOIN familias f ON f.id = p.familia_id
      LEFT JOIN zonas_preparacion zp ON zp.id = p.zona_preparacion_id
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_principal_id
      WHERE p.activo AND (p.nombre ILIKE $1 OR p.nombre_corto ILIKE $1 OR p.codigo ILIKE $1)
      ORDER BY f.orden, p.orden, p.nombre
      LIMIT 100
    `
      : `
      SELECT p.*, f.nombre as familia_nombre, f.curso as familia_curso, zp.nombre as zona_preparacion_nombre,
             pr.nombre as proveedor_principal_nombre,
             (SELECT COALESCE(json_agg(fm.id), '[]'::json) FROM plato_familias_menu pfm
              JOIN familias_menu fm ON fm.id = pfm.familia_menu_id AND fm.activo
              WHERE pfm.plato_id = p.id) as familia_menu_ids
      FROM platos p
      LEFT JOIN familias f ON f.id = p.familia_id
      LEFT JOIN zonas_preparacion zp ON zp.id = p.zona_preparacion_id
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_principal_id
      WHERE p.activo
      ORDER BY f.orden, p.orden, p.nombre
    `, q ? [searchPattern] : []);
    rows.forEach((r) => { r.familia_menu_ids = r.familia_menu_ids || []; if (typeof r.familia_menu_ids === 'string') r.familia_menu_ids = JSON.parse(r.familia_menu_ids || '[]'); });
    if (cajaId) {
      const { rows: exRows } = await pool.query(
        'SELECT plato_id, precio_base, precio_suplemento_menu FROM caja_plato_precio WHERE caja_id = $1',
        [cajaId]
      );
      const exMap = exRows.reduce((m, e) => { m[e.plato_id] = e; return m; }, {});
      rows.forEach((r) => {
        const ex = exMap[r.id];
        if (ex) { r.precio_base = parseFloat(ex.precio_base) || 0; r.precio_suplemento_menu = parseFloat(ex.precio_suplemento_menu) || 0; }
      });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/platos/:id/idiomas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pi.*, i.codigo as idioma_codigo, i.nombre as idioma_nombre
      FROM platos_idiomas pi
      JOIN idiomas i ON i.id = pi.idioma_id
      WHERE pi.plato_id = $1
      ORDER BY i.nombre
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/platos/:id/idiomas', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : (req.body?.items || []);
  const platoId = parseInt(req.params.id, 10);
  try {
    for (const it of items) {
      const idiomaId = it.idioma_id;
      const nombre = it.nombre || null;
      const nombreCorto = (it.nombre_corto || '').slice(0, 25) || null;
      const comentarios = it.comentarios || null;
      if (!idiomaId) continue;
      await pool.query(`
        INSERT INTO platos_idiomas (plato_id, idioma_id, nombre, nombre_corto, comentarios, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (plato_id, idioma_id) DO UPDATE SET
          nombre = EXCLUDED.nombre, nombre_corto = EXCLUDED.nombre_corto, comentarios = EXCLUDED.comentarios, updated_at = NOW()
      `, [platoId, idiomaId, nombre, nombreCorto, comentarios]);
    }
    const { rows } = await pool.query(`
      SELECT pi.*, i.codigo as idioma_codigo, i.nombre as idioma_nombre
      FROM platos_idiomas pi
      JOIN idiomas i ON i.id = pi.idioma_id
      WHERE pi.plato_id = $1 ORDER BY i.nombre
    `, [platoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/platos', async (req, res) => {
  const body = req.body || {};
  const codigo = body.codigo;
  const nombre = body.nombre;
  const nombre_corto = (body.nombre_corto || '').slice(0, 25) || null;
  const comentarios = body.comentarios || null;
  const familia_id = body.familia_id || null;
  const empresa_id = body.empresa_id || null;
  const precio_base = body.precio_base ?? 0;
  const precio_suplemento_menu = body.precio_suplemento_menu ?? 0;
  const zona_preparacion_id = (body.zona_preparacion_id && body.zona_preparacion_id !== '') ? body.zona_preparacion_id : null;
  const ruta_imagen = body.ruta_imagen || null;
  const proveedor_principal_id = (body.proveedor_principal_id && body.proveedor_principal_id !== '') ? body.proveedor_principal_id : null;
  const alergenos = (body.alergenos && String(body.alergenos).trim()) ? String(body.alergenos).trim() : null;
  const apto_celiaco = !!body.apto_celiaco;
  const vegetariano = !!body.vegetariano;
  const vegano = !!body.vegano;
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO platos (codigo, nombre, nombre_corto, comentarios, familia_id, empresa_id, precio_base, precio_suplemento_menu, zona_preparacion_id, ruta_imagen, proveedor_principal_id, alergenos, apto_celiaco, vegetariano, vegano)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *
    `, [codigo, nombre, nombre_corto, comentarios, familia_id || null, empresa_id || null, precio_base, precio_suplemento_menu, zona_preparacion_id || null, ruta_imagen || null, proveedor_principal_id || null, alergenos || null, apto_celiaco, vegetariano, vegano]);
    const plato = rows[0];
    await syncPlatoIdiomaBase(plato.id, nombre, nombre_corto, comentarios, plato.empresa_id);
    res.status(201).json(plato);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/platos/:id', async (req, res) => {
  const body = req.body || {};
  const codigo = body.codigo;
  const nombre = body.nombre;
  const nombre_corto = body.nombre_corto !== undefined ? (String(body.nombre_corto || '').slice(0, 25) || null) : null;
  const comentarios = body.comentarios !== undefined ? (body.comentarios || null) : null;
  const familia_id = body.familia_id || null;
  const precio_base = body.precio_base;
  const precio_suplemento_menu = body.precio_suplemento_menu;
  const zona_preparacion_id = (body.zona_preparacion_id && body.zona_preparacion_id !== '') ? body.zona_preparacion_id : null;
  const ruta_imagen = body.ruta_imagen || null;
  const proveedor_principal_id = (body.proveedor_principal_id && body.proveedor_principal_id !== '') ? body.proveedor_principal_id : null;
  const alergenos = body.alergenos !== undefined ? (String(body.alergenos).trim() || null) : null;
  const apto_celiaco = !!body.apto_celiaco;
  const vegetariano = !!body.vegetariano;
  const vegano = !!body.vegano;
  try {
    const { rows } = await pool.query(`
      UPDATE platos SET
        codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), nombre_corto=COALESCE($3,nombre_corto), comentarios=COALESCE($4,comentarios),
        familia_id=COALESCE($5,familia_id), precio_base=COALESCE($6,precio_base), precio_suplemento_menu=COALESCE($7,precio_suplemento_menu),
        zona_preparacion_id=COALESCE($8,zona_preparacion_id), ruta_imagen=COALESCE($9,ruta_imagen),
        proveedor_principal_id=COALESCE($10,proveedor_principal_id), alergenos=$11, apto_celiaco=$12, vegetariano=$13, vegano=$14, updated_at=NOW()
      WHERE id=$15 RETURNING *
    `, [codigo, nombre, nombre_corto, comentarios, familia_id, precio_base, precio_suplemento_menu, zona_preparacion_id, ruta_imagen, proveedor_principal_id, alergenos, apto_celiaco, vegetariano, vegano, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Plato no encontrado' });
    const plato = rows[0];
    await syncPlatoIdiomaBase(plato.id, plato.nombre, plato.nombre_corto, plato.comentarios, plato.empresa_id);
    res.json(plato);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/platos/:id', async (req, res) => {
  try {
    await pool.query('UPDATE platos SET activo=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MENÚS ==========
app.get('/api/tipos-menu', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
        (SELECT COALESCE(json_agg(fm.id), '[]'::json) FROM tipo_menu_familias_menu tmfm
         JOIN familias_menu fm ON fm.id = tmfm.familia_menu_id AND fm.activo
         WHERE tmfm.tipo_menu_id = t.id) as familia_menu_ids
      FROM tipos_menu t WHERE t.activo ORDER BY t.orden, t.nombre
    `);
    rows.forEach((r) => { r.familia_menu_ids = r.familia_menu_ids || []; if (typeof r.familia_menu_ids === 'string') r.familia_menu_ids = JSON.parse(r.familia_menu_ids || '[]'); });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tipos-menu/:id/configuracion', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT curso, platos_por_persona FROM configuracion_menu
      WHERE tipo_menu_id = $1 ORDER BY 
        CASE curso WHEN 'entrante' THEN 1 WHEN 'primero' THEN 2 WHEN 'segundo' THEN 3 WHEN 'tercero' THEN 4 WHEN 'cuarto' THEN 5 ELSE 6 END
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tipos-menu', async (req, res) => {
  const { codigo, nombre, precio = 0, orden = 0 } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO tipos_menu (codigo, nombre, precio, orden) VALUES ($1, $2, $3, $4) RETURNING *
    `, [codigo, nombre, precio, orden || 0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tipos-menu/:id', async (req, res) => {
  const { codigo, nombre, precio, orden } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE tipos_menu SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), precio=COALESCE($3,precio), orden=COALESCE($4,orden)
      WHERE id=$5 RETURNING *
    `, [codigo, nombre, precio, orden, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Tipo de menú no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tipos-menu/:id', async (req, res) => {
  try {
    await pool.query('UPDATE tipos_menu SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CAJAS ==========
app.get('/api/cajas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cajas WHERE activo ORDER BY orden, nombre');
    res.json(rows);
  } catch (err) {
    if (err.message?.includes('cajas')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cajas', async (req, res) => {
  const { codigo, nombre, orden = 0 } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO cajas (codigo, nombre, orden) VALUES ($1, $2, $3) RETURNING *',
      [codigo, nombre, orden || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cajas/:id', async (req, res) => {
  const { codigo, nombre, orden } = req.body || {};
  try {
    const { rows } = await pool.query(
      'UPDATE cajas SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), orden=COALESCE($3,orden) WHERE id=$4 RETURNING *',
      [codigo, nombre, orden, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Caja no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cajas/:id', async (req, res) => {
  try {
    await pool.query('UPDATE cajas SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/usuarios/:id/cajas', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT c.id, c.codigo, c.nombre FROM usuario_cajas uc JOIN cajas c ON c.id = uc.caja_id WHERE uc.usuario_id = $1 AND c.activo ORDER BY c.orden',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.put('/api/usuarios/:id/cajas', async (req, res) => {
  const cajaIds = Array.isArray(req.body) ? req.body : (req.body?.caja_ids || []);
  try {
    await pool.query('DELETE FROM usuario_cajas WHERE usuario_id = $1', [req.params.id]);
    for (const cid of cajaIds) {
      if (cid) await pool.query('INSERT INTO usuario_cajas (usuario_id, caja_id) VALUES ($1, $2)', [req.params.id, cid]);
    }
    const { rows } = await pool.query(
      'SELECT c.id, c.codigo, c.nombre FROM usuario_cajas uc JOIN cajas c ON c.id = uc.caja_id WHERE uc.usuario_id = $1 ORDER BY c.orden',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/platos/:id/precios-caja', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT cpp.caja_id, cpp.plato_id, cpp.precio_base, cpp.precio_suplemento_menu, c.nombre as caja_nombre FROM caja_plato_precio cpp JOIN cajas c ON c.id = cpp.caja_id WHERE cpp.plato_id = $1',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.put('/api/platos/:id/precios-caja', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : (req.body?.precios || []);
  const platoId = parseInt(req.params.id, 10);
  try {
    await pool.query('DELETE FROM caja_plato_precio WHERE plato_id = $1', [platoId]);
    for (const it of items) {
      const { caja_id, precio_base, precio_suplemento_menu = 0 } = it || {};
      if (caja_id && precio_base != null) {
        await pool.query(
          'INSERT INTO caja_plato_precio (caja_id, plato_id, precio_base, precio_suplemento_menu) VALUES ($1, $2, $3, $4)',
          [caja_id, platoId, parseFloat(precio_base) || 0, parseFloat(precio_suplemento_menu) || 0]
        );
      }
    }
    const { rows } = await pool.query(
      'SELECT cpp.caja_id, cpp.plato_id, cpp.precio_base, cpp.precio_suplemento_menu, c.nombre as caja_nombre FROM caja_plato_precio cpp JOIN cajas c ON c.id = cpp.caja_id WHERE cpp.plato_id = $1',
      [platoId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== USUARIOS ==========
app.get('/api/usuarios', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.codigo, u.nombre, u.rol, u.idioma_id, u.ruta_foto, i.codigo as idioma_codigo
      FROM usuarios u
      LEFT JOIN idiomas i ON i.id = u.idioma_id
      WHERE u.activo ORDER BY u.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { codigo, nombre, rol = 'camarero', pin = '1234', idioma_id } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO usuarios (codigo, nombre, rol, idioma_id) VALUES ($1, $2, $3, $4) RETURNING *
    `, [codigo, nombre, rol || 'camarero', idioma_id || null]);
    const cfg = await pool.query("SELECT valor FROM config WHERE clave = 'pins'");
    let pins = cfg.rows[0]?.valor;
    if (typeof pins !== 'object' || pins === null) pins = {};
    pins = { ...pins, [String(rows[0].id)]: pin };
    await pool.query("INSERT INTO config (clave, valor, updated_at) VALUES ('pins', $1::jsonb, NOW()) ON CONFLICT (clave) DO UPDATE SET valor = $1::jsonb, updated_at = NOW()", [JSON.stringify(pins)]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { codigo, nombre, rol, idioma_id, ruta_foto } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE usuarios SET codigo=COALESCE($1,codigo), nombre=COALESCE($2,nombre), rol=COALESCE($3,rol), idioma_id=$4, ruta_foto=COALESCE($5,ruta_foto)
      WHERE id=$6 RETURNING *
    `, [codigo, nombre, rol, idioma_id ?? null, ruta_foto ?? null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    await pool.query('UPDATE usuarios SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Subir foto de usuario (base64 desde webcam)
app.post('/api/usuarios/:id/foto', async (req, res) => {
  const { imagen } = req.body || {};
  const usuarioId = parseInt(req.params.id, 10);
  if (!imagen || !usuarioId) return res.status(400).json({ error: 'imagen base64 requerida' });
  try {
    const base64Data = imagen.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64Data, 'base64');
    const imagenesDir = path.join(__dirname, '..', 'imagenes', 'usuarios');
    if (!fs.existsSync(imagenesDir)) fs.mkdirSync(imagenesDir, { recursive: true });
    const rutaRelativa = `usuarios/${usuarioId}.jpg`;
    const filePath = path.join(imagenesDir, `${usuarioId}.jpg`);
    fs.writeFileSync(filePath, buf);
    await pool.query('UPDATE usuarios SET ruta_foto=$1 WHERE id=$2', [rutaRelativa, usuarioId]);
    res.json({ ruta_foto: rutaRelativa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login camarero (verifica PIN)
app.post('/api/auth/login', async (req, res) => {
  const { usuario_id, pin } = req.body || {};
  if (!usuario_id || !pin) return res.status(400).json({ error: 'usuario_id y pin requeridos' });
  try {
    const { rows } = await pool.query(
      'SELECT id, codigo, nombre, rol, ruta_foto FROM usuarios WHERE id = $1 AND activo',
      [usuario_id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });
    const cfg = await pool.query("SELECT valor FROM config WHERE clave = 'pins'");
    const pins = cfg.rows[0]?.valor || {};
    const pinOk = pins[String(usuario_id)] === pin || pins[usuario_id] === pin;
    if (!pinOk) return res.status(401).json({ error: 'PIN incorrecto' });
    const user = rows[0];
    let cajas = [];
    try {
      const { rows: cRows } = await pool.query(
        'SELECT c.id, c.codigo, c.nombre FROM usuario_cajas uc JOIN cajas c ON c.id = uc.caja_id WHERE uc.usuario_id = $1 AND c.activo ORDER BY c.orden',
        [usuario_id]
      );
      cajas = cRows || [];
    } catch (_) {}
    if (cajas.length === 0) {
      const { rows: allCajas } = await pool.query('SELECT id, codigo, nombre FROM cajas WHERE activo ORDER BY orden LIMIT 1');
      if (allCajas[0]) cajas = [allCajas[0]];
    }
    res.json({ ...user, cajas });
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

// Menú de tablas configurable: apartados (Sistema, Maestros...) + items (cada mantenimiento con apartado_id)
const CONFIG_MENU_DEFAULT = {
  apartados: [
    { id: 'sistema', nombre: 'Sistema', orden: 0 },
    { id: 'maestros', nombre: 'Maestros', orden: 1 },
    { id: 'facturacion', nombre: 'Facturación', orden: 2 },
  ],
  items: [
    { id: 'empresas', apartado_id: 'sistema', orden: 0 },
    { id: 'zonas-preparacion', apartado_id: 'sistema', orden: 1 },
    { id: 'impresoras', apartado_id: 'sistema', orden: 2 },
    { id: 'idiomas', apartado_id: 'sistema', orden: 3 },
    { id: 'config-nav', apartado_id: 'sistema', orden: 4 },
    { id: 'proveedores', apartado_id: 'maestros', orden: 0 },
    { id: 'clientes', apartado_id: 'maestros', orden: 1 },
    { id: 'familias', apartado_id: 'maestros', orden: 2 },
    { id: 'productos', apartado_id: 'maestros', orden: 3 },
    { id: 'platos', apartado_id: 'maestros', orden: 4 },
    { id: 'tipos-menu', apartado_id: 'maestros', orden: 5 },
    { id: 'usuarios', apartado_id: 'maestros', orden: 6 },
    { id: 'familias-menu', apartado_id: 'maestros', orden: 7 },
    { id: 'apartados', apartado_id: 'maestros', orden: 8 },
    { id: 'config-menu', apartado_id: 'maestros', orden: 9 },
  ],
};

function migrateConfigMenu(val) {
  if (!val || !val.apartados) return CONFIG_MENU_DEFAULT;
  if (Array.isArray(val.items)) return val;
  const items = [];
  (val.apartados || []).forEach((ap, apIdx) => {
    (ap.items || []).forEach((itemId, ord) => {
      items.push({ id: itemId, apartado_id: ap.id || '', orden: ord });
    });
  });
  return {
    apartados: (val.apartados || []).map(({ id, nombre, orden }) => ({ id, nombre, orden: orden ?? 0 })),
    items,
  };
}

app.get('/api/config/menu', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT valor FROM config WHERE clave = 'config_menu'");
    const val = rows[0]?.valor;
    if (val && val.apartados && Array.isArray(val.apartados)) {
      return res.json(migrateConfigMenu(val));
    }
    res.json(CONFIG_MENU_DEFAULT);
  } catch (err) {
    res.json(CONFIG_MENU_DEFAULT);
  }
});

app.put('/api/config/menu', async (req, res) => {
  const body = req.body || {};
  const apartados = Array.isArray(body.apartados) ? body.apartados : CONFIG_MENU_DEFAULT.apartados;
  const items = Array.isArray(body.items) ? body.items : CONFIG_MENU_DEFAULT.items;
  try {
    await pool.query(
      `INSERT INTO config (clave, valor, updated_at) VALUES ('config_menu', $1::jsonb, NOW())
       ON CONFLICT (clave) DO UPDATE SET valor = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify({ apartados, items })]
    );
    res.json({ apartados, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Imágenes estáticas
const imagenesPath = path.join(__dirname, '..', 'imagenes');
if (fs.existsSync(imagenesPath)) {
  app.use('/imagenes', express.static(imagenesPath));
}

// Módulo caja web
const cajaPath = path.join(__dirname, '..', 'web', 'caja');
if (fs.existsSync(cajaPath)) {
  app.use('/caja', express.static(cajaPath));
}

// Iniciar servidor
app.listen(PORT, config.server?.host || '0.0.0.0', () => {
  console.log(`XenialRest API en http://0.0.0.0:${PORT}`);
});