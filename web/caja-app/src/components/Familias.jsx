export default function Familias({ familias, familiaId, onSelect }) {
  return (
    <nav className="familias">
      <button
        className={`familia-btn ${!familiaId ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        Todos
      </button>
      {familias.map((f) => (
        <button
          key={f.id}
          className={`familia-btn ${familiaId === String(f.id) ? 'active' : ''}`}
          onClick={() => onSelect(String(f.id))}
        >
          {f.nombre}
        </button>
      ))}
    </nav>
  )
}
