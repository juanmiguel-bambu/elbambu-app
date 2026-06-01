const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const webpush = require("web-push");

initializeApp();

const VAPID_PUBLIC_KEY = "BOAhRPgcEJBXM_KsBk9TfegDoZBNPCLD6wdLT8d004bgHMdv7vJQ-nNepGusUZzWheRmq-bzG2mc6su8bawV8FM"
const VAPID_PRIVATE_KEY = "qsKUUA3P8EOrUSY8RxEZfIf7Y7taZvTZc5AOuZyNm8c"

webpush.setVapidDetails(
  "mailto:migueljmolina79@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

exports.notificarPedidoNuevo = onDocumentCreated(
  "pedidos/{pedidoId}",
  async (event) => {
    const pedido = event.data.data();
    const db = getFirestore();

    const subsSnap = await db.collection("pushSubscriptions").get();
    if (subsSnap.empty) return null;

    const payload = JSON.stringify({
      title: "🧾 Nuevo pedido — El Bambú",
      body: `Pedido de ${pedido.vendedorNombre || pedido.vendedor}`
    });

    const envios = subsSnap.docs.map(async (doc) => {
      const sub = doc.data().subscription;
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        console.error("Error enviando a", doc.id, err.statusCode);
      }
    });

    await Promise.all(envios);
    return null;
  }
);

exports.notificarHorneado = onDocumentWritten(
  "pedidos/{pedidoId}",
  async (event) => {
    const antes = event.data.before.data();
    const despues = event.data.after.data();

    if (!despues || !despues.estadoItems) return null;

    const db = getFirestore();
    const vendedorEmail = despues.vendedor;
    const estadosAntes = antes?.estadoItems || {};
    const estadosDespues = despues.estadoItems;

    // Buscar productos que cambiaron A horneado en este update
    const productosHorneados = Object.entries(estadosDespues).filter(([productoId, estado]) =>
      estado === 'horneado' && estadosAntes[productoId] !== 'horneado'
    )

    if (productosHorneados.length === 0) return null;

    // Obtener nombres de productos horneados
    const nombresProductos = productosHorneados.map(([productoId]) => {
      const item = despues.items?.find(i => i.productoId === productoId)
      return item?.nombre || 'Producto'
    })

    const subsSnap = await db.collection("pushSubscriptions").get();
    if (subsSnap.empty) return null;

    const payload = JSON.stringify({
      title: "🍞 ¡Listo para entregar!",
      body: `${nombresProductos.join(', ')} — El Bambú`
    });

    const envios = subsSnap.docs
      .filter(doc => doc.data().email === vendedorEmail)
      .map(async (doc) => {
        const sub = doc.data().subscription;
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error("Error enviando a", doc.id, err.statusCode);
        }
      });

    await Promise.all(envios);
    return null;
  }
);