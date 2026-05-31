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
  "estadosProducto/{estadoId}",
  async (event) => {
    const antes = event.data.before.data();
    const despues = event.data.after.data();

    if (!despues || despues.estado !== "horneado") return null;
    if (antes && antes.estado === "horneado") return null;

    const db = getFirestore();
    const { productoId, nombre, fecha } = despues;

    const pedidosSnap = await db.collection("pedidos")
      .where("fechaEntrega", "==", fecha)
      .get();

    if (pedidosSnap.empty) return null;

    const vendedoresEmails = new Set();
    pedidosSnap.docs.forEach(doc => {
      const pedido = doc.data();
      const tieneProducto = pedido.items?.some(item => item.productoId === productoId);
      if (tieneProducto) vendedoresEmails.add(pedido.vendedor);
    });

    if (vendedoresEmails.size === 0) return null;

    const subsSnap = await db.collection("pushSubscriptions").get();
    if (subsSnap.empty) return null;

    const payload = JSON.stringify({
      title: "🍞 ¡Listo para entregar!",
      body: `${nombre} está horneado — El Bambú`
    });

    const envios = subsSnap.docs
      .filter(doc => vendedoresEmails.has(doc.data().email))
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