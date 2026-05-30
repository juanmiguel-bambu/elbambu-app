import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import Login from './components/Login'
import Catalogo from './components/Catalogo'
import NuevoPedido from './components/NuevoPedido'
import MisPedidos from './components/MisPedidos'
import Consolidado from './components/Consolidado'
import Usuarios from './components/Usuarios'
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

function limpiarBadge() {
  try {
    if (navigator.clearAppBadge) navigator.clearAppBadge()
  } catch (e) {}
}

export default function App() {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [tab, setTab] = useState('nuevo-pedido')

  useEffect(() => {
    limpiarBadge()
    const onFocus = () => limpiarBadge()
    const onVisibility = () => { if (!document.hidden) limpiarBadge() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser)
      if (currentUser) {
        registrarPush(currentUser.uid)
        limpiarBadge()
        const id = currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
        const snap = await getDoc(doc(db, 'usuarios', id))
        if (snap.exists()) {
          setPerfil(snap.data())
        } else {
          setPerfil({ rol: ADMINS.includes(currentUser.email) ? 'admin' : 'vendedor' })
        }
      } else {
        setPerfil(null)
      }
    })
    return () => unsub()
  }, [])

  if (!user || !perfil) return <Login />

  const rol = perfil.rol
  const isAdmin = rol === 'admin'

  const tabs = [
    ...(rol === 'vendedor' ? [{ key:'nuevo-pedido', label:'➕ Pedido' }] : []),
    ...(rol === 'vendedor' ? [{ key:'mis-pedidos', label:'📦 Mis pedidos' }] : []),
    ...(rol === 'admin' ? [{ key:'nuevo-pedido', label:'➕ Pedido' }] : []),
    ...(rol === 'admin' ? [{ key:'mis-pedidos', label:'📦 Mis pedidos' }] : []),
    ...(rol !== 'vendedor' ? [{ key:'consolidado', label:'📊 Consolidado' }] : []),
    ...(isAdmin ? [{ key:'catalogo', label:'📋 Catálogo' }] : []),
    ...(isAdmin ? [{ key:'usuarios', label:'👥 Usuarios' }] : []),
  ]

  const tabsKeys = tabs.map(t => t.key)
  const tabActual = tabsKeys.includes(tab) ? tab : tabsKeys[0]

  return (
    <div translate="no" style={{ minHeight:'100vh', background: G.cafeClaro, paddingBottom:'70px' }}>
      <div style={{ background: G.cafe, color:'white', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <img src="/icon-192.png" alt="" style={{ width:'28px', height:'28px', borderRadius:'6px' }} />
          <span style={{ fontWeight:'bold', fontSize:'18px' }}>El Bambú</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'13px', opacity:0.8 }}>{user.email.split('@')[0]}</span>
          <button onClick={() => signOut(auth)} style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>Salir</button>
        </div>
      </div>
      <div>
        {tabActual === 'nuevo-pedido' && <NuevoPedido user={user} />}
        {tabActual === 'mis-pedidos' && <MisPedidos user={user} />}
        {tabActual === 'consolidado' && <Consolidado userEmail={user.email} />}
        {tabActual === 'catalogo' && isAdmin && <Catalogo />}
        {tabActual === 'usuarios' && isAdmin && <Usuarios />}
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderTop:`1px solid ${G.borde}`, display:'flex' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); limpiarBadge() }}
            style={{ flex:1, padding:'12px 4px', border:'none', background: tabActual === t.key ? G.cafeClaro : 'white', color: tabActual === t.key ? G.cafe : G.gris, fontWeight: tabActual === t.key ? 'bold' : 'normal', cursor:'pointer', fontSize:'11px' }}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}