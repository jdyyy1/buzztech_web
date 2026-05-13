"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { type User as FirebaseUser, onAuthStateChanged } from "firebase/auth"
import { auth, db } from "./firebase"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import type { User } from "./models"

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  error: string | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If Firebase didn't initialize (missing/invalid env), skip subscription.
    if (!auth || !db) {
      setLoading(false)
      setError("Firebase is not configured. Check .env.local NEXT_PUBLIC_* values.")
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          setFirebaseUser(fbUser)
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, "users", fbUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data() as User
            setUser(userData)
            setError(null)
          } else {
            setUser(null)
            setError("User profile not found in Firestore")
          }
        } else {
          setUser(null)
          setFirebaseUser(null)
          // Clear session cookie on logout
          document.cookie = "__session=; path=/; max-age=0"
        }
      } catch (err) {
        console.error("[v0] Auth error:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  /** Realtime-ish presence: refresh `presenceAt` while this browser session is signed in and visible. */
  useEffect(() => {
    if (!db || !firebaseUser) return

    const ref = doc(db, "users", firebaseUser.uid)
    const intervalMs = 30_000

    const pulse = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      updateDoc(ref, { presenceAt: serverTimestamp() }).catch(() => {
        /* ignore: rules or missing doc */
      })
    }

    pulse()
    const id = window.setInterval(pulse, intervalMs)

    const onVis = () => {
      if (document.visibilityState === "visible") pulse()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [firebaseUser])

  const logout = async () => {
    try {
      if (!auth) {
        throw new Error("Firebase auth is not available")
      }
      await auth.signOut()
      setUser(null)
      setFirebaseUser(null)
      document.cookie = "__session=; path=/; max-age=0"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed")
      throw err
    }
  }

  return <AuthContext.Provider value={{ user, firebaseUser, loading, error, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
