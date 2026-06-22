import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { G } from './constants'

const normalizarSecciones = (receta) => {
  if (receta.secciones && receta.secciones.length > 0) return receta.secciones
  if (receta.ingredientes && receta.ingredientes.length > 0) {
    return [{ nombre: 'Ingredientes', ingredientes: receta.ingredientes }]
  }
  return []
}

const seccionVacia = (nombre = '') => ({ nombre, ingredientes: [{ nombre: '', oz: '' }] })

const HORARIOS_TURNO = {
  manana: 'Entrega mañana — productos listos antes de las 6:00 AM',
  tarde:  'Entrega tarde — productos listos antes de las 12:00 PM'
}

export default function Recetas({ isAdmin }) {
  const [tab, setTab] = useState('calcular')
  const [recetas, setRecetas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [subgrupos, setSubgrupos] = useState([])
  const [pedidosHoy, setPedidosHoy] = useState([])
  const [inventario, setInventario] = useState([])
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [turnoFiltro, setTurnoFiltro] = useState('manana')
  const [confirmando, setConfirmando] = useState(false)
  const [msgConfirm, setMsgConfirm] = useState('')
  const [turnoConfirmado, setTurnoConfirmado] = useState(false)

  const [formNombre, setFormNombre] = useState('')
  const [formGrupoId, setFormGrupoId] = useState('')
  const [formSubgrupo, setFormSubgrupo] = useState('')
  const [formUsaSecciones, setFormUsaSecciones] = useState(false)
  const [formIngredientes, setFormIngredientes] = useState([{ nombre: '', oz: '' }])
  const [formSecciones, setFormSecciones] = useState([seccionVacia('Masa'), seccionVacia('Relleno')])
  const [formEsBaseCompartida, setFormEsBaseCompartida] = useState(false)
  const [productos, setProductos] = useState([])

  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [mostrarSugIng, setMostrarSugIng] = useState({})

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
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setProductos(lista)
      const subs = [...new Set(lista.map(p => p.subgrupo).filter(Boolean))]
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventario'), snap => {
      setInventario(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const cambiarTurno = (nuevoTurno) => {
    setTurnoFiltro(nuevoTurno)
    setTurnoConfirmado(false)
    setResultado(null)
    setRecetaSeleccionada(null)
    setMsgConfirm('')
  }

  const confirmarTurno = () => {
    setTurnoConfirmado(true)
  }

  const esUnidadPeso = (medida) => /oz|lb|g\b|kg/i.test(medida || '')

  const calcular = (receta) => {
    setRecetaSeleccionada(receta)
    setMsgConfirm('')

    const pedidosFiltrados = pedidosHoy.filter(p => (p.turnoEntrega || 'manana') === turnoFiltro)

    if (receta.esBaseCompartida) {
      const productosVinculados = productos
        .map(p => {
          const vinculo = p.recetasVinculadas?.find(rv => rv.recetaId === receta.id)
          return vinculo ? { producto: p, ozPorUnidad: Number(vinculo.oz) } : null
        })
        .filter(Boolean)
      const idsVinculados = new Map(productosVinculados.map(v => [v.producto.id, v.ozPorUnidad]))

      let totalOz = 0
      const detalle = {}

      pedidosFiltrados.forEach(pedido => {
        pedido.items?.forEach(item => {
          if (!idsVinculados.has(item.productoId)) return
          const cantidad = Number(item.cantidad)
          const ozPorUnidad = idsVinculados.get(item.productoId)
          totalOz += cantidad * ozPorUnidad
          const key = `${item.nombre} (${item.medida})`
          detalle[key] = (detalle[key] || 0) + cantidad
        })
      })

      if (totalOz === 0) {
        setResultado({ vacio: true, receta })
        return
      }

      const recetaIngredientes = receta.ingredientes && receta.ingredientes.length > 0
        ? receta.ingredientes
        : (receta.secciones?.[0]?.ingredientes || [])
      const ozBaseReceta = recetaIngredientes.reduce((acc, i) => acc + Number(i.oz || 0), 0)
      const factor = ozBaseReceta > 0 ? totalOz / ozBaseReceta : 0

      const seccionesCalculadas = [{
        nombre: receta.nombre,
        ingredientes: recetaIngredientes.map(i => {
          const ozTotal = Number(i.oz) * factor
          return { nombre: i.nombre, oz: ozTotal.toFixed(2), lb: (ozTotal / 16).toFixed(3) }
        })
      }]

      setResultado({
        vacio: false, receta,
        totalFactor: totalOz.toFixed(2),
        masaBaseOz: ozBaseReceta.toFixed(2),
        factor: factor.toFixed(4),
        usaPeso: true, turnoFiltro,
        seccionesCalculadas, detalle,
        esBaseCompartida: true
      })
      return
    }

    let totalFactor = 0
    const detalle = {}

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

    const secciones = normalizarSecciones(receta)
    const usaPeso = Object.keys(detalle).some(k => esUnidadPeso(k))
    const masaBaseOz = secciones[0]?.ingredientes?.reduce((acc, i) => acc + Number(i.oz || 0), 0) || 0
    const factor = usaPeso ? totalFactor / masaBaseOz : totalFactor

    const seccionesCalculadas = secciones.map(sec => ({
      nombre: sec.nombre,
      ingredientes: sec.ingredientes.map(i => {
        const ozTotal = Number(i.oz) * factor
        return { nombre: i.nombre, oz: ozTotal.toFixed(2), lb: (ozTotal / 16).toFixed(3) }
      })
    }))

    setResultado({
      vacio: false, receta,
      totalFactor: totalFactor.toFixed(2),
      masaBaseOz: masaBaseOz.toFixed(2),
      factor: factor.toFixed(4),
      usaPeso, turnoFiltro,
      seccionesCalculadas, detalle
    })
  }

  const confirmarProduccion = async () => {
    if (!resultado || resultado.vacio) return
    setConfirmando(true)
    setMsgConfirm('')
    try {
      const actualizados = []
      const noEncontrados = []
      const todosLosIngredientes = resultado.seccionesCalculadas.flatMap(sec => sec.ingredientes)
      for (const ing of todosLosIngredientes) {
        const materia = inventario.find(m => m.nombre.toLowerCase().trim() === ing.nombre.toLowerCase().trim())
        if (!materia) { noEncontrados.push(ing.nombre); continue }
        const ozUsadas = parseFloat(ing.oz)
        let descuento = 0
        if (materia.unidad === 'oz') {
          descuento = ozUsadas
        } else if (materia.unidad === 'lb') {
          descuento = ozUsadas / 16
        } else {
          noEncontrados.push(ing.nombre); continue
        }
        const nuevoStock = Math.max(0, (materia.stockActual || 0) - descuento)
        await updateDoc(doc(db, 'inventario', materia.id), { stockActual: parseFloat(nuevoStock.toFixed(3)) })
        actualizados.push(ing.nombre)
      }
      let msgFinal = `✅ Producción confirmada. ${actualizados.length} ingrediente${actualizados.length !== 1 ? 's' : ''} descontado${actualizados.length !== 1 ? 's' : ''} del inventario.`
      if (noEncontrados.length > 0) msgFinal += ` Sin match en inventario: ${noEncontrados.join(', ')}.`
      setMsgConfirm(msgFinal)
    } catch (e) {
      setMsgConfirm('⚠️ Error al confirmar producción.')
      console.error(e)
    }
    setConfirmando(false)
  }

  const guardarReceta = async () => {
    if (!formNombre.trim() || !formGrupoId) { setMsg('⚠️ Completá nombre y grupo'); return }
    if (!formEsBaseCompartida && !formSubgrupo.trim()) { setMsg('⚠️ Completá el subgrupo'); return }

    let datos = { nombre: formNombre.trim(), grupoId: formGrupoId, subgrupo: formSubgrupo.trim(), esBaseCompartida: formEsBaseCompartida }

    if (formEsBaseCompartida) {
      const ingValidos = formIngredientes.filter(i => i.nombre.trim() && i.oz)
      if (ingValidos.length === 0) { setMsg('⚠️ Agregá al menos un ingrediente de la masa'); return }
      datos.ingredientes = ingValidos.map(i => ({ nombre: i.nombre.trim(), oz: parseFloat(i.oz) }))
      datos.secciones = []
    } else if (formUsaSecciones) {
      const seccionesValidas = formSecciones
        .map(sec => ({ nombre: sec.nombre.trim(), ingredientes: sec.ingredientes.filter(i => i.nombre.trim() && i.oz) }))
        .filter(sec => sec.nombre && sec.ingredientes.length > 0)
      if (seccionesValidas.length === 0) { setMsg('⚠️ Agregá al menos una sección con ingredientes'); return }
      datos.secciones = seccionesValidas.map(sec => ({
        nombre: sec.nombre,
        ingredientes: sec.ingredientes.map(i => ({ nombre: i.nombre.trim(), oz: parseFloat(i.oz) }))
      }))
      datos.ingredientes = []
    } else {
      const ingValidos = formIngredientes.filter(i => i.nombre.trim() && i.oz)
      if (ingValidos.length === 0) { setMsg('⚠️ Agregá al menos un ingrediente'); return }
      datos.ingredientes = ingValidos.map(i => ({ nombre: i.nombre.trim(), oz: parseFloat(i.oz) }))
      datos.secciones = []
    }

    setGuardando(true)
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
    setFormSecciones([seccionVacia('Masa'), seccionVacia('Relleno')])
    setFormUsaSecciones(false)
    setFormEsBaseCompartida(false)
    setEditandoId(null); setMostrarForm(false); setMostrarSugIng({})
  }

  const iniciarEdicion = (r) => {
    setFormNombre(r.nombre)
    setFormGrupoId(r.grupoId)
    setFormSubgrupo(r.subgrupo || '')
    setFormEsBaseCompartida(!!r.esBaseCompartida)
    const tieneSecciones = r.secciones && r.secciones.length > 0
    setFormUsaSecciones(tieneSecciones)
    if (tieneSecciones) {
      setFormSecciones(r.secciones.map(sec => ({
        nombre: sec.nombre,
        ingredientes: sec.ingredientes.map(i => ({ nombre: i.nombre, oz: i.oz.toString() }))
      })))
    } else {
      setFormIngredientes((r.ingredientes || []).map(i => ({ nombre: i.nombre, oz: i.oz.toString() })))
    }
    setEditandoId(r.id)
    setMostrarForm(true)
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

  const agregarSeccion = () => setFormSecciones([...formSecciones, seccionVacia()])
  const quitarSeccion = (si) => setFormSecciones(formSecciones.filter((_, i) => i !== si))
  const actualizarNombreSeccion = (si, valor) => {
    const nuevas = [...formSecciones]
    nuevas[si] = { ...nuevas[si], nombre: valor }
    setFormSecciones(nuevas)
  }
  const agregarIngSeccion = (si) => {
    const nuevas = [...formSecciones]
    nuevas[si] = { ...nuevas[si], ingredientes: [...nuevas[si].ingredientes, { nombre: '', oz: '' }] }
    setFormSecciones(nuevas)
  }
  const quitarIngSeccion = (si, ii) => {
    const nuevas = [...formSecciones]
    nuevas[si] = { ...nuevas[si], ingredientes: nuevas[si].ingredientes.filter((_, i) => i !== ii) }
    setFormSecciones(nuevas)
  }
  const actualizarIngSeccion = (si, ii, campo, valor) => {
    const nuevas = [...formSecciones]
    const ings = [...nuevas[si].ingredientes]
    ings[ii] = { ...ings[ii], [campo]: valor }
    nuevas[si] = { ...nuevas[si], ingredientes: ings }
    setFormSecciones(nuevas)
  }

  const sugerenciasSimple = (idx) => {
    const texto = formIngredientes[idx]?.nombre || ''
    if (!texto.trim()) return []
    return inventario.map(m => m.nombre).filter(n => n.toLowerCase().includes(texto.toLowerCase())).sort()
  }
  const sugerenciasSeccion = (si, ii) => {
    const texto = formSecciones[si]?.ingredientes[ii]?.nombre || ''
    if (!texto.trim()) return []
    return inventario.map(m => m.nombre).filter(n => n.toLowerCase().includes(texto.toLowerCase())).sort()
  }

  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'14px' }

  const subTabs = [
    { key:'calcular', label:'🧮 Calcular' },
    ...(isAdmin ? [{ key:'gestionar', label:'⚙️ Gestionar' }] : [])
  ]

  const renderIngredienteRow = (ing, idx, onChange, onQuitar, sugs, mostrar, onFocus, onBlur, onSelectSug) => (
    <div key={idx} style={{ marginBottom:'8px' }}>
      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
        <div style={{ position:'relative', flex:2 }}>
          <input placeholder="Ingrediente" value={ing.nombre}
            onChange={e => onChange(idx, 'nombre', e.target.value)}
            onFocus={() => onFocus(idx)}
            onBlur={() => setTimeout(() => onBlur(idx), 150)}
            autoCorrect="off" autoCapitalize="off" spellCheck="false"
            style={{ ...inputStyle, marginBottom:0 }} />
          {mostrar && sugs.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:`1px solid ${G.borde}`, borderRadius:'8px', zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.12)', maxHeight:'160px', overflowY:'auto' }}>
              {sugs.map(s => (
                <div key={s} onClick={() => onSelectSug(idx, s)}
                  style={{ padding:'9px 14px', cursor:'pointer', borderBottom:`1px solid ${G.borde}`, fontSize:'14px', color: G.texto }}
                  onMouseEnter={e => e.currentTarget.style.background = G.cafeClaro}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
        <input type="number" placeholder="Oz" value={ing.oz}
          onChange={e => onChange(idx, 'oz', e.target.value)} min="0" step="0.01"
          style={{ ...inputStyle, flex:1, marginBottom:0 }} />
        <button onClick={() => onQuitar(idx)}
          style={{ padding:'10px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', flexShrink:0 }}>✕</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>

      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex' }}>
          {subTabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setResultado(null); setMsgConfirm(''); setTurnoConfirmado(false) }}
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
            <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Turno a producir</p>
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              {[{ val:'manana', label:'🌅 Mañana' }, { val:'tarde', label:'🌇 Tarde' }].map(op => (
                <button key={op.val} onClick={() => cambiarTurno(op.val)}
                  style={{ flex:1, padding:'10px 8px', borderRadius:'8px',
                    border:`2px solid ${turnoFiltro === op.val ? G.cafe : G.borde}`,
                    background: turnoFiltro === op.val ? G.cafe : 'white',
                    color: turnoFiltro === op.val ? 'white' : G.texto,
                    cursor:'pointer', fontSize:'13px', fontWeight: turnoFiltro === op.val ? 'bold' : 'normal' }}>
                  {op.label}
                </button>
              ))}
            </div>

            {/* Cuadro de confirmación de turno */}
            {!turnoConfirmado && (
              <div style={{ background: turnoFiltro === 'manana' ? '#eff6ff' : '#fdf3e7', border:`2px solid ${turnoFiltro === 'manana' ? '#3b82f6' : G.cafe}`, borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
                <p style={{ margin:'0 0 4px', fontWeight:'bold', fontSize:'15px', color: turnoFiltro === 'manana' ? '#1d4ed8' : G.cafe }}>
                  {turnoFiltro === 'manana' ? '🌅 Producción para turno Mañana' : '🌇 Producción para turno Tarde'}
                </p>
                <p style={{ margin:'0 0 14px', fontSize:'13px', color: G.gris }}>
                  {HORARIOS_TURNO[turnoFiltro]}
                </p>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => cambiarTurno(turnoFiltro === 'manana' ? 'tarde' : 'manana')}
                    style={{ flex:1, padding:'10px', background:'white', color: G.gris, border:`1px solid ${G.borde}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                    Cambiar turno
                  </button>
                  <button onClick={confirmarTurno}
                    style={{ flex:2, padding:'10px', background: turnoFiltro === 'manana' ? '#1d4ed8' : G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }}>
                    ✅ Confirmar — voy a producir para {turnoFiltro === 'manana' ? 'Mañana' : 'Tarde'}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmado — mostrar badge del turno activo */}
            {turnoConfirmado && (
              <div style={{ display:'flex', alignItems:'center', gap:'10px', background: turnoFiltro === 'manana' ? '#eff6ff' : '#fdf3e7', border:`1px solid ${turnoFiltro === 'manana' ? '#93c5fd' : '#f0d9b5'}`, borderRadius:'10px', padding:'10px 14px', marginBottom:'20px' }}>
                <span style={{ fontSize:'18px' }}>{turnoFiltro === 'manana' ? '🌅' : '🌇'}</span>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontWeight:'bold', fontSize:'13px', color: turnoFiltro === 'manana' ? '#1d4ed8' : G.cafe }}>
                    Produciendo para turno {turnoFiltro === 'manana' ? 'Mañana' : 'Tarde'}
                  </p>
                  <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{HORARIOS_TURNO[turnoFiltro]}</p>
                </div>
                <button onClick={() => { setTurnoConfirmado(false); setResultado(null); setRecetaSeleccionada(null) }}
                  style={{ padding:'6px 10px', background:'white', color: G.gris, border:`1px solid ${G.borde}`, borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                  Cambiar
                </button>
              </div>
            )}

            {/* Selector de receta — solo si turno confirmado */}
            {turnoConfirmado && (
              <>
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
                    <p style={{ color: G.gris, fontSize:'14px' }}>
                      No hay pedidos de turno <strong>{turnoFiltro === 'manana' ? 'Mañana' : 'Tarde'}</strong> para {resultado.receta.esBaseCompartida ? 'los productos que vinculan' : 'el subgrupo de'} <strong>{resultado.receta.nombre}</strong>.
                    </p>
                  </div>
                )}

                {resultado && !resultado.vacio && (
                  <>
                    <div style={{ background: G.cafe, color:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'16px' }}>
                      <p style={{ margin:0, fontWeight:'bold', fontSize:'16px' }}>{resultado.receta.nombre}</p>
                      <p style={{ margin:'4px 0 0', fontSize:'13px', opacity:0.85 }}>
                        Turno: {resultado.turnoFiltro === 'manana' ? '🌅 Mañana' : '🌇 Tarde'}{resultado.esBaseCompartida ? ' · Receta compartida' : ` · Subgrupo: ${resultado.receta.subgrupo}`}
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

                    {resultado.seccionesCalculadas.map((sec, si) => (
                      <div key={si} style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderTop: resultado.seccionesCalculadas.length > 1 ? `3px solid ${si === 0 ? G.cafe : G.verde}` : 'none' }}>
                        {resultado.seccionesCalculadas.length > 1 && (
                          <p style={{ fontSize:'13px', fontWeight:'bold', color: si === 0 ? G.cafe : G.verde, marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            {si === 0 ? '🍞' : '🥜'} {sec.nombre}
                          </p>
                        )}
                        {resultado.seccionesCalculadas.length === 1 && (
                          <p style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Ingredientes</p>
                        )}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0 12px', alignItems:'center' }}>
                          <span style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, paddingBottom:'6px' }}>Ingrediente</span>
                          <span style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, paddingBottom:'6px', textAlign:'right' }}>Oz</span>
                          <span style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, paddingBottom:'6px', textAlign:'right' }}>Lb</span>
                          {sec.ingredientes.map((ing, idx) => (
                            <>
                              <span key={`n${idx}`} style={{ fontSize:'14px', color: G.texto, padding:'6px 0', borderTop:`1px solid ${G.borde}` }}>{ing.nombre}</span>
                              <span key={`o${idx}`} style={{ fontSize:'14px', fontWeight:'bold', color: G.cafe, padding:'6px 0', borderTop:`1px solid ${G.borde}`, textAlign:'right' }}>{ing.oz}</span>
                              <span key={`l${idx}`} style={{ fontSize:'14px', fontWeight:'bold', color: G.texto, padding:'6px 0', borderTop:`1px solid ${G.borde}`, textAlign:'right' }}>{ing.lb}</span>
                            </>
                          ))}
                        </div>
                      </div>
                    ))}

                    {msgConfirm ? (
                      <div style={{ background: msgConfirm.includes('⚠️') ? '#fee2e2' : '#dcfce7', padding:'14px 16px', borderRadius:'10px', fontSize:'13px', color: msgConfirm.includes('⚠️') ? G.rojo : G.verde }}>
                        {msgConfirm}
                      </div>
                    ) : (
                      <button onClick={confirmarProduccion} disabled={confirmando}
                        style={{ width:'100%', padding:'14px', background: G.verde, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px' }}>
                        {confirmando ? 'Confirmando...' : '✅ Confirmar producción'}
                      </button>
                    )}
                  </>
                )}
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
                <input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Semita de Piña"
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

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'#fdf3e7', borderRadius:'10px', marginBottom:'16px', cursor:'pointer', border:'1px solid #f0d9b5' }}
                  onClick={() => { setFormEsBaseCompartida(!formEsBaseCompartida); setFormUsaSecciones(false) }}>
                  <div>
                    <p style={{ margin:0, fontSize:'14px', fontWeight:'bold', color: G.cafe }}>🍞 Es receta compartida por varios productos</p>
                    <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>Ej: Masa Chibola (Novias, Torta Seca) o Velo de Novia</p>
                  </div>
                  <div style={{ width:'44px', height:'24px', borderRadius:'12px', background: formEsBaseCompartida ? G.cafe : G.borde, position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', left: formEsBaseCompartida ? '22px' : '2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>

                {formEsBaseCompartida && (
                  <div style={{ background:'#fdf3e7', border:'1px solid #f0d9b5', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px', fontSize:'13px', color: G.cafe }}>
                    💡 Después de guardar, andá a <strong>Catálogo</strong> y vinculá cada producto que la use, indicando cuántas oz de esta receta le corresponden a 1 unidad.
                  </div>
                )}

                {!formEsBaseCompartida && (
                  <>
                    <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Subgrupo vinculado</p>
                    <select value={formSubgrupo} onChange={e => setFormSubgrupo(e.target.value)}
                      style={{ ...inputStyle, marginBottom:'16px' }}>
                      <option value=''>Seleccioná un subgrupo...</option>
                      {subgrupos.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background: G.cafeClaro, borderRadius:'10px', marginBottom:'16px', cursor:'pointer' }}
                      onClick={() => setFormUsaSecciones(!formUsaSecciones)}>
                      <div>
                        <p style={{ margin:0, fontSize:'14px', fontWeight:'bold', color: G.cafe }}>Receta con secciones</p>
                        <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>Ej: Masa + Relleno por separado</p>
                      </div>
                      <div style={{ width:'44px', height:'24px', borderRadius:'12px', background: formUsaSecciones ? G.cafe : G.borde, position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                        <div style={{ position:'absolute', top:'2px', left: formUsaSecciones ? '22px' : '2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  </>
                )}

                {!formUsaSecciones && (
                  <>
                    <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Ingredientes (en onzas)</p>
                    {formIngredientes.map((ing, idx) => {
                      const sugs = sugerenciasSimple(idx)
                      const mostrar = mostrarSugIng[`s-${idx}`] && sugs.length > 0
                      return renderIngredienteRow(
                        ing, idx,
                        actualizarIngrediente, quitarIngrediente,
                        sugs, mostrar,
                        (i) => setMostrarSugIng(prev => ({ ...prev, [`s-${i}`]: true })),
                        (i) => setMostrarSugIng(prev => ({ ...prev, [`s-${i}`]: false })),
                        (i, s) => { actualizarIngrediente(i, 'nombre', s); setMostrarSugIng(prev => ({ ...prev, [`s-${i}`]: false })) }
                      )
                    })}
                    <button onClick={agregarIngrediente}
                      style={{ width:'100%', padding:'9px', background: G.cafeClaro, color: G.cafe, border:`1px dashed ${G.cafe}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px', marginBottom:'16px' }}>
                      ➕ Agregar ingrediente
                    </button>
                  </>
                )}

                {formUsaSecciones && (
                  <>
                    {formSecciones.map((sec, si) => (
                      <div key={si} style={{ border:`1px solid ${G.borde}`, borderRadius:'10px', padding:'14px', marginBottom:'12px', background:'#fafaf9' }}>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px' }}>
                          <input placeholder={`Nombre de sección (ej: Masa)`} value={sec.nombre}
                            onChange={e => actualizarNombreSeccion(si, e.target.value)}
                            style={{ ...inputStyle, marginBottom:0, fontWeight:'bold', fontSize:'15px' }} />
                          {formSecciones.length > 1 && (
                            <button onClick={() => quitarSeccion(si)}
                              style={{ padding:'10px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', flexShrink:0 }}>✕</button>
                          )}
                        </div>
                        <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Ingredientes (en onzas)</p>
                        {sec.ingredientes.map((ing, ii) => {
                          const key = `sec-${si}-${ii}`
                          const sugs = sugerenciasSeccion(si, ii)
                          const mostrar = mostrarSugIng[key] && sugs.length > 0
                          return (
                            <div key={ii} style={{ marginBottom:'8px' }}>
                              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                                <div style={{ position:'relative', flex:2 }}>
                                  <input placeholder="Ingrediente" value={ing.nombre}
                                    onChange={e => { actualizarIngSeccion(si, ii, 'nombre', e.target.value); setMostrarSugIng(prev => ({ ...prev, [key]: true })) }}
                                    onFocus={() => setMostrarSugIng(prev => ({ ...prev, [key]: true }))}
                                    onBlur={() => setTimeout(() => setMostrarSugIng(prev => ({ ...prev, [key]: false })), 150)}
                                    autoCorrect="off" autoCapitalize="off" spellCheck="false"
                                    style={{ ...inputStyle, marginBottom:0 }} />
                                  {mostrar && (
                                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:`1px solid ${G.borde}`, borderRadius:'8px', zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.12)', maxHeight:'160px', overflowY:'auto' }}>
                                      {sugs.map(s => (
                                        <div key={s} onClick={() => { actualizarIngSeccion(si, ii, 'nombre', s); setMostrarSugIng(prev => ({ ...prev, [key]: false })) }}
                                          style={{ padding:'9px 14px', cursor:'pointer', borderBottom:`1px solid ${G.borde}`, fontSize:'14px', color: G.texto }}
                                          onMouseEnter={e => e.currentTarget.style.background = G.cafeClaro}
                                          onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                          {s}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <input type="number" placeholder="Oz" value={ing.oz}
                                  onChange={e => actualizarIngSeccion(si, ii, 'oz', e.target.value)} min="0" step="0.01"
                                  style={{ ...inputStyle, flex:1, marginBottom:0 }} />
                                {sec.ingredientes.length > 1 && (
                                  <button onClick={() => quitarIngSeccion(si, ii)}
                                    style={{ padding:'10px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', flexShrink:0 }}>✕</button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        <button onClick={() => agregarIngSeccion(si)}
                          style={{ width:'100%', padding:'8px', background: G.cafeClaro, color: G.cafe, border:`1px dashed ${G.cafe}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                          ➕ Ingrediente
                        </button>
                      </div>
                    ))}
                    <button onClick={agregarSeccion}
                      style={{ width:'100%', padding:'9px', background:'white', color: G.cafe, border:`1px dashed ${G.cafe}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px', marginBottom:'16px' }}>
                      ➕ Agregar sección
                    </button>
                  </>
                )}

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

            {recetas.map(r => {
              const tieneSecciones = r.secciones && r.secciones.length > 0
              const totalIng = tieneSecciones
                ? r.secciones.reduce((acc, s) => acc + (s.ingredientes?.length || 0), 0)
                : (r.ingredientes?.length || 0)
              return (
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
                        <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>
                          {r.esBaseCompartida ? 'Receta compartida' : r.subgrupo} · {totalIng} ingrediente{totalIng !== 1 ? 's' : ''}
                          {tieneSecciones && <span style={{ marginLeft:'6px', background: G.cafeClaro, color: G.cafe, padding:'1px 6px', borderRadius:'4px', fontSize:'11px' }}>{r.secciones.length} secciones</span>}
                          {r.esBaseCompartida && <span style={{ marginLeft:'6px', background:'#fdf3e7', color: G.cafe, padding:'1px 6px', borderRadius:'4px', fontSize:'11px' }}>🍞 compartida</span>}
                        </p>
                      </div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => iniciarEdicion(r)} style={{ padding:'7px 12px', background: G.amarilloClaro, color: G.amarillo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✏️</button>
                        <button onClick={() => setConfirmEliminar(r.id)} style={{ padding:'7px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}