import { type NextRequest, NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ message: "Missing credentials" }, { status: 400 })
    }

    // 1. Try to find the user in Firestore first to check for "staff" or "admin" roles
    console.log(`[Login API] Initializing for email: ${email}`)
    
    if (!adminDb) {
      console.error("[Login API] adminDb is not initialized. Check your Service Account keys.")
      return NextResponse.json({ message: "Server configuration error" }, { status: 500 })
    }

    const usersRef = adminDb.collection("users")
    const snapshot = await usersRef.where("email", "==", email).limit(1).get()

    if (snapshot.empty) {
      console.log(`[Login API] No user found in Firestore for email: ${email}`)
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const userData = snapshot.docs[0].data()
    const userId = snapshot.docs[0].id
    console.log(`[Login API] Found user doc: ${userId}, Role: ${userData.role}`)

    // 2. Check if this is a "temp" password login
    // Robust check: convert both to string to avoid type mismatch
    const providedPassword = String(password).trim()
    const storedPassword = userData.password_temp ? String(userData.password_temp).trim() : null

    if (storedPassword && storedPassword === providedPassword) {
      console.log(`[Login API] Password matched. Creating custom token for ${userId}...`)
      try {
        await adminDb.collection("users").doc(userId).set(
          {
            last_login: FieldValue.serverTimestamp(),
            status: "active",
          },
          { merge: true },
        )

        const token = await adminAuth.createCustomToken(userId)
        return NextResponse.json({
          token,
          user: {
            id: userId,
            email: userData.email,
            name: userData.name,
            role: userData.role
          },
          message: "Login successful (Temp Credential)"
        }, { status: 200 })
      } catch (tokenError) {
        console.error(`[Login API] Token Error:`, tokenError)
        return NextResponse.json({ message: "Internal Auth Error" }, { status: 500 })
      }
    }

    console.log(`[Login API] Password mismatch for ${email}. Entered: "${providedPassword}", Stored: "${storedPassword}"`)
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })

  } catch (error) {
    console.error("Login API Error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
