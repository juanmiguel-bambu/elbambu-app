import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, setDoc, collection, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore'

const VAPID_PUBLIC_KEY = 'BOAhRPgcEJBXM_KsBk9TfegDoZBNPCLD6wdLT8d004bgHMdv7vJQ-nNepGusUZzWheRmq-bzG2mc6su8bawV8FM'
const ADMINS = ['migueljmolina79@gmail.com']

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

async function registrarPush(uid) {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
    await setDoc(doc(db, 'pushSubscriptions', uid), {
      uid, subscription: JSON.parse(JSON.stringify(subscription)), updatedAt: new Date()
    })
  } catch (err) { console.error('Error push:', err) }
}

const G = {
  cafe: '#8B6B3E', cafeClaro: '#f5f0eb', texto: '#333',
  gris: '#888', verde: '#16a34a', rojo: '#dc2626', borde: '#e5e7eb',
  amarillo: '#854d0e', amarilloClaro: '#fef9c3'
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await signInWithEmailAndPassword(auth, email, password) }
    catch { setError('Usuario o contraseña incorrectos') }
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background: G.cafeClaro }}>
      <div style={{ width:'300px', background:'white', padding:'32px', borderRadius:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ fontSize:'40px' }}>🍞</div>
          <h2 style={{ color: G.cafe, margin:'8px 0 0' }}>El Bambú</h2>
        </div>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width:'100%', padding:'10px', marginBottom:'12px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width:'100%', padding:'10px', marginBottom:'12px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto }} />
          {error && <p style={{ color: G.rojo, fontSize:'13px', marginBottom:'8px' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function GestionGrupos({ onVolver }) {
  const [grupos, setGrupos] = useState([])
  const [nombre, setNombre] = useState('')
  const [horario, setHorario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grupos'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      setGrupos(lista)
    })
    return () => unsub()
  }, [])

  const guardar = async () => {
    if (!nombre.trim()) { setMsg('⚠️ Escribí el nombre del grupo'); return }
    setGuardando(true)
    if (editando) {
      await updateDoc(doc(db, 'grupos', editando.id), { nombre: nombre.trim(), horario: horario.trim() })
      setEditando(null); setMsg('Grupo actualizado ✅')
    } else {
      await setDoc(doc(db, 'grupos', Date.now().toString()), {
        nombre: nombre.trim(), horario: horario.trim(), orden: grupos.length, creadoEn: new Date()
      })
      setMsg('Grupo creado ✅')
    }
    setNombre(''); setHorario('')
    setTimeout(() => setMsg(''), 2500)
    setGuardando(false)
  }

  const iniciarEdicion = (g) => { setEditando(g); setNombre(g.nombre); setHorario(g.horario || ''); window.scrollTo(0,0) }
  const cancelar = () => { setEditando(null); setNombre(''); setHorario('') }
  const eliminar = async (g) => { await deleteDoc(doc(db, 'grupos', g.id)); setConfirmEliminar(null) }

  const inputStyle = { width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'15px' }

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto', padding:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <button onClick={onVolver} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color: G.cafe }}>←</button>
        <h3 style={{ margin:0, color: G.cafe }}>Gestión de grupos</h3>
      </div>
      <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop: editando ? `3px solid #854d0e` : `3px solid ${G.cafe}` }}>
        <p style={{ fontWeight:'bold', marginBottom:'14px', color: editando ? '#854d0e' : G.cafe }}>{editando ? `✏️ Editando: ${editando.nombre}` : '➕ Nuevo grupo'}</p>
        <input placeholder="Nombre del grupo" value={nombre} onChange={e => setNombre(e.target.value)} autoCorrect="off" autoCapitalize="off" spellCheck="false" style={inputStyle} />
        <input placeholder="Horario de corte (ej: 12:00 — opcional)" value={horario} onChange={e => setHorario(e.target.value)} autoCorrect="off" autoCapitalize="off" spellCheck="false" style={inputStyle} />
        <p style={{ fontSize:'12px', color: G.gris, marginBottom:'12px', marginTop:'-4px' }}>Hora límite para recibir pedidos de este grupo.</p>
        {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
        <div style={{ display:'flex', gap:'8px' }}>
          {editando && <button onClick={cancelar} style={{ flex:1, padding:'11px', background: G.borde, color: G.texto, border:'none', borderRadius:'8px', cursor:'pointer' }}>Cancelar</button>}
          <button onClick={guardar} disabled={guardando} style={{ flex:2, padding:'11px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold' }}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear grupo'}
          </button>
        </div>
      </div>
      <p style={{ fontWeight:'bold', color: G.gris, fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Grupos ({grupos.length})</p>
      {grupos.map(g => (
        <div key={g.id} style={{ background:'white', padding:'14px 16px', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          {confirmEliminar === g.id ? (
            <div>
              <p style={{ margin:'0 0 10px', fontSize:'14px', color: G.rojo }}>⚠️ ¿Seguro que querés eliminar "{g.nombre}"?</p>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => setConfirmEliminar(null)} style={{ flex:1, padding:'8px', background: G.borde, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
                <button onClick={() => eliminar(g)} style={{ flex:1, padding:'8px', background: G.rojo, color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>Sí, eliminar</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ margin:0, fontWeight:'bold', color: G.texto, fontSize:'15px' }} translate="no">{g.nombre}</p>
                {g.horario ? <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>⏰ Corte: {g.horario}</p> : <p style={{ margin:'2px 0 0', fontSize:'12px', color: G.gris }}>Sin horario de corte</p>}
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => iniciarEdicion(g)} style={{ padding:'7px 12px', background: G.amarilloClaro, color: G.amarillo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>✏️</button>
                <button onClick={() => setConfirmEliminar(g.id)} style={{ padding:'7px 12px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>🗑️</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Catalogo() {
  const [grupos, setGrupos] = useState([])
  const [productos, setProductos] = useState([])
  const [tabGrupo, setTabGrupo] = useState(null)
  const [nombre, setNombre] = useState('')
  const [medida, setMedida] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [subgrupo, setSubgrupo] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSug, setMostrarSug] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [verGestionGrupos, setVerGestionGrupos] = useState(false)
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
      lista.sort((a, b) => (a.subgrupo||'').localeCompare(b.subgrupo||'') || a.nombre.localeCompare(b.nombre))
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
    const datos = { nombre: nombre.trim(), medida: medida.trim(), grupoId, subgrupo: subgrupo.trim(), activo: true }
    if (editando) {
      await updateDoc(doc(db, 'productos', editando.id), datos)
      setEditando(null); setMsg('Producto actualizado ✅')
    } else {
      await setDoc(doc(db, 'productos', Date.now().toString()), { ...datos, creadoEn: new Date() })
      setMsg('Producto guardado ✅')
    }
    setNombre(''); setMedida(''); setSubgrupo('')
    setTimeout(() => { setMsg(''); setMostrarForm(false) }, 1500)
    setGuardando(false)
  }

  const iniciarEdicion = (p) => { setEditando(p); setNombre(p.nombre); setMedida(p.medida); setGrupoId(p.grupoId || ''); setSubgrupo(p.subgrupo || ''); setMostrarForm(true); setMenuProducto(null); window.scrollTo(0,0) }
  const cancelarEdicion = () => { setEditando(null); setNombre(''); setMedida(''); setSubgrupo(''); setGrupoId(tabGrupo || ''); setMostrarForm(false) }
  const toggleActivo = async (p) => { await updateDoc(doc(db, 'productos', p.id), { activo: !p.activo }); setMenuProducto(null) }
  const eliminarProducto = async (p) => { await deleteDoc(doc(db, 'productos', p.id)); setConfirmEliminarProducto(null); setMenuProducto(null) }

  const activos = productos.filter(p => p.activo && p.grupoId === tabGrupo)
  const inactivos = productos.filter(p => !p.activo && p.grupoId === tabGrupo)
  const subgruposActivos = [...new Set(activos.map(p => p.subgrupo || '—'))]

  const inputStyle = { width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'15px' }

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
            {!mostrarForm ? (
              <button onClick={() => { setGrupoId(tabGrupo || ''); setMostrarForm(true) }}
                style={{ width:'100%', padding:'12px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px', marginBottom:'20px' }}>
                ➕ Agregar producto
              </button>
            ) : (
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
                <input placeholder="Medida / peso (ej: 1 lb, 500g, unidad)" value={medida} onChange={e => setMedida(e.target.value)} autoCorrect="off" autoCapitalize="off" spellCheck="false" style={{ ...inputStyle, marginBottom:'14px' }} />
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

// ─── PEDIDOS ──────────────────────────────────────────────────
function Pedidos({ user }) {
  const [grupos, setGrupos] = useState([])
  const [productos, setProductos] = useState([])
  const [items, setItems] = useState([])
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null)
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [entrega, setEntrega] = useState('panaderia')
  const [pago, setPago] = useState('pagado')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [horaEntrega, setHoraEntrega] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)

  useEffect(() => {
    const hoy = new Date()
    const yyyy = hoy.getFullYear()
    const mm = String(hoy.getMonth() + 1).padStart(2, '0')
    const dd = String(hoy.getDate()).padStart(2, '0')
    setFechaEntrega(`${yyyy}-${mm}-${dd}`)
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
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(lista)
    })
    return () => unsub()
  }, [])

  const horarioCortePasado = (grupoId) => {
    const grupo = grupos.find(g => g.id === grupoId)
    if (!grupo || !grupo.horario) return false
    const [h, m] = grupo.horario.split(':').map(Number)
    const ahora = new Date()
    const corte = new Date()
    corte.setHours(h, m, 0, 0)
    return ahora > corte
  }

  const productosFiltrados = productos
    .filter(p => p.grupoId === grupoSeleccionado)
    .filter(p => busqueda === '' || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.subgrupo||'').toLowerCase().includes(busqueda.toLowerCase()))

  const agregarItem = () => {
    if (!productoSeleccionado || !cantidad || Number(cantidad) <= 0) return
    const prod = productos.find(p => p.id === productoSeleccionado)
    if (!prod) return
    const existente = items.findIndex(i => i.productoId === productoSeleccionado)
    if (existente >= 0) {
      const nuevos = [...items]
      nuevos[existente].cantidad = Number(nuevos[existente].cantidad) + Number(cantidad)
      setItems(nuevos)
    } else {
      setItems([...items, {
        productoId: prod.id,
        nombre: prod.nombre,
        medida: prod.medida,
        grupoId: prod.grupoId,
        cantidad: Number(cantidad)
      }])
    }
    setProductoSeleccionado(null)
    setCantidad('')
    setBusqueda('')
    setMostrarBuscador(false)
  }

  const quitarItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const enviarPedido = async () => {
    if (items.length === 0) { setMsg('⚠️ Agregá al menos un producto'); return }
    if (!fechaEntrega) { setMsg('⚠️ Indicá la fecha de entrega'); return }
    setEnviando(true)
    try {
      await addDoc(collection(db, 'pedidos'), {
        vendedor: user.email,
        vendedorNombre: user.email.split('@')[0],
        items,
        entrega,
        pago,
        fechaEntrega,
        horaEntrega,
        estado: 'pendiente',
        creadoEn: serverTimestamp()
      })
      setItems([])
      setFechaEntrega('')
      setHoraEntrega('')
      setEntrega('panaderia')
      setPago('pagado')
      setMsg('✅ Pedido enviado correctamente')
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      setMsg('⚠️ Error al enviar el pedido')
    }
    setEnviando(false)
  }

  const grupoActual = grupos.find(g => g.id === grupoSeleccionado)
  const cortePasado = grupoSeleccionado ? horarioCortePasado(grupoSeleccionado) : false

  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'15px' }

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto', padding:'16px', paddingBottom:'30px' }}>
      <h3 style={{ color: G.cafe, marginBottom:'16px' }}>📋 Nuevo pedido</h3>

      {/* Selector de grupo */}
      <div style={{ marginBottom:'16px' }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Grupo de productos</p>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {grupos.map(g => {
            const pasado = horarioCortePasado(g.id)
            return (
              <button key={g.id} translate="no" onClick={() => { setGrupoSeleccionado(g.id); setProductoSeleccionado(null); setBusqueda('') }}
                style={{ padding:'8px 14px', borderRadius:'8px', border:`2px solid ${grupoSeleccionado === g.id ? G.cafe : G.borde}`, background: grupoSeleccionado === g.id ? G.cafe : 'white', color: grupoSeleccionado === g.id ? 'white' : pasado ? G.gris : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: grupoSeleccionado === g.id ? 'bold' : 'normal', opacity: pasado ? 0.7 : 1 }}>
                {g.nombre} {pasado ? '⏰' : ''}
              </button>
            )
          })}
        </div>
        {cortePasado && grupoActual && (
          <p style={{ fontSize:'12px', color: G.rojo, marginTop:'8px' }}>
            ⚠️ El horario de corte para "{grupoActual.nombre}" ya pasó ({grupoActual.horario}). Solo admins pueden autorizar pedidos fuera de horario.
          </p>
        )}
      </div>

      {/* Buscador de productos */}
      <div style={{ marginBottom:'16px' }}>
        <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Agregar producto</p>
        <div style={{ position:'relative' }}>
          <input placeholder="Buscar producto..." value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setMostrarBuscador(true); setProductoSeleccionado(null) }}
            onFocus={() => setMostrarBuscador(true)}
            onBlur={() => setTimeout(() => setMostrarBuscador(false), 150)}
            autoCorrect="off" autoCapitalize="off" spellCheck="false"
            style={{ ...inputStyle, marginBottom:'0' }} />
          {mostrarBuscador && productosFiltrados.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:`1px solid ${G.borde}`, borderRadius:'8px', zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.12)', maxHeight:'200px', overflowY:'auto' }}>
              {productosFiltrados.map(p => (
                <div key={p.id}
                  onClick={() => { setProductoSeleccionado(p.id); setBusqueda(p.nombre); setMostrarBuscador(false) }}
                  style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${G.borde}`, background: productoSeleccionado === p.id ? G.cafeClaro : 'white' }}
                  onMouseEnter={e => e.currentTarget.style.background = G.cafeClaro}
                  onMouseLeave={e => e.currentTarget.style.background = productoSeleccionado === p.id ? G.cafeClaro : 'white'}>
                  <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{p.nombre}</p>
                  <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{p.medida} · {p.subgrupo}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {productoSeleccionado && (
          <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
            <input type="number" placeholder="Cantidad" value={cantidad} onChange={e => setCantidad(e.target.value)}
              min="1" style={{ ...inputStyle, flex:1 }} />
            <button onClick={agregarItem}
              style={{ padding:'10px 18px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'15px' }}>
              ➕
            </button>
          </div>
        )}
      </div>

      {/* Lista de items */}
      {items.length > 0 && (
        <div style={{ marginBottom:'20px' }}>
          <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Productos en el pedido ({items.length})</p>
          {items.map((item, idx) => (
            <div key={idx} style={{ background:'white', padding:'12px 14px', borderRadius:'10px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
              <div>
                <p style={{ margin:0, fontWeight:'bold', fontSize:'14px' }}>{item.nombre}</p>
                <p style={{ margin:0, fontSize:'12px', color: G.gris }}>{item.medida} · Cantidad: {item.cantidad}</p>
              </div>
              <button onClick={() => quitarItem(idx)}
                style={{ padding:'6px 10px', background:'#fee2e2', color: G.rojo, border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Detalles del pedido */}
      {items.length > 0 && (
        <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop:`3px solid ${G.cafe}` }}>
          <p style={{ fontWeight:'bold', color: G.cafe, marginBottom:'14px' }}>Detalles del pedido</p>

          {/* Fecha y hora */}
          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Fecha de entrega</p>
          <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
            style={{ ...inputStyle, marginBottom:'10px' }} />
          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'6px' }}>Hora de entrega (opcional)</p>
          <input type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)}
            style={{ ...inputStyle, marginBottom:'14px' }} />

          {/* Lugar de entrega */}
          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Lugar de entrega</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            {[{ val:'panaderia', label:'🏠 Recoger en panadería' }, { val:'ruta', label:'🚚 Entrega en ruta' }].map(op => (
              <button key={op.val} onClick={() => setEntrega(op.val)}
                style={{ flex:1, padding:'10px 8px', borderRadius:'8px', border:`2px solid ${entrega === op.val ? G.cafe : G.borde}`, background: entrega === op.val ? G.cafe : 'white', color: entrega === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: entrega === op.val ? 'bold' : 'normal' }}>
                {op.label}
              </button>
            ))}
          </div>

          {/* Pago */}
          <p style={{ fontSize:'12px', color: G.gris, marginBottom:'8px' }}>Estado de pago</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
            {[{ val:'pagado', label:'✅ Pagado' }, { val:'pendiente', label:'⏳ Pendiente' }].map(op => (
              <button key={op.val} onClick={() => setPago(op.val)}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:`2px solid ${pago === op.val ? G.cafe : G.borde}`, background: pago === op.val ? G.cafe : 'white', color: pago === op.val ? 'white' : G.texto, cursor:'pointer', fontSize:'13px', fontWeight: pago === op.val ? 'bold' : 'normal' }}>
                {op.label}
              </button>
            ))}
          </div>

          {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}

          <button onClick={enviarPedido} disabled={enviando}
            style={{ width:'100%', padding:'14px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'16px' }}>
            {enviando ? 'Enviando...' : '📤 Enviar pedido'}
          </button>
        </div>
      )}

      {items.length === 0 && (
        <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
          Buscá un producto para comenzar el pedido.
        </p>
      )}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('pedidos')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser)
      if (currentUser) registrarPush(currentUser.uid)
    })
    return () => unsub()
  }, [])

  if (!user) return <Login />

  const isAdmin = ADMINS.includes(user.email)

  const tabs = [
    { key:'pedidos', label:'📋 Pedidos' },
    ...(isAdmin ? [{ key:'catalogo', label:'📦 Catálogo' }] : []),
  ]

  return (
    <div style={{ minHeight:'100vh', background: G.cafeClaro, paddingBottom:'70px' }}>
      <div style={{ background: G.cafe, color:'white', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100 }}>
        <span style={{ fontWeight:'bold', fontSize:'18px' }}>🍞 El Bambú</span>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'13px', opacity:0.8 }}>{user.email.split('@')[0]}</span>
          <button onClick={() => signOut(auth)} style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>Salir</button>
        </div>
      </div>
      <div>
        {tab === 'pedidos' && <Pedidos user={user} />}
        {tab === 'catalogo' && isAdmin && <Catalogo />}
        {tab === 'catalogo' && !isAdmin && <p style={{ textAlign:'center', color: G.gris, marginTop:'40px' }}>Sin acceso.</p>}
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderTop:`1px solid ${G.borde}`, display:'flex' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex:1, padding:'12px 8px', border:'none', background: tab === t.key ? G.cafeClaro : 'white', color: tab === t.key ? G.cafe : G.gris, fontWeight: tab === t.key ? 'bold' : 'normal', cursor:'pointer', fontSize:'12px' }}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default App