import { useState, useEffect, useCallback } from 'react'

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
  [' ', '↵'],
]

export default function OnScreenKeyboard({ valorInicial = '', onConfirmar, onCerrar, titulo = 'Teclado', maxLength }) {
  const [valor, setValor] = useState(valorInicial === undefined || valorInicial === null ? '' : String(valorInicial))

  const tecla = useCallback((char) => {
    setValor((v) => {
      if (char === '⌫') return v.slice(0, -1)
      if (char === '↵') return v
      if (maxLength && v.length >= maxLength) return v
      return v + char
    })
  }, [maxLength])

  function confirmar() {
    onConfirmar(valor)
    onCerrar?.()
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onCerrar?.()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        confirmar()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setValor((v) => v.slice(0, -1))
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        if (e.key === ' ') tecla(' ')
        else if (/[a-zA-Z0-9ñÑ,.\-]/.test(e.key)) tecla(e.key.toLowerCase())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [valor, onCerrar, onConfirmar])

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-keypad keyboard-qwerty" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">{titulo}</h3>
        <div className="keyboard-display">{valor}</div>
        <div className="keyboard-grid">
          {ROWS.map((row, ri) => (
            <div key={ri} className="keyboard-row">
              {row.map((char) => (
                <button
                  key={char}
                  type="button"
                  className={`keyboard-btn ${char === ' ' ? 'keyboard-space' : ''} ${char === '↵' ? 'keyboard-ok' : ''} ${char === '⌫' ? 'keyboard-func' : ''}`}
                  onClick={() => (char === '↵' ? confirmar() : tecla(char))}
                >
                  {char === ' ' ? '⎵' : char}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="keyboard-actions">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={confirmar}>Aceptar</button>
        </div>
      </div>
    </div>
  )
}
