// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 🟢 1. Import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyBYJhuwthmdd7fDDOj1lmnNzkUJG5N075s",
  authDomain: "senorplus-1926c.firebaseapp.com",
  projectId: "senorplus-1926c",
  storageBucket: "senorplus-1926c.firebasestorage.app",
  messagingSenderId: "176067304584",
  appId: "1:176067304584:web:16346821442861c7f6533d",
  measurementId: "G-Z86KJRW25Q"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// 🟢 2. Initialize and Export Database
export const db = getFirestore(app); 

// Initialize and Export Auth
export const auth = getAuth(app);



export default app;