import { type NextRequest, NextResponse } from "next/server"
import admin from "firebase-admin"

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("__session")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token)

    // Check if user is superadmin
    const db = admin.firestore()
    const userDoc = await db.collection("users").doc(decodedToken.uid).get()
    
    if (!userDoc.exists || userDoc.data()?.role !== "superadmin") {
      return NextResponse.json({ error: "Only superadmins can modify system config" }, { status: 403 })
    }

    const body = await request.json()
    const { updates } = body

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid updates" }, { status: 400 })
    }

    // Update system config
    await db.collection("system_config").doc("app_configuration").set(
      {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: decodedToken.uid,
      },
      { merge: true }
    )

    return NextResponse.json({ success: true, message: "System configuration updated" })
  } catch (error: any) {
    console.error("System config update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update system config" },
      { status: error.code === "auth/invalid-id-token" ? 401 : 500 }
    )
  }
}
