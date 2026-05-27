import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCJlxa__0Ho1j-D8bwcjxDFMUnenVZr2p8",
  authDomain: "elbambu-app.firebaseapp.com",
  projectId: "elbambu-app",
  storageBucket: "elbambu-app.firebasestorage.app",
  messagingSenderId: "448925108552",
  appId: "1:448925108552:web:35eb2e9927187c14a6cb7d",
  measurementId: "G-6407EFVXM8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);