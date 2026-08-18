import { initializeApp, getApps, deleteApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

const FIREBASE_CONFIG_KEY = 'vllm-firebase-config'
const DOC_ID = 'metrics-state'
const COLLECTION_NAME = 'vllm_telemetry'

let app = null
let db = null
let auth = null
let unsubscribeSnapshot = null

export function getSavedFirebaseConfig() {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}

  // Fallback to environment variables
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      enabled: true,
      authEnabled: true,
    }
  }

  return {
    apiKey: 'AIzaSyCnz6CemdTh0Q60E9vHQLDm8RJvTIAlOCo',
    authDomain: 'llm-dashboard-gameonvinay.firebaseapp.com',
    projectId: 'llm-dashboard-gameonvinay',
    storageBucket: 'llm-dashboard-gameonvinay.firebasestorage.app',
    messagingSenderId: '225579938921',
    appId: '1:225579938921:web:a9cdd34a2e446d8116def8',
    enabled: true,
    authEnabled: true,
  }
}

export function saveFirebaseConfig(config) {
  try {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config))
    return initFirebase(config)
  } catch (e) {
    console.error('Failed to save Firebase config:', e)
    return false
  }
}

export function isFirebaseConfigured() {
  const cfg = getSavedFirebaseConfig()
  return Boolean(cfg?.apiKey && cfg?.projectId && cfg?.enabled)
}

export function initFirebase(customConfig = null) {
  const config = customConfig || getSavedFirebaseConfig()
  
  if (!config || !config.apiKey || !config.projectId || !config.enabled) {
    cleanupFirebase()
    return false
  }

  try {
    // If an app already exists, delete it first to reinitialize with new config
    const existingApps = getApps()
    if (existingApps.length > 0) {
      deleteApp(existingApps[0])
    }

    app = initializeApp({
      apiKey: config.apiKey.trim(),
      authDomain: config.authDomain?.trim(),
      projectId: config.projectId?.trim(),
      storageBucket: config.storageBucket?.trim(),
      messagingSenderId: config.messagingSenderId?.trim(),
      appId: config.appId?.trim(),
    })

    db = getFirestore(app)
    auth = getAuth(app)
    return true
  } catch (e) {
    console.error('Firebase initialization error:', e)
    cleanupFirebase()
    return false
  }
}

function cleanupFirebase() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot()
    unsubscribeSnapshot = null
  }
  app = null
  db = null
  auth = null
}

// ─── Cloud Firestore Sync ──────────────────────────────────────────────────────

let debounceTimer = null

export async function saveStateToFirestore(statePayload) {
  if (!db || !isFirebaseConfigured()) return false

  // Debounce saves by 2 seconds so we don't spam Firestore on 1s polls
  return new Promise((resolve) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(async () => {
      try {
        const metricsDoc = doc(db, COLLECTION_NAME, DOC_ID)
        await setDoc(metricsDoc, {
          ...statePayload,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
        resolve(true)
      } catch (err) {
        console.warn('Firestore write failed:', err)
        resolve(false)
      }
    }, 2000)
  })
}

export async function fetchStateFromFirestore() {
  if (!db || !isFirebaseConfigured()) return null

  try {
    const metricsDoc = doc(db, COLLECTION_NAME, DOC_ID)
    const snap = await getDoc(metricsDoc)
    if (snap.exists()) {
      return snap.data()
    }
  } catch (err) {
    console.warn('Firestore read failed:', err)
  }
  return null
}

export function subscribeToFirestore(onData) {
  if (!db || !isFirebaseConfigured()) return () => {}

  try {
    if (unsubscribeSnapshot) unsubscribeSnapshot()

    const metricsDoc = doc(db, COLLECTION_NAME, DOC_ID)
    unsubscribeSnapshot = onSnapshot(metricsDoc, (snap) => {
      if (snap.exists()) {
        onData(snap.data())
      }
    }, (error) => {
      console.warn('Firestore real-time subscription error:', error)
    })

    return unsubscribeSnapshot
  } catch (err) {
    console.warn('Failed to attach Firestore listener:', err)
    return () => {}
  }
}

// ─── Firebase Authentication ─────────────────────────────────────────────────

export async function signInWithGoogle() {
  if (!auth) {
    initFirebase()
    if (!auth) throw new Error('Firebase Auth is not configured')
  }

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function signOutUser() {
  if (!auth) return
  await signOut(auth)
}

export function onAuthChange(callback) {
  if (!auth) {
    initFirebase()
    if (!auth) {
      callback(null)
      return () => {}
    }
  }
  return onAuthStateChanged(auth, callback)
}
