import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export const firebaseApp = initializeApp({
  apiKey: 'AIzaSyByk-tH2N0heDCjG-UMgHj9iygZmPenVOA',
  authDomain: 'apu-studio.firebaseapp.com',
  projectId: 'apu-studio',
  storageBucket: 'apu-studio.firebasestorage.app',
  messagingSenderId: '381905837371',
  appId: '1:381905837371:web:96c0b1f20e3564262d6b1e',
})
export const firebaseAuth = getAuth(firebaseApp)
