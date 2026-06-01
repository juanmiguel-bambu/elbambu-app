import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, getDocs, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore'
import { G } from './constants'

const estadoConfig = {
  'pendiente':      { label: 'Pendiente',      bg: '#f3f4f6', color: G.gris },
  'recibido':       { label: 'Recibido',        bg: '#dbeafe', color: '#1d4ed8' },
  'en produccion':  { label: 'En producción',   bg: '#fef9c3', color: '#854d0e' },
  'horneado':       { label: 'Horneado 🍞',      bg: '#dcfce7', color: '#16a34a' },
}

export default function Consolidado({ userEmail }) {
  const [grupos, setGrupos] = useState([])
  const [tabGrupo, setTabGrupo] = useState(null)
  const [fecha, setFecha] = useState('')
  const [consolidado, setConsolidado] = useState([])
  const [cargando, setCargando] = useState(false)
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [contadores, setContadores] = useState({})
  const [pedidosSnap, setPedidosSnap] = useState([])

  const hoy = new Date()
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

  useEffect(() => { setFecha(fechaHoy) }, [])

  useEffect(() => {
    const cargarGrupos = async () => {
      const snap = await getDocs(collection(db, 'grupos'))
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      setGrupos(lista)
      if (lista.length > 0) setTabGrupo(lista[0].id)
    }
    cargarGrupos()
  }, [])

  useEffect(() => {
    if (grupos.length === 0) return
    const unsub = onSnapshot(
      query(collection(db, 'pedidos'), where('fechaEntrega', '==', fechaHoy)),
      (snap) => {
        const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setPedidosSnap(pedidos)
        const nuevosContadores = {}
        grupos.forEach(g => {
          const keyStorage = `visto_${userEmail}_${g.id}_${fechaHoy}`
          const ultimoVisto = Number(localStorage.getItem(keyStorage) || 0)
          const pedidosNuevos = pedidos.filter(p =>
            p.items?.some(item => item.grupoId === g.id) &&
            (p.creadoEn?.seconds || 0) * 1000 > ultimoVisto
          )
          nuevosContadores[g.id] = pedidosNuevos.length
        })
        setContadores(nuevosContadores)
      }
    )
    return () => unsub()
  }, [grupos, fechaHoy, userEmail])

  const entrarATab = (grupoId) => {
    setTabGrupo(grupoId)
    setDetalleAbierto(null)
    const keyStorage = `visto_${userEmail}_${grupoId}_${fechaHoy}`
    localStorage.setItem(keyStorage, Date.now().toString())
    setContadores(prev => ({ ...prev, [grupoId]: 0 }))
  }

  useEffect(() => {
    if (!fecha || !tabGrupo) return
    cargarConsolidado()
  }, [fecha, tabGrupo, pedidosSnap])

  const cargarConsolidado = async () => {
    setCargando(true)
    setDetalleAbierto(null)
    try {
      const snap = fecha === fechaHoy ? pedidosSnap :
        (await getDocs(query(collection(db, 'pedidos'), where('fechaEntrega', '==', fecha)))).docs.map(d => ({ id: d.id, ...d.data() }))

      const pedidos = fecha === fechaHoy ? snap : snap

      const mapa = {}
      pedidos.forEach(pedido => {
        pedido.items?.forEach(item => {
          if (item.grupoId !== tabGrupo) return
          if (!mapa[item.productoId]) {
            mapa[item.productoId] = {
              productoId: item.productoId,
              nombre: item.nombre,
              medida: item.medida,
              total: 0,
              detalle: [],
              vendedores: []
            }
          }
          mapa[item.productoId].total += Number(item.cantidad)
          mapa[item.productoId].detalle.push({
            pedidoId: pedido.id,
            vendedor: pedido.vendedorNombre || pedido.vendedor,
            vendedorEmail: pedido.vendedor,
            cantidad: Number(item.cantidad),
            entrega: pedido.entrega,
            pago: pedido.pago,
            turno: pedido.turnoEntrega || 'manana',
            comentario: pedido.comentario || '',
            estadoPedido: pedido.estadoItems?.[item.productoId] || 'pendiente'
          })
          if (!mapa[item.productoId].vendedores.includes(pedido.vendedor)) {
            mapa[item.productoId].vendedores.push(pedido.vendedor)
          }
        })
      })
      const lista = Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre))
      setConsolidado(lista)
    } catch (e) { console.error(e) }
    setCargando(false)
  }

  const cambiarEstadoPedido = async (pedidoId, productoId, nuevoEstado) => {
    await updateDoc(doc(db, 'pedidos', pedidoId), {
      [`estadoItems.${productoId}`]: nuevoEstado
    })
  }

  const hornearTodos = async (prod) => {
    await Promise.all(prod.detalle.map(d =>
      updateDoc(doc(db, 'pedidos', d.pedidoId), {
        [`estadoItems.${prod.productoId}`]: 'horneado'
      })
    ))
  }

  const totalGeneral = consolidado.reduce((acc, p) => acc + p.total, 0)

  const hoyObj = new Date()
  const hace30 = new Date(hoyObj)
  hace30.setDate(hoyObj.getDate() - 30)
  const minFecha = `${hace30.getFullYear()}-${String(hace30.getMonth()+1).padStart(2,'0')}-${String(hace30.getDate()).padStart(2,'0')}`

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>

      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
          {grupos.map(g => {
            const count = contadores[g.id] || 0
            return (
              <button key={g.id} translate="no" onClick={() => entrarATab(g.id)}
                style={{ flexShrink:0, padding:'13px 16px', border:'none', background:'transparent',
                  color: tabGrupo === g.id ? G.cafe : G.gris,
                  fontWeight: tabGrupo === g.id ? 'bold' : 'normal',
                  borderBottom: tabGrupo === g.id ? `3px solid ${G.cafe}` : '3px solid transparent',
                  cursor:'pointer', fontSize:'14px', whiteSpace:'nowrap',
                  display:'flex', alignItems:'center', gap:'6px' }}>
                {g.nombre}
                {count > 0 && (
                  <span style={{ background: G.rojo, color:'white', borderRadius:'10px', fontSize:'11px', fontWeight:'bold', padding:'1px 6px', minWidth:'18px', textAlign:'center' }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h3 style={{ color: G.cafe, margin:0 }}>📊 Consolidado</h3>
          <input type="date" value={fecha} min={minFecha} max={fechaHoy}
            onChange={e => setFecha(e.target.value)}
            style={{ padding:'8px 10px', borderRadius:'8px', border:`1px solid ${G.borde}`, background:'white', color: G.texto, fontSize:'14px' }} />
        </div>

        {!cargando && consolidado.length > 0 && (
          <div style={{ background: G.cafe, color:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'14px' }}>{consolidado.length} producto{consolidado.length !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight:'bold', fontSize:'18px' }}>{totalGeneral} uds total</span>
          </div>
        )}

        {cargando && <p style={{ textAlign:'center', color: G.gris, marginTop:'40px' }}>Cargando...</p>}

        {!cargando && consolidado.length === 0 && (
          <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
            No hay pedidos para esta fecha y grupo.
          </p>
        )}

        {consolidado.map((prod, idx) => {
          const horneados = prod.detalle.filter(d => d.estadoPedido === 'horneado').length
          const total = prod.detalle.length
          const todoHorneado = horneados === total

          return (
            <div key={idx} style={{ background:'white', borderRadius:'10px', marginBottom:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontWeight:'bold', fontSize:'15px', color: G.texto }}>{prod.nombre}</p>
                  <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>{prod.medida}</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontWeight:'bold', fontSize:'20px', color: G.cafe }}>{prod.total}</span>
                    <p style={{ margin:0, fontSize:'11px', color: todoHorneado ? G.verde : G.gris }}>
                      {horneados}/{total} 🍞
                    </p>
                  </div>
                  <button onClick={() => setDetalleAbierto(detalleAbierto === idx ? null : idx)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', color: G.gris, padding:'4px 6px', lineHeight:1 }}>
                    ⋮
                  </button>
                </div>
              </div>

              {!todoHorneado && (
                <div style={{ padding:'0 16px 12px' }}>
                  <button onClick={() => hornearTodos(prod)}
                    style={{ width:'100%', padding:'8px', borderRadius:'8px', border:`2px solid ${G.verde}`, background:'white', color: G.verde, cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                    🍞 Hornear todos
                  </button>
                </div>
              )}

              {detalleAbierto === idx && (
                <div style={{ borderTop:`1px solid ${G.borde}`, padding:'12px 16px', background:'#fafafa' }}>
                  <p style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                    Detalle por vendedor
                  </p>
                  {prod.detalle.map((d, i) => {
                    const cfg = estadoConfig[d.estadoPedido]
                    return (
                      <div key={i} style={{ padding:'10px 0', borderBottom: i < prod.detalle.length - 1 ? `1px solid ${G.borde}` : 'none' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                          <div>
                            <p style={{ margin:0, fontSize:'14px', fontWeight:'bold', color: G.texto }}>{d.vendedor}</p>
                            <p style={{ margin:0, fontSize:'11px', color: G.gris }}>
                              {d.entrega === 'panaderia' ? '🏠 Panadería' : '🚚 Ruta'} · {d.pago === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'} · {d.turno === 'tarde' ? '🌇 Tarde' : '🌅 Mañana'}
                            </p>
                            {d.comentario ? (
                              <p style={{ margin:'4px 0 0', fontSize:'11px', color: G.texto, background: G.cafeClaro, padding:'4px 8px', borderRadius:'4px', borderLeft:`2px solid ${G.cafe}` }}>
                                💬 {d.comentario}
                              </p>
                            ) : null}
                          </div>
                          <span style={{ fontWeight:'bold', fontSize:'16px', color: G.cafe, marginLeft:'12px' }}>{d.cantidad}</span>
                        </div>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px' }}>
                          {['recibido', 'en produccion', 'horneado'].map(estado => {
                            const c = estadoConfig[estado]
                            const activo = d.estadoPedido === estado
                            return (
                              <button key={estado} onClick={() => cambiarEstadoPedido(d.pedidoId, prod.productoId, estado)}
                                style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'bold',
                                  border: activo ? `2px solid ${c.color}` : `2px solid ${G.borde}`,
                                  background: activo ? c.bg : 'white',
                                  color: activo ? c.color : G.gris,
                                  cursor:'pointer' }}>
                                {c.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}