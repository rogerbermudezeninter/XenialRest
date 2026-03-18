import { useState } from 'react'

export default function ProductosGrid({
  platos,
  onAñadir,
  ticket,
  poderEditar = true,
  getImagenUrl,
  formatPrecio,
}) {
  const [imgErrors, setImgErrors] = useState(new Set())

  function handleClick(plato) {
    if (!poderEditar) {
      alert('No tienes permiso para modificar el pedido.')
      return
    }
    if (!ticket) {
      alert('Primero selecciona una mesa y ábrela.')
      return
    }
    if (!plato.activo) return
    onAñadir(plato, 1)
  }

  return (
    <div className="productos-grid">
      {(platos || []).map((p) => (
        <div
          key={p.id}
          className={`producto-card ${!p.activo ? 'no-disponible' : ''} ${!poderEditar ? 'disabled' : ''}`}
          onClick={() => handleClick(p)}
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
  )
}
