import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import Login from './components/Login'
import Catalogo from './components/Catalogo'
import NuevoPedido from './components/NuevoPedido'
import MisPedidos from './components/MisPedidos'
import Consolidado from './components/Consolidado'
import { VAPID_PUBLIC_KEY, ADMINS, G } from './components/constants'

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

export default function App() {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('nuevo-pedido')

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
    { key:'nuevo-pedido', label:'➕ Pedido' },
    { key:'mis-pedidos', label:'📦 Mis pedidos' },
    { key:'consolidado', label:'📊 Consolidado' },
    ...(isAdmin ? [{ key:'catalogo', label:'📋 Catálogo' }] : []),
  ]

  return (
    <div translate="no" style={{ minHeight:'100vh', background: G.cafeClaro, paddingBottom:'70px' }}>
      <div style={{ background: G.cafe, color:'white', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100 }}>
        <span style={{ fontWeight:'bold', fontSize:'18px' }}>🍞 El Bambú</span>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'13px', opacity:0.8 }}>{user.email.split('@')[0]}</span>
          <button onClick={() => signOut(auth)} style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>Salir</button>
        </div>
      </div>
      <div>
        {tab === 'nuevo-pedido' && <NuevoPedido user={user} />}
        {tab === 'mis-pedidos' && <MisPedidos user={user} />}
        {tab === 'consolidado' && <Consolidado />}
        {tab === 'catalogo' && isAdmin && <Catalogo />}
        {tab === 'catalogo' && !isAdmin && <p style={{ textAlign:'center', color: G.gris, marginTop:'40px' }}>Sin acceso.</p>}
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderTop:`1px solid ${G.borde}`, display:'flex' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex:1, padding:'12px 4px', border:'none', background: tab === t.key ? G.cafeClaro : 'white', color: tab === t.key ? G.cafe : G.gris, fontWeight: tab === t.key ? 'bold' : 'normal', cursor:'pointer', fontSize:'11px' }}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}