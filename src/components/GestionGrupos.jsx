import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, setDoc, collection, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { G } from './constants'

export default function GestionGrupos({ onVolver }) {
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