import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore'
import { G } from './constants'

const estadoConfig = {
  'pendiente':      { label: 'Pendiente',      bg: '#f3f4f6', color: '#888' },
  'recibido':       { label: 'Recibido',        bg: '#dbeafe', color: '#1d4ed8' },
  'en produccion':  { label: 'En producción',   bg: '#fef9c3', color: '#854d0e' },
  'horneado':       { label: 'Horneado 🍞',      bg: '#dcfce7', color: '#16a34a' },
}

export default function MisPedidos({ user }) {
  const [pedidos, setPedidos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [tabGrupo, setTabGrupo] = useState(null)
  const [cargando, setCargando] = useState(true)

  const hoy = new Date()
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

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
    const unsub = onSnapshot(
      query(
        collection(db, 'pedidos'),
        where('vendedor', '==', user.email),
        where('fechaEntrega', '==', fechaHoy)
      ),
      (snap) => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        lista.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0))
        setPedidos(lista)
        setCargando(false)
      }
    )
    return () => unsub()
  }, [user.email, fechaHoy])

  const pedidosDelGrupo = pedidos
    .filter(p => p.items?.some(item => item.grupoId === tabGrupo))
    .map(p => ({ ...p, items: p.items.filter(item => item.grupoId === tabGrupo) }))

  const totalItems = pedidosDelGrupo.reduce((acc, p) => acc + (p.items?.length || 0), 0)

  const getHora = (creadoEn) => {
    try {
      const seconds = creadoEn?.seconds
      if (!seconds) return ''
      return new Date(seconds * 1000).toLocaleTimeString('es-SV', { hour:'2-digit', minute:'2-digit' })
    } catch { return '' }
  }

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>

      {/* Tabs de grupos */}
      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
          {grupos.map(g => (
            <button key={g.id} translate="no" onClick={() => setTabGrupo(g.id)}
              style={{ flexShrink:0, padding:'13px 16px', border:'none', background:'transparent',
                color: tabGrupo === g.id ? G.cafe : G.gris,
                fontWeight: tabGrupo === g.id ? 'bold' : 'normal',
                borderBottom: tabGrupo === g.id ? `3px solid ${G.cafe}` : '3px solid transparent',
                cursor:'pointer', fontSize:'14px', whiteSpace:'nowrap' }}>
              {g.nombre}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h3 style={{ color: G.cafe, margin:0 }}>📦 Mis pedidos de hoy</h3>
          <p style={{ color: G.gris, fontSize:'13px', margin:0 }}>
            {pedidosDelGrupo.length} pedido{pedidosDelGrupo.length !== 1 ? 's' : ''} · {totalItems} ítem{totalItems !== 1 ? 's' : ''}
          </p>
        </div>

        {cargando && <p style={{ textAlign:'center', color: G.gris }}>Cargando...</p>}

        {!cargando && pedidosDelGrupo.length === 0 && (
          <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
            No tenés pedidos de este grupo hoy.
          </p>
        )}

        {pedidosDelGrupo.map(pedido => {
          const horaStr = getHora(pedido.creadoEn)
          return (
            <div key={pedido.id} style={{ background:'white', borderRadius:'12px', marginBottom:'14px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${G.borde}` }}>
                {horaStr ? <p style={{ margin:0, fontSize:'13px', color: G.gris }}>Enviado a las {horaStr}</p> : null}
                <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
                  {pedido.entrega === 'panaderia' ? '🏠 Recoger en panadería' : '🚚 Entrega en ruta'} · {pedido.pago === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
                </p>
              </div>
              <div style={{ padding:'12px 16px' }}>
                {pedido.items?.map((item, idx) => {
                  const estadoActual = pedido.estadoItems?.[item.productoId] || 'pendiente'
                  const cfg = estadoConfig[estadoActual]
                  return (
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: idx < pedido.items.length - 1 ? `1px solid ${G.borde}` : 'none' }}>
                      <div>
                        <p style={{ margin:0, fontSize:'14px', fontWeight:'bold' }}>{item.nombre}</p>
                        <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{item.medida} × {item.cantidad}</p>
                      </div>
                      <span style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold', background: cfg.bg, color: cfg.color, whiteSpace:'nowrap' }}>
                        {cfg.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}