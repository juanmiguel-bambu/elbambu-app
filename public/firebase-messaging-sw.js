importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCJlxa__0Ho1j-D8bwcjxDFMUnenVZr2p8",
  authDomain: "elbambu-app.firebaseapp.com",
  projectId: "elbambu-app",
  storageBucket: "elbambu-app.firebasestorage.app",
  messagingSenderId: "448925108552",
  appId: "1:448925108552:web:35eb2e9927187c14a6cb7d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: 'pedido-nuevo',
    renotify: true
  });
});