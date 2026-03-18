import { useState, useEffect, useRef } from 'react'

export default function CameraModal({ onCapturar, onCerrar }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [dispositivos, setDispositivos] = useState([])
  const [dispositivoId, setDispositivoId] = useState('')

  useEffect(() => {
    let mounted = true
    async function cargarDispositivos() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videos = devices.filter((d) => d.kind === 'videoinput')
        if (mounted && videos.length > 0) {
          setDispositivos(videos)
          setDispositivoId((prev) => (prev && videos.some((v) => v.deviceId === prev) ? prev : videos[0].deviceId))
        }
      } catch (e) {
        console.warn('Error enumerando dispositivos:', e)
      }
    }
    cargarDispositivos()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    async function iniciar() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        const constraints = {
          video: {
            width: 320,
            height: 320,
            ...(dispositivoId ? { deviceId: { exact: dispositivoId } } : { facingMode: 'user' }),
          },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setListo(true)
        setError('')
      } catch (err) {
        setError(err.message || 'No se pudo acceder a la cámara')
        setListo(false)
      }
    }
    iniciar()
    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [dispositivoId])

  function capturar() {
    if (!videoRef.current || !streamRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    onCapturar(dataUrl)
    onCerrar()
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal camera-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Tomar foto</h3>
        {error ? (
          <p className="camera-error">{error}</p>
        ) : (
          <>
            {dispositivos.length > 1 && (
              <div className="camera-selector">
                <label>Cámara:</label>
                <select
                  value={dispositivoId}
                  onChange={(e) => setDispositivoId(e.target.value)}
                >
                  {dispositivos.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Cámara ${dispositivos.indexOf(d) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="camera-preview">
              <video ref={videoRef} autoPlay playsInline muted />
            </div>
            <div className="camera-acciones">
              <button type="button" className="btn btn-secondary" onClick={onCerrar}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={capturar} disabled={!listo}>
                Capturar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
