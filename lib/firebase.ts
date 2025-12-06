import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Replace these values with your Firebase project config from Android google-services.json
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function hasValidConfig() {
  return (
    !!firebaseConfig.apiKey &&
    !!firebaseConfig.authDomain &&
    !!firebaseConfig.projectId &&
    !!firebaseConfig.appId
  )
}

// Only initialize Firebase when config is present. This prevents
// build-time SSR/prerender from failing if env vars are missing.
let app: ReturnType<typeof initializeApp> | undefined
let auth: ReturnType<typeof getAuth> | undefined
let db: ReturnType<typeof getFirestore> | undefined

if (hasValidConfig()) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
  } catch (e) {
    // Swallow initialization errors during build/prerender; runtime should surface logs
    if (process.env.NODE_ENV !== "production") {
      console.warn("Firebase failed to initialize:", e)
    }
  }
} else {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "Firebase config missing. Set NEXT_PUBLIC_* env vars in .env.local to enable Firebase."
    )
  }
}

export { auth, db }
export default app
