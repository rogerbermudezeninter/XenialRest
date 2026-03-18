import KeypadModal from './KeypadModal'

export default function MesaKeypadModal({ mesas, mesasLibres, onSeleccionar, onReabrirMesa, onCerrar }) {
  function confirmar(num) {
    const n = Math.floor(num)
    if (n < 1 || n > 999) return
    const mesa = mesas.find((m) => m.id === n || m.codigo === String(n))
    if (mesa) {
      const libre = mesasLibres?.some((m) => m.id === mesa.id) ?? true
      if (libre) {
        onSeleccionar(mesa.id)
        onCerrar()
      } else if (onReabrirMesa) {
        onReabrirMesa(mesa.id)
        onCerrar()
      } else {
        alert(`Mesa ${n} está ocupada.`)
      }
    } else {
      alert(`Mesa ${n} no encontrada. Mesas: 1-300`)
    }
  }

  return (
    <KeypadModal
      titulo="Número de mesa"
      valorInicial={1}
      onConfirmar={confirmar}
      onCerrar={onCerrar}
    />
  )
}
