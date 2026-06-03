import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { G } from './constants'

const UNIDADES = ['oz', 'lb', 'unidades']

export default function Inventario({ isAdmin }) {
  const [materias, setMaterias] = useState([])
  const [tab, setTab] = useState('stock')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formNombre, setFormNombre] = useState('')
  const [formUnidad, setFormUnidad] = useState('oz')
  const [formStockMax, setFormStockMax] = useState('')
  const [formStockInicial, setFormStockInicial] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [entradaId, setEntradaId] = useState(null)
  const [entradaCantidad, setEntradaCantidad] = useState('')
  const [entradaMsg, setEntradaMsg] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventario'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setMaterias(lista)
    })
    return () => unsub()
  }, [])

  const porcentaje = (m) => {
    if (!m.stockMaximo || m.stockMaximo === 0) return 0
    return Math.min(100, Math.round((m.stockActual / m.stockMaximo) * 100))
  }

  const enAlerta = (m) => porcentaje(m) <= 25

  const guardar = async () => {
    if (!formNombre.trim()) { setMsg('⚠️ Ingresá el nombre'); return }
    if (!formStockMax || Number(formStockMax) <= 0) { setMsg('⚠️ Ingresá el stock máximo'); return }
    setGuardando(true)
    if (editandoId) {
      await updateDoc(doc(db, 'inventario', editandoId), {
        nombre: formNombre.trim(),
        unidad: formUnidad,
        stockMaximo: Number(formStockMax)
      })
      setMsg('Actualizado ✅')
    } else {
      await addDoc(collection(db, 'inventario'), {
        nombre: formNombre.trim(),
        unidad: formUnidad,
        stockMaximo: Number(formStockMax),
        stockActual: Number(formStockInicial) || 0,
        creadoEn: new Date()
      })
      setMsg('Agregado ✅')
    }
    resetForm()
    setTimeout(() => setMsg(''), 2000)
    setGuardando(false)
  }

  const resetForm = () => {
    setFormNombre(''); setFormUnidad('oz'); setFormStockMax(''); setFormStockInicial('')
    setEditandoId(null); setMostrarForm(false)
  }

  const iniciarEdicion = (m) => {
    setFormNombre(m.nombre); setFormUnidad(m.unidad); setFormStockMax(m.stockMaximo.toString())
    setEditandoId(m.id); setMostrarForm(true); setTab('gestion')
  }

  const eliminar = async (id) => {
    await deleteDoc(doc(db, 'inventario', id))
    setConfirmEliminar(null)
  }

  const registrarEntrada = async (m) => {
    const cant = Number(entradaCantidad)
    if (!cant || cant <= 0) { setEntradaMsg('⚠️ Ingresá una cantidad válida'); return }
    await updateDoc(doc(db, 'inventario', m.id), {
      stockActual: (m.stockActual || 0) + cant
    })
    setEntradaId(null); setEntradaCantidad(''); setEntradaMsg('')
  }

  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'14px' }

  const alertas = materias.filter(m => enAlerta(m) && m.stockActual > 0)
  const sinStock = materias.filter(m => m.stockActual === 0)

  const subTabs = [
    { key:'stock', label:'📊 Stock' },
    ...(isAdmin ? [{ key:'gestion', label:'⚙️ Gestión' }] : [])
  ]

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>

      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex' }}>
          {subTabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setMostrarForm(false) }}
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

        {/* ── TAB STOCK ── */}
        {tab === 'stock' && (
          <>
            <h3 style={{ color: G.cafe, marginBottom:'16px' }}>📦 Inventario Materias Primas</h3>

            {/* Alertas */}
            {(alertas.length > 0 || sinStock.length > 0) && (
              <div style={{ background:'#fff3cd', border:'1px solid #ffc107', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px' }}>
                <p style={{ margin:'0 0 8px', fontWeight:'bold', fontSize:'13px', color:'#856404' }}>⚠️ Alertas de stock</p>
                {sinStock.map(m => (
                  <p key={m.id} style={{ margin:'2px 0', fontSize:'13px', color: G.rojo }}>
                    🔴 <strong>{m.nombre}</strong> — Sin stock
                  </p>
                ))}
                {alertas.map(m => (
                  <p key={m.id} style={{ margin:'2px 0', fontSize:'13px', color:'#856404' }}>
                    🟡 <strong>{m.nombre}</strong> — {m.stockActual} {m.unidad} ({porcentaje(m)}% del máximo)
                  </p>
                ))}
              </div>
            )}

            {materias.length === 0 && (
              <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
                No hay materias primas registradas.{isAdmin ? ' Andá a ⚙️ Gestión para agregar.' : ''}
              </p>
            )}

            {materias.map(m => {
              const pct = porcentaje(m)
              const alerta = enAlerta(m)
              const barColor = pct === 0 ? G.rojo : alerta ? '#ffc107' : G.verde

              return (
                <div key={m.id} style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        {alerta && <span style={{ fontSize:'14px' }}>⚠️</span>}
                        <p style={{ margin:0, fontWeight:'bold', fontSize:'15px', color: G.texto }}>{m.nombre}</p>
                      </div>
                      <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
                        Stock máx: {m.stockMaximo} {m.unidad}
                      </p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontWeight:'bold', fontSize:'18px', color: pct === 0 ? G.rojo : alerta ? '#856404' : G.cafe }}>
                        {m.stockActual}
                      </span>
                      <span style={{ fontSize:'13px', color: G.gris }}> {m.unidad}</span>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div style={{ background: G.borde, borderRadius:'4px', height:'6px', marginBottom:'10px' }}>
                    <div style={{ width:`${pct}%`, background: barColor, borderRadius:'4px', height:'6px', transition:'width 0.3s' }} />
                  </div>

                  {/* Botón registrar entrada */}
                  {isAdmin && (
                    entradaId === m.id ? (
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <input type="number" placeholder={`Cantidad en ${m.unidad}`} value={entradaCantidad}
                          onChange={e => setEntradaCantidad(e.target.value)}
                          style={{ ...inputStyle, flex:1, padding:'8px' }} />
                        <button onClick={() => registrarEntrada(m)}
                          style={{ padding:'8px 14px', background: G.verde, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                          ✅
                        </button>
                        <button onClick={() => { setEntradaId(null); setEntradaCantidad(''); setEntradaMsg('') }}
                          style={{ padding:'8px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEntradaId(m.id); setEntradaCantidad('') }}
                        style={{ width:'100%', padding:'7px', background: G.cafeClaro, color: G.cafe, border:`1px solid ${G.cafe}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                        ➕ Registrar entrada
                      </button>
                    )
                  )}
                  {entradaMsg && entradaId === m.id && (
                    <p style={{ color: G.rojo, fontSize:'12px', margin:'4px 0 0' }}>{entradaMsg}</p>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ── TAB GESTIÓN ── */}
        {tab === 'gestion' && isAdmin && (
          <>
            <h3 style={{ color: G.cafe, marginBottom:'16px' }}>⚙️ Gestión de materias primas</h3>

            {!mostrarForm && (
              <button onClick={() => setMostrarForm(true)}
                style={{ width:'100%', padding:'12px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px', marginBottom:'20px' }}>
                ➕ Nueva materia prima
              </button>
            )}

            {mostrarForm && (
              <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop:`3px solid ${G.cafe}` }}>
                <p style={{ fontWeight:'bold', color: G.cafe, marginBottom:'14px' }}>{editandoId ? '✏️ Editar materia prima' : '➕ Nueva materia prima'}</p>

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Nombre</p>
                <input value={formNombre} onChange={e => setFormNombre(e.target.value)}
                  placeholder="Ej: Harina Suave"
                  style={{ ...inputStyle, marginBottom:'12px' }} />

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Unidad</p>
                <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                  {UNIDADES.map(u => (
                    <button key={u} onClick={() => setFormUnidad(u)}
                      style={{ flex:1, padding:'9px', borderRadius:'8px', border:`2px solid ${formUnidad === u ? G.cafe : G.borde}`, background: formUnidad === u ? G.cafe : 'white', color: formUnidad === u ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: formUnidad === u ? 'bold' : 'normal' }}>
                      {u}
                    </button>
                  ))}
                </div>

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Stock máximo ({formUnidad})</p>
                <input type="number" value={formStockMax} onChange={e => setFormStockMax(e.target.value)}
                  placeholder="Ej: 500"
                  style={{ ...inputStyle, marginBottom:'12px' }} min="0" step="0.01" />

                {!editandoId && (
                  <>
                    <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Stock inicial ({formUnidad}) <span style={{ opacity:0.6 }}>(opcional)</span></p>
                    <input type="number" value={formStockInicial} onChange={e => setFormStockInicial(e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, marginBottom:'16px' }} min="0" step="0.01" />
                  </>
                )}

                {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={resetForm} style={{ flex:1, padding:'11px', background: G.borde, color: G.texto, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>Cancelar</button>
                  <button onClick={guardar} disabled={guardando} style={{ flex:2, padding:'11px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }}>
                    {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar'}
                  </button>
                </div>
              </div>
            )}

            {materias.length === 0 && !mostrarForm && (
              <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>No hay materias primas registradas.</p>
            )}

            {materias.map(m => (
              <div key={m.id} style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                {confirmEliminar === m.id ? (
                  <div>
                    <p style={{ margin:'0 0 10px', fontSize:'14px', color: G.rojo }}>⚠️ ¿Eliminar "{m.nombre}"?</p>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => setConfirmEliminar(null)} style={{ flex:1, padding:'8px', background: G.borde, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
                      <button onClick={() => eliminar(m.id)} style={{ flex:1, padding:'8px', background: G.rojo, color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>Sí, eliminar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ margin:0, fontWeight:'bold', fontSize:'15px', color: G.texto }}>{m.nombre}</p>
                      <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
                        {m.stockActual} / {m.stockMaximo} {m.unidad}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => iniciarEdicion(m)} style={{ padding:'7px 12px', background: G.amarilloClaro, color: G.amarillo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✏️</button>
                      <button onClick={() => setConfirmEliminar(m.id)} style={{ padding:'7px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}