import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { G } from './constants'

export default function MisPedidos({ user }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const hoy = new Date()
    const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

    const q = query(
      collection(db, 'pedidos'),
      where('vendedor', '==', user.email),
      where('fechaEntrega', '==', fechaHoy)
    )
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0))
      setPedidos(lista)
      setCargando(false)
    })
    return () => unsub()
  }, [user.email])

  const totalItems = pedidos.reduce((acc, p) => acc + (p.items?.length || 0), 0)

  const estadoColor = (estado) => {
    if (estado === 'confirmado') return { bg:'#dcfce7', color: G.verde }
    if (estado === 'en proceso') return { bg:'#fef9c3', color: G.amarillo }
    if (estado === 'listo') return { bg:'#dbeafe', color:'#1d4ed8' }
    return { bg:'#f3f4f6', color: G.gris }
  }

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto', padding:'16px' }}>
      <h3 style={{ color: G.cafe, marginBottom:'4px' }}>📦 Mis pedidos de hoy</h3>
      <p style={{ color: G.gris, fontSize:'13px', marginBottom:'20px' }}>
        {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} · {totalItems} producto{totalItems !== 1 ? 's' : ''}
      </p>

      {cargando && <p style={{ textAlign:'center', color: G.gris }}>Cargando...</p>}

      {!cargando && pedidos.length === 0 && (
        <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
          No tenés pedidos para hoy todavía.
        </p>
      )}

      {pedidos.map(pedido => {
        const colores = estadoColor(pedido.estado)
        const hora = pedido.creadoEn?.toDate?.()
        const horaStr = hora ? hora.toLocaleTimeString('es-SV', { hour:'2-digit', minute:'2-digit' }) : ''
        return (
          <div key={pedido.id} style={{ background:'white', borderRadius:'12px', marginBottom:'14px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${G.borde}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ margin:0, fontSize:'13px', color: G.gris }}>{horaStr && `Enviado a las ${horaStr}`}</p>
                <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
                  {pedido.entrega === 'panaderia' ? '🏠 Recoger en panadería' : '🚚 Entrega en ruta'} · {pedido.pago === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
                </p>
              </div>
              <span style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold', background: colores.bg, color: colores.color }}>
                {pedido.estado}
              </span>
            </div>
            <div style={{ padding:'12px 16px' }}>
              {pedido.items?.map((item, idx) => (
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom: idx < pedido.items.length - 1 ? `1px solid ${G.borde}` : 'none' }}>
                  <p style={{ margin:0, fontSize:'14px', fontWeight:'bold' }}>{item.nombre}</p>
                  <p style={{ margin:0, fontSize:'13px', color: G.gris }}>{item.medida} × {item.cantidad}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}