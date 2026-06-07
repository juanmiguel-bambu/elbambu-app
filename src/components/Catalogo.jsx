import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, setDoc, collection, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { G } from './constants'
import GestionGrupos from './GestionGrupos'

export default function Catalogo() {
  const [grupos, setGrupos] = useState([])
  const [productos, setProductos] = useState([])
  const [tabGrupo, setTabGrupo] = useState(null)
  const [nombre, setNombre] = useState('')
  const [medida, setMedida] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [subgrupo, setSubgrupo] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [precioMayoreo, setPrecioMayoreo] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSug, setMostrarSug] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [verGestionGrupos, setVerGestionGrupos] = useState(false)
  const [verListaPrecios, setVerListaPrecios] = useState(false)
  const [menuProducto, setMenuProducto] = useState(null)
  const [confirmEliminarProducto, setConfirmEliminarProducto] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grupos'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      setGrupos(lista)
      if (lista.length > 0 && !tabGrupo) setTabGrupo(lista[0].id)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (a.subgrupo||'').localeCompare(b.subgrupo||'') || (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0))
      setProductos(lista)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const subs = [...new Set(productos.filter(p => p.grupoId === grupoId && p.subgrupo).map(p => p.subgrupo))]
    setSugerencias(subs)
  }, [grupoId, productos])

  const sugerenciasFiltradas = sugerencias.filter(s => subgrupo === '' || s.toLowerCase().includes(subgrupo.toLowerCase()))

  const guardar = async () => {
    if (!nombre.trim() || !medida.trim() || !grupoId) { setMsg('⚠️ Completá todos los campos'); return }
    setGuardando(true)
    const datos = {
      nombre: nombre.trim(), medida: medida.trim(), grupoId, subgrupo: subgrupo.trim(), activo: true,
      precioUnitario: precioUnitario ? parseFloat(precioUnitario) : 0,
      precioMayoreo: precioMayoreo ? parseFloat(precioMayoreo) : 0
    }
    if (editando) {
      await updateDoc(doc(db, 'productos', editando.id), datos)
      setEditando(null); setMsg('Producto actualizado ✅')
    } else {
      await setDoc(doc(db, 'productos', Date.now().toString()), { ...datos, creadoEn: new Date() })
      setMsg('Producto guardado ✅')
    }
    setNombre(''); setMedida(''); setSubgrupo(''); setPrecioUnitario(''); setPrecioMayoreo('')
    setTimeout(() => { setMsg(''); setMostrarForm(false) }, 1500)
    setGuardando(false)
  }

  const iniciarEdicion = (p) => {
    setEditando(p); setNombre(p.nombre); setMedida(p.medida); setGrupoId(p.grupoId || '')
    setSubgrupo(p.subgrupo || ''); setMostrarForm(true); setMenuProducto(null)
    setPrecioUnitario(p.precioUnitario ? p.precioUnitario.toString() : '')
    setPrecioMayoreo(p.precioMayoreo ? p.precioMayoreo.toString() : '')
    window.scrollTo(0,0)
  }
  const cancelarEdicion = () => {
    setEditando(null); setNombre(''); setMedida(''); setSubgrupo('')
    setGrupoId(tabGrupo || ''); setMostrarForm(false)
    setPrecioUnitario(''); setPrecioMayoreo('')
  }
  const toggleActivo = async (p) => { await updateDoc(doc(db, 'productos', p.id), { activo: !p.activo }); setMenuProducto(null) }
  const eliminarProducto = async (p) => { await deleteDoc(doc(db, 'productos', p.id)); setConfirmEliminarProducto(null); setMenuProducto(null) }

  const activos = productos.filter(p => p.activo && p.grupoId === tabGrupo)
  const inactivos = productos.filter(p => !p.activo && p.grupoId === tabGrupo)
  const subgruposActivos = [...new Set(activos.map(p => p.subgrupo || '—'))]

  const inputStyle = { width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'15px' }
  const formatPrecio = (p) => p ? `$${Number(p).toFixed(2)}` : null

  const compartirWhatsApp = () => {
    const fecha = new Date().toLocaleDateString('es-SV', { day:'2-digit', month:'2-digit', year:'numeric' })
    let texto = `🥖 *Lista de Precios El Bambú*\n📅 ${fecha}\n\n`
    grupos.forEach(g => {
      const productosGrupo = productos.filter(p => p.activo && p.grupoId === g.id && p.precioUnitario > 0)
      if (productosGrupo.length === 0) return
      texto += `*${g.nombre.toUpperCase()}*\n`
      const subs = [...new Set(productosGrupo.map(p => p.subgrupo || '—'))]
      subs.forEach(sg => {
        if (sg !== '—') texto += `\n_${sg}_\n`
        productosGrupo.filter(p => (p.subgrupo || '—') === sg).forEach(p => {
          texto += `• ${p.nombre} (${p.medida}) — $${Number(p.precioUnitario).toFixed(2)}\n`
        })
      })
      texto += '\n'
    })
    texto += '📍 Panadería El Bambú — Santa Tecla'
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const ProductoCard = ({ p }) => (
    <div style={{ background:'white', padding:'12px 14px', borderRadius:'10px', marginBottom:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
      {confirmEliminarProducto === p.id ? (
        <div>
          <p style={{ margin:'0 0 10px', fontSize:'14px', color: G.rojo }}>⚠️ ¿Seguro que querés eliminar "{p.nombre}"?</p>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setConfirmEliminarProducto(null)} style={{ flex:1, padding:'8px', background: G.borde, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
            <button onClick={() => eliminarProducto(p)} style={{ flex:1, padding:'8px', background: G.rojo, color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>Sí, eliminar</button>
          </div>
        </div>
      ) : menuProducto === p.id ? (
        <div>
          <p style={{ margin:'0 0 10px', fontSize:'14px', fontWeight:'bold', color: G.texto }}>{p.nombre}</p>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setMenuProducto(null)} style={{ flex:1, padding:'8px', background: G.borde, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
            <button onClick={() => toggleActivo(p)} style={{ flex:1, padding:'8px', background: G.amarilloClaro, color: G.amarillo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>Desactivar</button>
            <button onClick={() => { setConfirmEliminarProducto(p.id); setMenuProducto(null) }} style={{ flex:1, padding:'8px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>Eliminar</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ flex:1, marginRight:'10px' }}>
            <p style={{ margin:0, fontWeight:'bold', color: G.texto, fontSize:'15px' }}>{p.nombre}</p>
            <p style={{ margin:0, fontSize:'12px', color: G.gris, marginTop:'2px' }}>{p.medida}</p>
            <div style={{ display:'flex', gap:'8px', marginTop:'4px', flexWrap:'wrap' }}>
              {formatPrecio(p.precioUnitario) && (
                <span style={{ fontSize:'12px', color: G.cafe, fontWeight:'bold' }}>{formatPrecio(p.precioUnitario)} unit.</span>
              )}
              {formatPrecio(p.precioMayoreo) && (
                <span style={{ fontSize:'12px', color: G.gris }}>{formatPrecio(p.precioMayoreo)} may.</span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => iniciarEdicion(p)} style={{ padding:'7px 12px', background: G.amarilloClaro, color: G.amarillo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✏️</button>
            <button onClick={() => setMenuProducto(p.id)} style={{ padding:'7px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )

  if (verGestionGrupos) return <GestionGrupos onVolver={() => setVerGestionGrupos(false)} />

  if (verListaPrecios) return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>
      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
        <button onClick={() => setVerListaPrecios(false)}
          style={{ padding:'7px 12px', background: G.cafeClaro, color: G.cafe, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
          ← Volver
        </button>
        <span style={{ fontWeight:'bold', color: G.cafe, fontSize:'16px', flex:1 }}>📋 Lista de precios</span>
        <button onClick={compartirWhatsApp}
          style={{ padding:'8px 14px', background:'#25D366', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
          📲 WhatsApp
        </button>
      </div>

      <div style={{ padding:'16px' }}>
        <div style={{ background: G.cafe, color:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'20px', textAlign:'center' }}>
          <p style={{ margin:0, fontWeight:'bold', fontSize:'18px' }}>🥖 Panadería El Bambú</p>
          <p style={{ margin:'4px 0 0', fontSize:'13px', opacity:0.85 }}>Lista de precios · {new Date().toLocaleDateString('es-SV', { day:'2-digit', month:'long', year:'numeric' })}</p>
        </div>

        {grupos.map(g => {
          const productosGrupo = productos.filter(p => p.activo && p.grupoId === g.id && p.precioUnitario > 0)
          if (productosGrupo.length === 0) return null
          const subs = [...new Set(productosGrupo.map(p => p.subgrupo || '—'))]
          return (
            <div key={g.id} style={{ marginBottom:'24px' }}>
              <div style={{ background: G.cafeClaro, padding:'8px 14px', borderRadius:'8px', marginBottom:'12px', borderLeft:`4px solid ${G.cafe}` }}>
                <p style={{ margin:0, fontWeight:'bold', fontSize:'13px', color: G.cafe, textTransform:'uppercase', letterSpacing:'1px' }}>{g.nombre}</p>
              </div>
              {subs.map(sg => (
                <div key={sg} style={{ marginBottom:'12px' }}>
                  {sg !== '—' && (
                    <p style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px', paddingLeft:'2px' }}>{sg}</p>
                  )}
                  {productosGrupo.filter(p => (p.subgrupo || '—') === sg).map(p => (
                    <div key={p.id} style={{ background:'white', padding:'11px 14px', borderRadius:'8px', marginBottom:'6px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                      <div>
                        <p style={{ margin:0, fontWeight:'bold', fontSize:'14px', color: G.texto }}>{p.nombre}</p>
                        <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{p.medida}</p>
                      </div>
                      <span style={{ fontWeight:'bold', fontSize:'16px', color: G.cafe }}>${Number(p.precioUnitario).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })}

        {productos.filter(p => p.activo && p.precioUnitario > 0).length === 0 && (
          <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
            No hay productos con precio registrado aún.
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto' }}>
      <div style={{ background:'white', position:'sticky', top:'52px', zIndex:90, borderBottom:`1px solid ${G.borde}` }}>
        <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
          {grupos.map(g => (
            <button key={g.id} translate="no" onClick={() => setTabGrupo(g.id)}
              style={{ flexShrink:0, padding:'13px 16px', border:'none', background:'transparent', color: tabGrupo === g.id ? G.cafe : G.gris, fontWeight: tabGrupo === g.id ? 'bold' : 'normal', borderBottom: tabGrupo === g.id ? `3px solid ${G.cafe}` : '3px solid transparent', cursor:'pointer', fontSize:'14px', whiteSpace:'nowrap' }}>
              {g.nombre}
            </button>
          ))}
          <button onClick={() => setVerGestionGrupos(true)} style={{ flexShrink:0, padding:'13px 14px', border:'none', background:'transparent', color: G.gris, cursor:'pointer', fontSize:'18px', borderBottom:'3px solid transparent' }}>⚙️</button>
        </div>
      </div>
      <div style={{ padding:'16px' }}>
        {grupos.length === 0 ? (
          <div style={{ textAlign:'center', marginTop:'60px' }}>
            <p style={{ color: G.gris, marginBottom:'16px' }}>No hay grupos creados aún.</p>
            <button onClick={() => setVerGestionGrupos(true)} style={{ padding:'12px 24px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold' }}>Crear primer grupo</button>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
              <button onClick={() => { setGrupoId(tabGrupo || ''); setMostrarForm(true) }}
                style={{ flex:1, padding:'12px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px' }}>
                ➕ Agregar producto
              </button>
              <button onClick={() => setVerListaPrecios(true)}
                style={{ padding:'12px 14px', background: G.cafeClaro, color: G.cafe, border:`1px solid ${G.cafe}`, borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }}>
                📋 Precios
              </button>
            </div>

            {mostrarForm && (
              <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop: editando ? `3px solid #854d0e` : `3px solid ${G.cafe}` }}>
                <p style={{ fontWeight:'bold', marginBottom:'14px', color: editando ? '#854d0e' : G.cafe, fontSize:'15px' }}>{editando ? `✏️ Editando: ${editando.nombre}` : '➕ Nuevo producto'}</p>
                <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
                  {grupos.map(g => (
                    <button key={g.id} type="button" translate="no" onClick={() => { setGrupoId(g.id); setSubgrupo('') }}
                      style={{ padding:'7px 12px', borderRadius:'8px', border:`2px solid ${grupoId === g.id ? G.cafe : G.borde}`, background: grupoId === g.id ? G.cafe : 'white', color: grupoId === g.id ? 'white' : G.gris, cursor:'pointer', fontSize:'13px', fontWeight: grupoId === g.id ? 'bold' : 'normal' }}>
                      {g.nombre}
                    </button>
                  ))}
                </div>
                <div style={{ position:'relative', marginBottom:'10px' }}>
                  <input placeholder="Subgrupo (opcional)" value={subgrupo} onChange={e => { setSubgrupo(e.target.value); setMostrarSug(true) }} onFocus={() => setMostrarSug(true)} onBlur={() => setTimeout(() => setMostrarSug(false), 150)} autoCorrect="off" autoCapitalize="off" spellCheck="false" style={inputStyle} />
                  {mostrarSug && sugerenciasFiltradas.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:`1px solid ${G.borde}`, borderRadius:'8px', zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.12)' }}>
                      {sugerenciasFiltradas.map(s => (
                        <div key={s} onClick={() => { setSubgrupo(s); setMostrarSug(false) }} style={{ padding:'11px 14px', cursor:'pointer', fontSize:'14px', borderBottom:`1px solid ${G.borde}` }} onMouseEnter={e => e.currentTarget.style.background = G.cafeClaro} onMouseLeave={e => e.currentTarget.style.background = 'white'}>{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                <input placeholder="Nombre del producto" value={nombre} onChange={e => setNombre(e.target.value)} autoCorrect="off" autoCapitalize="off" spellCheck="false" style={inputStyle} />
                <input placeholder="Medida / peso" value={medida} onChange={e => setMedida(e.target.value)} autoCorrect="off" autoCapitalize="off" spellCheck="false" style={inputStyle} />
                <div style={{ display:'flex', gap:'8px' }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'12px', color: G.gris, margin:'0 0 4px' }}>Precio unitario ($)</p>
                    <input type="number" placeholder="0.00" value={precioUnitario} onChange={e => setPrecioUnitario(e.target.value)} min="0" step="0.01"
                      style={{ ...inputStyle, marginBottom:'14px' }} />
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'12px', color: G.gris, margin:'0 0 4px' }}>Precio mayoreo ($)</p>
                    <input type="number" placeholder="0.00" value={precioMayoreo} onChange={e => setPrecioMayoreo(e.target.value)} min="0" step="0.01"
                      style={{ ...inputStyle, marginBottom:'14px' }} />
                  </div>
                </div>
                {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={cancelarEdicion} style={{ flex:1, padding:'11px', background: G.borde, color: G.texto, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>Cancelar</button>
                  <button onClick={guardar} disabled={guardando} style={{ flex:2, padding:'11px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}</button>
                </div>
              </div>
            )}

            {subgruposActivos.map((sg, idx) => (
              <div key={sg} style={{ marginBottom:'20px' }}>
                <p style={{ fontSize:'11px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px', paddingLeft:'2px' }}>{sg}</p>
                {activos.filter(p => (p.subgrupo || '—') === sg).map(p => <ProductoCard key={p.id} p={p} />)}
                {idx < subgruposActivos.length - 1 && <div style={{ height:'1px', background: G.borde, margin:'4px 0 20px' }} />}
              </div>
            ))}
            {activos.length === 0 && !mostrarForm && <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>No hay productos en este grupo aún.</p>}
            {inactivos.length > 0 && (
              <div style={{ marginTop:'24px', opacity:0.65 }}>
                <p style={{ fontWeight:'bold', color: G.gris, marginBottom:'10px', fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>INACTIVOS ({inactivos.length})</p>
                {inactivos.map(p => (
                  <div key={p.id} style={{ background:'#f9f9f9', padding:'11px 14px', borderRadius:'10px', marginBottom:'7px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{p.nombre}</p>
                      <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{p.medida} · {p.subgrupo}</p>
                    </div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => toggleActivo(p)} style={{ padding:'6px 12px', background:'#dcfce7', color: G.verde, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'12px' }}>Activar</button>
                      <button onClick={() => setConfirmEliminarProducto(p.id)} style={{ padding:'6px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'12px' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}