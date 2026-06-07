import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore'
import { G } from './constants'

const MOTIVOS_MERMA = ['Quebrado', 'Vencido', 'Devolución', 'Error de pedido', 'Otro']

export default function CierreCaja({ user, isAdmin }) {
  const [tab, setTab] = useState('cierre')
  const [pedidosHoy, setPedidosHoy] = useState([])
  const [productos, setProductos] = useState([])
  const [cierres, setCierres] = useState([])
  const [vendidos, setVendidos] = useState({})
  const [sobrantes, setSobrantes] = useState({})
  const [mermas, setMermas] = useState({})
  const [motivosMerma, setMotivosMerma] = useState({})
  const [efectivo, setEfectivo] = useState('')
  const [transferencia, setTransferencia] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')

  const hoy = new Date()
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), snap => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activo))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = isAdmin
      ? query(collection(db, 'pedidos'), where('fechaEntrega', '==', fechaHoy))
      : query(collection(db, 'pedidos'), where('fechaEntrega', '==', fechaHoy), where('vendedor', '==', user.email))
    const unsub = onSnapshot(q, snap => {
      setPedidosHoy(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [fechaHoy, isAdmin, user.email])

  useEffect(() => {
    const q = isAdmin
      ? query(collection(db, 'cierresCaja'), where('fecha', '==', fechaHoy))
      : query(collection(db, 'cierresCaja'), where('fecha', '==', fechaHoy), where('vendedorEmail', '==', user.email))
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0))
      setCierres(lista)
    })
    return () => unsub()
  }, [fechaHoy, isAdmin, user.email])

  const consolidadoPedidos = () => {
    const mapa = {}
    const pedidosFiltrados = isAdmin && filtroVendedor !== 'todos'
      ? pedidosHoy.filter(p => p.vendedor === filtroVendedor)
      : isAdmin ? pedidosHoy : pedidosHoy.filter(p => p.vendedor === user.email)

    pedidosFiltrados.forEach(pedido => {
      pedido.items?.forEach(item => {
        if (!mapa[item.productoId]) {
          const prod = productos.find(p => p.id === item.productoId)
          mapa[item.productoId] = {
            productoId: item.productoId,
            nombre: item.nombre,
            medida: item.medida,
            precio: item.precio || prod?.precioUnitario || 0,
            totalPedido: 0
          }
        }
        mapa[item.productoId].totalPedido += Number(item.cantidad)
      })
    })
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  const items = consolidadoPedidos()

  const totalVendido = items.reduce((acc, item) => {
    return acc + (Number(vendidos[item.productoId] || 0) * item.precio)
  }, 0)

  const totalMerma = items.reduce((acc, item) => {
    return acc + (Number(mermas[item.productoId] || 0) * item.precio)
  }, 0)

  const validarCuadre = (item) => {
    const v = Number(vendidos[item.productoId] || 0)
    const s = Number(sobrantes[item.productoId] || 0)
    const m = Number(mermas[item.productoId] || 0)
    return v + s + m === item.totalPedido
  }

  const diferencia = (item) => {
    const v = Number(vendidos[item.productoId] || 0)
    const s = Number(sobrantes[item.productoId] || 0)
    const m = Number(mermas[item.productoId] || 0)
    return item.totalPedido - v - s - m
  }

  const todoCuadra = items.every(item => {
    const v = Number(vendidos[item.productoId] || 0)
    const s = Number(sobrantes[item.productoId] || 0)
    const m = Number(mermas[item.productoId] || 0)
    return v + s + m === item.totalPedido
  })

  const cerrarCaja = async () => {
    if (items.length === 0) { setMsg('⚠️ No hay pedidos del día para cerrar'); return }
    if (!todoCuadra) { setMsg('⚠️ Algunos productos no cuadran. Verificá Vendido + Sobrante + Merma = Total pedido'); return }
    setGuardando(true)
    try {
      const itemsCierre = items.map(item => ({
        productoId: item.productoId,
        nombre: item.nombre,
        medida: item.medida,
        precio: item.precio,
        totalPedido: item.totalPedido,
        vendido: Number(vendidos[item.productoId] || 0),
        sobrante: Number(sobrantes[item.productoId] || 0),
        merma: Number(mermas[item.productoId] || 0),
        motivoMerma: motivosMerma[item.productoId] || '',
      }))

      await addDoc(collection(db, 'cierresCaja'), {
        fecha: fechaHoy,
        vendedorEmail: user.email,
        vendedorNombre: user.email.split('@')[0],
        items: itemsCierre,
        totalVendido,
        totalMerma,
        efectivo: parseFloat(efectivo) || 0,
        transferencia: parseFloat(transferencia) || 0,
        observaciones: observaciones.trim(),
        creadoEn: new Date()
      })

      setVendidos({}); setSobrantes({}); setMermas({}); setMotivosMerma({})
      setEfectivo(''); setTransferencia(''); setObservaciones('')
      setMsg('✅ Cierre registrado correctamente')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setMsg('⚠️ Error al registrar el cierre')
      console.error(e)
    }
    setGuardando(false)
  }

  const vendedoresHoy = [...new Set(pedidosHoy.map(p => p.vendedor))]
  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'14px' }

  const subTabs = [
    { key:'cierre', label:'💰 Cierre' },
    ...(isAdmin ? [{ key:'reporte', label:'📊 Reporte' }] : []),
  ]

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>
      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex' }}>
          {subTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex:1, padding:'13px 16px', border:'none', background:'transparent',
                color: tab === t.key ? G.cafe : G.gris,
                fontWeight: tab === t.key ? 'bold' : 'normal',
                borderBottom: tab === t.key ? `3px solid ${G.cafe}` : '3px solid transparent',
                cursor:'pointer', fontSize:'14px' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px' }}>

        {tab === 'cierre' && (
          <>
            <h3 style={{ color: G.cafe, marginBottom:'4px' }}>💰 Cierre de Caja</h3>
            <p style={{ fontSize:'13px', color: G.gris, marginBottom:'16px' }}>{fechaHoy} · {user.email.split('@')[0]}</p>

            {isAdmin && vendedoresHoy.length > 0 && (
              <div style={{ marginBottom:'16px' }}>
                <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Vendedor</p>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {['todos', ...vendedoresHoy].map(v => (
                    <button key={v} onClick={() => setFiltroVendedor(v)}
                      style={{ padding:'7px 12px', borderRadius:'8px', border:`2px solid ${filtroVendedor === v ? G.cafe : G.borde}`, background: filtroVendedor === v ? G.cafe : 'white', color: filtroVendedor === v ? 'white' : G.texto, cursor:'pointer', fontSize:'13px' }}>
                      {v === 'todos' ? 'Todos' : v.split('@')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>No hay pedidos del día para registrar.</p>
            )}

            {items.length > 0 && (
              <>
                <div style={{ background: G.cafe, color:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'16px' }}>
                  <p style={{ margin:0, fontWeight:'bold', fontSize:'15px' }}>Pedidos del día — {items.length} producto{items.length !== 1 ? 's' : ''}</p>
                  <p style={{ margin:'4px 0 0', fontSize:'13px', opacity:0.85 }}>Vendido + Sobrante + Merma debe ser igual al total pedido</p>
                </div>

                {items.map(item => {
                  const v = Number(vendidos[item.productoId] || 0)
                  const s = Number(sobrantes[item.productoId] || 0)
                  const m = Number(mermas[item.productoId] || 0)
                  const dif = item.totalPedido - v - s - m
                  const cuadra = dif === 0
                  const hayDatos = v + s + m > 0

                  return (
                    <div key={item.productoId} style={{ background:'white', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', overflow:'hidden', border: hayDatos ? `2px solid ${cuadra ? G.verde : G.rojo}` : `2px solid transparent` }}>
                      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${G.borde}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <p style={{ margin:0, fontWeight:'bold', fontSize:'14px', color: G.texto }}>{item.nombre}</p>
                          <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{item.medida} · Total pedido: <strong>{item.totalPedido}</strong> uds{item.precio > 0 ? ` · $${item.precio.toFixed(2)}` : ''}</p>
                        </div>
                        {hayDatos && (
                          <span style={{ fontSize:'12px', fontWeight:'bold', color: cuadra ? G.verde : G.rojo }}>
                            {cuadra ? '✅' : `⚠️ ${dif > 0 ? '+' : ''}${dif}`}
                          </span>
                        )}
                      </div>
                      <div style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:'11px', color: G.verde, fontWeight:'bold', margin:'0 0 4px', textTransform:'uppercase' }}>✅ Vendido</p>
                            <input type="number" placeholder="0" min="0"
                              value={vendidos[item.productoId] || ''}
                              onChange={e => setVendidos(prev => ({ ...prev, [item.productoId]: e.target.value }))}
                              style={{ ...inputStyle, textAlign:'center' }} />
                          </div>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:'11px', color:'#1d4ed8', fontWeight:'bold', margin:'0 0 4px', textTransform:'uppercase' }}>📦 Sobrante</p>
                            <input type="number" placeholder="0" min="0"
                              value={sobrantes[item.productoId] || ''}
                              onChange={e => setSobrantes(prev => ({ ...prev, [item.productoId]: e.target.value }))}
                              style={{ ...inputStyle, textAlign:'center' }} />
                          </div>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:'11px', color: G.rojo, fontWeight:'bold', margin:'0 0 4px', textTransform:'uppercase' }}>🗑️ Merma</p>
                            <input type="number" placeholder="0" min="0"
                              value={mermas[item.productoId] || ''}
                              onChange={e => setMermas(prev => ({ ...prev, [item.productoId]: e.target.value }))}
                              style={{ ...inputStyle, textAlign:'center' }} />
                          </div>
                        </div>

                        {Number(mermas[item.productoId] || 0) > 0 && (
                          <div style={{ marginBottom:'8px' }}>
                            <p style={{ fontSize:'11px', color: G.gris, margin:'0 0 4px' }}>Motivo de merma</p>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              {MOTIVOS_MERMA.map(mot => (
                                <button key={mot} onClick={() => setMotivosMerma(prev => ({ ...prev, [item.productoId]: mot }))}
                                  style={{ padding:'5px 10px', borderRadius:'20px', fontSize:'11px', border:`2px solid ${motivosMerma[item.productoId] === mot ? G.rojo : G.borde}`, background: motivosMerma[item.productoId] === mot ? '#fee2e2' : 'white', color: motivosMerma[item.productoId] === mot ? G.rojo : G.gris, cursor:'pointer' }}>
                                  {mot}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display:'flex', gap:'10px', fontSize:'12px', color: G.gris }}>
                          <span style={{ color: G.verde }}>✅ {v}</span>
                          <span style={{ color:'#1d4ed8' }}>📦 {s}</span>
                          <span style={{ color: G.rojo }}>🗑️ {m}</span>
                          <span style={{ color: cuadra && hayDatos ? G.verde : dif !== 0 && hayDatos ? G.rojo : G.gris }}>
                            {cuadra && hayDatos ? '= ✅ cuadra' : hayDatos ? `faltan ${dif}` : `= ${item.totalPedido} pendiente`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderTop:`3px solid ${G.cafe}` }}>
                  <p style={{ fontWeight:'bold', color: G.cafe, marginBottom:'14px', fontSize:'14px' }}>💵 Totales</p>

                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                    <span style={{ fontSize:'14px', color: G.texto }}>Total vendido</span>
                    <span style={{ fontWeight:'bold', fontSize:'16px', color: G.verde }}>${totalVendido.toFixed(2)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'14px' }}>
                    <span style={{ fontSize:'14px', color: G.texto }}>Total merma</span>
                    <span style={{ fontWeight:'bold', fontSize:'16px', color: G.rojo }}>${totalMerma.toFixed(2)}</span>
                  </div>

                  <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Efectivo recibido ($)</p>
                  <input type="number" placeholder="0.00" value={efectivo}
                    onChange={e => setEfectivo(e.target.value)} min="0" step="0.01"
                    style={{ ...inputStyle, marginBottom:'10px' }} />

                  <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Transferencia bancaria ($)</p>
                  <input type="number" placeholder="0.00" value={transferencia}
                    onChange={e => setTransferencia(e.target.value)} min="0" step="0.01"
                    style={{ ...inputStyle, marginBottom:'10px' }} />

                  {(parseFloat(efectivo) || 0) + (parseFloat(transferencia) || 0) > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderTop:`1px solid ${G.borde}`, marginBottom:'10px' }}>
                      <span style={{ fontWeight:'bold', fontSize:'14px' }}>Total cobrado</span>
                      <span style={{ fontWeight:'bold', fontSize:'18px', color: G.cafe }}>
                        ${((parseFloat(efectivo) || 0) + (parseFloat(transferencia) || 0)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Observaciones <span style={{ opacity:0.6 }}>(opcional)</span></p>
                  <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                    placeholder="Ej: cliente devolvió 5 semitas..." rows={2}
                    style={{ ...inputStyle, resize:'vertical', marginBottom:'14px', fontFamily:'inherit' }} />

                  {!todoCuadra && items.some(item => {
                    const v = Number(vendidos[item.productoId] || 0)
                    const s = Number(sobrantes[item.productoId] || 0)
                    const m = Number(mermas[item.productoId] || 0)
                    return v + s + m > 0 && v + s + m !== item.totalPedido
                  }) && (
                    <p style={{ color: G.rojo, fontSize:'13px', marginBottom:'10px' }}>⚠️ Algunos productos no cuadran. Verificá que Vendido + Sobrante + Merma = Total pedido.</p>
                  )}

                  {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
                  <button onClick={cerrarCaja} disabled={guardando}
                    style={{ width:'100%', padding:'14px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'16px' }}>
                    {guardando ? 'Registrando...' : '🔒 Registrar cierre'}
                  </button>
                </div>
              </>
            )}

            {cierres.length > 0 && (
              <div style={{ marginTop:'8px' }}>
                <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                  Cierres registrados hoy ({cierres.length})
                </p>
                {cierres.map(c => <CierreCard key={c.id} c={c} isAdmin={isAdmin} />)}
              </div>
            )}
          </>
        )}

        {tab === 'reporte' && isAdmin && (
          <ReporteAdmin cierres={cierres} fechaHoy={fechaHoy} />
        )}
      </div>
    </div>
  )
}

function CierreCard({ c, isAdmin }) {
  const [expandido, setExpandido] = useState(false)
  const hora = c.creadoEn?.toDate ? c.creadoEn.toDate().toLocaleTimeString('es-SV', { hour:'2-digit', minute:'2-digit' }) : '—'

  return (
    <div style={{ background:'white', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }} onClick={() => setExpandido(!expandido)}>
        <div>
          <p style={{ margin:0, fontWeight:'bold', fontSize:'14px', color: G.texto }}>
            {isAdmin ? c.vendedorNombre : 'Mi cierre'} · {hora}
          </p>
          <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
            Vendido: <span style={{ color: G.verde, fontWeight:'bold' }}>${c.totalVendido?.toFixed(2)}</span>
            {' · '}Merma: <span style={{ color: G.rojo, fontWeight:'bold' }}>${c.totalMerma?.toFixed(2)}</span>
          </p>
        </div>
        <span style={{ color: G.gris, fontSize:'14px' }}>{expandido ? '▲' : '▼'}</span>
      </div>
      {expandido && (
        <div style={{ borderTop:`1px solid ${G.borde}`, padding:'12px 16px', background:'#fafafa' }}>
          <div style={{ display:'flex', gap:'16px', marginBottom:'12px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px' }}>💵 Efectivo: <strong>${c.efectivo?.toFixed(2)}</strong></span>
            <span style={{ fontSize:'13px' }}>🏦 Transferencia: <strong>${c.transferencia?.toFixed(2)}</strong></span>
          </div>
          {c.items?.map((item, idx) => (
            <div key={idx} style={{ padding:'6px 0', borderBottom:`1px solid ${G.borde}`, fontSize:'13px' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:'bold' }}>{item.nombre}</span>
                <span style={{ color: G.gris }}>{item.medida}</span>
              </div>
              <div style={{ display:'flex', gap:'10px', marginTop:'2px', flexWrap:'wrap' }}>
                <span style={{ color: G.gris }}>Pedido: {item.totalPedido}</span>
                <span style={{ color: G.verde }}>✅ {item.vendido}</span>
                <span style={{ color:'#1d4ed8' }}>📦 {item.sobrante}</span>
                <span style={{ color: G.rojo }}>🗑️ {item.merma}{item.motivoMerma ? ` (${item.motivoMerma})` : ''}</span>
              </div>
            </div>
          ))}
          {c.observaciones ? (
            <p style={{ margin:'10px 0 0', fontSize:'12px', color: G.texto, background: G.cafeClaro, padding:'6px 10px', borderRadius:'6px' }}>
              💬 {c.observaciones}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ReporteAdmin({ cierres, fechaHoy }) {
  if (cierres.length === 0) return (
    <p style={{ textAlign:'center', color: '#888', marginTop:'40px', fontSize:'14px' }}>No hay cierres registrados hoy.</p>
  )

  const totalVendidoGeneral = cierres.reduce((acc, c) => acc + (c.totalVendido || 0), 0)
  const totalMermaGeneral = cierres.reduce((acc, c) => acc + (c.totalMerma || 0), 0)
  const totalEfectivo = cierres.reduce((acc, c) => acc + (c.efectivo || 0), 0)
  const totalTransferencia = cierres.reduce((acc, c) => acc + (c.transferencia || 0), 0)

  const mermasPorProducto = {}
  cierres.forEach(c => {
    c.items?.forEach(item => {
      if (item.merma > 0) {
        if (!mermasPorProducto[item.nombre]) mermasPorProducto[item.nombre] = { total: 0, motivos: {} }
        mermasPorProducto[item.nombre].total += item.merma
        const motivo = item.motivoMerma || 'Sin motivo'
        mermasPorProducto[item.nombre].motivos[motivo] = (mermasPorProducto[item.nombre].motivos[motivo] || 0) + item.merma
      }
    })
  })

  return (
    <div>
      <h3 style={{ color: G.cafe, marginBottom:'4px' }}>📊 Reporte del día</h3>
      <p style={{ fontSize:'13px', color: G.gris, marginBottom:'16px' }}>{fechaHoy} · {cierres.length} cierre{cierres.length !== 1 ? 's' : ''}</p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
        {[
          { label:'Total vendido', valor:`$${totalVendidoGeneral.toFixed(2)}`, color: G.verde, bg:'#dcfce7' },
          { label:'Total merma', valor:`$${totalMermaGeneral.toFixed(2)}`, color: G.rojo, bg:'#fee2e2' },
          { label:'Efectivo', valor:`$${totalEfectivo.toFixed(2)}`, color: G.cafe, bg: G.cafeClaro },
          { label:'Transferencia', valor:`$${totalTransferencia.toFixed(2)}`, color:'#1d4ed8', bg:'#dbeafe' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, padding:'12px 14px', borderRadius:'10px', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:'11px', color: item.color, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.5px' }}>{item.label}</p>
            <p style={{ margin:'4px 0 0', fontSize:'20px', fontWeight:'bold', color: item.color }}>{item.valor}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Por vendedor</p>
      {cierres.map(c => (
        <div key={c.id} style={{ background:'white', padding:'12px 16px', borderRadius:'10px', marginBottom:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{c.vendedorNombre}</p>
            <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
              💵 ${c.efectivo?.toFixed(2)} · 🏦 ${c.transferencia?.toFixed(2)}
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ margin:0, fontWeight:'bold', color: G.verde }}>${c.totalVendido?.toFixed(2)}</p>
            <p style={{ margin:0, fontSize:'12px', color: G.rojo }}>-${c.totalMerma?.toFixed(2)} merma</p>
          </div>
        </div>
      ))}

      {Object.keys(mermasPorProducto).length > 0 && (
        <>
          <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px', marginTop:'16px' }}>🗑️ Mermas por producto</p>
          {Object.entries(mermasPorProducto).sort((a,b) => b[1].total - a[1].total).map(([nombre, data]) => (
            <div key={nombre} style={{ background:'white', padding:'12px 16px', borderRadius:'10px', marginBottom:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{nombre}</p>
                <span style={{ fontWeight:'bold', color: G.rojo }}>{data.total} uds</span>
              </div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {Object.entries(data.motivos).map(([motivo, cant]) => (
                  <span key={motivo} style={{ fontSize:'11px', background:'#fee2e2', color: G.rojo, padding:'3px 8px', borderRadius:'20px' }}>
                    {motivo}: {cant}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}