import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { G } from './constants'

export default function NuevoPedido({ user }) {
  const [grupos, setGrupos] = useState([])
  const [productos, setProductos] = useState([])
  const [items, setItems] = useState([])
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null)
  const [cantidades, setCantidades] = useState({})
  const [subgruposAbiertos, setSubgruposAbiertos] = useState({})
  const [entrega, setEntrega] = useState('panaderia')
  const [pago, setPago] = useState('pagado')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [turnoEntrega, setTurnoEntrega] = useState('manana')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  const [clientesMayoreo, setClientesMayoreo] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [esMayoreo, setEsMayoreo] = useState(false)

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
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.activo)
        .sort((a, b) => (a.subgrupo||'').localeCompare(b.subgrupo||'') || (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0))
      setProductos(lista)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'clientesMayoreo'),
        where('vendedorEmail', '==', user.email),
        where('estadoMayoreo', '==', 'aprobado')
      ),
      snap => setClientesMayoreo(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [user.email])

  useEffect(() => {
    if (!grupoSeleccionado) return
    const productosGrupo = productos.filter(p => p.grupoId === grupoSeleccionado)
    const subgruposGrupo = [...new Set(productosGrupo.map(p => p.subgrupo || '—'))]
    if (subgruposGrupo.length > 0) {
      setSubgruposAbiertos({ [subgruposGrupo[0]]: true })
    }
  }, [grupoSeleccionado, productos])

  const toggleSubgrupo = (sg) => {
    setSubgruposAbiertos(prev => ({ ...prev, [sg]: !prev[sg] }))
  }

  const getPrecio = (prod) => {
    if (esMayoreo && clienteSeleccionado && prod.precioMayoreo > 0) return prod.precioMayoreo
    return prod.precioUnitario || 0
  }

  const agregarItem = (prod) => {
    const cant = Number(cantidades[prod.id] || 0)
    if (cant <= 0) return
    const precio = getPrecio(prod)
    const existente = items.findIndex(i => i.productoId === prod.id)
    if (existente >= 0) {
      const nuevos = [...items]
      nuevos[existente].cantidad = Number(nuevos[existente].cantidad) + cant
      setItems(nuevos)
    } else {
      setItems([...items, {
        productoId: prod.id, nombre: prod.nombre, medida: prod.medida,
        grupoId: prod.grupoId, subgrupo: prod.subgrupo || '', cantidad: cant,
        precio, esMayoreo: esMayoreo && !!clienteSeleccionado
      }])
    }
    setCantidades(prev => ({ ...prev, [prod.id]: '' }))
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
        esMayoreo: esMayoreo && !!clienteSeleccionado,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: clienteSeleccionado ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}` : null,
        creadoEn: serverTimestamp()
      })
      setItems([]); setTurnoEntrega('manana'); setComentario('')
      setEntrega('panaderia'); setPago('pagado'); setCantidades({})
      setEsMayoreo(false); setClienteSeleccionado(null)
      const hoy = new Date()
      setFechaEntrega(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`)
      setMsg('✅ Pedido enviado')
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('⚠️ Error al enviar') }
    setEnviando(false)
  }

  const productosGrupo = productos.filter(p => p.grupoId === grupoSeleccionado)
  const subgruposGrupo = [...new Set(productosGrupo.map(p => p.subgrupo || '—'))]
  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'15px' }

  const turnoLabel = turnoEntrega === 'tarde' ? '🌇 Tarde' : '🌅 Mañana'
  const entregaLabel = entrega === 'ruta' ? '🚚 Ruta' : '🏠 Panadería'
  const pagoLabel = pago === 'pendiente' ? '⏳ Pendiente' : '✅ Pagado'

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

      {/* Selector de grupo */}
      <div style={{ marginBottom:'16px' }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Grupo</p>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {grupos.map(g => (
            <button key={g.id} translate="no" onClick={() => setGrupoSeleccionado(g.id)}
              style={{ padding:'8px 14px', borderRadius:'8px', border:`2px solid ${grupoSeleccionado === g.id ? G.cafe : G.borde}`, background: grupoSeleccionado === g.id ? G.cafe : 'white', color: grupoSeleccionado === g.id ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: grupoSeleccionado === g.id ? 'bold' : 'normal' }}>
              {g.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Detalles — siempre visible */}
      <div style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderTop:`3px solid ${G.cafe}` }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.cafe, textTransform:'uppercase', letterSpacing:'1px', margin:'0 0 12px' }}>Detalles del pedido</p>

        <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Fecha de entrega</p>
        <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
          style={{ ...inputStyle, marginBottom:'12px' }} />

        <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Turno</p>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          {[{ val:'manana', label:'🌅 Mañana' }, { val:'tarde', label:'🌇 Tarde' }].map(op => (
            <button key={op.val} onClick={() => setTurnoEntrega(op.val)}
              style={{ flex:1, padding:'9px 8px', borderRadius:'8px', border:`2px solid ${turnoEntrega === op.val ? G.cafe : G.borde}`, background: turnoEntrega === op.val ? G.cafe : 'white', color: turnoEntrega === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: turnoEntrega === op.val ? 'bold' : 'normal' }}>
              {op.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Lugar de entrega</p>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          {[{ val:'panaderia', label:'🏠 Panadería' }, { val:'ruta', label:'🚚 Ruta' }].map(op => (
            <button key={op.val} onClick={() => setEntrega(op.val)}
              style={{ flex:1, padding:'9px 8px', borderRadius:'8px', border:`2px solid ${entrega === op.val ? G.cafe : G.borde}`, background: entrega === op.val ? G.cafe : 'white', color: entrega === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: entrega === op.val ? 'bold' : 'normal' }}>
              {op.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Pago</p>
        <div style={{ display:'flex', gap:'8px', marginBottom: clientesMayoreo.length > 0 ? '12px' : '0' }}>
          {[{ val:'pagado', label:'✅ Pagado' }, { val:'pendiente', label:'⏳ Pendiente' }].map(op => (
            <button key={op.val} onClick={() => setPago(op.val)}
              style={{ flex:1, padding:'9px 8px', borderRadius:'8px', border:`2px solid ${pago === op.val ? G.cafe : G.borde}`, background: pago === op.val ? G.cafe : 'white', color: pago === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: pago === op.val ? 'bold' : 'normal' }}>
              {op.label}
            </button>
          ))}
        </div>

        {/* Selector cliente mayoreo — solo si tiene clientes aprobados */}
        {clientesMayoreo.length > 0 && (
          <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:`1px solid ${G.borde}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <p style={{ fontSize:'12px', color: G.gris, margin:0 }}>¿Pedido para cliente mayoreo?</p>
              <button onClick={() => { setEsMayoreo(!esMayoreo); setClienteSeleccionado(null) }}
                style={{ padding:'5px 12px', borderRadius:'20px', border:`2px solid ${esMayoreo ? G.cafe : G.borde}`, background: esMayoreo ? G.cafe : 'white', color: esMayoreo ? 'white' : G.gris, cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                {esMayoreo ? '✅ Sí' : 'No'}
              </button>
            </div>
            {esMayoreo && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {clientesMayoreo.map(c => (
                  <button key={c.id} onClick={() => setClienteSeleccionado(clienteSeleccionado?.id === c.id ? null : c)}
                    style={{ padding:'9px 12px', borderRadius:'8px', border:`2px solid ${clienteSeleccionado?.id === c.id ? G.cafe : G.borde}`, background: clienteSeleccionado?.id === c.id ? G.cafeClaro : 'white', color: G.texto, cursor:'pointer', fontSize:'13px', textAlign:'left', fontWeight: clienteSeleccionado?.id === c.id ? 'bold' : 'normal' }}>
                    👤 {c.nombre} {c.apellido}
                    {clienteSeleccionado?.id === c.id && <span style={{ color: G.cafe, marginLeft:'8px', fontSize:'12px' }}>✅ precio mayoreo activo</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Catálogo por subgrupos */}
      <div style={{ marginBottom:'20px' }}>
        {subgruposGrupo.map(sg => (
          <div key={sg} style={{ marginBottom:'8px', background:'white', borderRadius:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', overflow:'hidden' }}>
            <button onClick={() => toggleSubgrupo(sg)}
              style={{ width:'100%', padding:'12px 16px', background: subgruposAbiertos[sg] ? G.cafeClaro : 'white', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'13px', fontWeight:'bold', color: G.cafe, textTransform:'uppercase', letterSpacing:'1px' }}>{sg}</span>
              <span style={{ fontSize:'16px', color: G.cafe }}>{subgruposAbiertos[sg] ? '▲' : '▼'}</span>
            </button>
            {subgruposAbiertos[sg] && (
              <div style={{ borderTop:`1px solid ${G.borde}` }}>
                {productosGrupo.filter(p => (p.subgrupo || '—') === sg).map((prod, idx, arr) => {
                  const precio = getPrecio(prod)
                  return (
                    <div key={prod.id} style={{ padding:'10px 16px', borderBottom: idx < arr.length - 1 ? `1px solid ${G.borde}` : 'none', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
                      <div style={{ flex:1 }}>
                        <p style={{ margin:0, fontSize:'14px', fontWeight:'bold', color: G.texto }}>{prod.nombre}</p>
                        <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{prod.medida}</p>
                        {precio > 0 && (
                          <p style={{ margin:'2px 0 0', fontSize:'12px', color: esMayoreo && clienteSeleccionado && prod.precioMayoreo > 0 ? G.verde : G.cafe, fontWeight:'bold' }}>
                            ${Number(precio).toFixed(2)} {esMayoreo && clienteSeleccionado && prod.precioMayoreo > 0 ? '· mayoreo' : ''}
                          </p>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <input type="number" placeholder="0" min="1"
                          value={cantidades[prod.id] || ''}
                          onChange={e => setCantidades(prev => ({ ...prev, [prod.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && agregarItem(prod)}
                          style={{ width:'64px', padding:'8px', borderRadius:'8px', border:`1px solid ${G.borde}`, textAlign:'center', fontSize:'14px', background:'white', color: G.texto }} />
                        <button onClick={() => agregarItem(prod)}
                          style={{ padding:'8px 12px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'bold' }}>
                          ➕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resumen del pedido */}
      {items.length > 0 && (
        <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop:`3px solid ${G.verde}` }}>
          <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
            Resumen — {items.length} producto{items.length !== 1 ? 's' : ''}
          </p>

          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
            <span style={{ fontSize:'12px', background: G.cafeClaro, color: G.cafe, padding:'4px 8px', borderRadius:'20px' }}>{fechaEntrega}</span>
            <span style={{ fontSize:'12px', background: G.cafeClaro, color: G.cafe, padding:'4px 8px', borderRadius:'20px' }}>{turnoLabel}</span>
            <span style={{ fontSize:'12px', background: G.cafeClaro, color: G.cafe, padding:'4px 8px', borderRadius:'20px' }}>{entregaLabel}</span>
            <span style={{ fontSize:'12px', background: G.cafeClaro, color: G.cafe, padding:'4px 8px', borderRadius:'20px' }}>{pagoLabel}</span>
            {clienteSeleccionado && (
              <span style={{ fontSize:'12px', background:'#dcfce7', color: G.verde, padding:'4px 8px', borderRadius:'20px', fontWeight:'bold' }}>
                👤 {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
              </span>
            )}
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: idx < items.length - 1 ? `1px solid ${G.borde}` : 'none' }}>
              <div>
                <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{item.nombre}</p>
                <p style={{ margin:0, fontSize:'12px', color: G.gris }}>
                  {item.medida} · {item.cantidad} uds
                  {item.precio > 0 && <span style={{ color: item.esMayoreo ? G.verde : G.cafe, fontWeight:'bold' }}> · ${(item.precio * item.cantidad).toFixed(2)}</span>}
                </p>
              </div>
              <button onClick={() => quitarItem(idx)} style={{ padding:'5px 9px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✕</button>
            </div>
          ))}

          {/* Total si hay precios */}
          {items.some(i => i.precio > 0) && (
            <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:`2px solid ${G.borde}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:'bold', fontSize:'14px', color: G.texto }}>Total</span>
              <span style={{ fontWeight:'bold', fontSize:'18px', color: G.cafe }}>
                ${items.reduce((acc, i) => acc + (i.precio * i.cantidad), 0).toFixed(2)}
              </span>
            </div>
          )}

          <p style={{ fontSize:'12px', color: G.gris, marginTop:'14px', marginBottom:'6px' }}>Comentario <span style={{ opacity:0.6 }}>(opcional)</span></p>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)}
            placeholder="Ej: entregar antes de las 8am..."
            rows={2}
            style={{ ...inputStyle, resize:'vertical', marginBottom:'14px', fontFamily:'inherit' }} />

          {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
          <button onClick={enviarPedido} disabled={enviando}
            style={{ width:'100%', padding:'14px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'16px' }}>
            {enviando ? 'Enviando...' : '📤 Enviar pedido'}
          </button>
        </div>
      )}

      {items.length === 0 && productosGrupo.length === 0 && (
        <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>No hay productos en este grupo.</p>
      )}
    </div>
  )
}