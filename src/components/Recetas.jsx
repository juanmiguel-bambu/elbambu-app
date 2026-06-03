import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { G } from './constants'

export default function Recetas({ isAdmin }) {
  const [tab, setTab] = useState('calcular')
  const [recetas, setRecetas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [subgrupos, setSubgrupos] = useState([])
  const [pedidosHoy, setPedidosHoy] = useState([])
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [turnoFiltro, setTurnoFiltro] = useState('manana')

  const [formNombre, setFormNombre] = useState('')
  const [formGrupoId, setFormGrupoId] = useState('')
  const [formSubgrupo, setFormSubgrupo] = useState('')
  const [formIngredientes, setFormIngredientes] = useState([{ nombre: '', oz: '' }])
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const hoy = new Date()
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'recetas'), snap => {
      setRecetas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grupos'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      setGrupos(lista)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), snap => {
      const subs = [...new Set(snap.docs.map(d => d.data().subgrupo).filter(Boolean))]
      setSubgrupos(subs.sort())
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'pedidos'), where('fechaEntrega', '==', fechaHoy)),
      snap => setPedidosHoy(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [fechaHoy])

  const esUnidadPeso = (medida) => {
    return /oz|lb|g\b|kg/i.test(medida || '')
  }

  const calcular = (receta) => {
    setRecetaSeleccionada(receta)
    let totalFactor = 0
    const detalle = {}

    const pedidosFiltrados = pedidosHoy.filter(p => (p.turnoEntrega || 'manana') === turnoFiltro)

    pedidosFiltrados.forEach(pedido => {
      pedido.items?.forEach(item => {
        if ((item.subgrupo || '').toLowerCase() !== (receta.subgrupo || '').toLowerCase()) return
        const cantidad = Number(item.cantidad)

        if (esUnidadPeso(item.medida)) {
          const ozMatch = item.medida?.match(/[\d.]+/)
          const ozUnidad = ozMatch ? parseFloat(ozMatch[0]) : 0
          totalFactor += ozUnidad * cantidad
        } else {
          totalFactor += cantidad
        }

        const key = `${item.nombre} (${item.medida})`
        detalle[key] = (detalle[key] || 0) + cantidad
      })
    })

    if (totalFactor === 0) {
      setResultado({ vacio: true, receta })
      return
    }

    const masaBaseOz = receta.ingredientes.reduce((acc, i) => acc + Number(i.oz), 0)
    const primerasMedidas = Object.keys(detalle)
    const usaPeso = primerasMedidas.some(k => esUnidadPeso(k))
    const factor = usaPeso ? totalFactor / masaBaseOz : totalFactor

    const ingredientesCalculados = receta.ingredientes.map(i => {
      const ozTotal = Number(i.oz) * factor
      const lbTotal = ozTotal / 16
      return { nombre: i.nombre, oz: ozTotal.toFixed(2), lb: lbTotal.toFixed(3) }
    })

    setResultado({
      vacio: false, receta,
      totalFactor: totalFactor.toFixed(2),
      masaBaseOz: masaBaseOz.toFixed(2),
      factor: factor.toFixed(4),
      usaPeso, turnoFiltro,
      ingredientesCalculados, detalle
    })
  }

  const guardarReceta = async () => {
    if (!formNombre.trim() || !formGrupoId || !formSubgrupo.trim()) { setMsg('⚠️ Completá nombre, grupo y subgrupo'); return }
    const ingValidos = formIngredientes.filter(i => i.nombre.trim() && i.oz)
    if (ingValidos.length === 0) { setMsg('⚠️ Agregá al menos un ingrediente'); return }
    setGuardando(true)
    const datos = {
      nombre: formNombre.trim(),
      grupoId: formGrupoId,
      subgrupo: formSubgrupo.trim(),
      ingredientes: ingValidos.map(i => ({ nombre: i.nombre.trim(), oz: parseFloat(i.oz) }))
    }
    if (editandoId) {
      await updateDoc(doc(db, 'recetas', editandoId), datos)
      setMsg('Receta actualizada ✅')
    } else {
      await addDoc(collection(db, 'recetas'), { ...datos, creadoEn: new Date() })
      setMsg('Receta guardada ✅')
    }
    resetForm()
    setTimeout(() => setMsg(''), 2000)
    setGuardando(false)
  }

  const resetForm = () => {
    setFormNombre(''); setFormGrupoId(''); setFormSubgrupo('')
    setFormIngredientes([{ nombre: '', oz: '' }])
    setEditandoId(null); setMostrarForm(false)
  }

  const iniciarEdicion = (r) => {
    setFormNombre(r.nombre); setFormGrupoId(r.grupoId); setFormSubgrupo(r.subgrupo)
    setFormIngredientes(r.ingredientes.map(i => ({ nombre: i.nombre, oz: i.oz.toString() })))
    setEditandoId(r.id); setMostrarForm(true)
  }

  const eliminar = async (id) => {
    await deleteDoc(doc(db, 'recetas', id))
    setConfirmEliminar(null)
  }

  const agregarIngrediente = () => setFormIngredientes([...formIngredientes, { nombre: '', oz: '' }])
  const quitarIngrediente = (idx) => setFormIngredientes(formIngredientes.filter((_, i) => i !== idx))
  const actualizarIngrediente = (idx, campo, valor) => {
    const nuevos = [...formIngredientes]
    nuevos[idx][campo] = valor
    setFormIngredientes(nuevos)
  }

  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'14px' }

  const subTabs = [
    { key:'calcular', label:'🧮 Calcular' },
    ...(isAdmin ? [{ key:'gestionar', label:'⚙️ Gestionar' }] : [])
  ]

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>

      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex' }}>
          {subTabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setResultado(null) }}
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

        {tab === 'calcular' && (
          <>
            <h3 style={{ color: G.cafe, marginBottom:'16px' }}>🧮 Calcular receta</h3>

            {/* Selector de turno */}
            <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Turno</p>
            <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
              {[{ val:'manana', label:'🌅 Mañana' }, { val:'tarde', label:'🌇 Tarde' }].map(op => (
                <button key={op.val} onClick={() => { setTurnoFiltro(op.val); setResultado(null); setRecetaSeleccionada(null) }}
                  style={{ flex:1, padding:'10px 8px', borderRadius:'8px',
                    border:`2px solid ${turnoFiltro === op.val ? G.cafe : G.borde}`,
                    background: turnoFiltro === op.val ? G.cafe : 'white',
                    color: turnoFiltro === op.val ? 'white' : G.texto,
                    cursor:'pointer', fontSize:'13px', fontWeight: turnoFiltro === op.val ? 'bold' : 'normal' }}>
                  {op.label}
                </button>
              ))}
            </div>

            {recetas.length === 0 && (
              <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
                No hay recetas creadas aún.{isAdmin ? ' Andá a ⚙️ Gestionar para crear una.' : ''}
              </p>
            )}

            {recetas.length > 0 && (
              <>
                <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Seleccionar receta</p>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px' }}>
                  {recetas.map(r => (
                    <button key={r.id} onClick={() => calcular(r)}
                      style={{ padding:'10px 16px', borderRadius:'8px',
                        border:`2px solid ${recetaSeleccionada?.id === r.id ? G.cafe : G.borde}`,
                        background: recetaSeleccionada?.id === r.id ? G.cafe : 'white',
                        color: recetaSeleccionada?.id === r.id ? 'white' : G.texto,
                        cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                      {r.nombre}
                    </button>
                  ))}
                </div>
              </>
            )}

            {resultado?.vacio && (
              <div style={{ background:'white', padding:'16px', borderRadius:'10px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                <p style={{ color: G.gris, fontSize:'14px' }}>No hay pedidos de turno <strong>{turnoFiltro === 'manana' ? 'Mañana' : 'Tarde'}</strong> para el subgrupo <strong>{resultado.receta.subgrupo}</strong>.</p>
              </div>
            )}

            {resultado && !resultado.vacio && (
              <>
                <div style={{ background: G.cafe, color:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'16px' }}>
                  <p style={{ margin:0, fontWeight:'bold', fontSize:'16px' }}>{resultado.receta.nombre}</p>
                  <p style={{ margin:'4px 0 0', fontSize:'13px', opacity:0.85 }}>
                    Turno: {resultado.turnoFiltro === 'manana' ? '🌅 Mañana' : '🌇 Tarde'} · Subgrupo: {resultado.receta.subgrupo}
                  </p>
                  <p style={{ margin:'2px 0 0', fontSize:'13px', opacity:0.85 }}>
                    {resultado.usaPeso ? `Masa necesaria: ${resultado.totalFactor} oz` : `Total: ${resultado.totalFactor} unidades`} · Factor: ×{resultado.factor}
                  </p>
                </div>

                <div style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                  <p style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Pedidos incluidos</p>
                  {Object.entries(resultado.detalle).map(([nombre, cant]) => (
                    <div key={nombre} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${G.borde}`, fontSize:'13px' }}>
                      <span style={{ color: G.texto }}>{nombre}</span>
                      <span style={{ fontWeight:'bold', color: G.cafe }}>{cant} uds</span>
                    </div>
                  ))}
                </div>

                <div style={{ background:'white', padding:'14px 16px', borderRadius:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                  <p style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Ingredientes</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0 12px', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, paddingBottom:'6px' }}>Ingrediente</span>
                    <span style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, paddingBottom:'6px', textAlign:'right' }}>Oz</span>
                    <span style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, paddingBottom:'6px', textAlign:'right' }}>Lb</span>
                    {resultado.ingredientesCalculados.map((ing, idx) => (
                      <>
                        <span key={`n${idx}`} style={{ fontSize:'14px', color: G.texto, padding:'6px 0', borderTop:`1px solid ${G.borde}` }}>{ing.nombre}</span>
                        <span key={`o${idx}`} style={{ fontSize:'14px', fontWeight:'bold', color: G.cafe, padding:'6px 0', borderTop:`1px solid ${G.borde}`, textAlign:'right' }}>{ing.oz}</span>
                        <span key={`l${idx}`} style={{ fontSize:'14px', fontWeight:'bold', color: G.texto, padding:'6px 0', borderTop:`1px solid ${G.borde}`, textAlign:'right' }}>{ing.lb}</span>
                      </>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'gestionar' && isAdmin && (
          <>
            <h3 style={{ color: G.cafe, marginBottom:'16px' }}>⚙️ Gestionar recetas</h3>

            {!mostrarForm && (
              <button onClick={() => setMostrarForm(true)}
                style={{ width:'100%', padding:'12px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px', marginBottom:'20px' }}>
                ➕ Nueva receta
              </button>
            )}

            {mostrarForm && (
              <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop:`3px solid ${G.cafe}` }}>
                <p style={{ fontWeight:'bold', color: G.cafe, marginBottom:'14px' }}>{editandoId ? '✏️ Editar receta' : '➕ Nueva receta'}</p>

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Nombre de la receta</p>
                <input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Masa de Pan Menudo"
                  style={{ ...inputStyle, marginBottom:'12px' }} />

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Grupo</p>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
                  {grupos.map(g => (
                    <button key={g.id} onClick={() => setFormGrupoId(g.id)}
                      style={{ padding:'7px 12px', borderRadius:'8px', border:`2px solid ${formGrupoId === g.id ? G.cafe : G.borde}`, background: formGrupoId === g.id ? G.cafe : 'white', color: formGrupoId === g.id ? 'white' : G.gris, cursor:'pointer', fontSize:'13px' }}>
                      {g.nombre}
                    </button>
                  ))}
                </div>

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Subgrupo vinculado</p>
                <select value={formSubgrupo} onChange={e => setFormSubgrupo(e.target.value)}
                  style={{ ...inputStyle, marginBottom:'16px' }}>
                  <option value=''>Seleccioná un subgrupo...</option>
                  {subgrupos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Ingredientes (en onzas)</p>
                {formIngredientes.map((ing, idx) => (
                  <div key={idx} style={{ display:'flex', gap:'6px', marginBottom:'8px', alignItems:'center' }}>
                    <input placeholder="Ingrediente" value={ing.nombre} onChange={e => actualizarIngrediente(idx, 'nombre', e.target.value)}
                      style={{ ...inputStyle, flex:2, marginBottom:0 }} />
                    <input type="number" placeholder="Oz" value={ing.oz} onChange={e => actualizarIngrediente(idx, 'oz', e.target.value)} min="0" step="0.01"
                      style={{ ...inputStyle, flex:1, marginBottom:0 }} />
                    {formIngredientes.length > 1 && (
                      <button onClick={() => quitarIngrediente(idx)}
                        style={{ padding:'10px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', flexShrink:0 }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={agregarIngrediente}
                  style={{ width:'100%', padding:'9px', background: G.cafeClaro, color: G.cafe, border:`1px dashed ${G.cafe}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px', marginBottom:'16px' }}>
                  ➕ Agregar ingrediente
                </button>

                {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={resetForm} style={{ flex:1, padding:'11px', background: G.borde, color: G.texto, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>Cancelar</button>
                  <button onClick={guardarReceta} disabled={guardando} style={{ flex:2, padding:'11px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }}>
                    {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar receta'}
                  </button>
                </div>
              </div>
            )}

            {recetas.length === 0 && !mostrarForm && (
              <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>No hay recetas creadas aún.</p>
            )}

            {recetas.map(r => (
              <div key={r.id} style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                {confirmEliminar === r.id ? (
                  <div>
                    <p style={{ margin:'0 0 10px', fontSize:'14px', color: G.rojo }}>⚠️ ¿Eliminar "{r.nombre}"?</p>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => setConfirmEliminar(null)} style={{ flex:1, padding:'8px', background: G.borde, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
                      <button onClick={() => eliminar(r.id)} style={{ flex:1, padding:'8px', background: G.rojo, color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>Sí, eliminar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ margin:0, fontWeight:'bold', fontSize:'15px', color: G.texto }}>{r.nombre}</p>
                      <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>{r.subgrupo} · {r.ingredientes?.length} ingredientes</p>
                    </div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => iniciarEdicion(r)} style={{ padding:'7px 12px', background: G.amarilloClaro, color: G.amarillo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✏️</button>
                      <button onClick={() => setConfirmEliminar(r.id)} style={{ padding:'7px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✕</button>
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