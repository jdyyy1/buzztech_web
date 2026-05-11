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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fcfbf9] via-[#f5f2eb] to-[#e8e2d5] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#dccca3] opacity-20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#c2a381] opacity-15 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-[420px] z-10 mt-10">
        {/* Floating Icon Container */}
        <div className="absolute -top-[70px] left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-full shadow-[0_8px_32px_rgba(139,115,85,0.2)] border border-white/80 z-20 transition-transform duration-300 hover:scale-105 hover:-translate-y-1">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-white flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="BUZZ TECH Logo" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Main Card */}
        <Card className="w-full pt-[4.5rem] pb-8 px-8 space-y-7 bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_20px_40px_rgba(139,115,85,0.08)] rounded-[2rem] relative">
          
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-[#4a3f35]">Login</h1>
            <p className="text-[#8c7b68] font-medium text-sm tracking-wide">BUZZ TECH Management</p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl flex items-start space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="text-sm font-medium text-red-600 leading-snug">{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8c7b68] pl-1">Email</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#a89680] group-focus-within:text-[#8b7355] transition-colors duration-300">
                  <Mail className="w-5 h-5" />
                </div>
                <Input
                  type="email"
                  placeholder="admin@gmail.com"
                  className="pl-11 h-12 rounded-full bg-white/50 border-white/60 shadow-sm focus-visible:ring-2 focus-visible:ring-[#8b7355]/30 focus-visible:border-[#8b7355]/50 focus-visible:bg-white text-[#4a3f35] placeholder:text-[#a89680] transition-all duration-300 backdrop-blur-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8c7b68] pl-1">Password</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#a89680] group-focus-within:text-[#8b7355] transition-colors duration-300">
                  <Lock className="w-5 h-5" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-11 pr-11 h-12 rounded-full bg-white/50 border-white/60 shadow-sm focus-visible:ring-2 focus-visible:ring-[#8b7355]/30 focus-visible:border-[#8b7355]/50 focus-visible:bg-white text-[#4a3f35] placeholder:text-[#a89680] transition-all duration-300 backdrop-blur-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-[#a89680] hover:text-[#8b7355] transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-12 mt-4 rounded-full bg-gradient-to-r from-[#8b7355] to-[#705a41] hover:from-[#7a6448] hover:to-[#5f4b36] text-white shadow-[0_8px_20px_rgba(139,115,85,0.25)] hover:shadow-[0_10px_25px_rgba(139,115,85,0.35)] transition-all duration-300 font-medium text-[15px] border-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                "LOGIN"
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] font-medium tracking-wide text-[#a89680]/80">
            {auth && db ? "Connected to Firebase Authentication system" : "Firebase not configured"}
          </p>
        </Card>
      </div>
    </div>
  )
}
