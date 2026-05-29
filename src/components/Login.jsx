import { useState } from 'react'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { G } from './constants'

export default function Login() {
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
          <img src="/icon-192.png" alt="El Bambú"
            style={{ width:'80px', height:'80px', borderRadius:'18px', marginBottom:'8px', display:'block', margin:'0 auto 8px' }} />
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