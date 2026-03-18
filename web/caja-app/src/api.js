const API_BASE = 'http://localhost:3000'

// Datos demo cuando la API/BD no está disponible
const DEMO = {
  familias: [
    { id: 0, nombre: 'Menús', curso: 'menu', mostrar_pantalla_principal: true },
    { id: 1, nombre: 'Entrantes', curso: 'entrante', mostrar_pantalla_principal: true },
    { id: 2, nombre: 'Primeros', curso: 'primero', mostrar_pantalla_principal: true },
    { id: 3, nombre: 'Segundos', curso: 'segundo', mostrar_pantalla_principal: true },
    { id: 4, nombre: 'Postres', curso: 'tercero', mostrar_pantalla_principal: false },
    { id: 5, nombre: 'Bebidas', curso: 'cuarto', mostrar_pantalla_principal: true },
    { id: 6, nombre: 'Terceros', curso: 'tercero', mostrar_pantalla_principal: false },
    { id: 7, nombre: 'Cuartos', curso: 'cuarto', mostrar_pantalla_principal: false },
  ],
  platos: [
    { id: 1, familia_id: 1, familia_nombre: 'Entrantes', nombre: 'Ensalada mixta', precio_base: 6.5, precio_suplemento_menu: 0, familia_curso: 'entrante', familia_menu_ids: [1] },
    { id: 2, familia_id: 1, familia_nombre: 'Entrantes', nombre: 'Bruschetta', precio_base: 5, precio_suplemento_menu: 0, familia_curso: 'entrante', familia_menu_ids: [1] },
    { id: 3, familia_id: 2, familia_nombre: 'Primeros', nombre: 'Paella valenciana', precio_base: 14, precio_suplemento_menu: 2, familia_curso: 'primero', familia_menu_ids: [1] },
    { id: 4, familia_id: 2, familia_nombre: 'Primeros', nombre: 'Sopa de marisco', precio_base: 8.5, precio_suplemento_menu: 0, familia_curso: 'primero', familia_menu_ids: [1] },
    { id: 5, familia_id: 3, familia_nombre: 'Segundos', nombre: 'Lomo al stroganoff', precio_base: 16, precio_suplemento_menu: 3, familia_curso: 'segundo', familia_menu_ids: [1] },
    { id: 6, familia_id: 3, familia_nombre: 'Segundos', nombre: 'Pollo al horno', precio_base: 12, precio_suplemento_menu: 0, familia_curso: 'segundo', familia_menu_ids: [1] },
    { id: 7, familia_id: 4, familia_nombre: 'Postres', nombre: 'Tarta de queso', precio_base: 5.5, precio_suplemento_menu: 0, familia_curso: 'tercero', familia_menu_ids: [1] },
    { id: 8, familia_id: 5, familia_nombre: 'Bebidas', nombre: 'Agua mineral', precio_base: 2, precio_suplemento_menu: 0, familia_curso: 'cuarto', familia_menu_ids: [1] },
    { id: 9, familia_id: 5, familia_nombre: 'Bebidas', nombre: 'Coca-Cola', precio_base: 2.5, precio_suplemento_menu: 0, familia_curso: 'cuarto', familia_menu_ids: [1] },
    { id: 10, familia_id: 5, familia_nombre: 'Bebidas', nombre: 'Cerveza', precio_base: 3, precio_suplemento_menu: 0.5, familia_curso: 'cuarto', familia_menu_ids: [1] },
  ],
  productos: [
    { id: 1, familia_id: 1, nombre: 'Ensalada mixta', precio_base: 6.5, precio_suplemento_menu: 0, activo: true, familia_curso: 'entrante' },
    { id: 2, familia_id: 1, nombre: 'Bruschetta', precio_base: 5, precio_suplemento_menu: 0, activo: true, familia_curso: 'entrante' },
    { id: 3, familia_id: 2, nombre: 'Paella valenciana', precio_base: 14, precio_suplemento_menu: 2, activo: true, familia_curso: 'primero' },
    { id: 4, familia_id: 2, nombre: 'Sopa de marisco', precio_base: 8.5, precio_suplemento_menu: 0, activo: true, familia_curso: 'primero' },
    { id: 5, familia_id: 3, nombre: 'Lomo al stroganoff', precio_base: 16, precio_suplemento_menu: 3, activo: true, familia_curso: 'segundo' },
    { id: 6, familia_id: 3, nombre: 'Pollo al horno', precio_base: 12, precio_suplemento_menu: 0, activo: true, familia_curso: 'segundo' },
    { id: 7, familia_id: 4, nombre: 'Tarta de queso', precio_base: 5.5, precio_suplemento_menu: 0, activo: true, familia_curso: 'tercero' },
    { id: 8, familia_id: 5, nombre: 'Agua mineral', precio_base: 2, precio_suplemento_menu: 0, activo: true, familia_curso: 'cuarto' },
    { id: 9, familia_id: 5, nombre: 'Coca-Cola', precio_base: 2.5, precio_suplemento_menu: 0, activo: true, familia_curso: 'cuarto' },
    { id: 10, familia_id: 5, nombre: 'Cerveza', precio_base: 3, precio_suplemento_menu: 0.5, activo: true, familia_curso: 'cuarto' },
  ],
  mesas: (() => {
    const salones = ['Salón 1', 'Salón 2', 'Salón 3', 'Salón 4', 'Salón 5', 'Salón 6', 'Salón 7', 'Salón 8', 'Salón 9', 'Salón 10']
    const mesas = []
    for (let i = 1; i <= 300; i++) {
      mesas.push({
        id: i,
        codigo: String(i),
        nombre: `Mesa ${i}`,
        salon_nombre: salones[Math.floor((i - 1) / 30) % salones.length],
        estado: 'libre',
      })
    }
    return mesas
  })(),
  tiposMenu: [
    { id: 1, codigo: 'DIARIO', nombre: 'Menu diario', orden: 1, precio: 12, familia_menu_ids: [1] },
    { id: 2, codigo: 'FIN_SEMANA', nombre: 'Menu fin de semana', orden: 2, precio: 15, familia_menu_ids: [1] },
    { id: 3, codigo: 'ESPECIAL', nombre: 'Menu especial', orden: 3, precio: 18, familia_menu_ids: [1] },
    { id: 4, codigo: 'NOCHE', nombre: 'Menu noche', orden: 4, precio: 14, familia_menu_ids: [1] },
  ],
  configuracionMenu: {
    1: [
      { curso: 'entrante', platos_por_persona: 1 },
      { curso: 'primero', platos_por_persona: 1 },
      { curso: 'segundo', platos_por_persona: 1 },
      { curso: 'tercero', platos_por_persona: 1 },
      { curso: 'cuarto', platos_por_persona: 1 },
    ],
    2: [
      { curso: 'entrante', platos_por_persona: 1 },
      { curso: 'primero', platos_por_persona: 2 },
      { curso: 'segundo', platos_por_persona: 1 },
      { curso: 'tercero', platos_por_persona: 1 },
      { curso: 'cuarto', platos_por_persona: 1 },
    ],
    3: [
      { curso: 'entrante', platos_por_persona: 1 },
      { curso: 'primero', platos_por_persona: 1 },
      { curso: 'segundo', platos_por_persona: 1 },
      { curso: 'tercero', platos_por_persona: 1 },
      { curso: 'cuarto', platos_por_persona: 1 },
    ],
    4: [
      { curso: 'entrante', platos_por_persona: 1 },
      { curso: 'primero', platos_por_persona: 1 },
      { curso: 'segundo', platos_por_persona: 1 },
      { curso: 'tercero', platos_por_persona: 1 },
      { curso: 'cuarto', platos_por_persona: 1 },
    ],
  },
  empresas: [
    { id: 1, codigo: 'DEFAULT', nombre: 'Empresa principal', cif_nif: '', direccion: '', codigo_postal: '', localidad: '', provincia: '', telefono: '', email: '', ruta_logo: null },
  ],
  zonasPreparacion: [
    { id: 1, empresa_id: 1, codigo: 'COCINA', nombre: 'Cocina principal', impresora_id: 1, ip_host: '192.168.1.10', impresora_nombre: 'Cocina', impresora_ip: '192.168.1.10' },
  ],
  impresoras: [
    { id: 1, codigo: 'COC1', nombre: 'Cocina', tipo: 'cocina', ip_host: '192.168.1.10', puerto: 9100 },
  ],
  idiomas: [
    { id: 1, codigo: 'es', nombre: 'Español' },
    { id: 2, codigo: 'en', nombre: 'English' },
    { id: 3, codigo: 'ca', nombre: 'Català' },
  ],
  proveedores: [
    { id: 1, codigo: 'PROV1', nombre: 'Proveedor principal', contacto: '', telefono: '', email: '' },
  ],
  clientes: [],
  familiasMenu: [
    { id: 1, codigo: 'ESTANDAR', nombre: 'Estándar', orden: 1 },
  ],
  usuarios: [
    { id: 1, codigo: 'CAM1', nombre: 'Camarero 1', pin: '1234', rol: 'camarero' },
    { id: 2, codigo: 'CAM2', nombre: 'Camarero 2', pin: '1234', rol: 'camarero' },
    { id: 3, codigo: 'CAM3', nombre: 'Camarero 3', pin: '1234', rol: 'camarero' },
    { id: 4, codigo: 'ADM1', nombre: 'Administrador', pin: '1234', rol: 'admin' },
  ],
}

export const DEMO_USUARIOS = [
  { id: 1, codigo: 'CAM1', nombre: 'Camarero 1', pin: '1234', rol: 'camarero' },
  { id: 2, codigo: 'CAM2', nombre: 'Camarero 2', pin: '1234', rol: 'camarero' },
  { id: 3, codigo: 'CAM3', nombre: 'Camarero 3', pin: '1234', rol: 'camarero' },
  { id: 4, codigo: 'ADM1', nombre: 'Administrador', pin: '1234', rol: 'admin' },
]

export async function fetchApi(url) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  try {
    const res = await fetch(fullUrl)
    if (!res.ok) throw new Error(res.statusText)
    return res.json()
  } catch (err) {
    if (url?.includes('tipos-menu') && url?.includes('configuracion')) {
      const id = url.match(/tipos-menu\/(\d+)/)?.[1] || '1'
      return DEMO.configuracionMenu[id] || DEMO.configuracionMenu[1]
    }
    if (url?.includes('tipos-menu') && url?.includes('apartados')) {
      return []
    }
    if (url === '/api/familias') return DEMO.familias
    if (url === '/api/productos') return DEMO.productos
    if (url?.startsWith('/api/platos')) return DEMO.platos || DEMO.productos
    if (url === '/api/mesas') return DEMO.mesas
    if (url === '/api/usuarios') return DEMO.usuarios
    if (url === '/api/tipos-menu') return DEMO.tiposMenu
    if (url === '/api/empresas') return DEMO.empresas
    if (url === '/api/zonas-preparacion') return DEMO.zonasPreparacion
    if (url === '/api/impresoras') return DEMO.impresoras
    if (url === '/api/idiomas') return DEMO.idiomas
    if (url === '/api/proveedores') return DEMO.proveedores
    if (url === '/api/clientes') return DEMO.clientes
    if (url === '/api/familias-menu') return DEMO.familiasMenu || []
    if (url === '/api/apartados') return []
    if (url === '/api/formas-pago') return [{ id: 1, codigo: 'EFECTIVO', nombre: 'Efectivo' }, { id: 2, codigo: 'TARJETA', nombre: 'Tarjeta' }]
    if (url?.includes('/api/config/menu')) {
      const local = (() => {
        for (const st of [localStorage, sessionStorage]) {
          try { const s = st?.getItem('xenialrest_config_menu'); if (s) { const d = JSON.parse(s); if (d?.apartados?.length) return d } } catch {}
        }
        return null
      })()
      if (local) return local
      return {
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
      }
    }
    throw err
  }
}

export async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    const data = await res.json()
    return data?.ok === true
  } catch {
    return false
  }
}

async function apiError(res) {
  let msg = res.statusText
  try {
    const data = await res.json()
    if (data?.error) msg = data.error
  } catch (_) {}
  return new Error(msg)
}

export async function postApi(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await apiError(res)
  return res.json()
}

export async function patchApi(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await apiError(res)
  return res.json()
}

export async function putApi(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await apiError(res)
  return res.json()
}

export async function deleteApi(url) {
  const res = await fetch(`${API_BASE}${url}`, { method: 'DELETE' })
  if (!res.ok) throw await apiError(res)
  return res.json()
}

export async function login(usuarioId, pin, modoDemo = false) {
  if (modoDemo) {
    const u = DEMO.usuarios.find((x) => x.id === usuarioId)
    if (u && u.pin === pin) {
      return { id: u.id, codigo: u.codigo, nombre: u.nombre, rol: u.rol || 'camarero', cajas: [{ id: 1, codigo: 'CAJA1', nombre: 'Caja 1' }] }
    }
    throw new Error('PIN incorrecto')
  }
  return postApi('/api/auth/login', { usuario_id: usuarioId, pin })
}


export function getImagenUrl(ruta) {
  if (!ruta) return null
  return `${API_BASE}/imagenes/${ruta}`
}
