import { useState, useEffect } from 'react'
import { getImagenUrl } from '../api'

export default function Header({ conectado, modoDemo, usuario, empresas, cajas, cajaId, onChangeCamarero, onConfig, esAdmin }) {
  const [fechaHora, setFechaHora] = useState('')
  const empresa = (empresas || [])[0]
  const caja = (cajas || []).find((c) => c.id === cajaId) || (cajas || [])[0]

  useEffect(() => {
    const update = () => {
      setFechaHora(
        new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="header">
      <div className="header-left">
        {usuario && (
          <div
            className="header-avatar"
            onClick={onChangeCamarero}
            title={`${usuario.nombre} - Clic para cambiar`}
          >
            {usuario.ruta_foto ? (
              <img src={getImagenUrl(usuario.ruta_foto)} alt={usuario.nombre} />
            ) : (
              usuario.nombre.charAt(0)
            )}
          </div>
        )}
        {esAdmin && (
          <button
            type="button"
            className="header-btn-config"
            onClick={onConfig}
            title="Configuración / Mantenimientos"
          >
            ⚙️
          </button>
        )}
        <div className="header-brand">
          <span className="header-empresa">{empresa?.nombre || 'XenialRest'}</span>
          {caja && <span className="header-caja">{caja.nombre}</span>}
        </div>
      </div>
      <div className="header-info">
        <span>{fechaHora}</span>
        <span className={`status ${conectado ? 'conectado' : modoDemo ? 'demo' : 'error'}`}>
          {conectado ? 'Conectado' : modoDemo ? 'Modo demo' : 'Error de conexión'}
        </span>
      </div>
    </header>
  )
}
