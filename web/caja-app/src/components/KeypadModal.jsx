import { useState, useEffect, useCallback } from 'react'

export default function KeypadModal({ titulo, valorInicial, onConfirmar, onCerrar }) {
  const [valor, setValor] = useState(valorInicial === undefined || valorInicial === '' ? '' : String(valorInicial))

  const tecla = useCallback((n) => {
    setValor((v) => {
      if (n === '.' && v.includes('.')) return v
      if (v === '' && n === '.') return '0.'
      if (v === '' || v === '0') return n === '.' ? '0.' : n
      return v + n
    })
  }, [])

  function borrar() {
    setValor((v) => (v.length > 1 ? v.slice(0, -1) : ''))
  }

  function limpiar() {
    setValor('')
  }

  function confirmar() {
    const num = parseFloat(valor) || 1
    if (num > 0) {
      onConfirmar(num)
      onCerrar()
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onCerrar()
        return
      }
      if (e.key === 'Enter') {
        const num = parseFloat(valor) || 1
        if (num > 0) {
          onConfirmar(num)
          onCerrar()
        }
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setValor((v) => (v.length > 1 ? v.slice(0, -1) : ''))
        return
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        tecla(e.key)
        return
      }
      if (e.key === ',' || e.key === '.') {
        e.preventDefault()
        tecla('.')
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [valor, onCerrar, onConfirmar, tecla])

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-keypad keypad-numpad" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">{titulo}</h3>
        <div className="keypad-display">{valor === '' ? '' : valor}</div>
        <div className="keypad-teclas keypad-numpad-grid">
          <button className="keypad-btn" onClick={() => tecla('7')}>7</button>
          <button className="keypad-btn" onClick={() => tecla('8')}>8</button>
          <button className="keypad-btn" onClick={() => tecla('9')}>9</button>
          <button className="keypad-btn keypad-func" onClick={borrar}>⌫</button>
          <button className="keypad-btn" onClick={() => tecla('4')}>4</button>
          <button className="keypad-btn" onClick={() => tecla('5')}>5</button>
          <button className="keypad-btn" onClick={() => tecla('6')}>6</button>
          <button className="keypad-btn keypad-func" onClick={limpiar}>C</button>
          <button className="keypad-btn" onClick={() => tecla('1')}>1</button>
          <button className="keypad-btn" onClick={() => tecla('2')}>2</button>
          <button className="keypad-btn" onClick={() => tecla('3')}>3</button>
          <button className="keypad-btn keypad-ok" onClick={confirmar}>↵</button>
          <button className="keypad-btn keypad-zero" onClick={() => tecla('0')}>0</button>
          <button className="keypad-btn" onClick={() => tecla('.')}>.</button>
        </div>
      </div>
    </div>
  )
}
