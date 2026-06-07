import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore'
import { G } from './constants'

export default function ClientesMayoreo({ user, isAdmin, onBadge }) {
  const [clientes, setClientes] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [formNombre, setFormNombre] = useState('')
  const [formApellido, setFormApellido] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formCorreo, setFormCorreo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clientesMayoreo'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0))
      setClientes(lista)

      // Badge para admin — solicitudes pendientes
      if (isAdmin) {
        const pendientes = lista.filter(c => c.estadoMayoreo === 'pendiente').length
        onBadge(pendientes)
      }
    })
    return () => unsub()
  }, [isAdmin])

  const clientesVisibles = isAdmin
    ? (filtroVendedor === 'todos' ? clientes : clientes.filter(c => c.vendedorEmail === filtroVendedor))
    : clientes.filter(c => c.vendedorEmail === user.email)

  const vendedores = [...new Set(clientes.map(c => c.vendedorEmail))]

  const guardar = async () => {
    if (!formNombre.trim() || !formApellido.trim() || !formTelefono.trim()) {
      setMsg('⚠️ Nombre, apellido y teléfono son obligatorios'); return
    }
    setGuardando(true)
    await addDoc(collection(db, 'clientesMayoreo'), {
      nombre: formNombre.trim(),
      apellido: formApellido.trim(),
      telefono: formTelefono.trim(),
      correo: formCorreo.trim(),
      vendedorEmail: user.email,
      vendedorNombre: user.email.split('@')[0],
      estadoMayoreo: 'pendiente',
      creadoEn: new Date()
    })
    setFormNombre(''); setFormApellido(''); setFormTelefono(''); setFormCorreo('')
    setMsg('✅ Cliente registrado. Solicitud enviada al administrador.')
    setTimeout(() => { setMsg(''); setMostrarForm(false) }, 2500)
    setGuardando(false)
  }

  const cambiarEstado = async (cliente, nuevoEstado) => {
    await updateDoc(doc(db, 'clientesMayoreo', cliente.id), {
      estadoMayoreo: nuevoEstado,
      revisadoEn: new Date(),
      revisadoPor: user.email
    })
  }

  const estadoConfig = {
    pendiente:  { label: '⏳ Pendiente',  bg: '#fef9c3', color: '#854d0e' },
    aprobado:   { label: '✅ Aprobado',   bg: '#dcfce7', color: '#16a34a' },
    rechazado:  { label: '❌ Rechazado',  bg: '#fee2e2', color: '#dc2626' },
  }

  const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'14px', marginBottom:'10px' }

  const pendientes = clientesVisibles.filter(c => c.estadoMayoreo === 'pendiente')
  const resto = clientesVisibles.filter(c => c.estadoMayoreo !== 'pendiente')

  return (
    <div style={{ maxWidth:'520px', margin:'0 auto', padding:'16px', paddingBottom:'30px' }}>
      <h3 style={{ color: G.cafe, marginBottom:'16px' }}>🤝 Clientes Mayoreo</h3>

      {/* Filtro por vendedor — solo admin */}
      {isAdmin && vendedores.length > 0 && (
        <div style={{ marginBottom:'16px' }}>
          <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Filtrar por vendedor</p>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {['todos', ...vendedores].map(v => (
              <button key={v} onClick={() => setFiltroVendedor(v)}
                style={{ padding:'7px 12px', borderRadius:'8px', border:`2px solid ${filtroVendedor === v ? G.cafe : G.borde}`, background: filtroVendedor === v ? G.cafe : 'white', color: filtroVendedor === v ? 'white' : G.texto, cursor:'pointer', fontSize:'13px' }}>
                {v === 'todos' ? 'Todos' : v.split('@')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botón agregar — solo vendedores */}
      {!isAdmin && !mostrarForm && (
        <button onClick={() => setMostrarForm(true)}
          style={{ width:'100%', padding:'12px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px', marginBottom:'20px' }}>
          ➕ Registrar cliente
        </button>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div style={{ background:'white', padding:'16px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', borderTop:`3px solid ${G.cafe}` }}>
          <p style={{ fontWeight:'bold', color: G.cafe, marginBottom:'14px' }}>➕ Nuevo cliente mayoreo</p>
          <input placeholder="Nombre *" value={formNombre} onChange={e => setFormNombre(e.target.value)} style={inputStyle} />
          <input placeholder="Apellido *" value={formApellido} onChange={e => setFormApellido(e.target.value)} style={inputStyle} />
          <input placeholder="Teléfono *" value={formTelefono} onChange={e => setFormTelefono(e.target.value)} style={inputStyle} type="tel" />
          <input placeholder="Correo electrónico (opcional)" value={formCorreo} onChange={e => setFormCorreo(e.target.value)} style={{ ...inputStyle, marginBottom:'16px' }} type="email" />
          {msg && <p style={{ color: msg.includes('⚠️') ? G.rojo : G.verde, fontSize:'13px', marginBottom:'10px' }}>{msg}</p>}
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => { setMostrarForm(false); setMsg('') }} style={{ flex:1, padding:'11px', background: G.borde, color: G.texto, border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ flex:2, padding:'11px', background: G.cafe, color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }}>
              {guardando ? 'Guardando...' : 'Registrar y solicitar'}
            </button>
          </div>
        </div>
      )}

      {/* Solicitudes pendientes primero */}
      {pendientes.length > 0 && (
        <>
          <p style={{ fontSize:'12px', fontWeight:'bold', color: '#854d0e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>⏳ Pendientes de autorización ({pendientes.length})</p>
          {pendientes.map(c => <ClienteCard key={c.id} c={c} isAdmin={isAdmin} cambiarEstado={cambiarEstado} estadoConfig={estadoConfig} />)}
          {resto.length > 0 && <div style={{ height:'1px', background: G.borde, margin:'16px 0' }} />}
        </>
      )}

      {/* Resto de clientes */}
      {resto.length > 0 && (
        <>
          {pendientes.length > 0 && <p style={{ fontSize:'12px', fontWeight:'bold', color: G.gris, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Historial</p>}
          {resto.map(c => <ClienteCard key={c.id} c={c} isAdmin={isAdmin} cambiarEstado={cambiarEstado} estadoConfig={estadoConfig} />)}
        </>
      )}

      {clientesVisibles.length === 0 && !mostrarForm && (
        <p style={{ textAlign:'center', color: G.gris, marginTop:'40px', fontSize:'14px' }}>
          {isAdmin ? 'No hay clientes mayoreo registrados aún.' : 'No tenés clientes mayoreo registrados aún.'}
        </p>
      )}
    </div>
  )
}

function ClienteCard({ c, isAdmin, cambiarEstado, estadoConfig }) {
  const cfg = estadoConfig[c.estadoMayoreo] || estadoConfig.pendiente
  const [expandido, setExpandido] = useState(false)

  return (
    <div style={{ background:'white', borderRadius:'10px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => setExpandido(!expandido)}>
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontWeight:'bold', fontSize:'15px', color: '#333' }}>{c.nombre} {c.apellido}</p>
          <p style={{ margin:'2px 0 0', fontSize:'12px', color: '#888' }}>
            {isAdmin ? `${c.vendedorNombre} · ` : ''}{c.telefono}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'12px', fontWeight:'bold', padding:'4px 10px', borderRadius:'20px', background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
          <span style={{ fontSize:'14px', color: '#888' }}>{expandido ? '▲' : '▼'}</span>
        </div>
      </div>

      {expandido && (
        <div style={{ borderTop:`1px solid #e5e7eb`, padding:'12px 16px', background:'#fafafa' }}>
          {c.correo ? <p style={{ margin:'0 0 4px', fontSize:'13px', color: '#555' }}>✉️ {c.correo}</p> : null}
          <p style={{ margin:'0 0 4px', fontSize:'13px', color: '#555' }}>📞 {c.telefono}</p>
          <p style={{ margin:'0 0 12px', fontSize:'12px', color: '#888' }}>
            Registrado el {c.creadoEn?.toDate ? c.creadoEn.toDate().toLocaleDateString('es-SV') : '—'}
          </p>

          {/* Botones de acción — solo admin, solo si pendiente */}
          {isAdmin && c.estadoMayoreo === 'pendiente' && (
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => cambiarEstado(c, 'rechazado')}
                style={{ flex:1, padding:'9px', background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                ❌ Rechazar
              </button>
              <button onClick={() => cambiarEstado(c, 'aprobado')}
                style={{ flex:2, padding:'9px', background:'#dcfce7', color:'#16a34a', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                ✅ Aprobar mayoreo
              </button>
            </div>
          )}

          {/* Si ya fue revisado */}
          {c.revisadoPor && (
            <p style={{ margin:'8px 0 0', fontSize:'11px', color: '#888' }}>
              {c.estadoMayoreo === 'aprobado' ? 'Aprobado' : 'Rechazado'} por {c.revisadoPor.split('@')[0]}
            </p>
          )}
        </div>
      )}
    </div>
  )
}