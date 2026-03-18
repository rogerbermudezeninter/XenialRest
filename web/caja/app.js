/**
 * XenialRest - Módulo Caja
 * Familias, selector de productos y detalle del pedido
 */

const API_BASE = window.location.origin;

const state = {
  familias: [],
  productos: [],
  mesas: [],
  usuarios: [],
  ticketActual: null,
  lineas: [],
  familiaSeleccionada: null,
};

// DOM
const elementos = {
  fechaHora: document.getElementById('fecha-hora'),
  status: document.getElementById('status'),
  selectMesa: document.getElementById('select-mesa'),
  selectCamarero: document.getElementById('select-camarero'),
  inputComensales: document.getElementById('input-comensales'),
  pedidoLineas: document.getElementById('pedido-lineas'),
  totalUnidades: document.getElementById('total-unidades'),
  totalLineas: document.getElementById('total-lineas'),
  totalImporte: document.getElementById('total-importe'),
  btnAbrirMesa: document.getElementById('btn-abrir-mesa'),
  btnEnviarCocina: document.getElementById('btn-enviar-cocina'),
  btnCobrar: document.getElementById('btn-cobrar'),
  familias: document.getElementById('familias'),
  productosGrid: document.getElementById('productos-grid'),
};

// Utilidades
async function fetchApi(url) {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatPrecio(n) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' €';
}

function actualizarReloj() {
  const now = new Date();
  elementos.fechaHora.textContent = now.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Carga datos
async function cargarDatos() {
  try {
    const [familias, productos, mesas, usuarios] = await Promise.all([
      fetchApi('/api/familias').catch(() => []),
      fetchApi('/api/productos'),
      fetchApi('/api/mesas'),
      fetchApi('/api/usuarios').catch(() => []),
    ]);

    state.familias = familias;
    state.productos = productos;
    state.mesas = mesas;
    state.usuarios = usuarios;
    elementos.status.textContent = 'Conectado';
    elementos.status.className = 'status conectado';
    return true;
  } catch (err) {
    console.error(err);
    elementos.status.textContent = 'Error de conexión';
    elementos.status.className = 'status error';
    return false;
  }
}

// Renderizar familias
function renderFamilias() {
  const todos = { id: '', nombre: 'Todos' };
  const familias = [todos, ...state.familias];

  elementos.familias.innerHTML = familias.map((f) => `
    <button class="familia-btn ${state.familiaSeleccionada === f.id ? 'active' : ''}" data-id="${f.id}">
      ${f.nombre}
    </button>
  `).join('');

  elementos.familias.querySelectorAll('.familia-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.familiaSeleccionada = btn.dataset.id || null;
      elementos.familias.querySelectorAll('.familia-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderProductos();
    });
  });
}

// Renderizar productos
function renderProductos() {
  let productos = state.productos;
  if (state.familiaSeleccionada) {
    productos = productos.filter((p) => p.familia_id === parseInt(state.familiaSeleccionada, 10));
  }

  elementos.productosGrid.innerHTML = productos.map((p) => {
    const imgHtml = p.ruta_imagen
      ? `<img class="producto-img" src="${API_BASE}/imagenes/${p.ruta_imagen}" alt="${p.nombre}" onerror="this.outerHTML='<div class=\\'producto-placeholder\\'>🍽️</div>'">`
      : '<div class="producto-placeholder">🍽️</div>';
    const noDisponible = !p.activo ? ' no-disponible' : '';
    return `
      <div class="producto-card${noDisponible}" data-id="${p.id}" data-precio="${p.precio_base}" data-nombre="${escapeHtml(p.nombre)}">
        <div class="producto-img-wrap">${imgHtml}</div>
        <div class="producto-info">
          <div class="producto-nombre">${escapeHtml(p.nombre)}</div>
          <div class="producto-precio">${formatPrecio(p.precio_base)}</div>
        </div>
      </div>
    `;
  }).join('');

  elementos.productosGrid.querySelectorAll('.producto-card:not(.no-disponible)').forEach((card) => {
    card.addEventListener('click', () => añadirProducto({
      id: parseInt(card.dataset.id, 10),
      nombre: card.dataset.nombre,
      precio: parseFloat(card.dataset.precio),
    }));
  });
}

// Añadir producto al pedido
function añadirProducto(producto) {
  if (!state.ticketActual) {
    alert('Primero selecciona una mesa y ábrela.');
    return;
  }

  const existente = state.lineas.find((l) => l.producto_id === producto.id && !l.notas);
  if (existente) {
    existente.cantidad += 1;
    existente.importe = existente.precio_unitario * existente.cantidad;
  } else {
    state.lineas.push({
      producto_id: producto.id,
      descripcion: producto.nombre,
      cantidad: 1,
      precio_unitario: producto.precio,
      importe: producto.precio,
    });
  }
  renderPedido();
  guardarLineas();
}

function quitarCantidad(index) {
  const linea = state.lineas[index];
  linea.cantidad -= 1;
  if (linea.cantidad <= 0) {
    state.lineas.splice(index, 1);
  } else {
    linea.importe = linea.precio_unitario * linea.cantidad;
  }
  renderPedido();
  guardarLineas();
}

function sumarCantidad(index) {
  const linea = state.lineas[index];
  linea.cantidad += 1;
  linea.importe = linea.precio_unitario * linea.cantidad;
  renderPedido();
  guardarLineas();
}

async function guardarLineas() {
  if (!state.ticketActual || state.lineas.length === 0) return;
  const pendientes = state.lineas.filter((l) => !l.id);
  for (const l of pendientes) {
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${state.ticketActual.id}/lineas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: l.producto_id,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        }),
      });
      const creada = await res.json();
      l.id = creada.id;
    } catch (e) {
      console.error('Error guardando línea:', e);
    }
  }
}

// Renderizar panel pedido
function renderPedido() {
  const totalUnidades = state.lineas.reduce((s, l) => s + l.cantidad, 0);
  const totalImporte = state.lineas.reduce((s, l) => s + l.importe, 0);

  elementos.totalUnidades.textContent = totalUnidades.toFixed(2);
  elementos.totalLineas.textContent = state.lineas.length;
  elementos.totalImporte.textContent = formatPrecio(totalImporte);

  if (state.lineas.length === 0) {
    elementos.pedidoLineas.innerHTML = '<p class="pedido-vacio">Selecciona una mesa y añade productos</p>';
  } else {
    elementos.pedidoLineas.innerHTML = state.lineas.map((l, i) => `
      <div class="linea-item">
        <div class="linea-info">
          <div class="linea-desc">${l.descripcion}</div>
          <div class="linea-detalle">${formatPrecio(l.precio_unitario)} × ${l.cantidad}</div>
        </div>
        <div class="linea-cantidad">
          <button type="button" data-action="menos" data-index="${i}">−</button>
          <span>${l.cantidad}</span>
          <button type="button" data-action="mas" data-index="${i}">+</button>
        </div>
        <div class="linea-importe">${formatPrecio(l.importe)}</div>
      </div>
    `).join('');

    elementos.pedidoLineas.querySelectorAll('[data-action="menos"]').forEach((btn) => {
      btn.addEventListener('click', () => quitarCantidad(parseInt(btn.dataset.index, 10)));
    });
    elementos.pedidoLineas.querySelectorAll('[data-action="mas"]').forEach((btn) => {
      btn.addEventListener('click', () => sumarCantidad(parseInt(btn.dataset.index, 10)));
    });
  }

  elementos.btnEnviarCocina.disabled = !state.ticketActual || state.lineas.length === 0;
  elementos.btnCobrar.disabled = !state.ticketActual || state.lineas.length === 0;
}

// Rellenar selects
function rellenarSelects() {
  elementos.selectMesa.innerHTML = '<option value="">-- Seleccionar mesa --</option>' +
    state.mesas.filter((m) => m.estado === 'libre').map((m) =>
      `<option value="${m.id}">${m.salon_nombre} - ${m.nombre}</option>`
    ).join('');

  elementos.selectCamarero.innerHTML = '<option value="">-- Sin asignar --</option>' +
    state.usuarios.map((u) => `<option value="${u.id}">${u.nombre}</option>`).join('');
}

// Abrir mesa
async function abrirMesa() {
  const mesaId = elementos.selectMesa.value;
  if (!mesaId) {
    alert('Selecciona una mesa.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mesa_id: parseInt(mesaId, 10),
        camarero_id: elementos.selectCamarero.value || null,
        comensales: parseInt(elementos.inputComensales.value, 10) || 1,
      }),
    });
    const ticket = await res.json();
    state.ticketActual = ticket;
    state.lineas = [];
    renderPedido();
    rellenarSelects();
    elementos.btnAbrirMesa.textContent = 'Mesa abierta';
    elementos.btnAbrirMesa.disabled = true;
  } catch (e) {
    alert('Error al abrir mesa: ' + e.message);
  }
}

// Enviar a cocina
async function enviarCocina() {
  if (!state.ticketActual) return;
  try {
    await fetch(`${API_BASE}/api/tickets/${state.ticketActual.id}/enviar-cocina`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    state.ticketActual = null;
    state.lineas = [];
    renderPedido();
    rellenarSelects();
    elementos.btnAbrirMesa.textContent = 'Abrir mesa';
    elementos.btnAbrirMesa.disabled = false;
    alert('Pedido enviado a cocina.');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Cobrar (pendiente: integrar pantalla de cobro)
function cobrar() {
  if (!state.ticketActual) return;
  alert(`Cobro del ticket #${state.ticketActual.id}\n\nLa pantalla de cobro se integrará en una próxima actualización.\nPor ahora usa POST /api/tickets/:id/pagos para registrar pagos.`);
}

// Init
async function init() {
  setInterval(actualizarReloj, 1000);
  actualizarReloj();

  const ok = await cargarDatos();
  if (!ok) return;

  rellenarSelects();
  renderFamilias();
  renderProductos();

  elementos.btnAbrirMesa.addEventListener('click', abrirMesa);
  elementos.btnEnviarCocina.addEventListener('click', enviarCocina);
  elementos.btnCobrar.addEventListener('click', cobrar);
}

init();
