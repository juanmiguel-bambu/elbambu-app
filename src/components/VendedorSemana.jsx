import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, query, where, doc, setDoc, getDoc } from 'firebase/firestore'
import { G } from './constants'

const CATEGORIAS = [
  { val: 'rutero', label: '🚚 Ruteros' },
  { val: 'punto_fijo', label: '🏪 Puntos fijos' },
  { val: 'en_linea', label: '💻 En línea' },
]

export default function VendedorSemana({ isAdmin }) {
  const [cierres, setCierres] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [activo, setActivo] = useState(false)
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  // Rango de la semana actual (lunes a hoy)
  const hoy = new Date()
  const diaSemana = hoy.getDay() // 0=dom, 1=lun ... 5=vie, 6=sab
  const diasDesdelunes = diaSemana === 0 ? 6 : diaSemana - 1
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - diasDesdelunes)
  lunes.setHours(0, 0, 0, 0)

  const fechas = []
  for (let i = 0; i <= diasDesdelunes; i++) {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    fechas.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  }

  const fechaLunes = fechas[0]
  const fechaHoy = fechas[fechas.length - 1]

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.activo && u.rol === 'vendedor'))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    // Cargar config de activación
    const cargarConfig = async () => {
      const snap = await getDoc(doc(db, 'config', 'vendedorSemana'))
      if (snap.exists()) setActivo(snap.data().activo || false)
    }
    cargarConfig()

    const unsub = onSnapshot(collection(db, 'config'), snap => {
      const cfg = snap.docs.find(d => d.id === 'vendedorSemana')
      if (cfg) setActivo(cfg.data().activo || false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    // Cargar cierres de la semana
    const unsub = onSnapshot(
      query(collection(db, 'cierresCaja'),
        where('fecha', '>=', fechaLunes),
        where('fecha', '<=', fechaHoy)
      ),
      snap => setCierres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [fechaLunes, fechaHoy])

  const toggleActivo = async () => {
    setGuardandoConfig(true)
    await setDoc(doc(db, 'config', 'vendedorSemana'), { activo: !activo })
    setGuardandoConfig(false)
  }

  // Calcular ranking por vendedor
  const rankingPorCategoria = () => {
    const mapa = {}
    cierres.forEach(c => {
      if (!mapa[c.vendedorEmail]) {
        mapa[c.vendedorEmail] = {
          email: c.vendedorEmail,
          nombre: c.vendedorNombre,
          totalVendido: 0,
          totalMerma: 0,
          diasCierre: 0
        }
      }
      mapa[c.vendedorEmail].totalVendido += c.totalVendido || 0
      mapa[c.vendedorEmail].totalMerma += c.totalMerma || 0
      mapa[c.vendedorEmail].diasCierre += 1
    })

    return CATEGORIAS.map(cat => {
      const vendedoresCat = usuarios.filter(u => u.categoriaVendedor === cat.val)
      const ranking = vendedoresCat
        .map(u => ({
          ...u,
          ...(mapa[u.email] || { totalVendido: 0, totalMerma: 0, diasCierre: 0 }),
        }))
        .sort((a, b) => b.totalVendido - a.totalVendido || a.totalMerma - b.totalMerma)

      return { ...cat, ranking }
    }).filter(cat => cat.ranking.length > 0)
  }

  const categorias = rankingPorCategoria()
  const esViernes = hoy.getDay() === 5

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '16px', paddingBottom: '30px' }}>
      <h3 style={{ color: G.cafe, marginBottom: '4px' }}>🏆 Vendedor de la semana</h3>
      <p style={{ fontSize: '13px', color: G.gris, marginBottom: '16px' }}>
        Semana del {fechaLunes} al {fechaHoy}
      </p>

      {/* Control activación — solo admin */}
      {isAdmin && (
        <div style={{ background: 'white', padding: '14px 16px', borderRadius: '10px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: G.texto }}>Anuncio de viernes</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: G.gris }}>Mostrar ganadores al abrir la app los viernes</p>
          </div>
          <button onClick={toggleActivo} disabled={guardandoConfig}
            style={{ padding: '8px 16px', borderRadius: '20px', border: `2px solid ${activo ? G.verde : G.borde}`, background: activo ? '#dcfce7' : 'white', color: activo ? G.verde : G.gris, cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            {activo ? '✅ Activo' : 'Inactivo'}
          </button>
        </div>
      )}

      {categorias.length === 0 && (
        <p style={{ textAlign: 'center', color: G.gris, marginTop: '40px', fontSize: '14px' }}>
          No hay cierres registrados esta semana aún.
        </p>
      )}

      {categorias.map(cat => (
        <div key={cat.val} style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: G.cafe, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {cat.label}
          </p>
          {cat.ranking.map((v, idx) => (
            <div key={v.email} style={{
              background: idx === 0 ? '#fffbeb' : 'white',
              border: idx === 0 ? `2px solid #f59e0b` : `1px solid ${G.borde}`,
              padding: '12px 16px', borderRadius: '10px', marginBottom: '8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px', minWidth: '28px', textAlign: 'center' }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: G.texto }}>{v.nombre}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: G.gris }}>
                    {v.diasCierre} cierre{v.diasCierre !== 1 ? 's' : ''} · Merma: ${v.totalMerma.toFixed(2)}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px', color: G.cafe }}>${v.totalVendido.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}