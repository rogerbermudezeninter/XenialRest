import { useState, useEffect } from 'react'
import { fetchApi } from '../api'
import KeypadModal from './KeypadModal'

const CURSO_LABELS = {
  entrante: 'Entrantes',
  primero: 'Primeros',
  segundo: 'Segundos',
  tercero: 'Terceros',
  cuarto: 'Cuartos',
}

export default function MenuSelector({
  tiposMenu,
  familiasConCurso,
  platos,
  cajaId,
  ticket,
  poderEditar,
  menuEnEdicion,
  onAñadirMenuCompleto,
  onMenuEditado,
  onMenuCompletado,
  onCancelarEdicion,
  getImagenUrl,
  formatPrecio,
}) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)
  const [configuracion, setConfiguracion] = useState([])
  const [apartados, setApartados] = useState([])
  const [menuSeleccion, setMenuSeleccion] = useState(null)
  const [seccionActual, setSeccionActual] = useState(null)
  const [imgErrors, setImgErrors] = useState(new Set())

  const familiaMenus = familiasConCurso?.find((f) => f.curso === 'menu')
  const modoApartados = (menuSeleccion?.apartados?.length ?? 0) > 0

  useEffect(() => {
    if (menuEnEdicion) {
      const { padre, hijos, completando } = menuEnEdicion
      const tipoMenu = tiposMenu.find((t) => t.id === padre.tipo_menu_id) || { id: padre.tipo_menu_id, nombre: padre.descripcion, precio: padre.precio_unitario }
      const hijosOriginalesIds = new Set(hijos.map((h) => h.plato_id ?? h.producto_id ?? h.id))
      const extra = completando ? { _completando: true, _padreId: padre.id, _hijosOriginalesIds: hijosOriginalesIds } : { _editando: true, _menuId: menuEnEdicion.menuId }
      fetchApi(`/api/tipos-menu/${tipoMenu.id}/apartados${cajaId ? `?caja_id=${cajaId}` : ''}`)
        .then((aps) => {
          if (aps?.length > 0) {
            const platosPorApartado = {}
            const seleccionados = {}
            const necesidades = {}
            const cant = parseFloat(padre.cantidad) || 1
            aps.forEach((a) => {
              platosPorApartado[a.id] = []
              necesidades[a.id] = Math.ceil(cant * parseFloat(a.platos_por_persona || 1))
              seleccionados[a.id] = 0
            })
            hijos.forEach((h) => {
              const plato = platos.find((p) => p.id === (h.plato_id ?? h.producto_id)) || { id: h.plato_id ?? h.producto_id, nombre: h.descripcion, precio_suplemento_menu: h.precio_unitario }
              const apartado = aps.find((a) => (a.platos || []).some((p) => p.id === plato.id))
              if (apartado) {
                platosPorApartado[apartado.id].push(plato)
                seleccionados[apartado.id] = (seleccionados[apartado.id] || 0) + 1
                necesidades[apartado.id] = Math.max(necesidades[apartado.id] || 1, seleccionados[apartado.id])
              }
            })
            setMenuSeleccion({
              tipoMenu,
              cantidad: parseFloat(padre.cantidad) || 1,
              apartados: aps,
              necesidades,
              seleccionados,
              platos: platosPorApartado,
              ...extra,
            })
            setSeccionActual(aps[0]?.id ?? null)
          } else {
            const platosPorCurso = { entrante: [], primero: [], segundo: [], tercero: [], cuarto: [] }
            hijos.forEach((h) => {
              const plato = platos.find((p) => p.id === (h.plato_id ?? h.producto_id))
              const curso = plato?.familia_curso || 'entrante'
              if (platosPorCurso[curso]) platosPorCurso[curso].push(plato || { id: h.plato_id ?? h.producto_id, nombre: h.descripcion, precio_suplemento_menu: h.precio_unitario })
            })
            const seleccionados = {}
            const necesidades = {}
            ;['entrante', 'primero', 'segundo', 'tercero', 'cuarto'].forEach((c) => {
              seleccionados[c] = platosPorCurso[c]?.length || 0
              necesidades[c] = platosPorCurso[c]?.length || 1
            })
            setMenuSeleccion({
              tipoMenu,
              cantidad: parseFloat(padre.cantidad) || 1,
              config: Object.keys(necesidades).map((c) => ({ curso: c, platos_por_persona: 1 })),
              necesidades,
              seleccionados,
              platos: platosPorCurso,
              ...extra,
            })
            setSeccionActual('entrante')
          }
        })
        .catch(() => {
          const platosPorCurso = { entrante: [], primero: [], segundo: [], tercero: [], cuarto: [] }
          hijos.forEach((h) => {
            const plato = platos.find((p) => p.id === (h.plato_id ?? h.producto_id))
            const curso = plato?.familia_curso || 'entrante'
            if (platosPorCurso[curso]) platosPorCurso[curso].push(plato || { id: h.plato_id ?? h.producto_id, nombre: h.descripcion, precio_suplemento_menu: h.precio_unitario })
          })
          const seleccionados = {}
          const necesidades = {}
          ;['entrante', 'primero', 'segundo', 'tercero', 'cuarto'].forEach((c) => {
            seleccionados[c] = platosPorCurso[c]?.length || 0
            necesidades[c] = platosPorCurso[c]?.length || 1
          })
          setMenuSeleccion({
            tipoMenu,
            cantidad: parseFloat(padre.cantidad) || 1,
            config: Object.keys(necesidades).map((c) => ({ curso: c, platos_por_persona: 1 })),
            necesidades,
            seleccionados,
            platos: platosPorCurso,
            ...extra,
          })
          setSeccionActual('entrante')
        })
    }
  }, [menuEnEdicion?.menuId, menuEnEdicion?.completando, tiposMenu, platos, cajaId])

  function handleTipoClick(tipo) {
    if (!poderEditar) {
      alert('No tienes permiso para modificar el pedido.')
      return
    }
    setTipoSeleccionado(tipo)
  }

  useEffect(() => {
    if (tipoSeleccionado) {
      Promise.all([
        fetchApi(`/api/tipos-menu/${tipoSeleccionado.id}/configuracion`).catch(() => []),
        fetchApi(`/api/tipos-menu/${tipoSeleccionado.id}/apartados${cajaId ? `?caja_id=${cajaId}` : ''}`).catch(() => []),
      ]).then(([cfg, aps]) => {
        setConfiguracion(cfg || [])
        setApartados(aps || [])
      })
    }
  }, [tipoSeleccionado?.id, cajaId])

  function handleCantidadConfirmada(cantidad) {
    if (!tipoSeleccionado) return
    const cant = parseFloat(cantidad) || 1

    if (apartados.length > 0) {
      const necesidades = {}
      const seleccionados = {}
      const platosPorApartado = {}
      apartados.forEach((a) => {
        necesidades[a.id] = Math.ceil(cant * parseFloat(a.platos_por_persona || 1))
        seleccionados[a.id] = 0
        platosPorApartado[a.id] = []
      })
      setMenuSeleccion({
        tipoMenu: tipoSeleccionado,
        cantidad: cant,
        apartados,
        necesidades,
        seleccionados,
        platos: platosPorApartado,
      })
      setSeccionActual(apartados[0]?.id ?? null)
    } else {
      const cfg = configuracion.length ? configuracion : [
        { curso: 'entrante', platos_por_persona: 1 },
        { curso: 'primero', platos_por_persona: 1 },
        { curso: 'segundo', platos_por_persona: 1 },
        { curso: 'tercero', platos_por_persona: 1 },
        { curso: 'cuarto', platos_por_persona: 1 },
      ]
      const necesidades = {}
      cfg.forEach((c) => {
        necesidades[c.curso] = Math.ceil(cant * parseFloat(c.platos_por_persona || 1))
      })
      setMenuSeleccion({
        tipoMenu: tipoSeleccionado,
        cantidad: cant,
        config: cfg,
        necesidades,
        seleccionados: { entrante: 0, primero: 0, segundo: 0, tercero: 0, cuarto: 0 },
        platos: { entrante: [], primero: [], segundo: [], tercero: [], cuarto: [] },
      })
      setSeccionActual('entrante')
    }
    setTipoSeleccionado(null)
  }

  if (tipoSeleccionado) {
    return (
      <>
        <div className="menu-tipos-grid">
          {tiposMenu.map((t) => (
            <div
              key={t.id}
              className={`producto-card ${t.id === tipoSeleccionado.id ? 'active' : ''}`}
              onClick={() => setTipoSeleccionado(t)}
            >
              <div className="producto-placeholder">📋</div>
              <div className="producto-info">
                <div className="producto-nombre">{t.nombre}</div>
              </div>
            </div>
          ))}
        </div>
        <KeypadModal
          titulo={`Cantidad - ${tipoSeleccionado.nombre}`}
          valorInicial={1}
          onConfirmar={handleCantidadConfirmada}
          onCerrar={() => setTipoSeleccionado(null)}
        />
      </>
    )
  }

  if (menuSeleccion) {
    const secciones = modoApartados
      ? (menuSeleccion.apartados || []).map((a) => ({ key: a.id, label: a.nombre }))
      : ['entrante', 'primero', 'segundo', 'tercero', 'cuarto'].map((c) => ({ key: c, label: CURSO_LABELS[c] }))

    const platosDisponibles = modoApartados
      ? (() => {
          const apartado = (menuSeleccion.apartados || []).find((a) => a.id === seccionActual)
          return apartado?.platos || []
        })()
      : (platos || []).filter((p) => {
          if (p.familia_curso !== seccionActual) return false
          const tipoFamilias = menuSeleccion.tipoMenu?.familia_menu_ids || []
          if (tipoFamilias.length === 0) return true
          const platoFamilias = p.familia_menu_ids || []
          if (platoFamilias.length === 0) return true
          return platoFamilias.some((fid) => tipoFamilias.includes(fid))
        })

    const necesario = menuSeleccion.necesidades[seccionActual] || 0
    const seleccionado = menuSeleccion.seleccionados[seccionActual] || 0
    const restante = necesario - seleccionado
    const labelActual = secciones.find((s) => s.key === seccionActual)?.label || seccionActual

    function añadirPlato(producto) {
      if (!ticket && !menuSeleccion._editando) {
        alert('Primero selecciona una mesa y ábrela.')
        return
      }
      if (restante <= 0) return
      const lista = menuSeleccion.platos[seccionActual] || []
      const platoAñadir = menuSeleccion._completando ? { ...producto, _añadidoEnSesion: true } : producto
      const nuevoSeleccion = { ...menuSeleccion }
      nuevoSeleccion.platos[seccionActual] = [...lista, platoAñadir]
      nuevoSeleccion.seleccionados[seccionActual] = (nuevoSeleccion.seleccionados[seccionActual] || 0) + 1
      setMenuSeleccion(nuevoSeleccion)
    }

    function quitarPlato(seccion, index) {
      if (menuSeleccion._completando) {
        const plato = (menuSeleccion.platos[seccion] || [])[index]
        if (!plato?._añadidoEnSesion) return
      }
      const lista = [...(menuSeleccion.platos[seccion] || [])]
      lista.splice(index, 1)
      const nuevoSeleccion = { ...menuSeleccion }
      nuevoSeleccion.platos[seccion] = lista
      nuevoSeleccion.seleccionados[seccion] = lista.length
      setMenuSeleccion(nuevoSeleccion)
    }

    const todosCompletos = secciones.every(
      (s) => (menuSeleccion.seleccionados[s.key] || 0) >= (menuSeleccion.necesidades[s.key] || 0)
    )

    const platosPayload = secciones.flatMap(
      (s) => (menuSeleccion.platos[s.key] || []).map((p) => ({
        plato_id: p.plato_id ?? p.id,
        nombre: p.nombre,
        descripcion: p.nombre,
        precio_suplemento_menu: p.precio_suplemento_menu ?? 0,
        _añadidoEnSesion: p._añadidoEnSesion,
      }))
    )

    return (
      <div className="menu-seleccion-container">
        <div className="menu-seleccion-header">
          <h3>
            {menuSeleccion._completando ? 'Completar ' : menuSeleccion._editando ? 'Editar ' : ''}{menuSeleccion.tipoMenu.nombre} × {(parseFloat(menuSeleccion.cantidad) || 1)}
          </h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setMenuSeleccion(null)
              ;(menuSeleccion._editando || menuSeleccion._completando) && onCancelarEdicion?.()
            }}
          >
            {menuSeleccion._completando ? 'Cancelar' : menuSeleccion._editando ? 'Cancelar edición' : 'Cancelar menú'}
          </button>
        </div>
        <div className="menu-contadores">
          {secciones.map((s) => {
            const nec = menuSeleccion.necesidades[s.key] || 0
            const sel = menuSeleccion.seleccionados[s.key] || 0
            const completo = sel >= nec
            return (
              <button
                key={s.key}
                type="button"
                className={`menu-curso-btn ${seccionActual === s.key ? 'active' : ''} ${completo ? 'completo' : ''}`}
                onClick={() => setSeccionActual(s.key)}
              >
                {s.label}: {sel} de {nec}
              </button>
            )
          })}
        </div>
        <div className="menu-productos-header">
          <span>
            {labelActual}: {seleccionado} de {necesario} ✓
          </span>
        </div>
        {(menuSeleccion.platos[seccionActual] || []).length > 0 && (
          <div className="menu-seleccionados-lista">
            <div className="menu-seleccionados-titulo">Seleccionados (clic en × para quitar)</div>
            <div className="menu-seleccionados-items">
              {(menuSeleccion.platos[seccionActual] || []).map((p, idx) => {
                const esOriginalCompletar = menuSeleccion._completando && !p._añadidoEnSesion && (menuSeleccion._hijosOriginalesIds || new Set()).has(p.plato_id ?? p.id)
                const puedeQuitar = poderEditar && (menuSeleccion._completando ? p._añadidoEnSesion : true)
                return (
                <div key={`${p.id}-${idx}`} className="menu-seleccionado-item">
                  <span>{p.nombre_corto || p.nombre}{esOriginalCompletar && <span className="badge-enviado" title="Ya enviado">✓</span>}</span>
                  {puedeQuitar && (
                    <button
                      type="button"
                      className="btn-quitar-plato"
                      onClick={() => quitarPlato(seccionActual, idx)}
                      title="Quitar"
                    >
                      ×
                    </button>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="productos-grid">
          {platosDisponibles.map((p) => (
            <div
              key={p.id}
              className={`producto-card ${restante <= 0 ? 'disabled' : ''}`}
              onClick={() => restante > 0 && añadirPlato(p)}
            >
              <div className="producto-img-wrap">
                {p.ruta_imagen && !imgErrors.has(p.id) ? (
                  <img
                    className="producto-img"
                    src={getImagenUrl(p.ruta_imagen)}
                    alt={p.nombre}
                    onError={() => setImgErrors((s) => new Set(s).add(p.id))}
                  />
                ) : (
                  <div className="producto-placeholder">🍽️</div>
                )}
              </div>
              <div className="producto-info">
                <div className="producto-nombre">{p.nombre_corto || p.nombre}</div>
                <div className="producto-badges">
                  {p.vegetariano && <span className="producto-badge" title="Vegetariano">🥬</span>}
                  {p.vegano && <span className="producto-badge" title="Vegano">🌱</span>}
                  {p.apto_celiaco && <span className="producto-badge" title="Apto celíacos">🌾</span>}
                </div>
                <div className="producto-precio">{formatPrecio(p.precio_base)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="menu-acciones">
          {todosCompletos && (
            <p className="menu-completo-msg">Menú completo ✓</p>
          )}
          {(menuSeleccion.platos[seccionActual] || []).length > 0 && (
            <button
              type="button"
              className={`btn ${todosCompletos ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => {
                if (menuSeleccion._completando) {
                  const nuevosPlatos = platosPayload
                    .filter((p) => p._añadidoEnSesion)
                    .map(({ _añadidoEnSesion, ...p }) => p)
                  if (nuevosPlatos.length > 0) {
                    onMenuCompletado?.(menuSeleccion._padreId, nuevosPlatos)
                  }
                  onCancelarEdicion?.()
                } else if (menuSeleccion._editando) {
                  onMenuEditado?.(menuSeleccion._menuId, menuSeleccion.tipoMenu, menuSeleccion.cantidad, platosPayload)
                } else {
                  onAñadirMenuCompleto(menuSeleccion.tipoMenu, menuSeleccion.cantidad, platosPayload)
                }
                setMenuSeleccion(null)
              }}
            >
              {menuSeleccion._completando
                ? 'Añadir platos al menú'
                : menuSeleccion._editando
                  ? 'Guardar cambios'
                  : todosCompletos
                    ? 'Finalizar menú'
                    : 'Añadir al pedido (incompleto)'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="menu-tipos-grid">
      {tiposMenu.map((t) => (
        <div
          key={t.id}
          className="producto-card"
          onClick={() => handleTipoClick(t)}
        >
          <div className="producto-placeholder">📋</div>
          <div className="producto-info">
            <div className="producto-nombre">{t.nombre}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
