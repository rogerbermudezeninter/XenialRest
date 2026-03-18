/**
 * Genera el contenido del ticket en formato PRN (texto plano para impresora térmica).
 * Ancho típico 80mm ≈ 32 caracteres.
 */
const ANCHO = 32

function pad(str, len = ANCHO) {
  return String(str || '').slice(0, len).padEnd(len)
}

function centrar(str, len = ANCHO) {
  const s = String(str || '').slice(0, len)
  const padLeft = Math.max(0, Math.floor((len - s.length) / 2))
  return ' '.repeat(padLeft) + s + ' '.repeat(len - padLeft - s.length)
}

function lineaPrecio(desc, importe, formatear) {
  const imp = formatear ? formatear(importe) : `${Number(importe).toFixed(2)} €`
  const maxDesc = ANCHO - imp.length - 2
  const d = String(desc || '').slice(0, maxDesc)
  return d + ' '.repeat(Math.max(0, maxDesc - d.length)) + ' ' + imp
}

export function generarTicketPrn({ cuenta, lineas, pagos, ticket, formasPago, empresaNombre, formatPrecio }) {
  const lineasOut = []
  const sep = '-'.repeat(ANCHO)
  const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })

  lineasOut.push(centrar(empresaNombre || 'RESTAURANTE'))
  lineasOut.push(sep)
  lineasOut.push(`Mesa: ${ticket?.mesa_nombre || `Mesa ${ticket?.mesa_id}`}`)
  lineasOut.push(`Ticket: ${ticket?.numero_ticket || ticket?.id || '—'}`)
  lineasOut.push(`Fecha: ${fecha}`)
  if (cuenta?.nombre) {
    lineasOut.push(cuenta.nombre)
  }
  lineasOut.push(sep)

  const ids = cuenta?.lineasIds || []
  let total = 0
  for (const idx of ids) {
    const l = lineas?.[idx]
    if (!l) continue
    const imp = parseFloat(l.importe) || 0
    total += imp
    const desc = (l.es_menu_padre || (l.tipo_menu_id && !l.linea_padre_id) ? 'Menu ' : l.linea_padre_id ? '  + ' : '') + (l.descripcion || '')
    lineasOut.push(lineaPrecio(desc, imp, formatPrecio))
  }

  lineasOut.push(sep)
  lineasOut.push(lineaPrecio('TOTAL', total, formatPrecio))
  lineasOut.push(sep)

  for (const p of pagos || []) {
    const nombre = formasPago?.find((f) => f.id === p.forma_pago_id)?.nombre || 'Pago'
    const imp = parseFloat(p.importe) || 0
    lineasOut.push(lineaPrecio(nombre, imp, formatPrecio))
  }
  lineasOut.push(sep)
  lineasOut.push(centrar('Gracias por su visita'))
  lineasOut.push('')

  return lineasOut
}
