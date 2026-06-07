import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, setDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore'
import { G } from './constants'

const ROLES = ['admin', 'vendedor', 'produccion']
const CATEGORIAS_VENDEDOR = [
  { val: 'rutero', label: '🚚 Rutero' },
  { val: 'punto_fijo', label: '🏪 Punto fijo' },
  { val: 'en_linea', label: '💻 En línea' },
]

const rolLabel = (rol) => {
  if (rol === 'admin') return { label: '🔑 Admin', bg: '#fef9c3', color: '#854d0e' }
  if (rol === 'vendedor') return { label: '🛒 Vendedor', bg: '#dbeafe', color: '#1d4ed8' }
  if (rol === 'produccion') return { label: '🍞 Producción', bg: '#dcfce7', color: '#16a34a' }
  return { label: rol, bg: '#f3f4f6', color: '#888' }
}

const categoriaLabel = (cat) => {
  if (cat === 'rutero') return '🚚 Rutero'
  if (cat === 'punto_fijo') return '🏪 Punto fijo'
  if (cat === 'en_linea') return '💻 En línea'
  return ''
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('vendedor')
  const [categoriaVendedor, setCategoriaVendedor] = useState('rutero')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmDesactivar, setConfirmDesactivar] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => a.nombre?.localeCompare(b.nombre || '') || 0)
      setUsuarios(lista)
    })
    return () => unsub()
  }, [])

  const guardar = async () => {
    if (!nombre.trim() || !email.trim()) { setMsg('⚠️ Completá nombre y email'); return }
    setGuardando(true)
    const datos = {
      nombre: nombre.trim(),
      rol,
      activo: true,
      ...(rol === 'vendedor' ? { categoriaVendedor } : { categoriaVendedor: null })
    }
    if (editando) {
      await updateDoc(doc(db, 'usuarios', editando.id), datos)
      setEditando(null); setMsg('Usuario actualizado ✅')
    } else {
      const id = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
      await setDoc(doc(db, 'usuarios', id), {
        ...datos,
        email: email.trim().toLowerCase(),
        creadoEn: new Date()
      })
      setMsg('Usuario agregado ✅')
    }
    setNombre(''); setEmail(''); setRol('vendedor'); setCategoriaVendedor('rutero')
    setTimeout(() => { setMsg(''); setMostrarForm(false) }, 2000)
    setGuardando(false)
  }

  const iniciarEdicion = (u) => {
    setEditando(u); setNombre(u.nombre); setEmail(u.email); setRol(u.rol)
    setCategoriaVendedor(u.categoriaVendedor || 'rutero')
    setMostrarForm(true); window.scrollTo(0, 0)
  }

  const cancelar = () => {
    setEditando(null); setNombre(''); setEmail(''); setRol('vendedor')
    setCategoriaVendedor('rutero'); setMostrarForm(false)
  }

  const toggleActivo = async (u) => {
    await updateDoc(doc(db, 'usuarios', u.id), { activo: !u.activo })
    setConfirmDesactivar(null)
  }

  const activos = usuarios.filter(u => u.activo)
  const inactivos = usuarios.filter(u => !u.activo)

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px',
    border: `1px solid ${G.borde}`, boxSizing: 'border-box',
    background: 'white', color: G.texto, fontSize: '15px'
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '16px' }}>
      <h3 style={{ color: G.cafe, marginBottom: '16px' }}>👥 Usuarios</h3>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)}
          style={{ width: '100%', padding: '12px', background: G.cafe, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginBottom: '20px' }}>
          ➕ Agregar usuario
        </button>
      ) : (
        <div style={{ background: 'white', padding: '16px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', borderTop: editando ? `3px solid #854d0e` : `3px solid ${G.cafe}` }}>
          <p style={{ fontWeight: 'bold', marginBottom: '14px', color: editando ? '#854d0e' : G.cafe }}>
            {editando ? `✏️ Editando: ${editando.nombre}` : '➕ Nuevo usuario'}
          </p>

          <input placeholder="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)}
            autoCorrect="off" autoCapitalize="off" spellCheck="false" style={inputStyle} />

          <input placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)}
            autoCorrect="off" autoCapitalize="off" spellCheck="false"
            disabled={!!editando}
            style={{ ...inputStyle, opacity: editando ? 0.6 : 1 }} />

          {editando && (
            <p style={{ fontSize: '12px', color: G.gris, marginTop: '-6px', marginBottom: '10px' }}>
              El email no se puede cambiar.
            </p>
          )}

          <p style={{ fontSize: '12px', color: G.gris, marginBottom: '8px' }}>Rol</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {ROLES.map(r => {
              const { label } = rolLabel(r)
              return (
                <button key={r} onClick={() => setRol(r)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: `2px solid ${rol === r ? G.cafe : G.borde}`, background: rol === r ? G.cafe : 'white', color: rol === r ? 'white' : G.gris, cursor: 'pointer', fontSize: '13px', fontWeight: rol === r ? 'bold' : 'normal' }}>
                  {label}
                </button>
              )
            })}
          </div>

          {rol === 'vendedor' && (
            <>
              <p style={{ fontSize: '12px', color: G.gris, marginBottom: '8px' }}>Categoría de vendedor</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {CATEGORIAS_VENDEDOR.map(c => (
                  <button key={c.val} onClick={() => setCategoriaVendedor(c.val)}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: `2px solid ${categoriaVendedor === c.val ? G.cafe : G.borde}`, background: categoriaVendedor === c.val ? G.cafe : 'white', color: categoriaVendedor === c.val ? 'white' : G.gris, cursor: 'pointer', fontSize: '13px', fontWeight: categoriaVendedor === c.val ? 'bold' : 'normal' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize: '13px', marginBottom: '10px' }}>{msg}</p>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={cancelar}
              style={{ flex: 1, padding: '11px', background: G.borde, color: G.texto, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              style={{ flex: 2, padding: '11px', background: G.cafe, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: '12px', fontWeight: 'bold', color: G.gris, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
        Activos ({activos.length})
      </p>

      {activos.map(u => {
        const { label, bg, color } = rolLabel(u.rol)
        return (
          <div key={u.id} style={{ background: 'white', padding: '14px 16px', borderRadius: '10px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            {confirmDesactivar === u.id ? (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: '14px', color: G.rojo }}>⚠️ ¿Desactivar a "{u.nombre}"?</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setConfirmDesactivar(null)}
                    style={{ flex: 1, padding: '8px', background: G.borde, border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                  <button onClick={() => toggleActivo(u)}
                    style={{ flex: 1, padding: '8px', background: G.rojo, color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Sí, desactivar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', color: G.texto }}>{u.nombre}</p>
                  <p style={{ margin: '2px 0 4px', fontSize: '12px', color: G.gris }}>{u.email}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: bg, color }}>{label}</span>
                    {u.rol === 'vendedor' && u.categoriaVendedor && (
                      <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: G.cafeClaro, color: G.cafe }}>{categoriaLabel(u.categoriaVendedor)}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '10px' }}>
                  <button onClick={() => iniciarEdicion(u)}
                    style={{ padding: '7px 12px', background: '#fef9c3', color: '#854d0e', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
                  <button onClick={() => setConfirmDesactivar(u.id)}
                    style={{ padding: '7px 12px', background: '#fee2e2', color: G.rojo, border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {activos.length === 0 && !mostrarForm && (
        <p style={{ textAlign: 'center', color: G.gris, fontSize: '14px', marginTop: '20px' }}>No hay usuarios registrados aún.</p>
      )}

      {inactivos.length > 0 && (
        <div style={{ marginTop: '24px', opacity: 0.65 }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: G.gris, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            Inactivos ({inactivos.length})
          </p>
          {inactivos.map(u => {
            const { label, bg, color } = rolLabel(u.rol)
            return (
              <div key={u.id} style={{ background: '#f9f9f9', padding: '12px 16px', borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{u.nombre}</p>
                  <p style={{ margin: '2px 0 4px', fontSize: '12px', color: G.gris }}>{u.email}</p>
                  <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: bg, color }}>{label}</span>
                </div>
                <button onClick={() => toggleActivo(u)}
                  style={{ padding: '6px 12px', background: '#dcfce7', color: G.verde, border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px' }}>Activar</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}