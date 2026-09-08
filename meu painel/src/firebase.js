import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDI3_Y3kdX-KCP14jYI3FX9NYawnRJIzpA",
  authDomain: "meta-ativos.firebaseapp.com",
  projectId: "meta-ativos",
  storageBucket: "meta-ativos.firebasestorage.app",
  messagingSenderId: "247415934030",
  appId: "1:247415934030:web:8141fba355a70f17f2071f",
  measurementId: "G-1S01QTJZZT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
