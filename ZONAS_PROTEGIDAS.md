# ZONAS PROTEGIDAS - NO MODIFICAR SIN AUTORIZACIÓN EXPLÍCITA

## functions/index.js
- VAPID_PUBLIC_KEY = "BOAhRPgcEJBXM_KsBk9TfegDoZBNPCLD6wdLT8d004bgHMdv7vJQ-nNepGusUZzWheRmq-bzG2mc6su8bawV8FM"
- VAPID_PRIVATE_KEY = "qsKUUA3P8EOrUSY8RxEZfIf7Y7taZvTZc5AOuZyNm8c"
- webpush.setVapidDetails completo
- lógica notificarPedidoNuevo completa
- lógica notificarHorneado completa

## src/App.jsx
- VAPID_PUBLIC_KEY = "BOAhRPgc..."
- función registrarPush completa (incluyendo unsubscribe + subscribe)
- translate="no" en el div raíz

## public/firebase-messaging-sw.js
- service worker simple sin Firebase SDK (solo eventos push y notificationclick)

## src/components/constants.js
- colores G completos

## Módulos funcionando correctamente
- Login con Firebase Auth
- Catálogo con subgrupos y sugerencias
- NuevoPedido con horarios de corte
- MisPedidos con estados en tiempo real
- Consolidado con contadores por grupo
- Usuarios con roles admin/vendedor/producción
- Estados de producción (Recibido/En producción/Horneado)
- Notificaciones push pedido nuevo ✅

## Metodología de trabajo
- Antes de editar cualquier archivo, el código actual se pega en el chat
- Solo se cambian las líneas específicas necesarias
- El resto del código se conserva intacto