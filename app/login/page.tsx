"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Lock, Mail, Eye, EyeOff } from "lucide-react"
import { signInWithEmailAndPassword, signInWithCustomToken } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!auth || !db) {
        throw new Error("Firebase is not configured. Check .env.local NEXT_PUBLIC_* values.")
      }

      let user;
      let userData;

      try {
        // Step 1: Try standard Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        user = userCredential.user
        const userDoc = await getDoc(doc(db, "users", user.uid))
        userData = userDoc.data()
      } catch (fbAuthError: any) {
        // Step 2: If standard auth fails, try our custom API (for Firestore-only users with password_temp)
        console.log("Standard auth failed, trying custom login API...")

        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        })

        if (!response.ok) {
          throw fbAuthError // Re-throw if API also fails
        }

        const data = await response.json()
        if (data.token) {
          const customCredential = await signInWithCustomToken(auth, data.token)
          user = customCredential.user
          userData = data.user
        } else {
          throw fbAuthError
        }
      }

      if (!userData || (userData.role !== "admin" && userData.role !== "staff" && userData.role !== "superadmin")) {
        await auth.signOut()
        setError("You do not have authorized access. Contact your administrator.")
        return
      }

      // Get Firebase ID token and store in cookie
      const token = await user.getIdToken()
      document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Strict`

      // Redirect based on role
      if (userData.role === "superadmin") {
        router.push("/superadmin/dashboard")
      } else {
        router.push("/dashboard")
      }
    } catch (err: any) {
      if (err.message?.includes("auth/user-not-found") || err.message?.includes("auth/invalid-credential")) {
        setError("Invalid email or password. Please check your credentials.")
      } else if (err.message?.includes("auth/wrong-password")) {
        setError("Incorrect password")
      } else if (err.message?.includes("auth/invalid-email")) {
        setError("Invalid email format")
      } else {
        setError(err.message || "Login failed. Please try again.")
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Admin Login</h1>
          <p className="text-muted-foreground mt-2">BUZZ TECH Management</p>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="email"
                placeholder="admin@gmail.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-6">
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {auth && db ? "Connected to Firebase Authentication system" : "Firebase not configured"}
        </p>
      </Card>
    </div>
  )
}
