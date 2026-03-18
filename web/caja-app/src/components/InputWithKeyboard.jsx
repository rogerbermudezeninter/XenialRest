import { useState } from 'react'
import OnScreenKeyboard from './OnScreenKeyboard'

export default function InputWithKeyboard({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  label,
  showKeyboardBtn = true,
  ...props
}) {
  const [mostrarTeclado, setMostrarTeclado] = useState(false)

  return (
    <label className="input-with-keyboard">
      {label && <span className="input-label">{label}</span>}
      <span className="input-wrap">
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          {...props}
        />
        {showKeyboardBtn && (
          <button
            type="button"
            className="btn-keyboard"
            onClick={() => setMostrarTeclado(true)}
            title="Teclado en pantalla"
          >
            ⌨
          </button>
        )}
      </span>
      {mostrarTeclado && (
        <OnScreenKeyboard
          valorInicial={value}
          titulo={label || 'Editar'}
          maxLength={maxLength}
          onConfirmar={(v) => {
            onChange(v)
            setMostrarTeclado(false)
          }}
          onCerrar={() => setMostrarTeclado(false)}
        />
      )}
    </label>
  )
}
