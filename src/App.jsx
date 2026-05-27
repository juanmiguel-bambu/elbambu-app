import { useState, useEffect } from 'react'
import { auth, messaging } from './firebase'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { getToken, onMessage } from 'firebase/messaging'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const db = getFirestore()
const VAPID_KEY = 'BE6g5fMBBNjlX1SJX5x3v3NXNAJHbRMekYzcQlQQ-JFpC6uyzwCA_kaA_p7wW-jTyxAho-9ZWhCOm2jauh92yel'

async function registrarToken(uid) {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (token) {
      await setDoc(doc(db, 'fcmTokens', uid), { token, uid, updatedAt: new Date() })
      console.log('Token FCM registrado:', token)
    }
  } catch (err) {
    console.error('Error registrando token FCM:', err)
  }
}

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) registrarToken(currentUser.uid)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' })
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError('Usuario o contraseña incorrectos')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  if (user) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h2>Bienvenido, {user.email}</h2>
        <p>Notificaciones: {Notification.permission}</p>
        <button onClick={handleLogout}>Cerrar sesión</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial' }}>
      <div style={{ width: '300px' }}>
        <h2 style={{ textAlign: 'center' }}>El Bambú</h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', background: '#8B6B3E', color: 'white', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App