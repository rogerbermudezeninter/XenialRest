import { useState } from 'react'
import PinKeypad from './PinKeypad'
import { getImagenUrl } from '../api'

export default function LoginModal({ usuarios, usuario, onLogin, onSeleccionarCaja, onCancelar, onCambiarUsuario }) {
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [error, setError] = useState('')
  const pendienteCaja = usuario?._pendienteCaja && usuario?.cajas?.length > 1

  async function handlePinConfirmar(pin) {
    if (!usuarioSeleccionado) return
    setError('')
    try {
      await onLogin(usuarioSeleccionado.id, pin)
    } catch (err) {
      setError(err.message || 'PIN incorrecto')
    }
  }

  if (pendienteCaja) {
    return (
      <div className="login-overlay" onClick={onCancelar}>
        <div className="modal-login" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-titulo">Seleccionar caja</h3>
          <p className="login-subtitulo">{usuario?.nombre}, elige la caja a usar</p>
          {(onCambiarUsuario || onCancelar) && (
            <button type="button" className="btn btn-secondary btn-volver" onClick={onCambiarUsuario || onCancelar} style={{ marginBottom: '1rem' }}>
              Cambiar de usuario
            </button>
          )}
          <div className="login-usuarios">
            {usuario.cajas.map((c) => (
              <button
                key={c.id}
                type="button"
                className="login-usuario-btn"
                onClick={() => onSeleccionarCaja(c)}
              >
                <span className="login-avatar">{c.nombre?.charAt(0) || 'C'}</span>
                <span className="login-nombre">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-overlay" onClick={onCancelar}>
      <div className="modal-login" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">
          {usuarioSeleccionado ? `PIN - ${usuarioSeleccionado.nombre}` : 'Seleccionar camarero'}
        </h3>
        {!usuarioSeleccionado ? (
          <>
            <p className="login-subtitulo">Selecciona tu usuario e introduce el PIN</p>
            {onCancelar && (
              <button type="button" className="btn btn-secondary btn-volver" onClick={onCancelar} style={{ marginBottom: '1rem' }}>
                Cancelar
              </button>
            )}
            <div className="login-usuarios">
              {usuarios.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="login-usuario-btn"
                  onClick={() => setUsuarioSeleccionado(u)}
                >
                  <span className="login-avatar">
                    {u.ruta_foto ? (
                      <img src={getImagenUrl(u.ruta_foto)} alt={u.nombre} />
                    ) : (
                      u.nombre.charAt(0)
                    )}
                  </span>
                  <span className="login-nombre">{u.nombre}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <PinKeypad onConfirmar={handlePinConfirmar} />
            {error && <p className="login-error">{error}</p>}
            <button
              type="button"
              className="btn btn-secondary btn-volver"
              onClick={() => { setUsuarioSeleccionado(null); setError('') }}
            >
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  )
}
