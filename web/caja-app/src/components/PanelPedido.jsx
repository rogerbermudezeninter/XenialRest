import { useState, useEffect } from 'react'
import MesaKeypadModal from './MesaKeypadModal'
import KeypadModal from './KeypadModal'
import OnScreenKeyboard from './OnScreenKeyboard'

export default function PanelPedido({
  mesas,
  mesasLibres,
  usuarios,
  usuarioLogeado,
  ticket,
  lineas,
  totalUnidades,
  totalImporte,
  poderEditar,
  onAbrirMesa,
  onReabrirMesa,
  onCerrarTicket,
  onEnviarCocina,
  onCobrar,
  onAbrirCajon,
  onCerrarCaja,
  onCambiarCantidad,
  onAbrirConfiguradorMenu,
  onEliminarLinea,
  onComentariosCocina,
  onCambiarComensales,
  formatPrecio,
}) {
  const [comensales, setComensales] = useState(1)
  const [mostrarSelectorMesa, setMostrarSelectorMesa] = useState(false)
  const [mostrarKeypadComensales, setMostrarKeypadComensales] = useState(false)
  const [comentariosLinea, setComentariosLinea] = useState(null)

  useEffect(() => {
    if (ticket?.comensales != null) setComensales(parseInt(ticket.comensales, 10) || 1)
  }, [ticket?.id, ticket?.comensales])

  function seleccionarMesa(id) {
    onAbrirMesa(id, usuarioLogeado?.id || null, comensales)
  }

  function cambiarComensales(delta) {
    const nuevo = Math.max(1, comensales + delta)
    setComensales(nuevo)
    if (ticket?.id && ticket.id !== 'demo') onCambiarComensales?.(ticket.id, nuevo)
  }

  return (
    <aside className="panel-pedido">
      <div className="pedido-header">
        <div className="pedido-meta-linea">
          <button
            type="button"
            className="btn-meta btn-mesa"
            onClick={() => ticket && onCerrarTicket ? (onCerrarTicket(), setMostrarSelectorMesa(true)) : setMostrarSelectorMesa(true)}
          >
            {ticket ? (ticket.mesa_nombre || `Mesa ${ticket.mesa_id}`) : 'Seleccionar mesa'}
          </button>
          <button
            type="button"
            className="btn-meta"
            disabled={!!ticket && (ticket.estado === 'cobrado' || ticket.estado === 'anulado')}
            onClick={() => setMostrarKeypadComensales(true)}
          >
            {comensales} comensal{comensales !== 1 ? 'es' : ''}
          </button>
          <span className="btn-meta btn-meta-static" title="Camarero (sesión)">
            {usuarioLogeado?.nombre || '—'}
          </span>
        </div>
      </div>

      <div className="pedido-lineas">
        {lineas.length === 0 ? (
          <p className="pedido-vacio">Selecciona una mesa y añade productos</p>
        ) : (
          (() => {
            const lineasNormales = []
            const menuGroups = new Map()
            lineas.forEach((l, i) => {
              const item = { ...l, _idx: i }
              if (l.menu_id) {
                if (!menuGroups.has(l.menu_id)) menuGroups.set(l.menu_id, [])
                menuGroups.get(l.menu_id).push(item)
              } else if (l.tipo_menu_id && !l.linea_padre_id) {
                const key = `db-${l.id}`
                menuGroups.set(key, [item])
              } else if (l.linea_padre_id) {
                const key = `db-${l.linea_padre_id}`
                if (!menuGroups.has(key)) menuGroups.set(key, [])
                menuGroups.get(key).push(item)
              } else {
                lineasNormales.push(item)
              }
            })
            return (
              <>
                {lineasNormales.map((l) => {
                  const enviada = l.estado && l.estado !== 'pendiente'
                  return (
                  <div key={l._idx} className={`linea-item ${enviada ? 'linea-enviada' : ''}`}>
                    <div className="linea-info">
                      <div className="linea-desc">
                        {l.descripcion}
                        {enviada && <span className="badge-enviado" title="Enviado a cocina">✓</span>}
                      </div>
                      <div className="linea-detalle">
                        {formatPrecio(l.precio_unitario)} × {(parseFloat(l.cantidad) || 0)}
                      </div>
                    </div>
                    <div className="linea-cantidad">
                      {poderEditar && (
                        <>
                          <button type="button" onClick={() => onCambiarCantidad(l._idx, -1)} disabled={enviada}>−</button>
                          <span>{parseFloat(l.cantidad) || 0}</span>
                          <button type="button" onClick={() => onCambiarCantidad(l._idx, 1)}>+</button>
                        </>
                      )}
                    </div>
                    <div className="linea-comentarios">
                      {poderEditar && !enviada && (
                        <button
                          type="button"
                          className={`btn-comentarios ${l.comentarios_cocina ? 'has-comentarios' : ''}`}
                          onClick={() => setComentariosLinea({ idx: l._idx, linea: l, valor: l.comentarios_cocina || '' })}
                          title={l.comentarios_cocina ? 'Editar comentarios cocina' : 'Añadir comentarios cocina'}
                        >
                          {l.comentarios_cocina ? '💬' : '⊕'}
                        </button>
                      )}
                    </div>
                    <div className="linea-importe">{formatPrecio(parseFloat(l.importe) || 0)}</div>
                  </div>
                  )
                })}
                {[...menuGroups.values()].map((grupo) => {
                  const padre = grupo.find((g) => g.es_menu_padre || (g.tipo_menu_id && !g.linea_padre_id))
                  const hijos = grupo.filter((g) => g !== padre)
                  const idxPadre = padre._idx
                  return (
                    <div
                      key={padre.menu_id || `db-${padre.id}`}
                      className="linea-menu-block"
                      role="button"
                      tabIndex={0}
                      onClick={() => poderEditar && onAbrirConfiguradorMenu?.({ padre, hijos })}
                      onKeyDown={(e) => poderEditar && (e.key === 'Enter' || e.key === ' ') && onAbrirConfiguradorMenu?.({ padre, hijos })}
                    >
                      <div className={`linea-item linea-menu-padre ${(padre.estado && padre.estado !== 'pendiente') ? 'linea-enviada' : ''}`}>
                        <div className="linea-info">
                          <div className="linea-desc">
                            📋 {padre.descripcion}
                            {(padre.estado && padre.estado !== 'pendiente') && <span className="badge-enviado" title="Enviado a cocina">✓</span>}
                          </div>
                          <div className="linea-detalle">
                            {formatPrecio(padre.precio_unitario)} × {(parseFloat(padre.cantidad) || 0)}
                          </div>
                        </div>
                        <div className="linea-importe">{formatPrecio(parseFloat(padre.importe) || 0)}</div>
                      </div>
                      <div className="linea-menu-hijos">
                        {hijos.map((h) => {
                          const hEnviado = h.estado && h.estado !== 'pendiente'
                          return (
                          <div key={h._idx} className="linea-item linea-menu-hijo">
                            <div className="linea-info">
                              <div className="linea-desc">└ {h.descripcion}</div>
                              {h.precio_unitario > 0 && (
                                <div className="linea-detalle suplemento">
                                  +{formatPrecio(h.precio_unitario)} suplemento
                                </div>
                              )}
                            </div>
                            <div className="linea-acciones-hijo">
                              {poderEditar && !hEnviado && (
                                <button
                                  type="button"
                                  className={`btn-comentarios ${h.comentarios_cocina ? 'has-comentarios' : ''}`}
                                  onClick={(ev) => { ev.stopPropagation(); setComentariosLinea({ idx: h._idx, linea: h, valor: h.comentarios_cocina || '' }); }}
                                  title={h.comentarios_cocina ? 'Editar comentarios cocina' : 'Añadir comentarios cocina'}
                                >
                                  {h.comentarios_cocina ? '💬' : '⊕'}
                                </button>
                              )}
                              {poderEditar && !hEnviado && onEliminarLinea && (
                                <button
                                  type="button"
                                  className="btn-papelera"
                                  onClick={(ev) => { ev.stopPropagation(); onEliminarLinea(h); }}
                                  title="Eliminar plato"
                                >
                                  🗑
                                </button>
                              )}
                              <div className="linea-importe">{parseFloat(h.importe) > 0 ? formatPrecio(h.importe) : '—'}</div>
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )
          })()
        )}
      </div>

      <div className="pedido-totales">
        <div className="total-row">
          <span>Unidades</span>
          <span>{(Number(totalUnidades) || 0).toFixed(2)}</span>
        </div>
        <div className="total-row">
          <span>Líneas</span>
          <span>{lineas.length}</span>
        </div>
        <div className="total-row total-principal">
          <span>Total</span>
          <span>{formatPrecio(totalImporte)}</span>
        </div>
      </div>

      <div className="pedido-acciones">
        {!ticket ? (
          <button className="btn btn-primary" onClick={() => setMostrarSelectorMesa(true)}>
            Seleccionar mesa
          </button>
        ) : (
          <div className="pedido-acciones-grid">
            <button
              className="btn btn-success btn-accion-cuadrada"
              disabled={lineas.length === 0}
              onClick={onEnviarCocina}
              title="Enviar a cocina"
            >
              <span className="btn-icon">🍳</span>
              <span className="btn-label">Enviar cocina</span>
            </button>
            <button
              className="btn btn-warning btn-accion-cuadrada"
              disabled={lineas.length === 0}
              onClick={onCobrar}
              title="Cobrar"
            >
              <span className="btn-icon">💰</span>
              <span className="btn-label">Cobrar</span>
            </button>
            <button
              className="btn btn-secondary btn-accion-cuadrada"
              onClick={onAbrirCajon}
              title="Abrir cajón"
            >
              <span className="btn-icon">📂</span>
              <span className="btn-label">Abrir cajón</span>
            </button>
            <button
              className="btn btn-secondary btn-accion-cuadrada"
              onClick={onCerrarCaja}
              title="Cerrar caja"
            >
              <span className="btn-icon">🔒</span>
              <span className="btn-label">Cerrar caja</span>
            </button>
          </div>
        )}
      </div>
      {mostrarKeypadComensales && (
        <KeypadModal
          titulo="Comensales"
          valorInicial={comensales}
          onConfirmar={(v) => {
            const n = Math.max(1, Math.round(v))
            setComensales(n)
            if (ticket?.id && ticket.id !== 'demo') onCambiarComensales?.(ticket.id, n)
            setMostrarKeypadComensales(false)
          }}
          onCerrar={() => setMostrarKeypadComensales(false)}
        />
      )}
      {comentariosLinea && (
        <OnScreenKeyboard
          valorInicial={comentariosLinea.valor}
          titulo="Comentarios para cocina"
          onConfirmar={(v) => {
            onComentariosCocina?.(comentariosLinea.idx, v, comentariosLinea.linea)
            setComentariosLinea(null)
          }}
          onCerrar={() => setComentariosLinea(null)}
        />
      )}
      {mostrarSelectorMesa && (
        <MesaKeypadModal
          mesas={mesas}
          mesasLibres={mesasLibres || mesas}
          onSeleccionar={seleccionarMesa}
          onReabrirMesa={onReabrirMesa}
          onCerrar={() => setMostrarSelectorMesa(false)}
        />
      )}
    </aside>
  )
}
