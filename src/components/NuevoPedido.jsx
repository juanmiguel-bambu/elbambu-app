import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { G } from './constants'

export default function NuevoPedido({ user }) {
  const [grupos, setGrupos] = useState([])
  const [productos, setProductos] = useState([])
  const [items, setItems] = useState([])
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null)
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [entrega, setEntrega] = useState('panaderia')
  const [pago, setPago] = useState('pagado')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [turnoEntrega, setTurnoEntrega] = useState('manana')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)

  useEffect(() => {
    const hoy = new Date()
    setFechaEntrega(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`)
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grupos'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      setGrupos(lista)
      if (lista.length > 0 && !grupoSeleccionado) setGrupoSeleccionado(lista[0].id)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(lista)
    })
    return () => unsub()
  }, [])

  const horarioCortePasado = (grupoId) => {
    const grupo = grupos.find(g => g.id === grupoId)
    if (!grupo || !grupo.horario) return false
    const [h, m] = grupo.horario.split(':').map(Number)
    const ahora = new Date()
    const corte = new Date()
    corte.setHours(h, m, 0, 0)
    return ahora > corte
  }

  const productosFiltrados = productos
    .filter(p => p.grupoId === grupoSeleccionado)
    .filter(p => busqueda === '' || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.subgrupo||'').toLowerCase().includes(busqueda.toLowerCase()))

  const agregarItem = () => {
    if (!productoSeleccionado || !cantidad || Number(cantidad) <= 0) return
    const prod = productos.find(p => p.id === productoSeleccionado)
    if (!prod) return
    const existente = items.findIndex(i => i.productoId === productoSeleccionado)
    if (existente >= 0) {
      const nuevos = [...items]
      nuevos[existente].cantidad = Number(nuevos[existente].cantidad) + Number(cantidad)
      setItems(nuevos)
    } else {
      setItems([...items, { productoId: prod.id, nombre: prod.nombre, medida: prod.medida, grupoId: prod.grupoId, cantidad: Number(cantidad) }])
    }
    setProductoSeleccionado(null); setCantidad(''); setBusqueda(''); setMostrarBuscador(false)
  }

  const quitarItem = (idx) => setItems(items.filter((_, i) => i !== idx))

  const enviarPedido = async () => {
    if (items.length === 0) { setMsg('⚠️ Agregá al menos un producto'); return }
    if (!fechaEntrega) { setMsg('⚠️ Indicá la fecha de entrega'); return }
    setEnviando(true)
    try {
      await addDoc(collection(db, 'pedidos'), {
        vendedor: user.email,
        vendedorNombre: user.email.split('@')[0],
        items, entrega, pago, fechaEntrega, turnoEntrega,
        comentario: comentario.trim(),
        estado: 'pendiente',
        creadoEn: serverTimestamp()
      })
      setItems([]); setTurnoEntrega('manana'); setComentario(''); setEntrega('panaderia'); setPago('pagado')
      const hoy = new Date()
      setFechaEntrega(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`)
      setMsg('✅ Pedido enviado')
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('⚠️ Error al enviar') }
    setEnviando(false)
  }

  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'15px' }

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto', padding:'16px', paddingBottom:'30px' }}>
      <h3 style={{ color: G.cafe, marginBottom:'16px' }}>📋 Nuevo pedido</h3>

      {/* Cuadro informativo de horarios */}
      <div style={{ background:'white', border:`1px solid ${G.borde}`, borderLeft:`4px solid ${G.cafe}`, borderRadius:'8px', padding:'12px 14px', marginBottom:'20px' }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.cafe, textTransform:'uppercase', letterSpacing:'1px', margin:'0 0 8px' }}>📋 Horarios de pedidos</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <p style={{ margin:0, fontSize:'13px', color: G.texto }}>🌅 <strong>3:00am – 6:00am</strong> → Entrega mismo día *</p>
          <p style={{ margin:0, fontSize:'13px', color: G.texto }}>🌄 <strong>10:00am – 1:00pm</strong> → Entrega siguiente día mañana</p>
          <p style={{ margin:0, fontSize:'13px', color: G.texto }}>🕐 <strong>Todo el día</strong> → Entrega siguiente día tarde</p>
        </div>
        <p style={{ margin:'8px 0 0', fontSize:'11px', color: G.gris }}>* Pan sin fermentación prioritario. Fermentados sujeto a disponibilidad.</p>
      </div>

      <div style={{ marginBottom:'16px' }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Grupo</p>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {grupos.map(g => (
            <button key={g.id} translate="no" onClick={() => { setGrupoSeleccionado(g.id); setProductoSeleccionado(null); setBusqueda('') }}
              style={{ padding:'8px 14px', borderRadius:'8px', border:`2px solid ${grupoSeleccionado === g.id ? G.cafe : G.borde}`, background: grupoSeleccionado === g.id ? G.cafe : 'white', color: grupoSeleccionado === g.id ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: grupoSeleccionado === g.id ? 'bold' : 'normal' }}>
              {g.nombre}
            </button>
          ))}
        </div>
        {/* Horario de corte desactivado durante pruebas */}
      </div>

      <div style={{ marginBottom:'16px' }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Agregar producto</p>
        <div style={{ position:'relative' }}>
          <input placeholder="Buscar producto..." value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setMostrarBuscador(true); setProductoSeleccionado(null) }}
            onFocus={() => setMostrarBuscador(true)}
            onBlur={() => setTimeout(() => setMostrarBuscador(false), 150)}
            autoCorrect="off" autoCapitalize="off" spellCheck="false"
            style={inputStyle} />
          {mostrarBuscador && productosFiltrados.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:`1px solid ${G.borde}`, borderRadius:'8px', zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.12)', maxHeight:'200px', overflowY:'auto' }}>
              {productosFiltrados.map(p => (
                <div key={p.id} onClick={() => { setProductoSeleccionado(p.id); setBusqueda(p.nombre); setMostrarBuscador(false) }}
                  style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${G.borde}` }}
                  onMouseEnter={e => e.currentTarget.style.background = G.cafeClaro}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{p.nombre}</p>
                  <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{p.medida} · {p.subgrupo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {productoSeleccionado && (
          <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
            <input type="number" placeholder="Cantidad" value={cantidad} onChange={e => setCantidad(e.target.value)} min="1" style={{ ...inputStyle, flex:1 }} />
            <button onClick={agregarItem} style={{ padding:'10px 18px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'15px' }}>➕</button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ marginBottom:'20px' }}>
          <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Productos ({items.length})</p>
          {items.map((item, idx) => (
            <div key={idx} style={{ background:'white', padding:'12px 14px', borderRadius:'10px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
              <div>
                <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{item.nombre}</p>
                <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{item.medida} · Cantidad: {item.cantidad}</p>
              </div>
              <button onClick={() => quitarItem(idx)} style={{ padding:'6px 10px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop:`3px solid ${G.cafe}` }}>
          <p style={{ fontWeight:'bold', color: G.cafe, marginBottom:'14px' }}>Detalles</p>

          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Fecha de entrega</p>
          <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} style={{ ...inputStyle, marginBottom:'14px' }} />

          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Turno de entrega</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            {[{ val:'manana', label:'🌅 Mañana' }, { val:'tarde', label:'🌇 Tarde' }].map(op => (
              <button key={op.val} onClick={() => setTurnoEntrega(op.val)}
                style={{ flex:1, padding:'10px 8px', borderRadius:'8px', border:`2px solid ${turnoEntrega === op.val ? G.cafe : G.borde}`, background: turnoEntrega === op.val ? G.cafe : 'white', color: turnoEntrega === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: turnoEntrega === op.val ? 'bold' : 'normal' }}>
                {op.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Lugar de entrega</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            {[{ val:'panaderia', label:'🏠 Recoger en panadería' }, { val:'ruta', label:'🚚 Entrega en ruta' }].map(op => (
              <button key={op.val} onClick={() => setEntrega(op.val)}
                style={{ flex:1, padding:'10px 8px', borderRadius:'8px', border:`2px solid ${entrega === op.val ? G.cafe : G.borde}`, background: entrega === op.val ? G.cafe : 'white', color: entrega === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: entrega === op.val ? 'bold' : 'normal' }}>
                {op.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Estado de pago</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            {[{ val:'pagado', label:'✅ Pagado' }, { val:'pendiente', label:'⏳ Pendiente' }].map(op => (
              <button key={op.val} onClick={() => setPago(op.val)}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:`2px solid ${pago === op.val ? G.cafe : G.borde}`, background: pago === op.val ? G.cafe : 'white', color: pago === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: pago === op.val ? 'bold' : 'normal' }}>
                {op.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Comentario <span style={{ fontWeight:'normal', opacity:0.6 }}>(opcional)</span></p>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)}
            placeholder="Ej: entregar antes de las 8am, empacar por separado..."
            rows={2}
            style={{ ...inputStyle, resize:'vertical', marginBottom:'16px', fontFamily:'inherit' }} />

          {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
          <button onClick={enviarPedido} disabled={enviando}
            style={{ width:'100%', padding:'14px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'16px' }}>
            {enviando ? 'Enviando...' : '📤 Enviar pedido'}
          </button>
        </div>
      )}

      {items.length === 0 && <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>Buscá un producto para comenzar.</p>}
    </div>
  )
}