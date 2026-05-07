import admin from "firebase-admin"

// Initialize Firebase Admin SDK for server-side operations.
// Prefer service account JSON via env variables in production.
// For local development, Application Default Credentials can work if set.

const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.appspot.com` : undefined)

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
        storageBucket,
      })
    } else {
      // Fallback to ADC (gcloud/auth configured) if service account env is not provided
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
        storageBucket,
      })
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Firebase Admin failed to initialize:", e)
    }
  }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()
export const adminStorage = admin.storage()
