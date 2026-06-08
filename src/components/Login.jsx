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
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background: G.cafeClaro, padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'380px', background:'white', padding:'40px 32px', borderRadius:'16px', boxShadow:'0 2px 16px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <img src="/icon-192.png" alt="El Bambú"
            style={{ width:'100px', height:'100px', borderRadius:'22px', display:'block', margin:'0 auto 12px' }} />
          <h2 style={{ color: G.cafe, margin:0, fontSize:'26px' }}>El Bambú</h2>
        </div>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width:'100%', padding:'14px', marginBottom:'14px', borderRadius:'10px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'16px' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width:'100%', padding:'14px', marginBottom:'14px', borderRadius:'10px', border:`1px solid ${G.borde}`, boxSizing:'border-box', background:'white', color: G.texto, fontSize:'16px' }} />
          {error && <p style={{ color: G.rojo, fontSize:'14px', marginBottom:'10px' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'16px', background: G.cafe, color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'18px' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}