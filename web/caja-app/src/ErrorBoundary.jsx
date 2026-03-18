import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', color: '#fff', background: '#1a1a1a', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2>Error en la aplicación</h2>
          <pre style={{ background: '#333', padding: '1rem', overflow: 'auto' }}>{this.state.error?.message}</pre>
          <p><button onClick={() => window.location.reload()}>Recargar</button></p>
        </div>
      )
    }
    return this.props.children
  }
}
