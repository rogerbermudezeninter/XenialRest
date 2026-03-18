import { useState } from 'react'

export default function PinKeypad({ onConfirmar }) {
  const [valor, setValor] = useState('')

  function tecla(n) {
    setValor((v) => v + n)
  }

  function borrar() {
    setValor((v) => v.slice(0, -1))
  }

  function limpiar() {
    setValor('')
  }

  function confirmar() {
    onConfirmar(valor || '0')
  }

  return (
    <div className="pin-keypad">
      <div className="keypad-display">{valor || '••••'}</div>
      <div className="keypad-teclas keypad-numpad-grid">
        <button type="button" className="keypad-btn" onClick={() => tecla('7')}>7</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('8')}>8</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('9')}>9</button>
        <button type="button" className="keypad-btn keypad-func" onClick={borrar}>⌫</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('4')}>4</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('5')}>5</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('6')}>6</button>
        <button type="button" className="keypad-btn keypad-func" onClick={limpiar}>C</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('1')}>1</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('2')}>2</button>
        <button type="button" className="keypad-btn" onClick={() => tecla('3')}>3</button>
        <button type="button" className="keypad-btn keypad-ok" onClick={confirmar}>↵</button>
        <button type="button" className="keypad-btn keypad-zero" onClick={() => tecla('0')}>0</button>
        <span className="keypad-filler" />
      </div>
    </div>
  )
}
