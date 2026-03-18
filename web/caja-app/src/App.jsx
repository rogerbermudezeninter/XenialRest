import { useState, useEffect } from 'react'
import { fetchApi, postApi, patchApi, deleteApi, getImagenUrl, checkApi, login, DEMO_USUARIOS } from './api'
import Header from './components/Header'
import ConfigPanel from './components/ConfigPanel'
import LoginModal from './components/LoginModal'
import PanelPedido from './components/PanelPedido'
import CobroModal from './components/CobroModal'
import Familias from './components/Familias'
import ProductosGrid from './components/ProductosGrid'
import MenuSelector from './components/MenuSelector'
import './App.css'

function formatPrecio(n) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' €'
}

export default function App() {
  const [familias, setFamilias] = useState([])
  const [productos, setProductos] = useState([])
  const [mesas, setMesas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [familiaId, setFamiliaId] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [lineas, setLineas] = useState([])
  const [conectado, setConectado] = useState(false)
  const [modoDemo, setModoDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [mostrarLogin, setMostrarLogin] = useState(false)
  const [menuEnEdicion, setMenuEnEdicion] = useState(null)
  const [completandoMenu, setCompletandoMenu] = useState(null)
  const [mostrarConfig, setMostrarConfig] = useState(false)

  const [tiposMenu, setTiposMenu] = useState([])
  const [platos, setPlatos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [zonasPreparacion, setZonasPreparacion] = useState([])
  const [impresoras, setImpresoras] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [clientes, setClientes] = useState([])
  const [familiasMenu, setFamiliasMenu] = useState([])
  const [apartados, setApartados] = useState([])
  const [cajas, setCajas] = useState([])
  const [cajaId, setCajaId] = useState(null)
  const [formasPago, setFormasPago] = useState([])
  const [mostrarCobro, setMostrarCobro] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (!conectado || modoDemo) return
    if (cajaId) {
      fetchApi(`/api/platos?caja_id=${cajaId}`).then((pl) => setPlatos(pl || [])).catch(() => {})
    }
  }, [cajaId, conectado, modoDemo])

  async function cargarDatos() {
    const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms))
    try {
      const apiOk = await Promise.race([checkApi(), timeout(5000)]).catch(() => false)
      const [f, p, m, u, tm, emp, cj, zp, imp, idi, prov, cli, pl, fm, ap, fp] = await Promise.race([
        Promise.all([
          fetchApi('/api/familias').catch(() => []),
          fetchApi('/api/productos').catch(() => []),
          fetchApi('/api/mesas').catch(() => []),
          fetchApi('/api/usuarios').catch(() => []),
          fetchApi('/api/tipos-menu').catch(() => []),
          fetchApi('/api/empresas').catch(() => []),
          fetchApi('/api/cajas').catch(() => []),
          fetchApi('/api/zonas-preparacion').catch(() => []),
          fetchApi('/api/impresoras').catch(() => []),
          fetchApi('/api/idiomas').catch(() => []),
          fetchApi('/api/proveedores').catch(() => []),
          fetchApi('/api/clientes').catch(() => []),
          fetchApi('/api/platos').catch(() => []),
          fetchApi('/api/familias-menu').catch(() => []),
          fetchApi('/api/apartados').catch(() => []),
          fetchApi('/api/formas-pago').catch(() => []),
        ]),
        timeout(8000),
      ])
      setFamilias(f || [])
      setProductos(p || [])
      setMesas(m || [])
      setUsuarios(u || [])
      setTiposMenu(tm || [])
      setEmpresas(emp || [])
      setCajas(cj || [])
      setPlatos(pl || [])
      setZonasPreparacion(zp || [])
      setImpresoras(imp || [])
      setIdiomas(idi || [])
      setProveedores(prov || [])
      setClientes(cli || [])
      setFamiliasMenu(fm || [])
      setApartados(ap || [])
      setFormasPago(fp || [])
      setConectado(apiOk)
      setModoDemo(!apiOk)
    } catch (err) {
      console.error(err)
      setConectado(false)
      setModoDemo(true)
      setFamilias([])
      setProductos([])
      setMesas([])
      setUsuarios([])
      setTiposMenu([])
      setPlatos([])
      setEmpresas([])
      setCajas([])
      setZonasPreparacion([])
      setImpresoras([])
      setIdiomas([])
      setProveedores([])
      setClientes([])
      setFamiliasMenu([])
      setApartados([])
      setFormasPago([])
    } finally {
      setLoading(false)
    }
  }

  const familiaMenus = familias.find((f) => f.curso === 'menu' || f.nombre === 'Menús')
  const esFamiliaMenus = familiaMenus && (familiaId === String(familiaMenus.id) || !!menuEnEdicion || !!completandoMenu)
  const familiasPantallaPrincipal = familias.filter((f) => f.mostrar_pantalla_principal !== false)

  useEffect(() => {
    if ((menuEnEdicion || completandoMenu) && familiaMenus) setFamiliaId(String(familiaMenus.id))
  }, [menuEnEdicion, completandoMenu, familiaMenus])
  const platosFiltrados = familiaId
    ? platos.filter((p) => p.familia_id === parseInt(familiaId, 10))
    : platos

  const mesasLibres = mesas.filter((m) => m.estado === 'libre')

  function actualizarProductoEnLista(producto) {
    setProductos((prev) => {
      const idx = prev.findIndex((p) => p.id === producto.id)
      if (idx >= 0) return prev.map((p) => (p.id === producto.id ? { ...p, ...producto } : p))
      return [...prev, producto]
    })
  }

  function actualizarPlatoEnLista(plato) {
    setPlatos((prev) => {
      const idx = prev.findIndex((p) => p.id === plato.id)
      if (idx >= 0) return prev.map((p) => (p.id === plato.id ? { ...p, ...plato } : p))
      return [...prev, plato]
    })
  }

  async function abrirMesa(mesaId, camareroId, comensales) {
    try {
      const t = await postApi('/api/tickets', {
        mesa_id: parseInt(mesaId, 10),
        camarero_id: camareroId || null,
        comensales: comensales || 1,
        caja_id: cajaId || null,
      })
      setTicket({ ...t, estado: t.estado || 'abierto' })
      setLineas([])
    } catch (err) {
      if (modoDemo) {
        setTicket({ id: 'demo', mesa_id: parseInt(mesaId, 10), estado: 'abierto' })
        setLineas([])
      } else {
        alert('Error al abrir mesa: ' + (err.message || 'Comprueba que la API esté en marcha (puerto 3000).'))
      }
    }
  }

  async function cambiarComensales(ticketId, comensales) {
    if (modoDemo) return
    try {
      const t = await patchApi(`/api/tickets/${ticketId}`, { comensales })
      setTicket((prev) => (prev?.id === ticketId ? { ...prev, comensales: t.comensales } : prev))
    } catch (e) {
      console.error('Error actualizando comensales:', e)
    }
  }

  async function reabrirMesa(mesaId) {
    if (modoDemo) return
    try {
      const estado = await fetchApi(`/api/mesas/${mesaId}/estado`)
      const ticketId = estado?.ticket_id
      if (!ticketId) {
        alert('Mesa sin ticket activo.')
        return
      }
      const [t, lineasData] = await Promise.all([
        fetchApi(`/api/tickets/${ticketId}`),
        fetchApi(`/api/tickets/${ticketId}/lineas`),
      ])
      setTicket({ ...t, estado: t.estado || 'abierto' })
      setLineas(lineasData || [])
    } catch (err) {
      alert('Error al cargar el ticket: ' + (err.message || 'Comprueba que la API esté en marcha.'))
    }
  }

  function añadirPlato(plato, cantidad = 1) {
    if (!ticket) return
    const existente = lineas.find((l) => l.plato_id === plato.id && !l.notas && !l.menu_id)
    if (existente) {
      const cantActual = parseFloat(existente.cantidad) || 0
      const cantAñadir = parseFloat(cantidad) || 1
      const nuevaCantidad = cantActual + cantAñadir
      setLineas((prev) =>
        prev.map((l) =>
          l === existente
            ? {
                ...l,
                cantidad: nuevaCantidad,
                importe: (parseFloat(l.precio_unitario) || 0) * nuevaCantidad,
              }
            : l
        )
      )
    } else {
      const cant = parseFloat(cantidad) || 1
      const importe = (parseFloat(plato.precio_base) || 0) * cant
      setLineas((prev) => [
        ...prev,
        {
          plato_id: plato.id,
          descripcion: plato.nombre,
          cantidad: cant,
          precio_unitario: plato.precio_base,
          importe,
        },
      ])
    }
  }

  function añadirMenuCompleto(tipoMenu, cantidad, platos) {
    if (!ticket) return
    const precioMenu = parseFloat(tipoMenu.precio) || 12
    const cant = parseFloat(cantidad) || 1
    const menuId = `menu-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const importeMenu = precioMenu * cant
    const lineasMenu = [
      {
        menu_id: menuId,
        es_menu_padre: true,
        tipo_menu_id: tipoMenu.id,
        tipo_menu_nombre: tipoMenu.nombre,
        descripcion: tipoMenu.nombre,
        cantidad: cant,
        precio_unitario: precioMenu,
        importe: importeMenu,
      },
      ...platos.map((p) => {
        const suplemento = parseFloat(p.precio_suplemento_menu) || 0
        return {
          menu_id: menuId,
          es_menu_padre: false,
          plato_id: p.plato_id ?? p.id,
          descripcion: p.nombre,
          cantidad: 1,
          precio_unitario: suplemento,
          importe: suplemento,
        }
      }),
    ]
    setLineas((prev) => [...prev, ...lineasMenu])
  }

  function abrirConfiguradorMenu({ padre, hijos }) {
    const algunEnviado = [padre, ...hijos].some((g) => g.estado && g.estado !== 'pendiente')
    if (algunEnviado) {
      setCompletandoMenu({ padre, hijos, completando: true })
    } else {
      const menuId = padre.menu_id || `db-${padre.id}`
      setMenuEnEdicion({ menuId, padre, hijos })
    }
  }

  async function eliminarLineaMenu(linea) {
    if (modoDemo || !ticket?.id || ticket.id === 'demo') {
      if (linea._idx != null) {
        setLineas((prev) => prev.filter((_, i) => i !== linea._idx))
      }
      return
    }
    if (linea.id) {
      try {
        await deleteApi(`/api/tickets/${ticket.id}/lineas/${linea.id}`)
        const lineasActualizadas = await fetchApi(`/api/tickets/${ticket.id}/lineas`)
        setLineas(lineasActualizadas || [])
      } catch (e) {
        alert(e?.message || 'Error al eliminar.')
      }
    } else if (linea._idx != null) {
      setLineas((prev) => prev.filter((_, i) => i !== linea._idx))
    }
  }

  async function cambiarCantidad(index, delta) {
    const l = lineas[index]
    const cantActual = parseFloat(l.cantidad) || 0
    const nuevaCantidad = cantActual + delta
    if (nuevaCantidad <= 0) {
      const enviada = l.estado && l.estado !== 'pendiente'
      if (enviada) {
        alert('No se puede eliminar: la línea ya fue enviada a cocina.')
        return
      }
      const grupo = l.menu_id
        ? lineas.filter((x) => x.menu_id === l.menu_id)
        : l.tipo_menu_id && !l.linea_padre_id
          ? [l, ...lineas.filter((x) => x.linea_padre_id === l.id)]
          : [l]
      const algunEnviado = grupo.some((g) => g.estado && g.estado !== 'pendiente')
      if (algunEnviado) {
        alert('No se puede eliminar: el menú tiene platos ya enviados a cocina.')
        return
      }
      if (l.id && !modoDemo && ticket?.id && ticket.id !== 'demo') {
        try {
          await deleteApi(`/api/tickets/${ticket.id}/lineas/${l.id}`)
        } catch (e) {
          alert(e?.message || 'Error al eliminar.')
          return
        }
      }
      if (l.menu_id) {
        setLineas((prev) => prev.filter((x) => x.menu_id !== l.menu_id))
      } else if (l.tipo_menu_id && !l.linea_padre_id) {
        setLineas((prev) => prev.filter((x) => x.id !== l.id && x.linea_padre_id !== l.id))
      } else {
        setLineas((prev) => prev.filter((_, i) => i !== index))
      }
      return
    }
    if (l.id && !modoDemo && ticket?.id && ticket.id !== 'demo') {
      try {
        await patchApi(`/api/tickets/${ticket.id}/lineas/${l.id}`, { cantidad: nuevaCantidad })
      } catch (e) {
        alert(e?.message || 'Error al actualizar.')
        return
      }
    }
    setLineas((prev) =>
      prev.map((x, i) =>
        i === index
          ? { ...x, cantidad: nuevaCantidad, importe: (parseFloat(x.precio_unitario) || 0) * nuevaCantidad }
          : x
      )
    )
  }

  useEffect(() => {
    if (!ticket || lineas.length === 0 || modoDemo || ticket.id === 'demo') return
    const pendientes = lineas.filter((l) => !l.id && !l.menu_id)
    pendientes.forEach(async (l) => {
      try {
        const body = {
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          comentarios_cocina: l.comentarios_cocina || null,
        }
        if (l.plato_id) body.plato_id = l.plato_id
        else if (l.producto_id) body.producto_id = l.producto_id
        const creada = await postApi(`/api/tickets/${ticket.id}/lineas`, body)
        l.id = creada.id
      } catch (e) {
        console.error('Error guardando línea:', e)
      }
    })
  }, [ticket, lineas, modoDemo])

  async function enviarCocina() {
    if (!ticket) return
    try {
      if (!modoDemo && ticket.id !== 'demo') {
        const menuBlocks = new Map()
        lineas.filter((l) => l.menu_id && !l.id).forEach((l) => {
          if (!menuBlocks.has(l.menu_id)) {
            const hijos = lineas.filter((h) => h.menu_id === l.menu_id && !h.es_menu_padre)
            const padre = lineas.find((p) => p.menu_id === l.menu_id && p.es_menu_padre)
            if (padre) menuBlocks.set(l.menu_id, { padre, hijos })
          }
        })
        for (const { padre, hijos } of menuBlocks.values()) {
          await postApi(`/api/tickets/${ticket.id}/lineas-menu`, {
            tipo_menu_id: padre.tipo_menu_id,
            cantidad: padre.cantidad,
            platos: hijos.map((h) => ({
              plato_id: h.plato_id ?? h.producto_id,
              nombre: h.descripcion,
              precio_suplemento_menu: h.precio_unitario,
              comentarios_cocina: h.comentarios_cocina || null,
            })),
          })
        }
      }
      await postApi(`/api/tickets/${ticket.id}/enviar-cocina`, {})
      setTicket((t) => (t ? { ...t, estado: 'enviado_cocina' } : null))
      setLineas((prev) => prev.map((l) => ({ ...l, estado: l.estado || 'enviado_cocina' })))
      cargarDatos()
      alert('Pedido enviado a cocina.')
    } catch (err) {
      if (modoDemo) {
        setTicket((t) => (t ? { ...t, estado: 'enviado_cocina' } : null))
        setLineas((prev) => prev.map((l) => ({ ...l, estado: 'enviado_cocina' })))
        alert('Pedido enviado a cocina (modo demo).')
      } else {
        throw err
      }
    }
  }

  function cobrar() {
    if (!ticket) return
    setMostrarCobro(true)
  }

  async function confirmarCobro(pagos) {
    if (!ticket?.id || ticket.id === 'demo' || modoDemo) {
      setTicket(null)
      setLineas([])
      setMostrarCobro(false)
      return
    }
    try {
      for (const p of pagos) {
        await postApi(`/api/tickets/${ticket.id}/pagos`, {
          forma_pago_id: p.forma_pago_id,
          importe: p.importe,
          usuario_id: usuario?.id,
        })
      }
      setTicket(null)
      setLineas([])
      setMostrarCobro(false)
      cargarDatos()
      alert('Cobro completado.')
    } catch (err) {
      alert('Error al registrar el cobro: ' + (err?.message || ''))
    }
  }

  function abrirCajon() {
    alert('Abrir cajón: se integrará con la impresora de tickets.')
  }

  function cerrarCaja() {
    alert('Cerrar caja: se integrará en una próxima actualización.')
  }

  const totalUnidades = lineas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
  const totalImporte = lineas.reduce((s, l) => s + (parseFloat(l.importe) || 0), 0)

  const poderEditar = usuario?.rol === 'admin' || !ticket?.estado || ['abierto', 'enviado_cocina'].includes(ticket?.estado)

  async function cambiarComentariosCocina(idx, comentarios, linea) {
    setLineas((prev) => {
      const l = prev[idx]
      if (!l) return prev
      return prev.map((x, i) => (i === idx ? { ...x, comentarios_cocina: comentarios || null } : x))
    })
    if (!modoDemo && ticket?.id && ticket.id !== 'demo' && linea?.id) {
      try {
        await patchApi(`/api/tickets/${ticket.id}/lineas/${linea.id}`, { comentarios_cocina: comentarios || null })
      } catch (e) {
        console.error('Error actualizando comentarios:', e)
      }
    }
  }

  async function completarMenu(padreId, nuevosPlatos) {
    if (!ticket?.id || ticket.id === 'demo' || modoDemo) return
    try {
      await postApi(`/api/tickets/${ticket.id}/lineas/${padreId}/platos`, { platos: nuevosPlatos })
      const lineasActualizadas = await fetchApi(`/api/tickets/${ticket.id}/lineas`)
      setLineas(lineasActualizadas || [])
      setCompletandoMenu(null)
    } catch (e) {
      alert(e?.message || 'Error al añadir platos.')
    }
  }

  async function reemplazarMenu(menuId, tipoMenu, cantidad, platos) {
    const esDbMenu = String(menuId).startsWith('db-')
    const padreId = esDbMenu ? parseInt(String(menuId).replace('db-', ''), 10) : null
    if (esDbMenu && padreId && !modoDemo && ticket?.id && ticket.id !== 'demo') {
      try {
        await deleteApi(`/api/tickets/${ticket.id}/lineas/${padreId}`)
        await postApi(`/api/tickets/${ticket.id}/lineas-menu`, {
          tipo_menu_id: tipoMenu.id,
          cantidad: parseFloat(cantidad) || 1,
          platos: platos.map((p) => ({
            plato_id: p.plato_id ?? p.id,
            nombre: p.nombre,
            precio_suplemento_menu: p.precio_suplemento_menu ?? 0,
          })),
        })
        const lineasActualizadas = await fetchApi(`/api/tickets/${ticket.id}/lineas`)
        setLineas(lineasActualizadas || [])
      } catch (e) {
        alert(e?.message || 'Error al actualizar menú.')
        return
      }
    } else {
      setLineas((prev) => {
        const sinEseMenu = prev.filter((l) => l.menu_id !== menuId)
        const nuevoMenuId = `menu-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const precioMenu = parseFloat(tipoMenu.precio) || 12
        const cant = parseFloat(cantidad) || 1
        const lineasMenu = [
          {
            menu_id: nuevoMenuId,
            es_menu_padre: true,
            tipo_menu_id: tipoMenu.id,
            tipo_menu_nombre: tipoMenu.nombre,
            descripcion: tipoMenu.nombre,
            cantidad: cant,
            precio_unitario: precioMenu,
            importe: precioMenu * cant,
          },
          ...platos.map((p) => {
            const suplemento = parseFloat(p.precio_suplemento_menu) || 0
            return {
              menu_id: nuevoMenuId,
              es_menu_padre: false,
              plato_id: p.plato_id ?? p.id,
              descripcion: p.nombre,
              cantidad: 1,
              precio_unitario: suplemento,
              importe: suplemento,
            }
          }),
        ]
        return [...sinEseMenu, ...lineasMenu]
      })
    }
    setMenuEnEdicion(null)
  }

  async function handleLogin(usuarioId, pin) {
    const u = await login(usuarioId, pin, modoDemo)
    const cajasUser = u?.cajas || []
    if (cajasUser.length > 1) {
      setUsuario({ ...u, _pendienteCaja: true })
    } else {
      setUsuario(u)
      setCajaId(cajasUser[0]?.id || null)
      setMostrarLogin(false)
    }
  }

  function handleSeleccionarCaja(caja) {
    setCajaId(caja?.id || null)
    setUsuario((prev) => prev ? { ...prev, _pendienteCaja: false } : null)
    setMostrarLogin(false)
  }

  if (loading) {
    return (
      <div className="loading">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!usuario) {
    const usuariosParaLogin = usuarios?.length > 0 ? usuarios : DEMO_USUARIOS
    return (
      <div className="app">
        <LoginModal usuarios={usuariosParaLogin} usuario={usuario} onLogin={handleLogin} onSeleccionarCaja={handleSeleccionarCaja} onCancelar={null} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header
        conectado={conectado}
        modoDemo={modoDemo}
        usuario={usuario}
        empresas={empresas}
        cajas={cajas}
        cajaId={cajaId}
        esAdmin={usuario?.rol === 'admin'}
        onChangeCamarero={() => setMostrarLogin(true)}
        onConfig={() => setMostrarConfig(true)}
      />
      {mostrarConfig && (
        <ConfigPanel
          familias={familias}
          productos={productos}
          platos={platos}
          tiposMenu={tiposMenu}
          usuarios={usuarios}
          empresas={empresas}
          cajas={cajas}
          zonasPreparacion={zonasPreparacion}
          impresoras={impresoras}
          idiomas={idiomas}
          proveedores={proveedores}
          clientes={clientes}
          familiasMenu={familiasMenu}
          apartados={apartados}
          onCerrar={() => setMostrarConfig(false)}
          onRefrescar={cargarDatos}
          onProductoActualizado={actualizarProductoEnLista}
          onPlatoActualizado={actualizarPlatoEnLista}
          onUsuarioFotoActualizada={(id, ruta_foto) => {
            if (usuario?.id === id) setUsuario((u) => ({ ...u, ruta_foto }))
          }}
        />
      )}
      {mostrarCobro && ticket && (
        <CobroModal
          ticket={ticket}
          lineas={lineas}
          formasPago={formasPago}
          usuarioId={usuario?.id}
          formatPrecio={formatPrecio}
          empresaNombre={empresas?.[0]?.nombre}
          onCerrar={() => setMostrarCobro(false)}
          onConfirmar={confirmarCobro}
        />
      )}
      {mostrarLogin && (
        <LoginModal
          usuarios={usuarios}
          usuario={usuario}
          onLogin={handleLogin}
          onSeleccionarCaja={handleSeleccionarCaja}
          onCancelar={() => setMostrarLogin(false)}
          onCambiarUsuario={() => { setUsuario(null); setMostrarLogin(true) }}
        />
      )}
      <main className="layout">
        <PanelPedido
          mesas={mesas}
          mesasLibres={mesasLibres}
          usuarios={usuarios}
          usuarioLogeado={usuario}
          ticket={ticket}
          lineas={lineas}
          totalUnidades={totalUnidades}
          totalImporte={totalImporte}
          poderEditar={poderEditar}
          onAbrirMesa={abrirMesa}
          onReabrirMesa={reabrirMesa}
          onCerrarTicket={() => { setTicket(null); setLineas([]); }}
          onEnviarCocina={enviarCocina}
          onCobrar={cobrar}
          onAbrirCajon={abrirCajon}
          onCerrarCaja={cerrarCaja}
          onCambiarCantidad={cambiarCantidad}
          onAbrirConfiguradorMenu={abrirConfiguradorMenu}
          onEliminarLinea={eliminarLineaMenu}
          onCambiarComensales={cambiarComensales}
          onComentariosCocina={cambiarComentariosCocina}
          formatPrecio={formatPrecio}
        />
        <section className="panel-productos">
          <Familias
            familias={familiasPantallaPrincipal}
            familiaId={familiaId}
            onSelect={setFamiliaId}
          />
          {esFamiliaMenus ? (
            <MenuSelector
              tiposMenu={tiposMenu}
              familiasConCurso={familias}
              platos={platos}
              cajaId={cajaId}
              ticket={ticket}
              poderEditar={poderEditar}
              menuEnEdicion={menuEnEdicion || completandoMenu}
              onAñadirMenuCompleto={añadirMenuCompleto}
              onMenuEditado={reemplazarMenu}
              onMenuCompletado={completarMenu}
              onCancelarEdicion={() => { setMenuEnEdicion(null); setCompletandoMenu(null); }}
              getImagenUrl={getImagenUrl}
              formatPrecio={formatPrecio}
            />
          ) : (
            <ProductosGrid
              platos={platosFiltrados}
              onAñadir={añadirPlato}
              ticket={ticket}
              poderEditar={poderEditar}
              getImagenUrl={getImagenUrl}
              formatPrecio={formatPrecio}
            />
          )}
        </section>
      </main>
    </div>
  )
}
