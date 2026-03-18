import React, { useState, useRef, useEffect } from 'react'
import { fetchApi, postApi, putApi, deleteApi, getImagenUrl } from '../api'
import InputWithKeyboard from './InputWithKeyboard'
import CameraModal from './CameraModal'

const ALLERGENOS_LIST = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'crustaceos', label: 'Crustáceos' },
  { id: 'huevos', label: 'Huevos' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'cacahuetes', label: 'Cacahuetes' },
  { id: 'soja', label: 'Soja' },
  { id: 'leche', label: 'Leche' },
  { id: 'frutos_cascara', label: 'Frutos de cáscara' },
  { id: 'apio', label: 'Apio' },
  { id: 'mostaza', label: 'Mostaza' },
  { id: 'sesamo', label: 'Sésamo' },
  { id: 'sulfitos', label: 'Sulfitos' },
  { id: 'altramuces', label: 'Altramuces' },
  { id: 'moluscos', label: 'Moluscos' },
]

const MENU_ITEMS = [
  { id: 'empresas', label: 'Empresas' },
  { id: 'cajas', label: 'Cajas' },
  { id: 'zonas-preparacion', label: 'Zonas preparación' },
  { id: 'impresoras', label: 'Impresoras' },
  { id: 'idiomas', label: 'Idiomas' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'familias', label: 'Familias (carta)' },
  { id: 'productos', label: 'Productos' },
  { id: 'platos', label: 'Platos (menús)' },
  { id: 'tipos-menu', label: 'Tipos de menú' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'familias-menu', label: 'Familias de menú' },
  { id: 'apartados', label: 'Apartados' },
  { id: 'config-menu', label: 'Config. menús' },
  { id: 'config-nav', label: 'Config. navegación' },
]

const CONFIG_MENU_STORAGE_KEY = 'xenialrest_config_menu'

function loadConfigMenuFromStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const s = storage?.getItem(CONFIG_MENU_STORAGE_KEY)
      if (s) {
        const d = JSON.parse(s)
        if (d?.apartados?.length) return d
      }
    } catch (_) {}
  }
  return null
}

function saveConfigMenuToStorage(data) {
  const json = JSON.stringify(data)
  for (const storage of [localStorage, sessionStorage]) {
    try {
      if (storage) {
        storage.setItem(CONFIG_MENU_STORAGE_KEY, json)
        return true
      }
    } catch (e) {
      console.warn('Storage falló:', e)
    }
  }
  return false
}

const CONFIG_MENU_DEFAULT = {
  apartados: [
    { id: 'sistema', nombre: 'Sistema', orden: 0 },
    { id: 'maestros', nombre: 'Maestros', orden: 1 },
    { id: 'facturacion', nombre: 'Facturación', orden: 2 },
  ],
  items: [
    { id: 'empresas', apartado_id: 'sistema', orden: 0 },
    { id: 'cajas', apartado_id: 'sistema', orden: 1 },
    { id: 'zonas-preparacion', apartado_id: 'sistema', orden: 2 },
    { id: 'impresoras', apartado_id: 'sistema', orden: 3 },
    { id: 'idiomas', apartado_id: 'sistema', orden: 4 },
    { id: 'config-nav', apartado_id: 'sistema', orden: 5 },
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

function buildMenuFromConfig(config) {
  const apartados = [...(config.apartados || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  if (Array.isArray(config.items)) {
    return apartados.map((ap) => ({
      ...ap,
      items: config.items
        .filter((i) => i.apartado_id === ap.id)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map((i) => i.id),
    }))
  }
  return apartados.map((ap) => ({ ...ap, items: ap.items || [] }))
}

export default function ConfigPanel({
  familias,
  productos,
  platos,
  tiposMenu,
  usuarios,
  empresas,
  cajas,
  zonasPreparacion,
  impresoras,
  idiomas,
  proveedores,
  clientes,
  familiasMenu,
  apartados,
  onCerrar,
  onRefrescar,
  onProductoActualizado,
  onPlatoActualizado,
  onUsuarioFotoActualizada,
}) {
  const [tab, setTab] = useState('empresas')
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({})
  const formDataRef = useRef(formData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [configMenu, setConfigMenu] = useState(() => loadConfigMenuFromStorage() || CONFIG_MENU_DEFAULT)
  const [menuExpandidos, setMenuExpandidos] = useState(() => new Set(['sistema', 'maestros']))

  useEffect(() => { formDataRef.current = formData }, [formData])

  function toggleMenuApartado(apId) {
    setMenuExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(apId)) next.delete(apId)
      else next.add(apId)
      return next
    })
  }

  useEffect(() => {
    const local = loadConfigMenuFromStorage()
    fetchApi('/api/config/menu')
      .then((d) => {
        const esDefault = !d?.apartados?.length || (
          d.apartados.length === 3 &&
          d.apartados.every((a, i) => a.id === CONFIG_MENU_DEFAULT.apartados[i]?.id)
        )
        if (local?.apartados?.length && esDefault) {
          setConfigMenu(local)
        } else if (d?.apartados?.length) {
          setConfigMenu(d)
        }
      })
      .catch(() => {
        if (local) setConfigMenu(local)
      })
  }, [])

  const list = {
    empresas: empresas || [],
    cajas: cajas || [],
    'zonas-preparacion': zonasPreparacion || [],
    impresoras: impresoras || [],
    idiomas: idiomas || [],
    proveedores: proveedores || [],
    clientes: clientes || [],
    familias: familias || [],
    productos: productos || [],
    platos: platos || [],
    'tipos-menu': tiposMenu || [],
    usuarios: usuarios || [],
    'familias-menu': familiasMenu || [],
    apartados: apartados || [],
  }[tab]

  function openNew() {
    setEditing('new')
    const data = getDefaultForm(tab)
    formDataRef.current = data
    setFormData(data)
    setError(null)
  }

  function openEdit(item) {
    setEditing(item.id)
    const data = itemToForm(item, tab)
    formDataRef.current = data
    setFormData(data)
    setError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setFormData({})
    setError(null)
  }

  async function handleSave(incomingData) {
    let data = incomingData ?? formDataRef.current
    if (tab === 'apartados' && (!data?.nombre || !String(data.nombre).trim())) {
      setError('El nombre del apartado es obligatorio')
      return
    }
    if ((tab === 'productos' || tab === 'platos') && data) {
      data = {
        ...data,
        vegetariano: data.vegetariano === true,
        vegano: data.vegano === true,
        apto_celiaco: data.apto_celiaco === true,
        alergenos: Array.isArray(data.alergenos) ? data.alergenos.join(',') : (data.alergenos || '')
      }
    }
    const idiomasData = tab === 'platos' ? data?.idiomas : null
    const preciosCajaData = tab === 'platos' ? data?.preciosCaja : null
    const cajaIdsData = tab === 'usuarios' ? data?.caja_ids : null
    if (idiomasData || preciosCajaData) {
      const { idiomas, preciosCaja, ...rest } = data
      data = rest
    }
    if (cajaIdsData) {
      const { caja_ids, id, ...rest } = data
      data = rest
    }
    setSaving(true)
    setError(null)
    try {
      let resultado
      if (editing === 'new') {
        resultado = await postApi(getApiUrl(tab), data)
      } else {
        resultado = await putApi(`${getApiUrl(tab)}/${editing}`, data)
      }
      if (tab === 'usuarios' && resultado?.id && Array.isArray(cajaIdsData)) {
        await putApi(`/api/usuarios/${resultado.id}/cajas`, cajaIdsData)
      }
      if (tab === 'platos' && resultado?.id && idiomasData?.length) {
        await putApi(`/api/platos/${resultado.id}/idiomas`, idiomasData)
      }
      if (tab === 'platos' && resultado?.id && Array.isArray(preciosCajaData)) {
        const validos = preciosCajaData.filter((p) => p?.caja_id && p.precio_base != null)
        await putApi(`/api/platos/${resultado.id}/precios-caja`, validos)
      }
      if (tab === 'productos' && resultado && onProductoActualizado) {
        onProductoActualizado(resultado)
      } else if (tab === 'platos' && resultado && onPlatoActualizado) {
        onPlatoActualizado(resultado)
      } else {
        onRefrescar()
      }
      cancelEdit()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`¿Eliminar "${item.nombre || item.codigo}"?`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteApi(`${getApiUrl(tab)}/${item.id}`)
      cancelEdit()
      onRefrescar()
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="config-overlay" onClick={onCerrar}>
      <div className="config-panel config-panel-layout" onClick={(e) => e.stopPropagation()}>
        <div className="config-header">
          <h2>Mantenimientos</h2>
          <div className="config-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onRefrescar()}>
              Actualizar
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
        <div className="config-body">
          <nav className="config-menu">
            {(() => {
              const apartadosConItems = buildMenuFromConfig(configMenu)
              const assigned = new Set(apartadosConItems.flatMap((ap) => ap.items || []))
              const otros = MENU_ITEMS.filter((m) => !assigned.has(m.id))
              return (
                <>
                  {apartadosConItems.map((ap) => {
                    const expandido = menuExpandidos.has(ap.id)
                    return (
                      <div key={ap.id} className={`config-menu-apartado ${expandido ? 'expandido' : 'colapsado'}`}>
                        <button
                          type="button"
                          className="config-menu-apartado-titulo"
                          onClick={() => toggleMenuApartado(ap.id)}
                        >
                          <span className="config-menu-apartado-chevron">▼</span>
                          {ap.nombre}
                          {(ap.items || []).length > 0 && (
                            <span className="config-menu-apartado-badge">{(ap.items || []).length}</span>
                          )}
                        </button>
                        <div className="config-menu-apartado-items">
                          {(ap.items || []).map((itemId) => {
                            const m = MENU_ITEMS.find((x) => x.id === itemId)
                            if (!m) return null
                            return (
                              <button
                                key={m.id}
                                type="button"
                                className={`config-menu-item ${tab === m.id ? 'active' : ''}`}
                                onClick={() => { setTab(m.id); cancelEdit(); }}
                              >
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {otros.length > 0 && (
                    <div className={`config-menu-apartado ${menuExpandidos.has('otros') ? 'expandido' : 'colapsado'}`}>
                      <button
                        type="button"
                        className="config-menu-apartado-titulo"
                        onClick={() => toggleMenuApartado('otros')}
                      >
                        <span className="config-menu-apartado-chevron">▼</span>
                        Otros
                        <span className="config-menu-apartado-badge">{otros.length}</span>
                      </button>
                      <div className="config-menu-apartado-items">
                        {otros.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`config-menu-item ${tab === m.id ? 'active' : ''}`}
                            onClick={() => { setTab(m.id); cancelEdit(); }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </nav>
          <div className="config-content">
            {tab === 'empresas' && (
              <ConfigEmpresas
                list={list}
                idiomas={idiomas}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'cajas' && (
              <ConfigCajas
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'idiomas' && (
              <ConfigIdiomas
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'proveedores' && (
              <ConfigProveedores
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'clientes' && (
              <ConfigClientes
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'zonas-preparacion' && (
              <ConfigZonasPreparacion
                list={list}
                empresas={empresas || []}
                impresoras={impresoras || []}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'impresoras' && (
              <ConfigImpresoras
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'familias' && (
              <ConfigFamilias
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'apartados' && (
              <ConfigApartados
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'familias-menu' && (
              <ConfigFamiliasMenu
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'productos' && (
              <ConfigProductos
                list={list}
                familias={familias || []}
                zonasPreparacion={zonasPreparacion || []}
                proveedores={proveedores || []}
                editing={editing}
                formData={formData}
                setFormData={(updater) => {
                  setFormData((prev) => {
                    const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
                    formDataRef.current = next
                    return next
                  })
                }}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onSaveWithData={() => handleSave(formDataRef.current)}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'platos' && (
              <ConfigPlatos
                list={list}
                familias={familias || []}
                idiomas={idiomas || []}
                zonasPreparacion={zonasPreparacion || []}
                proveedores={proveedores || []}
                cajas={cajas || []}
                editing={editing}
                formData={formData}
                setFormData={(updater) => {
                  setFormData((prev) => {
                    const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
                    formDataRef.current = next
                    return next
                  })
                }}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onSaveWithData={() => handleSave(formDataRef.current)}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'tipos-menu' && (
              <ConfigTiposMenu
                list={list}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
              />
            )}
            {tab === 'usuarios' && (
              <ConfigUsuarios
                list={list}
                idiomas={idiomas}
                cajas={cajas || []}
                editing={editing}
                formData={formData}
                setFormData={setFormData}
                onNew={openNew}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
                onUsuarioFotoActualizada={onUsuarioFotoActualizada}
              />
            )}
            {tab === 'config-menu' && (
              <ConfigMenu
                tiposMenu={tiposMenu || []}
                apartados={apartados || []}
                platos={platos || []}
                onRefrescar={onRefrescar}
              />
            )}
            {tab === 'config-nav' && (
              <ConfigNav
                configMenu={configMenu}
                setConfigMenu={setConfigMenu}
                menuItems={MENU_ITEMS}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getApiUrl(tab) {
  const map = {
    empresas: '/api/empresas',
    cajas: '/api/cajas',
    'zonas-preparacion': '/api/zonas-preparacion',
    impresoras: '/api/impresoras',
    idiomas: '/api/idiomas',
    proveedores: '/api/proveedores',
    clientes: '/api/clientes',
    familias: '/api/familias',
    'familias-menu': '/api/familias-menu',
    apartados: '/api/apartados',
    productos: '/api/productos',
    platos: '/api/platos',
    'tipos-menu': '/api/tipos-menu',
    usuarios: '/api/usuarios',
  }
  return map[tab] || ''
}

function getDefaultForm(tab) {
  const defaults = {
    empresas: { codigo: '', nombre: '', cif_nif: '', direccion: '', codigo_postal: '', localidad: '', provincia: '', telefono: '', email: '' },
    cajas: { codigo: '', nombre: '', orden: 0 },
    'zonas-preparacion': { empresa_id: 1, codigo: '', nombre: '', impresora_id: '', ip_host: '', puerto: 9100 },
    impresoras: { codigo: '', nombre: '', tipo: 'cocina', ip_host: '', puerto: 9100 },
    idiomas: { codigo: '', nombre: '' },
    proveedores: { codigo: '', nombre: '', cif_nif: '', direccion: '', codigo_postal: '', localidad: '', provincia: '', telefono: '', email: '', ruta_logo: '' },
    clientes: { codigo: '', nombre: '', nif_cif: '', direccion: '', codigo_postal: '', localidad: '', provincia: '', telefono: '', email: '', notas: '', ruta_logo: '' },
    familias: { codigo: '', nombre: '', orden: 0, curso: '', mostrar_pantalla_principal: true },
    'familias-menu': { codigo: '', nombre: '', orden: 0 },
    apartados: { codigo: '', nombre: '', orden: 0 },
    productos: { codigo: '', nombre: '', familia_id: '', precio_base: 0, precio_suplemento_menu: 0, zona_preparacion_id: '', proveedor_principal_id: '', ruta_imagen: '', alergenos: [], vegetariano: false, vegano: false, apto_celiaco: false },
    platos: { codigo: '', nombre: '', nombre_corto: '', comentarios: '', familia_id: '', precio_base: 0, precio_suplemento_menu: 0, zona_preparacion_id: '', proveedor_principal_id: '', ruta_imagen: '', alergenos: [], vegetariano: false, vegano: false, apto_celiaco: false, preciosCaja: [] },
    'tipos-menu': { codigo: '', nombre: '', precio: 0, orden: 0 },
    usuarios: { codigo: '', nombre: '', idioma_id: null, rol: 'camarero', caja_ids: [], ruta_foto: '' },
  }
  return { ...defaults[tab] }
}

function itemToForm(item, tab) {
  if (tab === 'empresas') return { codigo: item.codigo, nombre: item.nombre, idioma_base_id: item.idioma_base_id ?? null, cif_nif: item.cif_nif || '', direccion: item.direccion || '', codigo_postal: item.codigo_postal || '', localidad: item.localidad || '', provincia: item.provincia || '', telefono: item.telefono || '', email: item.email || '' }
  if (tab === 'cajas') return { codigo: item.codigo, nombre: item.nombre, orden: item.orden ?? 0 }
  if (tab === 'zonas-preparacion') return { empresa_id: item.empresa_id, codigo: item.codigo, nombre: item.nombre, impresora_id: item.impresora_id || '', ip_host: item.ip_host || '', puerto: item.puerto ?? 9100 }
  if (tab === 'impresoras') return { codigo: item.codigo, nombre: item.nombre, tipo: item.tipo || 'cocina', ip_host: item.ip_host || '', puerto: item.puerto ?? 9100 }
  if (tab === 'idiomas') return { codigo: item.codigo, nombre: item.nombre }
  if (tab === 'proveedores') return { codigo: item.codigo, nombre: item.nombre, cif_nif: item.cif_nif || '', direccion: item.direccion || '', codigo_postal: item.codigo_postal || '', localidad: item.localidad || '', provincia: item.provincia || '', telefono: item.telefono || '', email: item.email || '', ruta_logo: item.ruta_logo || '' }
  if (tab === 'clientes') return { codigo: item.codigo || '', nombre: item.nombre, nif_cif: item.nif_cif || '', direccion: item.direccion || '', codigo_postal: item.codigo_postal || '', localidad: item.localidad || '', provincia: item.provincia || '', telefono: item.telefono || '', email: item.email || '', notas: item.notas || '', ruta_logo: item.ruta_logo || '' }
  if (tab === 'familias') return { codigo: item.codigo, nombre: item.nombre, orden: item.orden ?? 0, curso: item.curso || '', mostrar_pantalla_principal: item.mostrar_pantalla_principal !== false }
  if (tab === 'familias-menu') return { codigo: item.codigo, nombre: item.nombre, orden: item.orden ?? 0 }
  if (tab === 'apartados') return { codigo: item.codigo, nombre: item.nombre, orden: item.orden ?? 0 }
  if (tab === 'productos') {
    const alergenosStr = item.alergenos || ''
    const alergenos = alergenosStr ? alergenosStr.split(',').map((s) => s.trim()).filter(Boolean) : []
    return { codigo: item.codigo, nombre: item.nombre, familia_id: item.familia_id, precio_base: item.precio_base ?? 0, precio_suplemento_menu: item.precio_suplemento_menu ?? 0, zona_preparacion_id: item.zona_preparacion_id || '', proveedor_principal_id: item.proveedor_principal_id || '', ruta_imagen: item.ruta_imagen || '', alergenos, vegetariano: !!item.vegetariano, vegano: !!item.vegano, apto_celiaco: !!item.apto_celiaco }
  }
  if (tab === 'platos') {
    const alergenosStr = item.alergenos || ''
    const alergenos = alergenosStr ? alergenosStr.split(',').map((s) => s.trim()).filter(Boolean) : []
    return { id: item.id, codigo: item.codigo, nombre: item.nombre, nombre_corto: item.nombre_corto || '', comentarios: item.comentarios || '', familia_id: item.familia_id, precio_base: item.precio_base ?? 0, precio_suplemento_menu: item.precio_suplemento_menu ?? 0, zona_preparacion_id: item.zona_preparacion_id || '', proveedor_principal_id: item.proveedor_principal_id || '', ruta_imagen: item.ruta_imagen || '', alergenos, vegetariano: !!item.vegetariano, vegano: !!item.vegano, apto_celiaco: !!item.apto_celiaco, preciosCaja: [] }
  }
  if (tab === 'tipos-menu') return { codigo: item.codigo, nombre: item.nombre, precio: item.precio ?? 0, orden: item.orden ?? 0 }
  if (tab === 'usuarios') return { id: item.id, codigo: item.codigo, nombre: item.nombre, idioma_id: item.idioma_id ?? null, rol: item.rol || 'camarero', caja_ids: [], ruta_foto: item.ruta_foto || '' }
  return {}
}

function FormWrapper({ children, editing, onNew, onCancel, onSave, onSaveWithData, formData, saving, error, hasCrud = true }) {
  const handleSave = () => (onSaveWithData ? onSaveWithData(formData) : onSave())
  return (
    <div className="config-section">
      {hasCrud && (
        <div className="config-actions">
          {!editing ? (
            <button type="button" className="btn btn-primary" onClick={onNew}>Nuevo</button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
            </>
          )}
        </div>
      )}
      {error && <p className="config-error">{error}</p>}
      {children}
    </div>
  )
}

function ConfigEmpresas({ list, idiomas, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Idioma base
            <select value={formData.idioma_base_id ?? ''} onChange={(e) => setFormData({ ...formData, idioma_base_id: e.target.value ? parseInt(e.target.value, 10) : null })}>
              <option value="">— Sin definir —</option>
              {(idiomas || []).map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.codigo})</option>)}
            </select>
          </label>
          <InputWithKeyboard label="CIF/NIF" value={formData.cif_nif} onChange={(v) => setFormData({ ...formData, cif_nif: v })} />
          <InputWithKeyboard label="Dirección" value={formData.direccion} onChange={(v) => setFormData({ ...formData, direccion: v })} />
          <InputWithKeyboard label="C.P." value={formData.codigo_postal} onChange={(v) => setFormData({ ...formData, codigo_postal: v })} />
          <InputWithKeyboard label="Localidad" value={formData.localidad} onChange={(v) => setFormData({ ...formData, localidad: v })} />
          <InputWithKeyboard label="Provincia" value={formData.provincia} onChange={(v) => setFormData({ ...formData, provincia: v })} />
          <InputWithKeyboard label="Teléfono" value={formData.telefono} onChange={(v) => setFormData({ ...formData, telefono: v })} />
          <InputWithKeyboard label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>CIF</th><th>Localidad</th><th></th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td><td>{e.codigo}</td><td>{e.nombre}</td><td>{e.cif_nif || '—'}</td><td>{e.localidad || '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(e)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(e)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigCajas({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <InputWithKeyboard label="Orden" value={String(formData.orden ?? 0)} onChange={(v) => setFormData({ ...formData, orden: parseInt(v, 10) || 0 })} />
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Orden</th><th></th></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td><td>{i.codigo}</td><td>{i.nombre}</td><td>{i.orden ?? 0}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(i)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(i)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigIdiomas({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th></th></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td><td>{i.codigo}</td><td>{i.nombre}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(i)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(i)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigProveedores({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <InputWithKeyboard label="CIF/NIF" value={formData.cif_nif} onChange={(v) => setFormData({ ...formData, cif_nif: v })} />
          <InputWithKeyboard label="Dirección" value={formData.direccion} onChange={(v) => setFormData({ ...formData, direccion: v })} />
          <InputWithKeyboard label="C.P." value={formData.codigo_postal} onChange={(v) => setFormData({ ...formData, codigo_postal: v })} />
          <InputWithKeyboard label="Localidad" value={formData.localidad} onChange={(v) => setFormData({ ...formData, localidad: v })} />
          <InputWithKeyboard label="Provincia" value={formData.provincia} onChange={(v) => setFormData({ ...formData, provincia: v })} />
          <InputWithKeyboard label="Teléfono" value={formData.telefono} onChange={(v) => setFormData({ ...formData, telefono: v })} />
          <InputWithKeyboard label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
          <InputWithKeyboard label="Ruta logo" value={formData.ruta_logo} onChange={(v) => setFormData({ ...formData, ruta_logo: v })} />
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>CIF</th><th>Localidad</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.codigo}</td><td>{p.nombre}</td><td>{p.cif_nif || '—'}</td><td>{p.localidad || '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(p)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(p)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigClientes({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <InputWithKeyboard label="NIF/CIF" value={formData.nif_cif} onChange={(v) => setFormData({ ...formData, nif_cif: v })} />
          <InputWithKeyboard label="Dirección" value={formData.direccion} onChange={(v) => setFormData({ ...formData, direccion: v })} />
          <InputWithKeyboard label="C.P." value={formData.codigo_postal} onChange={(v) => setFormData({ ...formData, codigo_postal: v })} />
          <InputWithKeyboard label="Localidad" value={formData.localidad} onChange={(v) => setFormData({ ...formData, localidad: v })} />
          <InputWithKeyboard label="Provincia" value={formData.provincia} onChange={(v) => setFormData({ ...formData, provincia: v })} />
          <InputWithKeyboard label="Teléfono" value={formData.telefono} onChange={(v) => setFormData({ ...formData, telefono: v })} />
          <InputWithKeyboard label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
          <InputWithKeyboard label="Notas" value={formData.notas} onChange={(v) => setFormData({ ...formData, notas: v })} />
          <InputWithKeyboard label="Ruta logo" value={formData.ruta_logo} onChange={(v) => setFormData({ ...formData, ruta_logo: v })} />
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>NIF</th><th>Localidad</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td><td>{c.codigo || '—'}</td><td>{c.nombre}</td><td>{c.nif_cif || '—'}</td><td>{c.localidad || '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(c)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(c)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigZonasPreparacion({ list, empresas, impresoras, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <label>Empresa
            <select value={formData.empresa_id} onChange={(e) => setFormData({ ...formData, empresa_id: parseInt(e.target.value, 10) })}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Impresora
            <select value={formData.impresora_id || ''} onChange={(e) => setFormData({ ...formData, impresora_id: e.target.value ? parseInt(e.target.value, 10) : null })}>
              <option value="">— Sin impresora —</option>
              {impresoras.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.ip_host || '—'})</option>)}
            </select>
          </label>
          <InputWithKeyboard label="IP/Host (alternativa)" value={formData.ip_host} onChange={(v) => setFormData({ ...formData, ip_host: v })} placeholder="192.168.1.10" />
          <label>Puerto <input type="number" value={formData.puerto} onChange={(e) => setFormData({ ...formData, puerto: parseInt(e.target.value, 10) || 9100 })} /></label>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Impresora</th><th>IP</th><th></th></tr></thead>
          <tbody>
            {list.map((z) => (
              <tr key={z.id}>
                <td>{z.id}</td><td>{z.codigo}</td><td>{z.nombre}</td><td>{z.impresora_nombre || z.ip_host || '—'}</td><td>{z.ip_host || '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(z)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(z)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigImpresoras({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Tipo <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
            <option value="cocina">Cocina</option><option value="barra">Barra</option><option value="caja">Caja</option>
          </select></label>
          <InputWithKeyboard label="IP/Host" value={formData.ip_host} onChange={(v) => setFormData({ ...formData, ip_host: v })} placeholder="192.168.1.10" />
          <label>Puerto <input type="number" value={formData.puerto} onChange={(e) => setFormData({ ...formData, puerto: parseInt(e.target.value, 10) || 9100 })} /></label>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Tipo</th><th>IP</th><th></th></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td><td>{i.codigo}</td><td>{i.nombre}</td><td>{i.tipo || 'cocina'}</td><td>{i.ip_host || '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(i)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(i)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigFamilias({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  const cursos = ['', 'entrante', 'primero', 'segundo', 'tercero', 'cuarto', 'menu']
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Curso <select value={formData.curso} onChange={(e) => setFormData({ ...formData, curso: e.target.value })}>
            {cursos.map((c) => <option key={c || 'empty'} value={c}>{c || '—'}</option>)}
          </select></label>
          <label>Orden <input type="number" value={formData.orden} onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value, 10) || 0 })} /></label>
          <label>
            <input type="checkbox" checked={formData.mostrar_pantalla_principal !== false} onChange={(e) => setFormData({ ...formData, mostrar_pantalla_principal: e.target.checked })} />
            Mostrar en pantalla principal
          </label>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Curso</th><th>Orden</th><th>Principal</th><th></th></tr></thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td><td>{f.codigo}</td><td>{f.nombre}</td><td>{f.curso || '—'}</td><td>{f.orden ?? '—'}</td><td>{f.mostrar_pantalla_principal !== false ? 'Sí' : 'No'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(f)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(f)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigFamiliasMenu({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Orden <input type="number" value={formData.orden} onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value, 10) || 0 })} /></label>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Orden</th><th></th></tr></thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td><td>{f.codigo}</td><td>{f.nombre}</td><td>{f.orden ?? '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(f)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(f)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigApartados({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Orden <input type="number" value={formData.orden} onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value, 10) || 0 })} /></label>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Orden</th><th></th></tr></thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td><td>{f.codigo}</td><td>{f.nombre}</td><td>{f.orden ?? '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(f)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(f)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigProductos({ list, familias, zonasPreparacion, proveedores, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onSaveWithData, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} onSaveWithData={onSaveWithData} formData={formData} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Familia
            <select value={formData.familia_id} onChange={(e) => setFormData({ ...formData, familia_id: parseInt(e.target.value, 10) })}>
              {familias.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </label>
          <label>Proveedor principal (opcional)
            <select value={formData.proveedor_principal_id || ''} onChange={(e) => setFormData({ ...formData, proveedor_principal_id: e.target.value ? parseInt(e.target.value, 10) : '' })}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Zona preparación (opcional)
            <select value={formData.zona_preparacion_id || ''} onChange={(e) => setFormData({ ...formData, zona_preparacion_id: e.target.value ? parseInt(e.target.value, 10) : '' })}>
              <option value="">— Sin zona —</option>
              {zonasPreparacion.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>
          <label>Precio base <input type="number" step="0.01" value={formData.precio_base} onChange={(e) => setFormData({ ...formData, precio_base: parseFloat(e.target.value) || 0 })} /></label>
          <label>Supl. menú <input type="number" step="0.01" value={formData.precio_suplemento_menu} onChange={(e) => setFormData({ ...formData, precio_suplemento_menu: parseFloat(e.target.value) || 0 })} /></label>
          <InputWithKeyboard label="Imagen (ruta)" value={formData.ruta_imagen} onChange={(v) => setFormData({ ...formData, ruta_imagen: v })} placeholder="productos/ejemplo.jpg" />
          <div className="config-checks-row">
            <label className="config-checkbox"><input type="checkbox" checked={!!formData.vegetariano} onChange={(e) => setFormData((p) => ({ ...p, vegetariano: e.target.checked }))} /> Vegetariano</label>
            <label className="config-checkbox"><input type="checkbox" checked={!!formData.vegano} onChange={(e) => setFormData((p) => ({ ...p, vegano: e.target.checked }))} /> Vegano</label>
            <label className="config-checkbox"><input type="checkbox" checked={!!formData.apto_celiaco} onChange={(e) => setFormData((p) => ({ ...p, apto_celiaco: e.target.checked }))} /> Apto celíacos</label>
          </div>
          <div className="config-alergenos">
            <span className="config-alergenos-label">Alérgenos (no se muestran en lista):</span>
            <div className="config-alergenos-grid">
              {ALLERGENOS_LIST.map((a) => (
                <label key={a.id} className="config-checkbox">
                  <input
                    type="checkbox"
                    checked={(formData.alergenos || []).includes(a.id)}
                    onChange={(e) => setFormData((p) => {
                      const arr = [...(p.alergenos || [])]
                      if (e.target.checked) arr.push(a.id)
                      else arr.splice(arr.indexOf(a.id), 1)
                      return { ...p, alergenos: arr }
                    })}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Precio</th><th>Supl.</th><th>Familia</th><th>Proveedor</th><th>Zona</th><th>Veg.</th><th>Vegan.</th><th>Celíaco</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.codigo}</td><td>{p.nombre}</td><td>{p.precio_base ?? 0} €</td><td>{p.precio_suplemento_menu ?? 0} €</td><td>{p.familia_nombre || '—'}</td><td>{p.proveedor_principal_nombre || '—'}</td><td>{p.zona_preparacion_nombre || '—'}</td><td>{p.vegetariano ? '✓' : '—'}</td><td>{p.vegano ? '✓' : '—'}</td><td>{p.apto_celiaco ? '✓' : '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(p)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(p)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigPlatos({ list, familias, idiomas, zonasPreparacion, proveedores, cajas, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onSaveWithData, onCancel, saving, error }) {
  const familiasPlatos = (familias || []).filter((f) => f.curso && f.curso !== 'menu')
  const familiasOpciones = familiasPlatos.length ? familiasPlatos : (familias || [])

  useEffect(() => {
    if (editing && editing !== 'new' && formData?.id && (cajas || []).length > 0) {
      fetchApi(`/api/platos/${formData.id}/precios-caja`)
        .then((rows) => {
          const precios = (rows || []).map((r) => ({
            caja_id: r.caja_id,
            caja_nombre: r.caja_nombre,
            precio_base: r.precio_base ?? 0,
            precio_suplemento_menu: r.precio_suplemento_menu ?? 0,
          }))
          setFormData((p) => ({ ...p, preciosCaja: precios }))
        })
        .catch(() => setFormData((p) => ({ ...p, preciosCaja: [] })))
    }
  }, [editing, formData?.id, cajas?.length])

  useEffect(() => {
    if (editing && editing !== 'new' && formData?.id && (idiomas || []).length > 0) {
      fetchApi(`/api/platos/${formData.id}/idiomas`)
        .then((rows) => {
          const merged = (idiomas || []).map((i) => {
            const ex = rows.find((r) => r.idioma_id === i.id)
            return {
              idioma_id: i.id,
              idioma_codigo: i.codigo,
              idioma_nombre: i.nombre,
              nombre: ex?.nombre ?? '',
              nombre_corto: ex?.nombre_corto ?? '',
              comentarios: ex?.comentarios ?? '',
            }
          })
          setFormData((p) => ({ ...p, idiomas: merged }))
        })
        .catch(() => setFormData((p) => ({ ...p, idiomas: (idiomas || []).map((i) => ({ idioma_id: i.id, idioma_codigo: i.codigo, idioma_nombre: i.nombre, nombre: '', nombre_corto: '', comentarios: '' })) })))
    } else if (editing === 'new' && (idiomas || []).length > 0 && !formData.idiomas) {
      setFormData((p) => ({ ...p, idiomas: (idiomas || []).map((i) => ({ idioma_id: i.id, idioma_codigo: i.codigo, idioma_nombre: i.nombre, nombre: p.nombre ?? '', nombre_corto: (p.nombre_corto ?? p.nombre ?? '').slice(0, 25), comentarios: p.comentarios ?? '' })) }))
    }
  }, [editing, formData?.id, idiomas?.length])

  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} onSaveWithData={onSaveWithData} formData={formData} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <InputWithKeyboard label="Nombre corto (25 chars, caja/PDA)" value={formData.nombre_corto} onChange={(v) => setFormData({ ...formData, nombre_corto: (v || '').slice(0, 25) })} maxLength={25} />
          <label>Comentarios <textarea value={formData.comentarios ?? ''} onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })} rows={2} placeholder="Comentarios del plato" /></label>
          <label>Familia (curso)
            <select value={formData.familia_id} onChange={(e) => setFormData({ ...formData, familia_id: parseInt(e.target.value, 10) })}>
              {familiasOpciones.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.curso || '—'})</option>)}
            </select>
          </label>
          <label>Proveedor principal (opcional)
            <select value={formData.proveedor_principal_id || ''} onChange={(e) => setFormData({ ...formData, proveedor_principal_id: e.target.value ? parseInt(e.target.value, 10) : '' })}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Zona preparación (opcional)
            <select value={formData.zona_preparacion_id || ''} onChange={(e) => setFormData({ ...formData, zona_preparacion_id: e.target.value ? parseInt(e.target.value, 10) : '' })}>
              <option value="">— Sin zona —</option>
              {zonasPreparacion.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>
          <label>Precio base <input type="number" step="0.01" value={formData.precio_base} onChange={(e) => setFormData({ ...formData, precio_base: parseFloat(e.target.value) || 0 })} /></label>
          <label>Supl. menú <input type="number" step="0.01" value={formData.precio_suplemento_menu} onChange={(e) => setFormData({ ...formData, precio_suplemento_menu: parseFloat(e.target.value) || 0 })} /></label>
          <p className="config-hint">Precios por defecto. Si una caja tiene precio distinto, añádelo en "Excepciones por caja" abajo.</p>
          <InputWithKeyboard label="Imagen (ruta)" value={formData.ruta_imagen} onChange={(v) => setFormData({ ...formData, ruta_imagen: v })} placeholder="productos/ejemplo.jpg" />
          <div className="config-checks-row">
            <label className="config-checkbox"><input type="checkbox" checked={!!formData.vegetariano} onChange={(e) => setFormData((p) => ({ ...p, vegetariano: e.target.checked }))} /> Vegetariano</label>
            <label className="config-checkbox"><input type="checkbox" checked={!!formData.vegano} onChange={(e) => setFormData((p) => ({ ...p, vegano: e.target.checked }))} /> Vegano</label>
            <label className="config-checkbox"><input type="checkbox" checked={!!formData.apto_celiaco} onChange={(e) => setFormData((p) => ({ ...p, apto_celiaco: e.target.checked }))} /> Apto celíacos</label>
          </div>
          <div className="config-alergenos">
            <span className="config-alergenos-label">Alérgenos:</span>
            <div className="config-alergenos-grid">
              {ALLERGENOS_LIST.map((a) => (
                <label key={a.id} className="config-checkbox">
                  <input
                    type="checkbox"
                    checked={(formData.alergenos || []).includes(a.id)}
                    onChange={(e) => setFormData((p) => {
                      const arr = [...(p.alergenos || [])]
                      if (e.target.checked) arr.push(a.id)
                      else arr.splice(arr.indexOf(a.id), 1)
                      return { ...p, alergenos: arr }
                    })}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
          {(cajas || []).length > 0 && (
            <div className="config-section config-precios-caja">
              <h4>Excepciones de precio por caja</h4>
              <p className="config-hint">Define un precio distinto para este plato en cajas concretas. Si no hay excepción, se usa el precio base del plato.</p>
              <table className="config-table config-precios-caja-table">
                <thead><tr><th>Caja</th><th>Precio base</th><th>Supl. menú</th><th></th></tr></thead>
                <tbody>
                  {(formData.preciosCaja || []).map((pc, idx) => (
                    <tr key={pc.caja_id || idx}>
                      <td>
                        <select
                          value={pc.caja_id}
                          onChange={(e) => setFormData((p) => {
                            const next = [...(p.preciosCaja || [])]
                            next[idx] = { ...next[idx], caja_id: parseInt(e.target.value, 10), caja_nombre: (cajas || []).find((c) => c.id === parseInt(e.target.value, 10))?.nombre }
                            return { ...p, preciosCaja: next }
                          })}
                        >
                          <option value="">— Caja —</option>
                          {(cajas || []).map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="number" step="0.01" value={pc.precio_base ?? ''} onChange={(e) => setFormData((p) => {
                        const next = [...(p.preciosCaja || [])]
                        next[idx] = { ...next[idx], precio_base: parseFloat(e.target.value) || 0 }
                        return { ...p, preciosCaja: next }
                      })} placeholder={formData.precio_base} /></td>
                      <td><input type="number" step="0.01" value={pc.precio_suplemento_menu ?? ''} onChange={(e) => setFormData((p) => {
                        const next = [...(p.preciosCaja || [])]
                        next[idx] = { ...next[idx], precio_suplemento_menu: parseFloat(e.target.value) || 0 }
                        return { ...p, preciosCaja: next }
                      })} placeholder={formData.precio_suplemento_menu} /></td>
                      <td><button type="button" className="btn btn-sm btn-danger" onClick={() => setFormData((p) => ({ ...p, preciosCaja: (p.preciosCaja || []).filter((_, i) => i !== idx) }))}>Quitar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-sm" onClick={() => setFormData((p) => ({ ...p, preciosCaja: [...(p.preciosCaja || []), { caja_id: (cajas || [])[0]?.id || '', caja_nombre: '', precio_base: formData.precio_base ?? 0, precio_suplemento_menu: formData.precio_suplemento_menu ?? 0 }] }))}>
                + Añadir excepción
              </button>
            </div>
          )}
          {(formData.idiomas || []).length > 0 && (
            <div className="config-section config-idiomas-platos">
              <h4>Traducciones por idioma</h4>
              <table className="config-table config-idiomas-table">
                <thead><tr><th>Idioma</th><th>Nombre</th><th>Nom. corto</th><th>Comentarios</th></tr></thead>
                <tbody>
                  {(formData.idiomas || []).map((it, idx) => (
                    <tr key={it.idioma_id}>
                      <td>{it.idioma_nombre} ({it.idioma_codigo})</td>
                      <td><input value={it.nombre ?? ''} onChange={(e) => setFormData((p) => {
                        const next = [...(p.idiomas || [])]
                        next[idx] = { ...next[idx], nombre: e.target.value }
                        return { ...p, idiomas: next }
                      })} placeholder="Nombre" style={{ width: '100%' }} /></td>
                      <td><input value={it.nombre_corto ?? ''} onChange={(e) => setFormData((p) => {
                        const next = [...(p.idiomas || [])]
                        next[idx] = { ...next[idx], nombre_corto: (e.target.value || '').slice(0, 25) }
                        return { ...p, idiomas: next }
                      })} placeholder="25 chars" maxLength={25} style={{ width: '100%' }} /></td>
                      <td><input value={it.comentarios ?? ''} onChange={(e) => setFormData((p) => {
                        const next = [...(p.idiomas || [])]
                        next[idx] = { ...next[idx], comentarios: e.target.value }
                        return { ...p, idiomas: next }
                      })} placeholder="Comentarios" style={{ width: '100%' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Nombre corto</th><th>Precio</th><th>Supl.</th><th>Familia</th><th>Veg.</th><th>Vegan.</th><th>Celíaco</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.codigo}</td><td>{p.nombre}</td><td>{p.nombre_corto || '—'}</td><td>{p.precio_base ?? 0} €</td><td>{p.precio_suplemento_menu ?? 0} €</td><td>{p.familia_nombre || '—'}</td><td>{p.vegetariano ? '✓' : '—'}</td><td>{p.vegano ? '✓' : '—'}</td><td>{p.apto_celiaco ? '✓' : '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(p)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(p)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigTiposMenu({ list, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error }) {
  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Precio <input type="number" step="0.01" value={formData.precio} onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })} /></label>
          <label>Orden <input type="number" value={formData.orden} onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value, 10) || 0 })} /></label>
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Precio</th><th>Orden</th><th></th></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td><td>{t.codigo}</td><td>{t.nombre}</td><td>{t.precio ?? 0} €</td><td>{t.orden ?? '—'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(t)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(t)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormWrapper>
  )
}

function ConfigUsuarios({ list, idiomas, cajas, editing, formData, setFormData, onNew, onEdit, onDelete, onSave, onCancel, saving, error, onUsuarioFotoActualizada }) {
  const [mostrarCamara, setMostrarCamara] = useState(false)

  useEffect(() => {
    if (editing && editing !== 'new' && formData?.id && (cajas || []).length > 0) {
      fetchApi(`/api/usuarios/${formData.id}/cajas`)
        .then((rows) => {
          const ids = (rows || []).map((r) => r.id)
          setFormData((p) => ({ ...p, caja_ids: ids }))
        })
        .catch(() => setFormData((p) => ({ ...p, caja_ids: [] })))
    }
  }, [editing, formData?.id, cajas?.length])

  return (
    <FormWrapper editing={editing} onNew={onNew} onCancel={onCancel} onSave={onSave} saving={saving} error={error}>
      {editing ? (
        <div className="config-form">
          {formData.id && (
            <div className="config-usuario-foto">
              <div className="config-usuario-foto-preview">
                {formData.ruta_foto ? (
                  <img src={getImagenUrl(formData.ruta_foto)} alt={formData.nombre} />
                ) : (
                  <span className="config-usuario-foto-placeholder">{formData.nombre?.charAt(0) || '?'}</span>
                )}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setMostrarCamara(true)}>
                📷 Tomar foto
              </button>
            </div>
          )}
          <InputWithKeyboard label="Código" value={formData.codigo} onChange={(v) => setFormData({ ...formData, codigo: v })} />
          <InputWithKeyboard label="Nombre" value={formData.nombre} onChange={(v) => setFormData({ ...formData, nombre: v })} />
          <label>Idioma por defecto
            <select value={formData.idioma_id ?? ''} onChange={(e) => setFormData({ ...formData, idioma_id: e.target.value ? parseInt(e.target.value, 10) : null })}>
              <option value="">— Sin definir —</option>
              {(idiomas || []).map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.codigo})</option>)}
            </select>
          </label>
          <label>Rol <select value={formData.rol} onChange={(e) => setFormData({ ...formData, rol: e.target.value })}>
            <option value="camarero">Camarero</option><option value="admin">Admin</option>
          </select></label>
          {(cajas || []).length > 0 && (
            <div className="config-section">
              <h4>Cajas asignadas</h4>
              <p className="config-hint">El usuario podrá acceder solo a las cajas marcadas. Si tiene varias, elegirá caja tras el login.</p>
              <div className="config-checks-row">
                {(cajas || []).map((c) => (
                  <label key={c.id} className="config-checkbox">
                    <input
                      type="checkbox"
                      checked={(formData.caja_ids || []).includes(c.id)}
                      onChange={(e) => setFormData((p) => {
                        const arr = [...(p.caja_ids || [])]
                        if (e.target.checked) arr.push(c.id)
                        else arr.splice(arr.indexOf(c.id), 1)
                        return { ...p, caja_ids: arr }
                      })}
                    />
                    {c.nombre} ({c.codigo})
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <table className="config-table">
          <thead><tr><th>ID</th><th>Código</th><th>Nombre</th><th>Idioma</th><th>Rol</th><th></th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td><td>{u.codigo}</td><td>{u.nombre}</td><td>{u.idioma_codigo || '—'}</td><td>{u.rol || 'camarero'}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => onEdit(u)}>Editar</button> <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(u)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {mostrarCamara && formData.id && (
        <CameraModal
          onCapturar={async (dataUrl) => {
            try {
              const r = await postApi(`/api/usuarios/${formData.id}/foto`, { imagen: dataUrl })
              setFormData((p) => ({ ...p, ruta_foto: r.ruta_foto }))
              onUsuarioFotoActualizada?.(formData.id, r.ruta_foto)
            } catch (e) {
              alert('Error al guardar la foto: ' + (e?.message || ''))
            }
          }}
          onCerrar={() => setMostrarCamara(false)}
        />
      )}
    </FormWrapper>
  )
}

function ConfigNav({ configMenu, setConfigMenu, menuItems }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const apartados = [...(configMenu.apartados || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  const items = [...(configMenu.items || [])]
  const mantenimientos = menuItems.filter((m) => m.id !== 'config-nav')

  function getItem(itemId) {
    return items.find((i) => i.id === itemId) || { id: itemId, apartado_id: apartados[0]?.id || '', orden: 0 }
  }

  function setItemApartado(itemId, apartadoId) {
    const idx = items.findIndex((i) => i.id === itemId)
    const maxOrden = items.filter((i) => i.apartado_id === apartadoId).reduce((m, i) => Math.max(m, i.orden ?? 0), -1)
    const nuevo = { id: itemId, apartado_id: apartadoId || '', orden: maxOrden + 1 }
    if (idx >= 0) {
      return items.map((i, iIdx) => (iIdx === idx ? nuevo : i))
    }
    return [...items, nuevo]
  }

  function setItemOrden(itemId, orden) {
    const idx = items.findIndex((i) => i.id === itemId)
    if (idx < 0) return items
    return items.map((i, iIdx) => (iIdx === idx ? { ...i, orden: parseInt(orden, 10) || 0 } : i))
  }

  function updateApartado(idx, field, value) {
    const next = [...apartados]
    next[idx] = { ...next[idx], [field]: value }
    setConfigMenu({ ...configMenu, apartados: next })
  }

  function addApartado() {
    const id = 'ap' + Date.now()
    setConfigMenu({ ...configMenu, apartados: [...apartados, { id, nombre: 'Nuevo', orden: apartados.length }] })
  }

  function removeApartado(idx) {
    if (!confirm('¿Eliminar este apartado? Los mantenimientos asignados pasarán a "Otros".')) return
    const ap = apartados[idx]
    const nextApartados = apartados.filter((_, i) => i !== idx)
    const nextItems = items.map((i) => (i.apartado_id === ap.id ? { ...i, apartado_id: '' } : i))
    setConfigMenu({ ...configMenu, apartados: nextApartados, items: nextItems })
  }

  async function guardar() {
    setSaving(true)
    setError(null)
    setInfo(null)
    const fullItems = mantenimientos.map((m) => {
      const it = getItem(m.id)
      return { id: m.id, apartado_id: it.apartado_id || '', orden: it.orden ?? 0 }
    })
    const data = { apartados, items: fullItems }
    try {
      await putApi('/api/config/menu', data)
      try {
        const d = await fetchApi('/api/config/menu')
        if (d?.apartados) setConfigMenu(d)
      } catch (_) {}
    } catch (err) {
      const ok = saveConfigMenuToStorage(data)
      setConfigMenu(data)
      if (ok) {
        setInfo('Guardado en este dispositivo. La API no está disponible; al conectar se guardará en servidor.')
      } else {
        setError('No se pudo guardar (localStorage no disponible en este contexto).')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="config-section">
      {error && <p className="config-error">{error}</p>}
      {info && <p className="config-info">{info}</p>}

      <h3 className="config-subtitle">Apartados del menú</h3>
      <p className="config-hint">Crea apartados (Sistema, Maestros, Facturación...) para organizar el menú lateral.</p>
      <div className="config-actions">
        <button type="button" className="btn btn-primary" onClick={addApartado}>Añadir apartado</button>
      </div>
      <table className="config-table config-nav-table">
        <thead><tr><th>Nombre</th><th>Orden</th><th></th></tr></thead>
        <tbody>
          {apartados.map((ap, apIdx) => (
            <tr key={ap.id}>
              <td>
                <input
                  type="text"
                  value={ap.nombre || ''}
                  onChange={(e) => updateApartado(apIdx, 'nombre', e.target.value)}
                  placeholder="Ej: Sistema"
                  className="config-nav-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={ap.orden ?? apIdx}
                  onChange={(e) => updateApartado(apIdx, 'orden', parseInt(e.target.value, 10) || 0)}
                  className="config-nav-input config-nav-orden"
                />
              </td>
              <td>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => removeApartado(apIdx)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="config-subtitle" style={{ marginTop: '2rem' }}>Asignación de mantenimientos</h3>
      <p className="config-hint">Asigna cada mantenimiento a un apartado. Los que no tengan apartado aparecerán en "Otros".</p>
      <table className="config-table config-nav-table">
        <thead><tr><th>Mantenimiento</th><th>Apartado</th><th>Orden</th></tr></thead>
        <tbody>
          {mantenimientos.map((m) => {
            const it = getItem(m.id)
            return (
              <tr key={m.id}>
                <td>{m.label}</td>
                <td>
                  <select
                    value={it.apartado_id || ''}
                    onChange={(e) => setConfigMenu({ ...configMenu, items: setItemApartado(m.id, e.target.value) })}
                  >
                    <option value="">— Otros —</option>
                    {apartados.map((ap) => (
                      <option key={ap.id} value={ap.id}>{ap.nombre}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={it.orden ?? 0}
                    onChange={(e) => setConfigMenu({ ...configMenu, items: setItemOrden(m.id, e.target.value) })}
                    className="config-nav-input config-nav-orden"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="config-actions" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}

function ConfigMenu({ tiposMenu, apartados, platos, onRefrescar }) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)
  const [apartadosDelTipo, setApartadosDelTipo] = useState([])
  const [expandidoPlatos, setExpandidoPlatos] = useState(null)
  const [busquedaPlatos, setBusquedaPlatos] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [saving, setSaving] = useState(false)
  const [savingPlatos, setSavingPlatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (tipoSeleccionado?.id) {
      fetchApi(`/api/tipos-menu/${tipoSeleccionado.id}/apartados`)
        .then(setApartadosDelTipo)
        .catch(() => setApartadosDelTipo([]))
    } else {
      setApartadosDelTipo([])
      setExpandidoPlatos(null)
    }
  }, [tipoSeleccionado?.id])

  useEffect(() => {
    if (!busquedaPlatos.trim()) {
      setResultadosBusqueda([])
      return
    }
    const t = setTimeout(() => {
      fetchApi(`/api/platos?q=${encodeURIComponent(busquedaPlatos)}`)
        .then(setResultadosBusqueda)
        .catch(() => setResultadosBusqueda([]))
    }, 300)
    return () => clearTimeout(t)
  }, [busquedaPlatos])

  const asignados = apartadosDelTipo.map((a) => a.id)
  const apartadosMaster = (apartados || []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  async function guardarPlatosApartado(apartado, platoIds) {
    if (!tipoSeleccionado?.id) return
    setSavingPlatos(apartado.id)
    try {
      const platosResp = await putApi(`/api/tipos-menu/${tipoSeleccionado.id}/apartados/${apartado.id}/platos`, { plato_ids: platoIds })
      setApartadosDelTipo((prev) => prev.map((a) => (a.id === apartado.id ? { ...a, platos: platosResp || [] } : a)))
      onRefrescar()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSavingPlatos(null)
    }
  }

  function añadirPlato(apartado, plato) {
    const actuales = apartado.platos || []
    if (actuales.some((p) => p.id === plato.id)) return
    const ids = [...actuales.map((p) => p.id), plato.id]
    guardarPlatosApartado(apartado, ids)
  }

  function quitarPlato(apartado, platoId) {
    const ids = (apartado.platos || []).map((p) => p.id).filter((id) => id !== platoId)
    guardarPlatosApartado(apartado, ids)
  }

  function toggleApartado(ap, checked) {
    if (checked) {
      setApartadosDelTipo((prev) => [...prev, { ...ap, orden: prev.length, platos_por_persona: 1 }].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)))
    } else {
      setApartadosDelTipo((prev) => prev.filter((x) => x.id !== ap.id).map((x, i) => ({ ...x, orden: i })))
    }
  }

  function cambiarPlatosPorPersona(apartadoId, val) {
    setApartadosDelTipo((prev) => prev.map((a) => (a.id === apartadoId ? { ...a, platos_por_persona: parseFloat(val) || 1 } : a)))
  }

  function cambiarOrden(apartadoId, val) {
    const ord = parseInt(val, 10) || 0
    setApartadosDelTipo((prev) => prev.map((a) => (a.id === apartadoId ? { ...a, orden: ord } : a)).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)))
  }

  async function guardar() {
    if (!tipoSeleccionado?.id) return
    setSaving(true)
    setError(null)
    try {
      await putApi(`/api/tipos-menu/${tipoSeleccionado.id}/apartados`, apartadosDelTipo.map((a, i) => ({
        apartado_id: a.id,
        orden: a.orden ?? i,
        platos_por_persona: a.platos_por_persona ?? 1,
      })))
      const list = await fetchApi(`/api/tipos-menu/${tipoSeleccionado.id}/apartados`)
      setApartadosDelTipo(list || [])
      onRefrescar()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const tipos = (tiposMenu || []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <div className="config-section">
      {error && <p className="config-error">{error}</p>}
      <h3 className="config-subtitle">Tipos de menú → Apartados</h3>
      <p className="config-hint">
        Cada tipo de menú usa apartados del catálogo. Selecciona cuáles usa y asigna platos a cada uno. El mismo apartado puede tener platos distintos en cada tipo de menú.
      </p>
      <label className="config-select-tipo">
        Tipo de menú:
        <select
          value={tipoSeleccionado?.id ?? ''}
          onChange={(e) => {
            const id = e.target.value ? parseInt(e.target.value, 10) : null
            setTipoSeleccionado(tipos.find((t) => t.id === id) || null)
          }}
        >
          <option value="">— Seleccionar —</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </label>
      {tipoSeleccionado && (
        <div className="config-apartados-block">
          {apartadosMaster.length === 0 ? (
            <p className="config-hint">Crea primero apartados en la pestaña &quot;Apartados&quot;.</p>
          ) : (
            <>
              <div className="config-actions">
                <button type="button" className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
              <table className="config-table">
                <thead>
                  <tr><th>Usar</th><th>Apartado</th><th>Orden</th><th>Platos/pers.</th><th>Platos</th></tr>
                </thead>
                <tbody>
                  {apartadosMaster.map((a) => {
                    const asignado = apartadosDelTipo.find((x) => x.id === a.id)
                    const expandido = expandidoPlatos === a.id
                    return (
                      <React.Fragment key={a.id}>
                        <tr>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!asignado}
                              onChange={(e) => toggleApartado(a, e.target.checked)}
                            />
                          </td>
                          <td>{a.nombre}</td>
                          <td>
                            {asignado ? (
                              <input
                                type="number"
                                value={asignado.orden ?? 0}
                                onChange={(e) => cambiarOrden(a.id, e.target.value)}
                                style={{ width: 60 }}
                              />
                            ) : '—'}
                          </td>
                          <td>
                            {asignado ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                value={asignado.platos_por_persona ?? 1}
                                onChange={(e) => cambiarPlatosPorPersona(a.id, e.target.value)}
                                style={{ width: 60 }}
                              />
                            ) : '—'}
                          </td>
                          <td>
                            {asignado && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={async () => {
                                  if (expandido) {
                                    setExpandidoPlatos(null)
                                    return
                                  }
                                  await guardar()
                                  setBusquedaPlatos('')
                                  setExpandidoPlatos(a.id)
                                }}
                              >
                                {(asignado.platos || []).length} platos — {expandido ? 'Ocultar' : 'Editar'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {asignado && expandido && (
                          <tr>
                            <td colSpan={5} className="config-platos-cell">
                              <div className="config-buscador-platos">
                                <label>
                                  Buscar plato:
                                  <input
                                    type="text"
                                    value={busquedaPlatos}
                                    onChange={(e) => setBusquedaPlatos(e.target.value)}
                                    placeholder="Escribe para buscar..."
                                    className="config-buscador-input"
                                  />
                                </label>
                                <div className="config-platos-dos-columnas">
                                  <div>
                                    <strong>Resultados ({resultadosBusqueda.length})</strong>
                                    <div className="config-platos-lista">
                                      {resultadosBusqueda
                                        .filter((p) => !(asignado.platos || []).some((x) => x.id === p.id))
                                        .map((p) => (
                                          <button key={p.id} type="button" className="btn btn-sm config-plato-btn" onClick={() => añadirPlato(asignado, p)} disabled={!!savingPlatos}>
                                            + {p.nombre_corto || p.nombre}
                                          </button>
                                        ))}
                                      {busquedaPlatos && resultadosBusqueda.length === 0 && <span className="config-hint">Sin resultados</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <strong>Asignados ({(asignado.platos || []).length})</strong>
                                    <div className="config-platos-lista">
                                      {(asignado.platos || []).map((p) => (
                                        <span key={p.id} className="config-plato-asignado">
                                          {p.nombre_corto || p.nombre}
                                          <button type="button" className="btn-quitar-plato" onClick={() => quitarPlato(asignado, p.id)} disabled={!!savingPlatos}>×</button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
