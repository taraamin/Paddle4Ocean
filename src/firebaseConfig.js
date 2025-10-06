import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyAs2S1eGGeGKcXfc4fU_8Qw77bw6qMeyNs",
    authDomain: "paddle-for-ocean.firebaseapp.com",
    projectId: "paddle-for-ocean",
    storageBucket: "paddle-for-ocean.firebasestorage.app",
    messagingSenderId: "516029485554",
    appId: "1:516029485554:web:4267e6759ee47bca2d1b6b",
    measurementId: "G-VK76HZGNFT"
  };

  const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
