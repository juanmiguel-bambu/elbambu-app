import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'

const VAPID_PUBLIC_KEY = 'BOAhRPgcEJBXM_KsBk9TfegDoZBNPCLD6wdLT8d004bgHMdv7vJQ-nNepGusUZzWheRmq-bzG2mc6su8bawV8FM'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

async function registrarPush(uid) {
  try {
    if (!('serviceWorker' in navigator)) {
      console.error('Service Worker no soportado')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Permiso denegado')
      return
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('Service Worker registrado:', registration.scope)

    await navigator.serviceWorker.ready
    console.log('Service Worker listo')

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    await setDoc(doc(db, 'pushSubscriptions', uid), {
      uid,
      subscription: JSON.parse(JSON.stringify(subscription)),
      updatedAt: new Date()
    })

    console.log('Suscripción push registrada ✅')
  } catch (err) {
    console.error('Error registrando push:', err)
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
      if (currentUser) registrarPush(currentUser.uid)
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

  const handleLogout = async () => await signOut(auth)

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