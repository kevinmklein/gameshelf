// Firebase / Firestore initialization.
// If the VITE_FIREBASE_* env vars are present we connect to the cloud; otherwise
// the app runs on a localStorage fallback (see catalog.js) so development and early
// cataloging work with zero setup. Fill in .env.local to switch to Firestore.
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const hasFirebase = Boolean(cfg.apiKey && cfg.projectId)

const app = hasFirebase ? initializeApp(cfg) : null
export const db = app ? getFirestore(app) : null
const auth = app ? getAuth(app) : null

// Silently sign the visitor in with an anonymous account. This gives every browser
// a stable auth token (no login screen — fits the passwordless family model) so the
// Firestore security rules can require `request.auth != null`. Resolves once a user
// exists; safe no-op when Firebase isn't configured (localStorage mode).
export function ensureAuth() {
  if (!auth) return Promise.resolve(null)
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user) }
      else signInAnonymously(auth).catch((err) => {
        console.error('Anonymous sign-in failed — is the provider enabled in Firebase?', err)
        unsub(); resolve(null)
      })
    })
  })
}
