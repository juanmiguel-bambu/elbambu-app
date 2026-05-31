self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'El Bambú'
  const options = {
    body: data.body || 'Nuevo aviso',
    icon: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'elbambu',
    renotify: true
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})