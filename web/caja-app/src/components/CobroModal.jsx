import { useState, useMemo, useEffect } from 'react'
import KeypadModal from './KeypadModal'
import { generarTicketPrn } from '../utils/ticketPrn'

function flattenLineas(lineas) {
  if (!lineas?.length) return []
  return lineas.map((l, i) => ({
    _idx: i,
    descripcion: (l.es_menu_padre || (l.tipo_menu_id && !l.linea_padre_id) ? '📋 ' : l.linea_padre_id ? '└ ' : '') + (l.descripcion || ''),
    importe: parseFloat(l.importe) || 0,
  }))
}

export default function CobroModal({
  ticket,
  lineas,
  formasPago,
  usuarioId,
  formatPrecio,
  empresaNombre,
  onCerrar,
  onConfirmar,
}) {
  const [cuentas, setCuentas] = useState([{ id: 0, nombre: 'Cuenta 1', lineasIds: [], pagos: [] }])
  const [cuentaActiva, setCuentaActiva] = useState(0)
  const [keypadPago, setKeypadPago] = useState(null)

  const lineasFlat = useMemo(() => flattenLineas(lineas || []), [lineas])

  useEffect(() => {
    if (!lineas?.length) return
    setCuentas((prev) => {
      if (prev.length !== 1 || (prev[0].lineasIds?.length ?? 0) > 0) return prev
      return [{ ...prev[0], lineasIds: lineas.map((_, i) => i) }]
    })
  }, [lineas])
  const totalTicket = useMemo(() => lineas.reduce((s, l) => s + (parseFloat(l.importe) || 0), 0), [lineas])

  const formasPagoList = formasPago?.length > 0 ? formasPago : [
    { id: 1, codigo: 'EFECTIVO', nombre: 'Efectivo' },
    { id: 2, codigo: 'TARJETA', nombre: 'Tarjeta' },
  ]

  function toggleLineaEnCuenta(cuentaIdx, lineaIdx) {
    setCuentas((prev) => {
      const next = prev.map((c, i) => {
        const ids = [...(c.lineasIds || [])]
        const pos = ids.indexOf(lineaIdx)
        if (i === cuentaIdx) {
          if (pos >= 0) ids.splice(pos, 1)
          else ids.push(lineaIdx)
          return { ...c, lineasIds: ids.sort((a, b) => a - b) }
        }
        if (pos >= 0) ids.splice(pos, 1)
        return { ...c, lineasIds: ids }
      })
      return next
    })
  }

  function addCuenta() {
    setCuentas((prev) => [...prev, { id: Date.now(), nombre: `Cuenta ${prev.length + 1}`, lineasIds: [], pagos: [] }])
    setCuentaActiva(cuentas.length)
  }

  function removeCuenta(idx) {
    if (cuentas.length <= 1) return
    setCuentas((prev) => prev.filter((_, i) => i !== idx))
    setCuentaActiva(Math.max(0, cuentaActiva - (idx < cuentaActiva ? 1 : 0)))
  }

  function addPago(cuentaIdx, formaPagoId) {
    setKeypadPago({ cuentaIdx, formaPagoId, formaNombre: formasPagoList.find((f) => f.id === formaPagoId)?.nombre })
  }

  function confirmarPagoImporte(importe) {
    if (!keypadPago || importe <= 0) return
    const { cuentaIdx, formaPagoId } = keypadPago
    setCuentas((prev) => {
      const next = [...prev]
      const c = { ...next[cuentaIdx], pagos: [...(next[cuentaIdx].pagos || []), { forma_pago_id: formaPagoId, importe: parseFloat(importe) || 0 }] }
      next[cuentaIdx] = c
      return next
    })
    setKeypadPago(null)
  }

  function removePago(cuentaIdx, pagoIdx) {
    setCuentas((prev) => {
      const next = [...prev]
      const c = { ...next[cuentaIdx], pagos: (next[cuentaIdx].pagos || []).filter((_, i) => i !== pagoIdx) }
      next[cuentaIdx] = c
      return next
    })
  }

  const cuentaActual = cuentas[cuentaActiva]
  const lineasAsignadas = new Set(cuentas.flatMap((c) => c.lineasIds || []))
  const totalPorCuenta = cuentas.map((c) => {
    const impLineas = (c.lineasIds || []).reduce((s, idx) => s + (parseFloat(lineas[idx]?.importe) || 0), 0)
    const impPagos = (c.pagos || []).reduce((s, p) => s + (parseFloat(p.importe) || 0), 0)
    return { total: impLineas, pagado: impPagos, pendiente: impLineas - impPagos }
  })

  const totalAsignado = cuentas.reduce((s, c) => s + (c.lineasIds || []).reduce((ss, idx) => ss + (parseFloat(lineas[idx]?.importe) || 0), 0), 0)
  const todosPagosCompletos = cuentas.every((c, i) => Math.abs(totalPorCuenta[i].pendiente) < 0.01)
  const todasLineasAsignadas = lineasFlat.length === 0 || lineasFlat.every((l) => lineasAsignadas.has(l._idx))

  const ticketPrnPorCuenta = useMemo(() => {
    return cuentas.map((c) =>
      generarTicketPrn({
        cuenta: c,
        lineas,
        pagos: c.pagos,
        ticket,
        formasPago: formasPagoList,
        empresaNombre,
        formatPrecio,
      })
    )
  }, [cuentas, lineas, ticket, formasPagoList, empresaNombre, formatPrecio])

  function imprimirTicket(cuentaIdx) {
    const lineas = ticketPrnPorCuenta[cuentaIdx] || []
    const contenido = lineas.join('\n')
    const ventana = window.open('', '_blank')
    if (!ventana) return
    ventana.document.write(
      '<pre style="font-family:Consolas,Monaco,monospace;font-size:12px;padding:16px;white-space:pre-wrap;max-width:320px;">' +
      contenido.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '</pre>'
    )
    ventana.document.close()
    ventana.focus()
    ventana.print()
    ventana.close()
  }

  function descargarPrn(cuentaIdx) {
    const lineas = ticketPrnPorCuenta[cuentaIdx] || []
    const contenido = lineas.join('\r\n')
    const blob = new Blob([contenido], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ticket-${cuentas[cuentaIdx]?.nombre || 'cuenta'}-${ticket?.numero_ticket || ticket?.id || 'ticket'}.prn`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleConfirmar() {
    if (!todasLineasAsignadas) {
      alert('Asigna todas las líneas del ticket a alguna cuenta.')
      return
    }
    if (!todosPagosCompletos) {
      alert('Cada cuenta debe estar pagada al completo.')
      return
    }
    const todosPagos = cuentas.flatMap((c) => (c.pagos || []).map((p) => ({ forma_pago_id: p.forma_pago_id, importe: p.importe })))
    await onConfirmar(todosPagos)
    onCerrar()
  }

  return (
    <div className="cobro-overlay" onClick={onCerrar}>
      <div className="cobro-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cobro-header">
          <h2>Cobro — {ticket?.mesa_nombre || `Mesa ${ticket?.mesa_id}`}</h2>
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        <div className="cobro-body">
          <aside className="cobro-ticket">
            <h3>Ticket</h3>
            <div className="cobro-lineas">
              {lineasFlat.map((l) => {
                const enCuenta = (cuentaActual?.lineasIds || []).includes(l._idx)
                return (
                  <div key={l._idx} className={`cobro-linea ${enCuenta ? 'asignada' : ''}`}>
                    <label className="cobro-linea-check">
                      <input
                        type="checkbox"
                        checked={enCuenta}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (cuentaActual) toggleLineaEnCuenta(cuentaActiva, l._idx)
                        }}
                      />
                      <span className="cobro-linea-desc">{l.descripcion}</span>
                    </label>
                    <span className="cobro-linea-importe">{formatPrecio(l.importe)}</span>
                  </div>
                )
              })}
            </div>
            <div className="cobro-ticket-total">
              <span>Total ticket</span>
              <span>{formatPrecio(totalTicket)}</span>
            </div>
          </aside>
          <section className="cobro-cuentas">
            <div className="cobro-pagecontrol">
              {cuentas.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cobro-tab ${i === cuentaActiva ? 'active' : ''}`}
                  onClick={() => setCuentaActiva(i)}
                >
                  {c.nombre}
                  {totalPorCuenta[i] && (
                    <span className="cobro-tab-total">{formatPrecio(totalPorCuenta[i].total)}</span>
                  )}
                </button>
              ))}
              <button type="button" className="cobro-tab-add" onClick={addCuenta} title="Añadir cuenta">
                +
              </button>
            </div>
            {cuentaActual && (
              <div className="cobro-cuenta-panel">
                <div className="cobro-cuenta-info">
                  <p>Asigna las líneas marcadas arriba a esta cuenta. Total: <strong>{formatPrecio(totalPorCuenta[cuentaActiva]?.total || 0)}</strong></p>
                </div>
                <div className="cobro-pagos-section">
                  <h4>Líneas de pago</h4>
                  {(cuentaActual.pagos || []).map((p, pi) => (
                    <div key={pi} className="cobro-pago-line">
                      <span>{formasPagoList.find((f) => f.id === p.forma_pago_id)?.nombre || '—'}</span>
                      <span>{formatPrecio(p.importe)}</span>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removePago(cuentaActiva, pi)}>✕</button>
                    </div>
                  ))}
                  <div className="cobro-pagos-add">
                    {formasPagoList.map((fp) => (
                      <button key={fp.id} type="button" className="btn btn-sm" onClick={() => addPago(cuentaActiva, fp.id)}>
                        + {fp.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cobro-cuenta-resumen">
                  <span>Pagado: {formatPrecio(totalPorCuenta[cuentaActiva]?.pagado || 0)}</span>
                  <span className={Math.abs(totalPorCuenta[cuentaActiva]?.pendiente || 0) < 0.01 ? 'ok' : 'pendiente'}>
                    Pendiente: {formatPrecio(totalPorCuenta[cuentaActiva]?.pendiente || 0)}
                  </span>
                </div>
                <div className="cobro-ticket-preview">
                  <div className="cobro-ticket-preview-header">
                    <h4>Vista previa ticket</h4>
                    <div className="cobro-ticket-actions">
                      <button type="button" className="btn btn-sm" onClick={() => imprimirTicket(cuentaActiva)}>
                        Imprimir
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => descargarPrn(cuentaActiva)}>
                        Descargar PRN
                      </button>
                    </div>
                  </div>
                  <pre className="cobro-ticket-prn">
                    {(ticketPrnPorCuenta[cuentaActiva] || []).map((linea, i) => (
                      <span key={i}>{linea}{'\n'}</span>
                    ))}
                  </pre>
                </div>
                {cuentas.length > 1 && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeCuenta(cuentaActiva)}>
                    Eliminar cuenta
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
        <div className="cobro-footer">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!todasLineasAsignadas || !todosPagosCompletos}
            onClick={handleConfirmar}
          >
            Confirmar cobro
          </button>
        </div>
      </div>
      {keypadPago && (
        <KeypadModal
          titulo={`Importe - ${keypadPago.formaNombre}`}
          valorInicial={0}
          onConfirmar={(v) => { confirmarPagoImporte(parseFloat(v) || 0); setKeypadPago(null) }}
          onCerrar={() => setKeypadPago(null)}
        />
      )}
    </div>
  )
}
